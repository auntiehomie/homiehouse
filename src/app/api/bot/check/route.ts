import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getDb } from '@/lib/db';
import { fetchNotifications, fetchCast, hasBotRepliedToCast } from '@/lib/hypersnap';
import { publishCast } from '@/lib/farcaster-writes';
import { verifyCronSecret } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { hasRepliedToAny, recordReplyBatch } from '@/lib/bot-reply-storage';
import { llmChat } from '@/lib/llm';
import { rateLimit } from '@/lib/ratelimit';

const BOT_FID = parseInt(process.env.APP_FID || '1349780');;

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
  let db: any;
  try {
    db = getDb();
  } catch {
    return "curation isn't set up yet 😅";
  }

  const userFid = cast.author?.fid;
  if (!userFid) return "couldn't identify you 🤔";

  const parentHash = cast.parent_hash;
  let parentText: string | undefined;
  let parentAuthorFid: number | undefined;
  let parentTimestamp: string | undefined;

  if (parentHash) {
    try {
      const parentData = await fetchCast(parentHash);
      const parentCast = parentData?.data?.cast ?? parentData?.cast;
      parentText = parentCast?.text;
      parentAuthorFid = parentCast?.author?.fid;
      parentTimestamp = parentCast?.timestamp;
    } catch {
      logger.warn('Could not fetch parent cast for curation');
    }
  }

  const targetHash = parentHash || cast.hash;

  if (!listName) {
    const { rows: userLists } = await db.query(
      `SELECT list_name FROM curated_lists WHERE fid = $1 ORDER BY created_at DESC LIMIT 5`,
      [userFid]
    );
    if (userLists.length > 0) {
      const names = userLists.map((l: any) => `"${l.list_name}"`).join(', ');
      return `which list? you have: ${names} (or reply with a new name) 📝`;
    }
    return `which list? reply with: "@auntiehomie curate this [list name]" 📝`;
  }

  if (listName.length > 100) {
    return "list name too long! keep it under 100 chars 📝";
  }

  // Find or create list (case-insensitive)
  const { rows: existingLists } = await db.query(
    `SELECT id, list_name FROM curated_lists WHERE fid = $1 AND LOWER(list_name) = LOWER($2)`,
    [userFid, listName]
  );

  let listId: number;
  let finalListName: string;

  if (existingLists.length > 0) {
    listId = existingLists[0].id;
    finalListName = existingLists[0].list_name;
  } else {
    try {
      const { rows: newList } = await db.query(
        `INSERT INTO curated_lists (fid, list_name, description, is_public)
         VALUES ($1, $2, $3, false)
         RETURNING id, list_name`,
        [userFid, listName, `Created via @auntiehomie`]
      );
      listId = newList[0].id;
      finalListName = newList[0].list_name;
      logger.info(`Created new list: "${finalListName}"`);
    } catch (createError) {
      logger.error('Failed to create list', createError);
      return `couldn't create "${listName}" 😕`;
    }
  }

  try {
    await db.query(
      `INSERT INTO curated_list_items
        (list_id, cast_hash, cast_author_fid, cast_text, cast_timestamp, added_by_fid, notes)
       VALUES ($1, $2, $3, $4, $5, $6, 'Curated via bot')`,
      [
        listId,
        targetHash,
        parentAuthorFid || cast.author?.fid || null,
        parentText || cast.text || null,
        parentTimestamp || cast.timestamp || null,
        userFid,
      ]
    );
  } catch (insertError: any) {
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

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: BOT_PERSONALITY },
    ...conversationHistory.map((msg: any) => ({
      role: (msg.role === 'bot' ? 'assistant' : 'user') as 'assistant' | 'user',
      content: msg.content as string,
    })),
  ];

  // Use vision-capable model for images
  if (hasImage && imageUrl) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: `@${authorUsername} says: ${castText}` },
        { type: 'image_url', image_url: { url: imageUrl } },
      ],
    });
  } else {
    messages.push({ role: 'user', content: `@${authorUsername} says: ${castText}` });
  }

  try {
    const { message } = await llmChat({
      messages,
      maxTokens: 400,
      temperature: 0.8,
      vision: hasImage,
    });
    return message.content?.trim() || 'Hey! 🏠';
  } catch (err: any) {
    console.error('[bot/check] All AI providers failed:', err?.message);
    return 'Hey! 🏠';
  }
}

// Database-backed reply tracking via bot_replies table (Neon DB)
// Replaces previous in-memory-only cache which lost state on cold starts

