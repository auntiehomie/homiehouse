import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getMemory } from './memory.js';
import { CuratedListService, BotConversationService } from './curated-lists.js';

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

// Search for similar casts to build context
async function searchSimilarCasts(castText: string, channelId?: string): Promise<string> {
  try {
    // Extract key topics from the cast
    const keywords = extractKeywords(castText);
    if (keywords.length === 0) return '';

    console.log(`   🔍 Searching for similar casts about: ${keywords.slice(0, 3).join(', ')}`);

    // Search for casts with similar content
    const searchQuery = keywords.slice(0, 3).join(' '); // Use top 3 keywords
    const searchResponse: any = await neynar.searchCasts({
      q: searchQuery,
      limit: 10,
    });

    if (!searchResponse.casts || searchResponse.casts.length === 0) {
      console.log(`   📭 No similar casts found`);
      return '';
    }

    // Filter for relevant, engaging casts
    const relevantCasts = searchResponse.casts
      .filter((c: any) => {
        // Skip if it's too short or too old
        const hoursOld = (Date.now() - new Date(c.timestamp).getTime()) / (1000 * 60 * 60);
        return c.text.length > 50 && hoursOld < 48; // Last 48 hours, minimum length
      })
      .slice(0, 5); // Top 5 most relevant

    if (relevantCasts.length === 0) {
      console.log(`   📭 No recent relevant casts found`);
      return '';
    }

    console.log(`   ✅ Found ${relevantCasts.length} similar casts for context`);

    let similarContext = '\n\n**Related discussions on Farcaster:**\n';
    relevantCasts.forEach((cast: any, idx: number) => {
      const preview = cast.text.slice(0, 120).replace(/\n/g, ' ');
      const engagement = cast.reactions.likes_count + cast.replies.count;
      similarContext += `${idx + 1}. @${cast.author.username}: "${preview}..." (${engagement} engagement)\n`;
    });

    return similarContext;
  } catch (error) {
    console.error('Error searching similar casts:', error);
    return '';
  }
}

// Extract keywords from text for search
function extractKeywords(text: string): string[] {
  // Remove URLs, mentions, and common words
  const cleanText = text
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
    .replace(/@\w+/g, '') // Remove mentions
    .replace(/[^\w\s]/g, ' '); // Remove punctuation

  // Common stop words to filter out
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
    'it', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has',
    'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can',
    'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they',
    'what', 'which', 'who', 'when', 'where', 'why', 'how', 'just', 'im', 'its'
  ]);

  // Split into words and filter
  const words = cleanText
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));

  // Count word frequency
  const wordCount = new Map<string, number>();
  words.forEach(word => {
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
  });

  // Return top keywords by frequency
  return Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

// Detect if message is requesting curation
function detectCurationIntent(text: string): boolean {
  const curationKeywords = [
    /curate\s+this/i,
    /add\s+this\s+to/i,
    /save\s+this\s+to/i,
    /add\s+to\s+(my\s+)?list/i,
    /save\s+to\s+(my\s+)?list/i,
  ];
  return curationKeywords.some(pattern => pattern.test(text));
}

