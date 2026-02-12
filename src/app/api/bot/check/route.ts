import { NextRequest, NextResponse } from 'next/server';
import { NeynarAPIClient, Configuration } from '@neynar/nodejs-sdk';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { neynarFetch } from '@/lib/neynar';
import { verifyCronSecret } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';

// Lazy client getters - re-read API keys on each request for key rotation support
function getNeynar() {
  const config = new Configuration({ apiKey: process.env.NEYNAR_API_KEY! });
  return new NeynarAPIClient(config);
}
function getBotOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
function getBotAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const BOT_FID = parseInt(process.env.APP_FID || '1987078');
const SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID!;

// ⚠️ WARNING: In-memory storage only works within same serverless instance
// For production with database, replace with database calls
// See: /server/src/db.ts for BotReplyService implementation

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

// Detect curation intent and extract list name if provided
function detectCurationIntent(text: string): { isCuration: boolean; listName?: string } {
  const cleanText = text.replace(/@\w+/g, '').trim();

  // Patterns that extract a list name from the same message
  const listNamePatterns = [
    /curate\s+this\s+(?:to\s+)?(?:list\s+)?[""\u201c]?([^""\u201c\u201d\n]+?)[""\u201d]?\s*$/i,
    /add\s+this\s+to\s+(?:my\s+)?[""\u201c]?([^""\u201c\u201d\n]+?)[""\u201d]?\s*$/i,
    /save\s+this\s+to\s+(?:my\s+)?[""\u201c]?([^""\u201c\u201d\n]+?)[""\u201d]?\s*$/i,
    /add\s+to\s+(?:my\s+)?(?:list\s+)?[""\u201c]?([^""\u201c\u201d\n]+?)[""\u201d]?\s*$/i,
    /save\s+to\s+(?:my\s+)?(?:list\s+)?[""\u201c]?([^""\u201c\u201d\n]+?)[""\u201d]?\s*$/i,
  ];

  for (const pattern of listNamePatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (name && name.toLowerCase() !== 'list' && name.toLowerCase() !== 'this' && name.length > 0) {
        return { isCuration: true, listName: name };
      }
    }
  }

  // Generic curation request without list name
  const curationKeywords = [
    /curate\s+this/i,
    /add\s+this\s+to/i,
    /save\s+this\s+to/i,
    /add\s+to\s+(my\s+)?list/i,
    /save\s+to\s+(my\s+)?list/i,
  ];
  const isCuration = curationKeywords.some(pattern => pattern.test(cleanText));
  return { isCuration };
}

