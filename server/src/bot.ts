import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

const neynar = new NeynarAPIClient(process.env.NEYNAR_API_KEY!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BOT_FID = parseInt(process.env.APP_FID || '1987078');
const SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID!;

// Persistent storage file (works on Render!)
const REPLIED_CASTS_FILE = path.join(process.cwd(), 'replied_casts.json');

// In-memory cache for quick lookups
const repliedCastsCache = new Map<string, number>();
const userProfileCache = new Map<number, { context: string; timestamp: number }>();
const PROFILE_CACHE_TTL = 3600000; // 1 hour

// Bot personality
const BOT_PERSONALITY = `You're homie on Farcaster. Match their vibe - if they're casual, you're casual. If they're serious, be thoughtful. 

CRITICAL RULES:
- Read their message first. Actually respond to what they said
- Keep it under 200 chars unless they wrote something long
- Sound like you're texting, not writing an essay
- No cringe words: fascinating, incredible, amazing, dynamic, evolution, evoke, transcend, interplay, ecosystem, tapestry, intriguing, profound, mundane, delve, leverage, unlock, seamless
- Skip emojis unless they use them. One emoji max if you do
- Don't be overly helpful or cheerful. Just be real
- If they're asking something, answer it directly. No fluff
- If they're sharing, react naturally like you would to a friend's text
- Use lowercase more than uppercase (it's more chill)

Look at their tone and mirror it. Short reply? You go short. Excited? Match that energy (but don't overdo it).`;

// Load replied casts from file
function loadRepliedCasts(): Set<string> {
  try {
    if (fs.existsSync(REPLIED_CASTS_FILE)) {
      const data = fs.readFileSync(REPLIED_CASTS_FILE, 'utf-8');
      const casts = JSON.parse(data);
      
      // Also populate in-memory cache
      casts.forEach((c: any) => {
        repliedCastsCache.set(c.hash, c.timestamp);
      });
      
      return new Set(casts.map((c: any) => c.hash));
    }
  } catch (error) {
    console.error('Error loading replied casts:', error);
  }
  return new Set();
}

// Save replied cast to file
function saveRepliedCast(castHash: string) {
  try {
    let casts: any[] = [];
    
    if (fs.existsSync(REPLIED_CASTS_FILE)) {
      const data = fs.readFileSync(REPLIED_CASTS_FILE, 'utf-8');
      casts = JSON.parse(data);
    }
    
    // Add new cast with timestamp
    casts.push({
      hash: castHash,
      timestamp: Date.now()
    });
    
    // Keep only last 1000 entries
    if (casts.length > 1000) {
      casts = casts.slice(-1000);
    }
    
    fs.writeFileSync(REPLIED_CASTS_FILE, JSON.stringify(casts, null, 2));
    repliedCastsCache.set(castHash, Date.now());
    console.log(`💾 Saved ${castHash} to persistent storage`);
  } catch (error) {
    console.error('Error saving replied cast:', error);
  }
}

// Check if image URL
function hasImageUrl(text: string, embeds?: any[]): { hasImage: boolean; imageUrl?: string } {
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp)$/i;
  const imageHosts = /imagedelivery\.net|imgur\.com|i\.imgur\.com/i;

  if (embeds && embeds.length > 0) {
    for (const embed of embeds) {
      if (embed.url && (imageExtensions.test(embed.url) || imageHosts.test(embed.url))) {
        return { hasImage: true, imageUrl: embed.url };
      }
    }
  }

  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = text.match(urlRegex) || [];
  for (const url of urls) {
    if (imageExtensions.test(url) || imageHosts.test(url)) {
      return { hasImage: true, imageUrl: url };
    }
  }

  return { hasImage: false };
}

