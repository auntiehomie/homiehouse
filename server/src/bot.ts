import { NeynarAPIClient, CastParamType } from '@neynar/nodejs-sdk';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { searchCasts, getCastsByUsername } from './db';

const neynar = new NeynarAPIClient(process.env.NEYNAR_API_KEY!);
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

// Detect if user is asking for a search
function detectSearchIntent(text: string): { isSearch: boolean; type?: 'keyword' | 'user'; query?: string } {
  const lower = text.toLowerCase();
  
  // Check for user search patterns
  const userMatch = lower.match(/(?:find|show|get|search|other|more|list).*?(?:casts?|posts?).*?(?:by|from)\s+@?(\w+)/i) ||
                    lower.match(/@(\w+).*?(?:casts?|posts?|content)/i) ||
                    lower.match(/(?:what|show).*?@?(\w+).*?(?:post|cast|say)/i);
  
  if (userMatch) {
    return { isSearch: true, type: 'user', query: userMatch[1] };
  }
  
  // Check for keyword search patterns
  const keywordPatterns = [
    /(?:find|search|show|get).*?(?:casts?|posts?).*?(?:about|on)\s+(.+?)(?:\?|$)/i,
    /(?:other|more|similar).*?(?:casts?|posts?).*?(?:about|like|on)\s+(.+?)(?:\?|$)/i,
    /(?:any|are there).*?(?:casts?|posts?).*?(?:about|on|showing)\s+(.+?)(?:\?|$)/i
  ];
  
  for (const pattern of keywordPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return { isSearch: true, type: 'keyword', query: match[1].trim() };
    }
  }
  
  return { isSearch: false };
}

// Detect if user wants to curate a cast
function detectCurateIntent(text: string): { isCurate: boolean; listName?: string } {
  const lower = text.toLowerCase();
  
  // Check if they specified a list name
  const listPatterns = [
    /(?:add|save|curate).*?(?:to|in).*?(?:list|folder).*?(?:titled|called|named)\s+[""']?([^""'\n]+?)[""']?(?:\s|$)/i,
    /(?:add|save|curate).*?(?:to|in)\s+[""']?([^""'\n]+?)[""']?\s+list/i,
    /(?:add|save|curate).*?(?:to|in)\s+(?:my\s+)?[""']?([^""'\n]+?)[""']?$/i
  ];
  
  for (const pattern of listPatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].toLowerCase() !== 'this' && match[1].toLowerCase() !== 'a') {
      return { isCurate: true, listName: match[1].trim() };
    }
  }
  
  // Generic curation request without list name
  const hasCurateKeyword = lower.includes('curate') || 
                           lower.includes('save this') || 
                           lower.includes('add to list') ||
                           lower.includes('add this to') ||
                           lower.includes('bookmark this');
  
  return { isCurate: hasCurateKeyword, listName: undefined };
}

// Add cast to user's curation list
async function curateThisCast(cast: any, listName?: string): Promise<string> {
  try {
    const parentCast = cast.parent_cast || cast;
    const castHash = parentCast.hash;
    const authorFid = cast.author?.fid;
    
    if (!castHash || !authorFid) {
      return `Couldn't find the cast to curate 🤔`;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return `Curation isn't set up yet, but I'd totally save this for you! 📌`;
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // If no list name provided, ask which list
    if (!listName) {
      // Fetch user's existing lists
      const { data: userLists, error: fetchError } = await supabase
        .from('curated_lists')
        .select('list_name')
        .eq('fid', authorFid)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching lists:', fetchError);
        return `Which list should I save this to? Reply with: "add to [list name]" 📝`;
      }

      if (!userLists || userLists.length === 0) {
        return `You don't have any lists yet! Reply with "add to [list name]" and I'll create it for you 📝`;
      }

      const listNames = userLists.map(l => `"${l.list_name}"`).slice(0, 5).join(', ');
      return `Which list? You have: ${listNames}\n\nReply with "add to [list name]" 📝`;
    }

    // Find or create the specified list
    let { data: targetList, error: listError } = await supabase
      .from('curated_lists')
      .select('*')
      .eq('fid', authorFid)
      .ilike('list_name', listName)
      .maybeSingle();

    if (listError && listError.code !== 'PGRST116') {
      console.error('Error checking for list:', listError);
      return `Had trouble accessing your lists 😅`;
    }

    // Create the list if it doesn't exist
    if (!targetList) {
      const { data: newList, error: createError } = await supabase
        .from('curated_lists')
        .insert([{
          fid: authorFid,
          list_name: listName,
          description: `Created via @homiehouse bot`,
          is_public: false
        }])
        .select()
        .single();

      if (createError) {
        console.error('Error creating list:', createError);
        return `Couldn't create the list "${listName}" 😕`;
      }

      targetList = newList;
      console.log(`✨ Created new list: "${listName}" for FID ${authorFid}`);
    }

    // Add the cast to the list
    const { error: insertError } = await supabase
      .from('curated_list_items')
      .insert([{
        list_id: targetList.id,
        cast_hash: castHash,
        cast_author_fid: parentCast.author?.fid,
        cast_text: parentCast.text,
        cast_timestamp: parentCast.timestamp,
        added_by_fid: authorFid,
        notes: 'Curated via bot'
      }]);

    if (insertError) {
      if (insertError.code === '23505') {
        return `Already in your "${listName}" list! ✅`;
      }
      console.error('Error adding to list:', insertError);
      return `Had trouble saving that cast 😅`;
    }

    return `✅ Saved to "${listName}"! Check it out in HomieHouse 🏡`;
  } catch (error) {
    console.error('Curation error:', error);
    return `Something went wrong trying to save that 😕`;
  }
}

