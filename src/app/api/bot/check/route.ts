import { NextRequest, NextResponse } from 'next/server';
import { NeynarAPIClient, Configuration } from '@neynar/nodejs-sdk';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

const neynarConfig = new Configuration({
  apiKey: process.env.NEYNAR_API_KEY!
});
const neynar = new NeynarAPIClient(neynarConfig);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BOT_FID = parseInt(process.env.APP_FID || '1987078');
const SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID!;

// Simple, casual bot personality - no fancy words
const BOT_PERSONALITY = `You are a chill friend on Farcaster. Reply naturally and casually. Keep it SHORT - max 280 characters. No hashtags unless the user uses them first.

BANNED WORDS (never use): fascinating, incredible, amazing, dynamic, evolution, evoke, transcend, interplay, ecosystem, tapestry, intriguing, profound, mundane

Talk like a real person texting a friend. Be helpful but laid-back.`;

function hasImageUrl(text: string, embeds?: any[]): { hasImage: boolean; imageUrl?: string } {
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp)$/i;
  const imageHosts = /imagedelivery\.net|imgur\.com|i\.imgur\.com/i;

  // Check embeds first
  if (embeds && embeds.length > 0) {
    for (const embed of embeds) {
      if (embed.url && (imageExtensions.test(embed.url) || imageHosts.test(embed.url))) {
        return { hasImage: true, imageUrl: embed.url };
      }
    }
  }

  // Check text for URLs
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = text.match(urlRegex) || [];
  for (const url of urls) {
    if (imageExtensions.test(url) || imageHosts.test(url)) {
      return { hasImage: true, imageUrl: url };
    }
  }

  return { hasImage: false };
}

async function generateReply(cast: any, conversationHistory: any[]): Promise<string> {
  const castText = cast.text || '';
  const authorUsername = cast.author?.username || 'unknown';
  
  const { hasImage, imageUrl } = hasImageUrl(castText, cast.embeds);

  // Use GPT-4 Vision for images
  if (hasImage && imageUrl) {
    try {
      const messages: any[] = [
        {
          role: 'system',
          content: BOT_PERSONALITY
        }
      ];

      if (conversationHistory.length > 0) {
        conversationHistory.forEach(msg => {
          messages.push({
            role: msg.role === 'bot' ? 'assistant' : 'user',
            content: msg.content
          });
        });
      }

      messages.push({
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
      });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        max_tokens: 150,
        temperature: 0.8
      });

      return response.choices[0]?.message?.content?.trim() || "Hey! 🏠";
    } catch (error) {
      console.error('Error with GPT-4 Vision:', error);
    }
  }

  // Use Claude for text-only
  try {
    const messages: any[] = [];
    
    if (conversationHistory.length > 0) {
      conversationHistory.forEach(msg => {
        messages.push({
          role: msg.role === 'bot' ? 'assistant' : 'user',
          content: msg.content
        });
      });
    }

    messages.push({
      role: 'user',
      content: `@${authorUsername} says: ${castText}`
    });

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 150,
      system: BOT_PERSONALITY,
      messages
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
    const messages: any[] = [
      { role: 'system', content: BOT_PERSONALITY }
    ];

    if (conversationHistory.length > 0) {
      conversationHistory.forEach(msg => {
        messages.push({
          role: msg.role === 'bot' ? 'assistant' : 'user',
          content: msg.content
        });
      });
    }

    messages.push({
      role: 'user',
      content: `@${authorUsername} says: ${castText}`
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 80,
      temperature: 0.8
    });

    return response.choices[0]?.message?.content?.trim() || "Hey! 🏠";
  } catch (error) {
    console.error('Error with OpenAI fallback:', error);
    return "Hey! 🏠";
  }
}

// In-memory cache to track recently replied casts (per serverless instance)
// This helps prevent duplicate replies within the same instance lifetime
const repliedCastsCache = new Map<string, number>();

// Clean up old entries from cache (older than 24 hours)
function cleanupCache() {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  
  for (const [hash, timestamp] of repliedCastsCache.entries()) {
    if (timestamp < oneDayAgo) {
      repliedCastsCache.delete(hash);
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret if configured
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    cleanupCache();
    let repliedCount = 0;

    // Fetch notifications
    const notifications = await neynar.fetchAllNotifications({ 
      fid: BOT_FID
    });

    console.log(`Found ${notifications.notifications.length} notifications`);

    for (const notification of notifications.notifications) {
      if (repliedCount >= 1) {
        console.log('Already replied to 1 cast in this run, stopping');
        break; // Only reply to 1 per run
      }

      const cast = notification.cast;
      if (!cast || !cast.hash) {
        continue;
      }

      // Check in-memory cache first (fast check)
      if (repliedCastsCache.has(cast.hash)) {
        console.log(`✓ Already replied to ${cast.hash} (in cache), skipping`);
        continue;
      }

      try {
        console.log(`Checking if already replied to ${cast.hash}`);
        
        // Fetch the cast with all replies to check if bot already replied
        const conversation = await neynar.lookupCastByHashOrUrl({
          identifier: cast.hash,
          type: 'hash'
        });
        
        // Check BOTH direct replies and all replies in the thread
        const allReplies = [
          ...((conversation.cast as any)?.direct_replies || []),
          ...((conversation.cast as any)?.replies?.casts || [])
        ];
        
        const botAlreadyReplied = allReplies.some(
          (reply: any) => {
            const replyFid = reply.author?.fid || reply.fid;
            return replyFid === BOT_FID;
          }
        );

        if (botAlreadyReplied) {
          console.log(`✓ Already replied to ${cast.hash}, adding to cache and skipping`);
          repliedCastsCache.set(cast.hash, Date.now());
          continue;
        }
        
        console.log(`No existing reply found for ${cast.hash}, proceeding to reply`);
      } catch (error) {
        console.error(`Error checking replies for ${cast.hash}:`, error);
        // If we can't check reliably, assume we've replied to be safe
        console.log('Skipping cast due to check error (being conservative)');
        repliedCastsCache.set(cast.hash, Date.now());
        continue;
      }

      try {
        console.log(`Generating reply for ${cast.hash}`);
        
        // Generate reply
        const reply = await generateReply(cast, []);

        // Post reply
        await neynar.publishCast({
          signerUuid: SIGNER_UUID,
          text: reply,
          parent: cast.hash
        });

        console.log(`Posted reply to ${cast.hash}: ${reply}`);
        
        // Add to cache after successful reply
        repliedCastsCache.set(cast.hash, Date.now());
        repliedCount++;

      } catch (error) {
        console.error(`Error replying to ${cast.hash}:`, error);
        // Even on error, mark as attempted to avoid retry loops
        repliedCastsCache.set(cast.hash, Date.now());
      }
    }

    return NextResponse.json({
      success: true,
      checked: notifications.notifications.length,
      replied: repliedCount,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Bot check error:', error);
    return NextResponse.json(
      { error: 'Bot check failed', details: error.message },
      { status: 500 }
    );
  }
}