// Fetch and analyze user profile
async function getUserContext(authorFid: number, authorUsername: string): Promise<string> {
  try {
    // Check cache first
    const cached = userProfileCache.get(authorFid);
    if (cached && (Date.now() - cached.timestamp) < PROFILE_CACHE_TTL) {
      console.log(`📋 Using cached profile for @${authorUsername}`);
      return cached.context;
    }

    console.log(`🔍 Fetching profile for @${authorUsername}...`);
    
    // Fetch user's profile info
    let profileInfo = '';
    try {
      const userBulk = await neynar.fetchBulkUsers([authorFid]);
      if (userBulk?.users?.[0]) {
        const user = userBulk.users[0];
        const bio = user.profile?.bio?.text || '';
        const followerCount = user.follower_count || 0;
        const isPowerBadge = user.power_badge || false;
        
        if (bio) profileInfo += `\n- Bio: "${bio.slice(0, 100)}${bio.length > 100 ? '...' : ''}"`;
        if (isPowerBadge) profileInfo += '\n- Has power badge (active community member)';
        if (followerCount > 1000) profileInfo += `\n- Well-known (${followerCount} followers)`;
      }
    } catch (err) {
      console.log('Could not fetch profile info');
    }
    
    // Fetch user's recent casts to understand their style and interests
    const userCasts = await neynar.fetchFeed('filter', {
      filterType: 'fids',
      fids: [authorFid],
      limit: 10
    });

    if (!userCasts || !userCasts.casts || userCasts.casts.length === 0) {
      return '';
    }

    // Analyze their recent casts
    const recentTexts = userCasts.casts.slice(0, 5).map((c: any) => c.text).filter(Boolean);
    const topics = new Set<string>();
    const style = {
      usesEmojis: false,
      avgLength: 0,
      tone: 'casual'
    };

    let totalLength = 0;
    recentTexts.forEach((text: string) => {
      totalLength += text.length;
      if (/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}]/u.test(text)) style.usesEmojis = true;
      
      // Extract hashtags
      const hashtags = text.match(/#\w+/g) || [];
      hashtags.forEach(tag => topics.add(tag.toLowerCase().slice(1)));
      
      // Extract potential topics (key terms)
      const words = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
      const topicWords = [
        'crypto', 'bitcoin', 'eth', 'ethereum', 'solana', 'base',
        'nft', 'nfts', 'art', 'artist', 'design', 'creative',
        'tech', 'developer', 'coding', 'programming', 'software',
        'ai', 'ml', 'chatgpt', 'claude', 'llm',
        'web3', 'defi', 'degen', 'meme', 'onchain',
        'farcaster', 'warpcast', 'lens', 'social',
        'building', 'shipping', 'launching', 'startup', 'founder',
        'music', 'gaming', 'sports', 'fitness', 'food',
        'writing', 'blog', 'newsletter', 'podcast'
      ];
      words.forEach(word => {
        if (topicWords.includes(word)) topics.add(word);
      });
    });

    style.avgLength = Math.round(totalLength / recentTexts.length);

    let context = `\n\nCONTEXT about @${authorUsername}:`;
    
    // Add profile info first
    context += profileInfo;
    
    // Add interests
    if (topics.size > 0) {
      const topicList = Array.from(topics).slice(0, 8).join(', ');
      context += `\n- Interests: ${topicList}`;
    }
    
    // Add posting style
    if (style.avgLength > 200) {
      context += `\n- Posts detailed, thoughtful content`;
    } else if (style.avgLength < 100) {
      context += `\n- Keeps it short and punchy`;
    }
    if (style.usesEmojis) {
      context += `\n- Uses emojis in posts`;
    }

    // Cache the result
    userProfileCache.set(authorFid, {
      context,
      timestamp: Date.now()
    });
    console.log(`✓ Cached profile for @${authorUsername}`);

    return context;
  } catch (error) {
    console.error('Error fetching user context:', error);
    return '';
  }
}

// Generate reply
async function generateReply(cast: any): Promise<string> {
  const castText = cast.text || '';
  const authorUsername = cast.author?.username || 'unknown';
  const authorFid = cast.author?.fid || cast.author?.user?.fid;
  
  // Fetch user context to personalize the reply
  const userContext = await getUserContext(authorFid, authorUsername);
  
  // Get conversation thread context
  let threadContext = '';
  try {
    const parentHash = cast.parent_hash || cast.parent_url;
    if (parentHash) {
      const conversation = await neynar.lookUpCastByHash(parentHash);
      const parentCast = (conversation as any)?.cast;
      
      if (parentCast && parentCast.text) {
        const parentAuthor = parentCast.author?.username || 'someone';
        threadContext = `\n\nTHREAD CONTEXT:\nThis is a reply to @${parentAuthor}: "${parentCast.text.slice(0, 150)}${parentCast.text.length > 150 ? '...' : ''}"`;
      }
    }
  } catch (err) {
    // Thread context is optional
  }
  
  // Add channel context if available
  let channelContext = '';
  if (cast.parent_url && cast.parent_url.includes('/channels/')) {
    const channelId = cast.parent_url.split('/channels/')[1]?.split('/')[0];
    if (channelId) {
      channelContext = `\n\nCHANNEL: /${channelId}`;
    }
  }
  
  const { hasImage, imageUrl } = hasImageUrl(castText, cast.embeds);

  // Use GPT-4 Vision for images
  if (hasImage && imageUrl) {
    try {
      const systemPrompt = BOT_PERSONALITY + userContext + threadContext + channelContext;
      
      // Analyze the message and image together
      const userMessage = castText 
        ? `@${authorUsername} posted with text: "${castText}"\n\nLook at their image and respond naturally. What would you say to a friend who just sent you this?`
        : `@${authorUsername} posted an image with no text.\n\nCheck it out and react naturally. What do you notice? What would you say?`;
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: userMessage
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        max_tokens: 150,
        temperature: 0.9
      });

      return response.choices[0]?.message?.content?.trim() || "Hey! 🏠";
    } catch (error) {
      console.error('Error with GPT-4 Vision:', error);
    }
  }

  // Use Claude for text
  try {
    const systemPrompt = BOT_PERSONALITY + userContext + threadContext + channelContext;
    
    // Create more natural user message
    let userMessage = `Message from @${authorUsername}: "${castText}"`;
    if (castText.length < 50) {
      userMessage += `\n\n(They kept it short. Match their energy - keep your reply brief and natural.)`;
    } else if (castText.includes('?')) {
      userMessage += `\n\n(They asked a question. Answer it directly, no need for extra stuff.)`;
    }
    
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 150,
      temperature: 0.9,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage
        }
      ]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text.trim();
    }
  } catch (error: any) {
    console.error('Error with Claude:', error?.message);
  }

  // Fallback to OpenAI
  try {
    const systemPrompt = BOT_PERSONALITY + userContext + threadContext + channelContext;
    
    // More natural formatting
    let userMessage = `@${authorUsername}: "${castText}"`;
    if (castText.length < 50) {
      userMessage += `\n\nKeep it short like they did.`;
    }
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 80,
      temperature: 0.9
    });

    return response.choices[0]?.message?.content?.trim() || "Hey! 🏠";
  } catch (error) {
    console.error('Error with OpenAI fallback:', error);
    return "Hey! 🏠";
  }
}