export async function GET(request: NextRequest) {
  const logger = createApiLogger('/bot/check');
  
  try {
    // Verify cron secret if configured
    verifyCronSecret(request, process.env.CRON_SECRET);
    
    // Rate limit: 30 requests/minute per IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success: rateLimitOk } = rateLimit(`bot-check:${ip}`, 30, 60);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    logger.start();
    logger.info('Using DB-backed reply tracking (bot_replies table)')

    
    let repliedCount = 0;

    // Fetch notifications via Pinata (no SDK needed)
    const notifData = await fetchNotifications({ fid: BOT_FID, limit: 50 });
    // Pinata wraps response: { data: { notifications: [...], next_page_token: ... } }
    const notificationList: any[] = notifData?.data?.notifications ?? notifData?.notifications ?? [];

    console.log(`Found ${notificationList.length} notifications`);

    for (const notification of notificationList) {
      if (repliedCount >= 1) {
        console.log('Already replied to 1 cast in this run, stopping');
        break; // Only reply to 1 per run
      }

      // Pinata notification shapes: mention/reply have a cast object
      const cast = notification.cast ?? notification;
      if (!cast || !cast.hash) {
        continue;
      }

      // Only process mention and reply notifications
      const notifType = notification.type ?? notification.notification_type;
      if (notifType && !['mention', 'reply'].includes(notifType)) {
        continue;
      }

      // Track multiple hashes to prevent any duplicate replies
      const castHash = cast.hash;
      const parentHash = cast.parent_hash || cast.parent_url || cast.hash;
      const rootParentHash = cast.root_parent_url || parentHash;
      
      // Create multiple tracking keys
      const trackingKeys = [
        `hl_cast_${castHash}`,
        `hl_parent_${parentHash}`,
        `hl_root_${rootParentHash}`,
      ];
      
      console.log(`Processing: cast=${castHash}, parent=${parentHash}, root=${rootParentHash}`);

      // Check if we've already replied to ANY of these keys (DB-backed)
      const alreadyRepliedKey = await hasRepliedToAny(trackingKeys);
      if (alreadyRepliedKey) {
        logger.info(`Already replied to ${alreadyRepliedKey}, skipping entire thread`);
        continue;
      }

      try {
        logger.info(`Checking hub for existing bot replies to ${castHash}`);

        // Uses fids-based feed query (supported by Hypersnap) instead of
        // the old parent_hash filter which Hypersnap doesn't support.
        const botAlreadyReplied = await hasBotRepliedToCast(BOT_FID, castHash);

        if (botAlreadyReplied) {
          logger.info(`Already replied in thread for ${castHash}, recording in DB and skipping`);
          await recordReplyBatch({
            trackingKeys,
            replyHash: 'already-replied',
            commandType: 'mention',
          });
          continue;
        }

        logger.info(`No existing reply found in thread for ${castHash}, proceeding to reply`);
      } catch (error) {
        // FAIL-CLOSED: skip if we can't verify, to prevent duplicate replies
        logger.warn(`Could not verify replies for ${castHash} — skipping to prevent duplicates`);
        await recordReplyBatch({
          trackingKeys,
          replyHash: 'fetch-failed-skip',
          commandType: 'mention',
        }).catch(() => {});
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

        // Post reply via farcaster-writes (app-managed signer)
        const botSignerKey = process.env.HOMIEHOUSELOL_SIGNER_KEY;
        console.error(`[bot/check] ATTEMPTING reply fid=${BOT_FID} parent=${castHash.slice(0,10)} hasKey=${!!botSignerKey}`);
        const { castHash: replyHash } = await publishCast({
          text: reply,
          fid: BOT_FID,
          parentCastHash: castHash,
          parentCastFid: cast.author?.fid,
          ...(botSignerKey ? { signerPrivateKey: botSignerKey } : {}),
        });
        console.error(`[bot/check] SUCCESS replyHash=${replyHash}`);

        logger.success(`Posted reply to ${castHash}`, { reply });
        
        // Record in DB after successful reply to prevent duplicates across instances
        await recordReplyBatch({
          trackingKeys,
          replyHash: replyHash || castHash,
          commandType: 'mention',
          replyText: reply,
        });
        repliedCount++;

      } catch (error) {
        logger.error(`Error replying to parent ${parentHash}`, error);
        // Even on error, mark as attempted to avoid retry loops
        await recordReplyBatch({
          trackingKeys,
          replyHash: 'error-no-reply',
          commandType: 'mention',
        });
      }
    }

    logger.end({ checked: notificationList.length, replied: repliedCount });

    return NextResponse.json({
      success: true,
      checked: notificationList.length,
      replied: repliedCount,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Bot check failed', error);
    return handleApiError(error, 'GET /bot/check');
  }
}