// Handle curation conversation flow
async function handleCurationRequest(
  cast: any,
  author: any,
  repliedCasts: Set<string>
): Promise<{ reply: string; shouldContinue: boolean }> {
  try {
    console.log(`   🎯 Detected curation intent`);
    
    // Check if this is a continuation of an existing conversation
    const existingConv = await BotConversationService.getActiveConversation(
      author.fid,
      'curation'
    );
    
    if (existingConv) {
      console.log(`   💬 Continuing curation conversation (ID: ${existingConv.id})`);
      
      // User is responding with a list name
      const listName = cast.text
        .replace(/@\w+/g, '') // Remove mentions
        .trim();
      
      console.log(`   📝 User specified list: "${listName}"`);
      
      // Get the original cast details from conversation context
      const contextData = existingConv.context_data;
      const originalCastHash = contextData?.cast_hash;
      
      if (!originalCastHash || !existingConv.id) {
        if (existingConv.id) {
          await BotConversationService.endConversation(existingConv.id);
        }
        return {
          reply: "oops, lost track of which cast we were talking about 😅 try again?",
          shouldContinue: true
        };
      }
      
      // Find or create the list
      let list = await CuratedListService.getListByName(author.fid, listName);
      
      if (!list) {
        console.log(`   ✨ Creating new list: "${listName}"`);
        const createResult = await CuratedListService.createList(
          author.fid,
          listName,
          `Created via @${BOT_USERNAME}`
        );
        
        if (!createResult.ok || !existingConv.id) {
          if (existingConv.id) {
            await BotConversationService.endConversation(existingConv.id);
          }
          return {
            reply: `couldn't create that list: ${createResult.error} 😕`,
            shouldContinue: true
          };
        }
        list = createResult.data;
      }
      
      console.log(`   📋 Adding cast to list: "${list.list_name}" (ID: ${list.id})`);
      
      // Add the cast to the list
      const addResult = await CuratedListService.addCastToList(
        list.id!,
        originalCastHash,
        author.fid,
        {
          author_fid: contextData?.cast_author_fid,
          text: contextData?.cast_text,
          timestamp: contextData?.cast_timestamp
        }
      );
      
      // End the conversation
      if (existingConv.id) {
        await BotConversationService.endConversation(existingConv.id);
      }
      
      if (!addResult.ok) {
        if (addResult.error === 'Cast already in this list') {
          return {
            reply: `that cast is already in "${list.list_name}" 👍`,
            shouldContinue: true
          };
        }
        return {
          reply: `couldn't add it: ${addResult.error} 😕`,
          shouldContinue: true
        };
      }
      
      console.log(`   ✅ Successfully added cast to list`);
      return {
        reply: `added to "${list.list_name}" 🏠✨`,
        shouldContinue: true
      };
      
    } else {
      console.log(`   🆕 Starting new curation conversation`);
      
      // Get the parent cast (the one they want to curate)
      let parentCastHash = cast.parent_hash;
      let parentCastData: any = null;
      
      // If they mentioned us in a cast without a parent, they might be referring to their own cast
      if (!parentCastHash) {
        console.log(`   ⚠️  No parent cast found - assuming they want to curate their own cast`);
        parentCastHash = cast.hash;
        parentCastData = {
          author_fid: author.fid,
          text: cast.text,
          timestamp: cast.timestamp
        };
      } else {
        // Fetch parent cast details
        try {
          const parentResponse = await fetch(
            `https://api.neynar.com/v2/farcaster/cast?identifier=${parentCastHash}&type=hash`,
            {
              headers: {
                accept: 'application/json',
                api_key: NEYNAR_API_KEY!,
              },
            }
          );
          if (parentResponse.ok) {
            const parentData = await parentResponse.json();
            parentCastData = {
              author_fid: parentData.cast.author.fid,
              text: parentData.cast.text,
              timestamp: parentData.cast.timestamp
            };
          }
        } catch (error) {
          console.error('Error fetching parent cast:', error);
        }
      }
      
      // Get user's existing lists to suggest
      const userLists = await CuratedListService.getUserLists(author.fid);
      
      let reply = "which list? 📝";
      if (userLists.length > 0) {
        const listNames = userLists.slice(0, 3).map(l => `"${l.list_name}"`).join(', ');
        reply = `which list? you have: ${listNames} (or say a new name) 📝`;
      }
      
      // Start a conversation
      const convResult = await BotConversationService.startConversation(
        author.fid,
        'curation',
        'awaiting_list_name',
        {
          cast_hash: parentCastHash,
          cast_author_fid: parentCastData?.author_fid,
          cast_text: parentCastData?.text,
          cast_timestamp: parentCastData?.timestamp
        },
        cast.hash
      );
      
      if (!convResult.ok) {
        console.error('Error starting conversation:', convResult.error);
        return {
          reply: "oops, something went wrong 😅",
          shouldContinue: true
        };
      }
      
      console.log(`   ✅ Started conversation (ID: ${convResult.data.id})`);
      return {
        reply,
        shouldContinue: true
      };
    }
  } catch (error) {
    console.error('Error handling curation request:', error);
    return {
      reply: "oops, something went wrong with that 😅",
      shouldContinue: true
    };
  }
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
  imageUrls?: string[],
  channelId?: string
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

    // Search for similar casts to build richer context
    const similarCastsContext = await searchSimilarCasts(mentionText, channelId);
    const fullContext = castContext + memoryContext + similarCastsContext;

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
          content: `${fullContext}\n\nONE SHORT sentence (max 280 chars). Simple words. Casual. NO essay. Stop after one thought.\n\nTheir message: "${mentionText}"`,
        },
      ],
    });

    const textContent = message.content.find((block) => block.type === 'text');
    return textContent && 'text' in textContent ? textContent.text.trim() : '';
  } catch (error: any) {
    console.log('Error generating reply with Claude:', error.message || error);
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
      
      // Use same full context for fallback
      const fallbackContext = castContext + memoryContext;
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 80,
        messages: [
          { role: 'system', content: BOT_PERSONALITY + '\n\nCRITICAL: Max 280 characters. ONE SHORT sentence. Stop immediately.' },
          { 
            role: 'user', 
            content: `${fallbackContext}\n\nONE SHORT sentence (max 280 chars). Simple words. NO essay. Stop.\n\nTheir message: "${mentionText}"` 
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

      // Check if this is a curation request or continuation
      const isCurationRequest = detectCurationIntent(cast.text);
      const hasActiveCuration = await BotConversationService.getActiveConversation(
        author.fid,
        'curation'
      );
      
      if (isCurationRequest || hasActiveCuration) {
        console.log(`   🎨 Handling curation conversation...`);
        const curationResult = await handleCurationRequest(cast, author, repliedCasts);
        
        if (curationResult.shouldContinue) {
          // Mark as replied BEFORE posting
          await markAsReplied(cast.hash, repliedCasts);
          
          // Post the reply
          const success = await postReply(curationResult.reply, cast.hash);
          
          if (success) {
            repliedThisCycle++;
            // Store in memory
            await memory.storeConversation(
              author.fid,
              author.username,
              cast.hash,
              cast.text,
              curationResult.reply
            );
            console.log(`   ✅ Curation response posted successfully`);
            break;
          }
        }
        
        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      // Get conversation context for regular replies
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
      
      // Get channel ID if cast is in a channel
      const channelId = cast.channel?.id;
      if (channelId) {
        console.log(`   📺 Cast is in channel: /${channelId}`);
      }
      
      // Generate reply with memory and similar casts context
      const reply = await generateReply(context, cast.text, author.fid, author.username, imageUrls, channelId);
      
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
