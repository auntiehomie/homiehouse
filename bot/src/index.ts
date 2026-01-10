import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getMemory } from './memory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const APP_FID = process.env.APP_FID || '1987078';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '60000');
const BOT_USERNAME = process.env.BOT_USERNAME || 'homiehouse';

if (!NEYNAR_API_KEY || !NEYNAR_SIGNER_UUID || !ANTHROPIC_API_KEY) {
  throw new Error('Missing required env vars: NEYNAR_API_KEY, NEYNAR_SIGNER_UUID, ANTHROPIC_API_KEY');
}

const neynar = new NeynarAPIClient({ apiKey: NEYNAR_API_KEY });
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
let memory: Awaited<ReturnType<typeof getMemory>>;

const REPLIED_CASTS_FILE = path.join(__dirname, '..', 'replied_casts.json');

// System prompt for the bot
const BOT_PERSONALITY = `You are @homiehouse, a chill friend. Talk super casually.

Your vibe:
- Talk like you're texting a buddy
- NO fancy words - banned: fascinating, incredible, dynamic, evolution, intersection, evoke, transcend, interplay, sustenance
- Just say what you see in plain English
- ABSOLUTE MAX: 280 characters (shorter is better)
- Use emojis naturally (🏠 is your signature)
- Be real - not everything is amazing
- No hype, no essay writing
- One SHORT observation

How to respond:
- Basic words only: cool, nice, good, looks, seems, pretty
- Like texting: "that looks good" or "nice shot" or "interesting"
- ONE or TWO short sentences MAX
- Be honest - can be neutral
- Don't write paragraphs
- Just make ONE simple point and STOP IMMEDIATELY`;

interface RepliedCast {
  hash: string;
  timestamp: number;
}

// Load replied casts from file
async function loadRepliedCasts(): Promise<Set<string>> {
  try {
    const data = await fs.readFile(REPLIED_CASTS_FILE, 'utf-8');
    const casts: RepliedCast[] = JSON.parse(data);
    // Filter out old replies (older than 7 days)
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentCasts = casts.filter(c => c.timestamp > weekAgo);
    await saveRepliedCasts(recentCasts);
    return new Set(recentCasts.map(c => c.hash));
  } catch {
    return new Set();
  }
}

// Save replied casts to file
async function saveRepliedCasts(casts: RepliedCast[]): Promise<void> {
  await fs.writeFile(REPLIED_CASTS_FILE, JSON.stringify(casts, null, 2));
}

// Add cast to replied list
async function markAsReplied(hash: string, repliedSet: Set<string>): Promise<void> {
  repliedSet.add(hash);
  const casts: RepliedCast[] = Array.from(repliedSet).map(h => ({
    hash: h,
    timestamp: Date.now(),
  }));
  // Save immediately to prevent duplicates if bot restarts
  await saveRepliedCasts(casts);
  console.log(`   ✅ Marked ${hash} as replied and saved to file`);
}

// Get conversation context for a cast
async function getConversationContext(castHash: string): Promise<string> {
  try {
    const response = await neynar.lookupCastConversation({
      identifier: castHash,
      type: 'hash' as any,
      replyDepth: 5,
    });
    const cast = response.conversation.cast;
    
    // Build context string
    let context = '';
    
    if (cast.parent_hash) {
      // Try to get parent cast details
      try {
        const parentResponse = await fetch(
          `https://api.neynar.com/v2/farcaster/cast?identifier=${cast.parent_hash}&type=hash`,
          {
            headers: {
              accept: 'application/json',
              api_key: NEYNAR_API_KEY!,
            },
          }
        );
        if (parentResponse.ok) {
          const parentData = await parentResponse.json();
          context += `Original cast by @${parentData.cast.author.username}:\n`;
          context += `"${parentData.cast.text}"\n\n`;
        }
      } catch {
        // Parent fetch failed, continue without it
      }
    }
    
    context += `Current cast by @${cast.author.username}:\n`;
    context += `"${cast.text}"\n`;
    
    // Add recent replies for context
    if (cast.direct_replies && cast.direct_replies.length > 0) {
      context += `\nRecent replies:\n`;
      cast.direct_replies.slice(0, 3).forEach((reply: any) => {
        context += `- @${reply.author.username}: "${reply.text}"\n`;
      });
    }
    
    return context;
  } catch (error) {
    console.error('Error getting conversation context:', error);
    return '';
  }
}