// Format search results for reply - with AI explanation
async function formatSearchResults(casts: any[], searchType: 'keyword' | 'user', query: string): Promise<string> {
  if (!casts || casts.length === 0) {
    return `Couldn't find any casts ${searchType === 'user' ? `from @${query}` : `about "${query}"`} 🤷`;
  }
  
  const topCasts = casts.slice(0, 3); // Show top 3
  
  // Build context for AI to explain
  const castsContext = topCasts.map((cast, idx) => {
    const author = cast.author?.username || 'unknown';
    const text = cast.text || '';
    const likes = cast.reactions?.likes_count || 0;
    const replies = cast.replies?.count || 0;
    return `Cast ${idx + 1} by @${author} (${likes} likes, ${replies} replies):\n"${text}"`;
  }).join('\n\n');
  
  const prompt = `Someone asked to ${searchType === 'user' ? `see casts from @${query}` : `find casts about "${query}"`}. 

Here are the top 3 results:

${castsContext}

Provide a brief, casual summary (max 280 chars) explaining what these casts are about and any interesting patterns. Be conversational and helpful.`;

  try {
    // Use OpenAI for quick response
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: BOT_PERSONALITY },
        { role: 'user', content: prompt }
      ],
      max_tokens: 120,
      temperature: 0.7
    });

    const explanation = response.choices[0]?.message?.content?.trim();
    
    if (explanation) {
      // Add link info
      const moreInfo = casts.length > 3 ? `\n\n(Found ${casts.length} total casts)` : '';
      return explanation + moreInfo;
    }
  } catch (error) {
    console.error('Error generating explanation:', error);
  }
  
  // Fallback to simple format
  const lines = [`Found ${casts.length} casts ${searchType === 'user' ? `from @${query}` : `about "${query}"`}:\n`];
  
  topCasts.forEach((cast, idx) => {
    const author = cast.author?.username || 'unknown';
    const text = cast.text?.slice(0, 100) || '';
    lines.push(`${idx + 1}. @${author}: "${text}..."`);
  });
  
  if (casts.length > 3) {
    lines.push(`\n...and ${casts.length - 3} more`);
  }
  
  return lines.join('\n');
}

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
  
  // Check if user wants to curate the cast
  const curateIntent = detectCurateIntent(castText);
  if (curateIntent.isCurate) {
    console.log(`📌 Detected curation request${curateIntent.listName ? ` for list: ${curateIntent.listName}` : ' (no list specified)'}`);
    return await curateThisCast(cast, curateIntent.listName);
  }
  
  // Check if this is a search request
  const searchIntent = detectSearchIntent(castText);
  
  if (searchIntent.isSearch && searchIntent.query && searchIntent.type) {
    console.log(`🔍 Detected ${searchIntent.type} search for: ${searchIntent.query}`);
    
    try {
      let results;
      
      if (searchIntent.type === 'user') {
        results = await getCastsByUsername(searchIntent.query, 10);
      } else {
        results = await searchCasts(searchIntent.query, 10);
      }
      
      return await formatSearchResults(results, searchIntent.type, searchIntent.query);
    } catch (error) {
      console.error('Search error:', error);
      return `Hmm, had trouble searching for that. Try again? 🤔`;
    }
  }
  
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

    // Fetch notifications using v2 API
    const response = await neynar.fetchMentionAndReplyNotifications(BOT_FID, {
      cursor: undefined
    });

    const allNotifications = response.result.notifications || [];
    console.log(`📬 Found ${allNotifications.length} notifications`);

    for (const notification of allNotifications) {
      if (repliedCount >= 1) {
        console.log('✋ Already replied to 1 cast in this run, stopping');
        break;
      }

      // The notification itself is the cast
      const cast = notification;
      if (!cast || !cast.hash) {
        continue;
      }

      // Track multiple hashes to prevent duplicates
      const castHash = cast.hash;
      const parentHash = cast.parentHash || cast.parentUrl || cast.hash;
      const rootParentHash = (cast as any).rootParentUrl || parentHash;
      
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
        const conversation = await neynar.lookupCastConversation(parentHash, CastParamType.Hash);
        
        const directReplies = conversation.conversation?.cast?.direct_replies || [];
        
        const botAlreadyReplied = directReplies.some((reply: any) => {
          const replyFid = reply.author?.fid;
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

        await neynar.publishCast(SIGNER_UUID, reply, { replyTo: parentHash });

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
      checked: allNotifications.length,
      replied: repliedCount,
      timestamp: new Date().toISOString()
    };

  } catch (error: any) {
    console.error('💥 Bot check error:', error);
    throw error;
  }
}