// Handle curation: add a cast to a user's curated list
async function handleCuration(
  cast: any,
  listName: string | undefined,
  logger: ReturnType<typeof createApiLogger>
): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return "curation isn't set up yet 😅";
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const userFid = cast.author?.fid;
  if (!userFid) return "couldn't identify you 🤔";

  // The cast to curate is the parent (the one they replied to)
  const parentHash = cast.parent_hash;
  let parentText: string | undefined;
  let parentAuthorFid: number | undefined;
  let parentTimestamp: string | undefined;

  if (parentHash) {
    try {
      const parentData = await neynarFetch(`/cast?identifier=${parentHash}&type=hash`);
      parentText = parentData?.cast?.text;
      parentAuthorFid = parentData?.cast?.author?.fid;
      parentTimestamp = parentData?.cast?.timestamp;
    } catch {
      logger.warn('Could not fetch parent cast for curation');
    }
  }

  const targetHash = parentHash || cast.hash;

  if (!listName) {
    // No list name: show user's existing lists
    const { data: userLists } = await supabase
      .from('curated_lists')
      .select('list_name')
      .eq('fid', userFid)
      .order('created_at', { ascending: false })
      .limit(5);

    if (userLists && userLists.length > 0) {
      const names = userLists.map((l: any) => `"${l.list_name}"`).join(', ');
      return `which list? you have: ${names} (or reply with a new name) 📝`;
    }
    return `which list? reply with: "@auntiehomie curate this [list name]" 📝`;
  }

  // Validate list name
  if (listName.length > 100) {
    return "list name too long! keep it under 100 chars 📝";
  }

  // Find or create the list
  let { data: existingList } = await supabase
    .from('curated_lists')
    .select('id, list_name')
    .eq('fid', userFid)
    .ilike('list_name', listName)
    .maybeSingle();

  let listId: number;
  let finalListName: string;

  if (existingList) {
    listId = existingList.id;
    finalListName = existingList.list_name;
  } else {
    const { data: newList, error: createError } = await supabase
      .from('curated_lists')
      .insert([{
        fid: userFid,
        list_name: listName,
        description: `Created via @auntiehomie`,
        is_public: false
      }])
      .select('id, list_name')
      .single();

    if (createError || !newList) {
      logger.error('Failed to create list', createError);
      return `couldn't create "${listName}" 😕`;
    }
    listId = newList.id;
    finalListName = newList.list_name;
    logger.info(`Created new list: "${finalListName}"`);
  }

  // Add cast to list
  const { error: insertError } = await supabase
    .from('curated_list_items')
    .insert([{
      list_id: listId,
      cast_hash: targetHash,
      cast_author_fid: parentAuthorFid || cast.author?.fid,
      cast_text: parentText || cast.text,
      cast_timestamp: parentTimestamp || cast.timestamp,
      added_by_fid: userFid,
      notes: 'Curated via bot'
    }]);

  if (insertError) {
    if (insertError.code === '23505') {
      return `already in "${finalListName}" 👍`;
    }
    logger.error('Failed to add cast to list', insertError);
    return "had trouble saving that 😅";
  }

  logger.info(`Curated cast ${targetHash} to list "${finalListName}"`);
  return `added to "${finalListName}" 🏠✨`;
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

      const response = await getBotOpenAI().chat.completions.create({
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

    const response = await getBotAnthropic().messages.create({
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

    const response = await getBotOpenAI().chat.completions.create({
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

// TODO: Replace with database storage for production
// Example: import { BotReplyService } from '@/server/src/db';
// Then use: await BotReplyService.hasRepliedTo(castHash)
//           await BotReplyService.recordReply(castHash, replyHash, 'mention', replyText)

export async function GET(request: NextRequest) {
  const logger = createApiLogger('/bot/check');
  
  try {
    // Verify cron secret if configured
    verifyCronSecret(request, process.env.CRON_SECRET);
    
    logger.start();
    cleanupCache();
    
    logger.info(`In-memory cache has ${repliedCastsCache.size} entries`);
    
    let repliedCount = 0;

    // Initialize Neynar client fresh (picks up rotated keys)
    const neynar = getNeynar();

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

      // Track multiple hashes to prevent any duplicate replies
      const castHash = cast.hash;
      const parentHash = cast.parent_hash || cast.parent_url || cast.hash;
      const rootParentHash = cast.root_parent_url || parentHash;
      
      // Create multiple tracking keys
      const trackingKeys = [
        `cast_${castHash}`,
        `parent_${parentHash}`,
        `root_${rootParentHash}`
      ];
      
      console.log(`Processing: cast=${castHash}, parent=${parentHash}, root=${rootParentHash}`);

      // Check if we've already replied to ANY of these keys (only in-memory cache)
      let alreadyReplied = false;
      for (const key of trackingKeys) {
        if (repliedCastsCache.has(key)) {
          logger.info(`Already replied to ${key}, skipping entire thread`);
          alreadyReplied = true;
          break;
        }
      }
      
      if (alreadyReplied) {
        continue;
      }

      try {
        logger.info(`Checking if already replied to parent ${parentHash}`);
        
        // Fetch the parent cast with all replies to check if bot already replied
        const conversation = await neynar.lookupCastByHashOrUrl({
          identifier: parentHash,
          type: 'hash'
        });
        
        // Check all possible reply structures
        const directReplies = (conversation.cast as any)?.direct_replies || [];
        const threadReplies = (conversation.cast as any)?.replies?.casts || [];
        
        // Combine all replies and check if bot already replied
        const allReplies = [...directReplies, ...threadReplies];
        
        const botAlreadyReplied = allReplies.some(
          (reply: any) => {
            const replyFid = reply.author?.fid || reply.fid;
            const didReply = replyFid === BOT_FID;
            if (didReply) {
              console.log(`Found existing bot reply to parent ${parentHash}`);
            }
            return didReply;
          }
        );

        if (botAlreadyReplied) {
          logger.info(`Already replied to parent ${parentHash}, caching all tracking keys and skipping`);
          // Cache ALL tracking keys to prevent any future duplicates in this instance
          trackingKeys.forEach(key => {
            repliedCastsCache.set(key, Date.now());
          });
          continue;
        }
        
        logger.info(`No existing reply found for parent ${parentHash}, proceeding to reply`);
      } catch (error) {
        logger.error(`Error checking replies for parent ${parentHash}`, error);
        // If we can't check reliably, assume we've replied to be safe
        logger.warn('Skipping cast due to check error (being conservative)');
        trackingKeys.forEach(key => {
          repliedCastsCache.set(key, Date.now());
        });
        continue;
      }

      try {
        // Check for curation intent before generating a generic reply
        const curationIntent = detectCurationIntent(cast.text || '');
        let reply: string;

        if (curationIntent.isCuration) {
          logger.info(`Curation request detected for parent ${parentHash}`);
          reply = await handleCuration(cast, curationIntent.listName, logger);
        } else {
          logger.info(`Generating reply for parent ${parentHash}`);
          reply = await generateReply(cast, []);
        }

        // Post reply (reply to the cast, not the parent)
        await neynar.publishCast({
          signerUuid: SIGNER_UUID,
          text: reply,
          parent: castHash
        });

        logger.success(`Posted reply to ${castHash}`, { reply });
        
        // Cache ALL tracking keys after successful reply to prevent duplicates
        trackingKeys.forEach(key => {
          repliedCastsCache.set(key, Date.now());
        });
        repliedCount++;

      } catch (error) {
        logger.error(`Error replying to parent ${parentHash}`, error);
        // Even on error, mark as attempted to avoid retry loops
        trackingKeys.forEach(key => {
          repliedCastsCache.set(key, Date.now());
        });
      }
    }

    logger.end({ checked: notifications.notifications.length, replied: repliedCount });

    return NextResponse.json({
      success: true,
      checked: notifications.notifications.length,
      replied: repliedCount,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Bot check failed', error);
    return handleApiError(error, 'GET /bot/check');
  }
}