// Generate reply using Claude with memory
async function generateReply(
  castContext: string,
  mentionText: string,
  userFid: number,
  username: string,
  imageUrls?: string[]
): Promise<string> {
  try {
    // Get past interactions with this user
    const userHistory = memory.getUserHistory(userFid, 3);
    const userProfile = memory.getUserProfile(userFid);
    
    let memoryContext = '';
    if (userHistory.length > 0) {
      memoryContext = `\n\n**Past conversations with @${username}:**\n`;
      userHistory.reverse().forEach((conv, idx) => {
        memoryContext += `${idx + 1}. Them: "${conv.user_message}" → You: "${conv.bot_reply}"\n`;
      });
      
      if (userProfile && userProfile.interaction_count > 1) {
        memoryContext += `\n(You've talked ${userProfile.interaction_count} times before)`;
      }
    }

    // If there are images, use GPT-4 Vision instead
    if (imageUrls && imageUrls.length > 0) {
      console.log(`🖼️ Analyzing ${imageUrls.length} image(s) with GPT-4 Vision...`);
      
      const imageContent: any[] = imageUrls.map(url => ({
        type: 'image_url',
        image_url: { url, detail: 'auto' }
      }));

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 80,
        messages: [
          {
            role: 'system',
            content: BOT_PERSONALITY + '\n\nIMPORTANT: Never end with a question. Provide thoughtful insights, not surface reactions.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Look at the image. Respond in ONE SHORT sentence (max 280 chars). Use simple words. Be casual. NO essay. Stop after one thought.\n\nTheir message: "${mentionText}"`
              },
              ...imageContent
            ]
          }
        ]
      });

      const reply = completion.choices[0]?.message?.content || '';
      console.log('✅ Generated reply with GPT-4 Vision');
      return reply.trim();
    }

    // No images, use Claude for text
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 80,
      system: BOT_PERSONALITY + '\n\nCRITICAL: Max 280 characters. ONE SHORT sentence. Basic words. Stop immediately.',
      messages: [
        {
          role: 'user',
          content: `ONE SHORT sentence (max 280 chars). Simple words. Casual. NO essay. Stop after one thought.\n\nTheir message: "${mentionText}"`,
        },
      ],
    });

    const textContent = message.content.find((block) => block.type === 'text');
    return textContent && 'text' in textContent ? textContent.text.trim() : '';
  } catch (error: any) {
    console.error('Error generating reply with Claude:', error.message || error);
    console.log('   Falling back to OpenAI...');
    
    // Fallback to OpenAI
    try {
      
      const userHistory = memory.getUserHistory(userFid, 3);
      let memoryContext = '';
      if (userHistory.length > 0) {
        memoryContext = `\n\nPast conversations with @${username}:\n`;
        userHistory.reverse().forEach((conv, idx) => {
          memoryContext += `${idx + 1}. Them: "${conv.user_message}" → You: "${conv.bot_reply}"\n`;
        });
      }
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 80,
        messages: [
          { role: 'system', content: BOT_PERSONALITY + '\n\nCRITICAL: Max 280 characters. ONE SHORT sentence. Stop immediately.' },
          { 
            role: 'user', 
            content: `ONE SHORT sentence (max 280 chars). Simple words. NO essay. Stop.\n\nTheir message: "${mentionText}"` 
          },
        ],
      });
      
      return completion.choices[0]?.message?.content?.trim() || 'Thanks for the mention! 🏠';
    } catch {
      return 'Thanks for the mention! 🏠';
    }
  }
}

// Post reply to Farcaster
async function postReply(text: string, parentHash: string): Promise<boolean> {
  try {
    const result = await neynar.publishCast({
      signerUuid: NEYNAR_SIGNER_UUID!,
      text,
      parent: parentHash,
    });
    console.log(`✅ Posted reply to ${parentHash}: "${text}"`);
    console.log(`   Cast result:`, result);
    return true;
  } catch (error: any) {
    console.error('❌ Error posting reply:', error.response?.data || error.message || error);
    return false;
  }
}