// Main function to check for mentions
export async function checkForMentions() {
  try {
    // Load previously replied casts
    const repliedCasts = loadRepliedCasts();
    console.log(`📂 Loaded ${repliedCasts.size} previously replied casts`);
    
    let repliedCount = 0;

    // Fetch notifications
    const notifications = await neynar.fetchAllNotifications(BOT_FID);

    console.log(`📬 Found ${notifications.notifications.length} notifications`);

    for (const notification of notifications.notifications) {
      if (repliedCount >= 1) {
        console.log('✋ Already replied to 1 cast in this run, stopping');
        break;
      }

      const cast = notification.cast;
      if (!cast || !cast.hash) {
        continue;
      }

      // Track multiple hashes to prevent duplicates
      const castHash = cast.hash;
      const parentHash = cast.parent_hash || cast.parent_url || cast.hash;
      const rootParentHash = cast.root_parent_url || parentHash;
      
      // IMPORTANT: Include notification ID to prevent processing same notification twice
      const trackingKeys = [
        `notification_${(notification as any).id || castHash}`,
        `cast_${castHash}`,
        `parent_${parentHash}`,
        `root_${rootParentHash}`
      ];
      
      console.log(`🔍 Checking cast=${castHash.slice(0, 10)}..., parent=${parentHash.slice(0, 10)}...`);

      // Check if already replied to any of these keys
      let alreadyReplied = false;
      for (const key of trackingKeys) {
        if (repliedCasts.has(key) || repliedCastsCache.has(key)) {
          console.log(`✓ Already replied to ${key}, skipping`);
          alreadyReplied = true;
          break;
        }
      }
      
      if (alreadyReplied) {
        continue;
      }

      // Double-check by fetching the MENTION cast (not parent) and looking for bot replies
      try {
        const mentionCast = await neynar.lookUpCastByHash(castHash);
        
        const directReplies = (mentionCast as any)?.direct_replies || [];
        const threadReplies = (mentionCast as any)?.replies?.casts || [];
        const allReplies = [...directReplies, ...threadReplies];
        
        const botAlreadyReplied = allReplies.some((reply: any) => {
          const replyFid = reply.author?.fid || reply.fid;
          return replyFid === BOT_FID;
        });

        if (botAlreadyReplied) {
          console.log(`✓ Found existing bot reply to this mention cast, saving and skipping`);
          trackingKeys.forEach(key => saveRepliedCast(key));
          continue;
        }
      } catch (error) {
        console.error(`⚠️ Error checking replies for mention cast:`, error);
        // Continue - don't skip on error, let the tracking keys handle duplicates
      }

      // Generate and post reply
      try {
        // CRITICAL: Mark as replied BEFORE generating to prevent race conditions
        trackingKeys.forEach(key => saveRepliedCast(key));
        console.log(`🔒 Locked reply for cast ${castHash.slice(0, 10)}...`);
        
        console.log(`💭 Generating reply for cast ${castHash.slice(0, 10)}...`);
        const reply = await generateReply(cast);

        // Reply to the mention cast (castHash), not the parent
        await neynar.publishCast(SIGNER_UUID, reply, { replyTo: castHash });

        console.log(`✅ Posted reply to ${castHash.slice(0, 10)}: ${reply}`);
        repliedCount++;

      } catch (error) {
        console.error(`❌ Error replying:`, error);
        // Already marked as attempted above
      }
    }

    return {
      success: true,
      checked: notifications.notifications.length,
      replied: repliedCount,
      timestamp: new Date().toISOString()
    };

  } catch (error: any) {
    console.error('💥 Bot check error:', error);
    throw error;
  }
}
