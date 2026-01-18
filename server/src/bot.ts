import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BotReplyService } from './db';

const neynar = new NeynarAPIClient(process.env.NEYNAR_API_KEY!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const BOT_FID = parseInt(process.env.APP_FID || '1987078');
const SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID!;

// In-memory cache for quick lookups during a single run
const repliedCastsCache = new Set<string>();
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

// Check if image URL
function hasImageUrl(text: string, embeds?: any[]): { hasImage: boolean; imageUrl?: string } {
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i;
  const imageHosts = /imagedelivery\.net|imgur\.com|i\.imgur\.com|pbs\.twimg\.com|media\.giphy\.com|cdn\.discordapp\.com|raw\.githubusercontent\.com/i;

  if (embeds && embeds.length > 0) {
    for (const embed of embeds) {
      if (embed.url && (imageExtensions.test(embed.url) || imageHosts.test(embed.url))) {
        return { hasImage: true, imageUrl: embed.url };
      }
      // Check for Warpcast image embeds
      if (embed.metadata?.image || embed.metadata?.content_type?.includes('image')) {
        return { hasImage: true, imageUrl: embed.url || embed.metadata?.image };
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

// Extract external links from cast
function getExternalLinks(text: string, embeds?: any[]): string[] {
  const links: string[] = [];
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i;
  
  // Get links from embeds first
  if (embeds && embeds.length > 0) {
    for (const embed of embeds) {
      if (embed.url && !imageExtensions.test(embed.url)) {
        links.push(embed.url);
      }
    }
  }
  
  // Get links from text
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = text.match(urlRegex) || [];
  for (const url of urls) {
    if (!imageExtensions.test(url) && !links.includes(url)) {
      links.push(url);
    }
  }
  
  return links.slice(0, 2); // Limit to 2 links to avoid slowdown
}

// Fetch content from external link
async function fetchLinkContent(url: string): Promise<string | null> {
  try {
    console.log(`🔗 Fetching content from ${url.slice(0, 50)}...`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HomieHouseBot/1.0)'
      },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    if (!response.ok) return null;
    
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('text/html')) return null;
    
    const html = await response.text();
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                     html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].trim() : '';
    
    if (title || description) {
      return `Link content: "${title}"${description ? ` - ${description.slice(0, 150)}` : ''}`;
    }
    
    return null;
  } catch (error) {
    console.log(`⚠️ Could not fetch link: ${error}`);
    return null;
  }
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
  
  // Fetch external link content if present
  let linkContext = '';
  const externalLinks = getExternalLinks(castText, cast.embeds);
  if (externalLinks.length > 0) {
    console.log(`🔗 Found ${externalLinks.length} external link(s)`);
    const linkPromises = externalLinks.map(url => fetchLinkContent(url));
    const linkResults = await Promise.all(linkPromises);
    const validLinks = linkResults.filter(Boolean);
    if (validLinks.length > 0) {
      linkContext = `\n\nLINKED CONTENT:\n${validLinks.join('\n')}`;
      console.log(`✓ Fetched ${validLinks.length} link preview(s)`);
    }
  }
  
  const { hasImage, imageUrl } = hasImageUrl(castText, cast.embeds);

  // Use GPT-4 Vision for images
  if (hasImage && imageUrl) {
    try {
      const systemPrompt = BOT_PERSONALITY + userContext + threadContext + channelContext + linkContext;
      
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

  // Use Gemini with Google Search for external links (better web context)
  if (externalLinks.length > 0) {
    try {
      console.log('🌐 Using Gemini with Google Search for external links...');
      const model = gemini.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp',
        systemInstruction: BOT_PERSONALITY + userContext + threadContext + channelContext
      });
      
      const userMessage = castText 
        ? `@${authorUsername} shared: "${castText}"\n\nLinks: ${externalLinks.join(', ')}\n\nLook up these links and respond naturally based on what you find. What would you say?`
        : `@${authorUsername} shared these links: ${externalLinks.join(', ')}\n\nLook them up and respond naturally.`;
      
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 150,
        }
      });
      
      const response = result.response;
      const text = response.text();
      if (text) {
        console.log('✓ Gemini response generated');
        return text.trim();
      }
    } catch (error: any) {
      console.error('Error with Gemini:', error?.message);
      // Fall through to Claude
    }
  }

  // Use Claude for text
  try {
    const systemPrompt = BOT_PERSONALITY + userContext + threadContext + channelContext + linkContext;
    
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
    console.log(`🔍 Starting mention check...`);
    
    let repliedCount = 0;
    let skippedAlreadyReplied = 0;

    // Fetch notifications
    const notifications = await neynar.fetchAllNotifications(BOT_FID);

    console.log(`📬 Found ${notifications.notifications.length} total notifications`);

    for (const notification of notifications.notifications) {
      if (repliedCount >= 1) {
        console.log('✋ Already replied to 1 cast in this run, stopping');
        break;
      }

      const cast = notification.cast;
      if (!cast || !cast.hash) {
        continue;
      }

      const castHash = cast.hash;
      
      console.log(`🔍 Checking mention cast: ${castHash.slice(0, 10)}...`);

      // Check in-memory cache first (for this run)
      if (repliedCastsCache.has(castHash)) {
        console.log(`✓ Already replied in this run, skipping`);
        skippedAlreadyReplied++;
        continue;
      }

      // Check database if bot has already replied to this cast
      const hasReplied = await BotReplyService.hasRepliedTo(castHash);
      if (hasReplied) {
        console.log(`✓ Already replied to ${castHash.slice(0, 10)} (found in DB), skipping`);
        repliedCastsCache.add(castHash);
        skippedAlreadyReplied++;
        continue;
      }

      // Double-check by fetching the MENTION cast and looking for bot replies
      try {
        console.log(`🔎 Double-checking cast ${castHash.slice(0, 10)}... for existing replies`);
        const mentionCast = await neynar.lookUpCastByHash(castHash);
        
        const directReplies = (mentionCast as any)?.direct_replies || [];
        const threadReplies = (mentionCast as any)?.replies?.casts || [];
        const allReplies = [...directReplies, ...threadReplies];
        
        const botAlreadyReplied = allReplies.some((reply: any) => {
          const replyFid = reply.author?.fid || reply.fid;
          return replyFid === BOT_FID;
        });

        if (botAlreadyReplied) {
          console.log(`✓ Found existing bot reply via API, recording in DB`);
          await BotReplyService.recordReply(castHash, 'existing', 'mention', 'Found existing reply');
          repliedCastsCache.add(castHash);
          skippedAlreadyReplied++;
          continue;
        }
      } catch (error) {
        console.error(`⚠️ Error checking replies for mention cast:`, error);
        // Continue - don't skip on error, let the database handle duplicates
      }

      // Generate and post reply
      try {
        console.log(`💭 Generating reply for cast ${castHash.slice(0, 10)}...`);
        
        // 🔒 LOCK THIS CAST FIRST by recording intent to reply
        // This prevents duplicate replies if the bot runs again during posting
        const lockAcquired = await BotReplyService.recordReply(castHash, 'pending', 'mention', 'Reply in progress...');
        
        if (!lockAcquired) {
          console.log(`🔒 Lock failed for ${castHash.slice(0, 10)} - another instance is handling this cast`);
          repliedCastsCache.add(castHash);
          skippedAlreadyReplied++;
          continue;
        }
        
        repliedCastsCache.add(castHash);
        
        const reply = await generateReply(cast);

        // Reply to the mention cast (castHash)
        const replyResult = await neynar.publishCast(SIGNER_UUID, reply, { replyTo: castHash });
        const replyHash = replyResult?.hash || castHash;

        console.log(`✅ Posted reply to ${castHash.slice(0, 10)}: ${reply.slice(0, 50)}...`);
        
        // Update the database record with actual reply details
        await BotReplyService.updateReply(castHash, replyHash, reply.slice(0, 280));
        
        repliedCount++;

      } catch (error) {
        console.error(`❌ Error replying:`, error);
        // If posting failed, we still keep the lock to prevent retry spam
      }
    }

    console.log(`\n📊 Summary: Checked ${notifications.notifications.length} notifications, skipped ${skippedAlreadyReplied} already replied, posted ${repliedCount} new replies\n`);

    return {
      success: true,
      checked: notifications.notifications.length,
      skipped_already_replied: skippedAlreadyReplied,
      replied: repliedCount,
      timestamp: new Date().toISOString()
    };

  } catch (error: any) {
    console.error('💥 Bot check error:', error);
    throw error;
  }
}