// Check for notifications and respond
async function checkNotifications(repliedCasts: Set<string>): Promise<void> {
  try {
    const notifications = await neynar.fetchAllNotifications({
      fid: parseInt(APP_FID),
      type: ['mentions', 'replies'],
    });

    if (!notifications.notifications || notifications.notifications.length === 0) {
      console.log(`📭 No notifications found`);
      return;
    }

    console.log(`📬 Found ${notifications.notifications.length} notifications`);
    
    // Debug: Show notification details
    console.log(`   Checking for new mentions...`);
    let newCount = 0;
    let repliedThisCycle = 0;
    const MAX_REPLIES_PER_CYCLE = 1; // Only reply to 1 cast per polling cycle

    for (const notification of notifications.notifications) {
      // Stop if we've already replied to one cast this cycle
      if (repliedThisCycle >= MAX_REPLIES_PER_CYCLE) {
        console.log(`   ⏸️  Already replied to ${repliedThisCycle} cast(s) this cycle, skipping rest`);
        break;
      }

      // @ts-ignore - types are incomplete
      const cast = notification.cast;
      
      // Skip if no cast or already replied
      if (!cast) {
        continue;
      }
      
      if (repliedCasts.has(cast.hash)) {
        console.log(`   ⏭️  Already replied to ${cast.hash} previously, skipping`);
        continue;
      }

      newCount++;
      const author = cast.author;
      
      // Don't reply to our own casts
      if (author.fid === parseInt(APP_FID)) {
        continue;
      }

      console.log(`\n💬 New notification from @${author.username}:`);
      console.log(`   "${cast.text}"`);

      // Get conversation context
      const context = await getConversationContext(cast.hash);
      
      // Extract image URLs from cast embeds
      const imageUrls: string[] = [];
      if (cast.embeds && cast.embeds.length > 0) {
        for (const embed of cast.embeds) {
          const embedUrl = (embed as any).url;
          if (embedUrl && (
            embedUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ||
            embedUrl.includes('imagedelivery.net') ||
            embedUrl.includes('imgur.com') ||
            embedUrl.includes('i.imgur.com')
          )) {
            imageUrls.push(embedUrl);
          }
        }
      }
      
      if (imageUrls.length > 0) {
        console.log(`   📸 Found ${imageUrls.length} image(s) in cast`);
      }
      
      // Generate reply with memory
      const reply = await generateReply(context, cast.text, author.fid, author.username, imageUrls);
      
      if (!reply) {
        console.log('   ⚠️ Failed to generate reply, skipping');
        continue;
      }

      console.log(`   🤖 Generated reply: "${reply}"`);

      // Mark as replied BEFORE posting to prevent duplicates
      await markAsReplied(cast.hash, repliedCasts);

      // Post reply
      const success = await postReply(reply, cast.hash);
      
      if (success) {
        repliedThisCycle++;
        // Store in memory
        await memory.storeConversation(
          author.fid,
          author.username,
          cast.hash,
          cast.text,
          reply
        );
        console.log(`   💾 Saved to memory`);
        
        // IMPORTANT: Stop immediately after one successful reply
        console.log(`   ✅ Successfully replied. Stopping to prevent duplicates.`);
        break;
      }

      // Rate limit: wait 2 seconds between replies
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    if (newCount === 0) {
      console.log(`   All notifications already processed`);
    }
  } catch (error) {
    console.error('Error checking notifications:', error);
  }
}

// Main bot loop
async function main() {
  console.log(`🏠 Homiehouse Bot starting...`);
  console.log(`   Bot: @${BOT_USERNAME} (FID: ${APP_FID})`);
  console.log(`   Poll interval: ${POLL_INTERVAL}ms`);
  console.log(`   Memory: Enabled ✅`);
  
  // Initialize memory
  memory = await getMemory();
  const stats = memory.getStats();
  console.log(`   📊 Memory: ${stats.totalConversations} conversations with ${stats.uniqueUsers} users`);
  console.log(`   Monitoring for mentions and replies...\n`);

  const repliedCasts = await loadRepliedCasts();
  console.log(`📝 Loaded ${repliedCasts.size} previously replied casts\n`);

  // Check notifications immediately
  await checkNotifications(repliedCasts);

  // Then check periodically
  setInterval(async () => {
    await checkNotifications(repliedCasts);
  }, POLL_INTERVAL);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
