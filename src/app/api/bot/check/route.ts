import { NextRequest, NextResponse } from 'next/server';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { promises as fs } from 'fs';
import path from 'path';

const neynar = new NeynarAPIClient(process.env.NEYNAR_API_KEY!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BOT_FID = parseInt(process.env.APP_FID || '1987078');
const SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID!;

// Simple, casual bot personality - no fancy words
const BOT_PERSONALITY = `You are a chill friend on Farcaster. Reply naturally and casually. Keep it SHORT - max 280 characters. No hashtags unless the user uses them first.

BANNED WORDS (never use): fascinating, incredible, amazing, dynamic, evolution, evoke, transcend, interplay, ecosystem, tapestry, intriguing, profound, mundane

Talk like a real person texting a friend. Be helpful but laid-back.`;

interface RepliedCast {
  hash: string;
  timestamp: number;
}

let repliedCastsCache: Set<string> | null = null;

async function loadRepliedCasts(): Promise<Set<string>> {
  if (repliedCastsCache) return repliedCastsCache;
  
  try {
    const filePath = path.join('/tmp', 'replied_casts.json');
    const data = await fs.readFile(filePath, 'utf-8');
    const casts: RepliedCast[] = JSON.parse(data);
    repliedCastsCache = new Set(casts.map(c => c.hash));
    return repliedCastsCache;
  } catch (error) {
    repliedCastsCache = new Set();
    return repliedCastsCache;
  }
}

async function saveRepliedCasts(repliedSet: Set<string>): Promise<void> {
  try {
    const filePath = path.join('/tmp', 'replied_casts.json');
    const casts: RepliedCast[] = Array.from(repliedSet).map(hash => ({
      hash,
      timestamp: Date.now()
    }));
    await fs.writeFile(filePath, JSON.stringify(casts, null, 2));
    repliedCastsCache = repliedSet;
  } catch (error) {
    console.error('Error saving replied casts:', error);
  }
}

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

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret if configured
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const repliedSet = await loadRepliedCasts();
    let repliedCount = 0;

    // Fetch notifications
    const notifications = await neynar.fetchAllNotifications(BOT_FID, {
      type: ['mentions', 'replies']
    });

    console.log(`Found ${notifications.notifications.length} notifications`);

    for (const notification of notifications.notifications) {
      if (repliedCount >= 1) break; // Only reply to 1 per run

      const cast = notification.cast;
      if (!cast || repliedSet.has(cast.hash)) {
        continue;
      }

      // Mark as replied BEFORE generating to prevent duplicates
      repliedSet.add(cast.hash);
      await saveRepliedCasts(repliedSet);

      try {
        // Generate reply
        const reply = await generateReply(cast, []);

        // Post reply
        await neynar.publishCast(SIGNER_UUID, reply, {
          replyTo: cast.hash
        });

        console.log(`Posted reply to ${cast.hash}: ${reply}`);
        repliedCount++;

      } catch (error) {
        console.error(`Error replying to ${cast.hash}:`, error);
        // Keep it marked as replied to avoid retry loops
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
