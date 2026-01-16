import { NeynarAPIClient, Configuration } from '@neynar/nodejs-sdk';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

const neynarConfig = new Configuration({
  apiKey: process.env.NEYNAR_API_KEY!
});
const neynar = new NeynarAPIClient(neynarConfig);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BOT_FID = parseInt(process.env.APP_FID || '1987078');
const SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID!;

// Persistent storage file (works on Render!)
const REPLIED_CASTS_FILE = path.join(process.cwd(), 'replied_casts.json');

// In-memory cache for quick lookups
const repliedCastsCache = new Map<string, number>();

// Bot personality
const BOT_PERSONALITY = `You are a chill friend on Farcaster. Reply naturally and casually. Keep it SHORT - max 280 characters. No hashtags unless the user uses them first.

BANNED WORDS (never use): fascinating, incredible, amazing, dynamic, evolution, evoke, transcend, interplay, ecosystem, tapestry, intriguing, profound, mundane

Talk like a real person texting a friend. Be helpful but laid-back.`;

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

// Generate reply
async function generateReply(cast: any): Promise<string> {
  const castText = cast.text || '';
  const authorUsername = cast.author?.username || 'unknown';
  
  const { hasImage, imageUrl } = hasImageUrl(castText, cast.embeds);

  // Use GPT-4 Vision for images
  if (hasImage && imageUrl) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: BOT_PERSONALITY
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `@${authorUsername} says: ${castText}`
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        max_tokens: 150,
        temperature: 0.8
      });

      return response.choices[0]?.message?.content?.trim() || "Hey! 🏠";
    } catch (error) {
      console.error('Error with GPT-4 Vision:', error);
    }
  }

  // Use Claude for text
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 150,
      system: BOT_PERSONALITY,
      messages: [
        {
          role: 'user',
          content: `@${authorUsername} says: ${castText}`
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
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: BOT_PERSONALITY },
        { role: 'user', content: `@${authorUsername} says: ${castText}` }
      ],
      max_tokens: 80,
      temperature: 0.8
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
    const notifications = await neynar.fetchAllNotifications({ 
      fid: BOT_FID
    });

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
      
      const trackingKeys = [
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

      // Double-check by fetching the cast and looking for bot replies
      try {
        const conversation = await neynar.lookupCastByHashOrUrl({
          identifier: parentHash,
          type: 'hash'
        });
        
        const directReplies = (conversation.cast as any)?.direct_replies || [];
        const threadReplies = (conversation.cast as any)?.replies?.casts || [];
        const allReplies = [...directReplies, ...threadReplies];
        
        const botAlreadyReplied = allReplies.some((reply: any) => {
          const replyFid = reply.author?.fid || reply.fid;
          return replyFid === BOT_FID;
        });

        if (botAlreadyReplied) {
          console.log(`✓ Found existing bot reply in thread, saving and skipping`);
          trackingKeys.forEach(key => saveRepliedCast(key));
          continue;
        }
      } catch (error) {
        console.error(`⚠️ Error checking replies:`, error);
        // Be conservative - skip if we can't check
        trackingKeys.forEach(key => saveRepliedCast(key));
        continue;
      }

      // Generate and post reply
      try {
        console.log(`💭 Generating reply for ${castHash.slice(0, 10)}...`);
        
        const reply = await generateReply(cast);

        await neynar.publishCast({
          signerUuid: SIGNER_UUID,
          text: reply,
          parent: parentHash
        });

        console.log(`✅ Posted reply: ${reply}`);
        
        // Save all tracking keys
        trackingKeys.forEach(key => saveRepliedCast(key));
        repliedCount++;

      } catch (error) {
        console.error(`❌ Error replying:`, error);
        // Mark as attempted even on error
        trackingKeys.forEach(key => saveRepliedCast(key));
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
