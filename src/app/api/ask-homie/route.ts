import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { AgentOrchestrator } from '@/lib/ai/agents';
import { UserProfileStorage } from '@/lib/ai/storage';
import { createApiLogger } from '@/lib/logger';
import { handleApiError } from '@/lib/errors';
import { rateLimit } from '@/lib/ratelimit';

// Increase timeout for agent tool calls and processing
export const maxDuration = 30; // 30 seconds for Pro plan, will use max available on free plan

// Lazy client getters - re-read API keys from env on each request
// so rotated keys are picked up without redeployment
function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}


const SYSTEM_PROMPT = `You are Homie, a helpful AI assistant for HomieHouse - a Farcaster-based social platform. 

Key Facts about Farcaster:
- Farcaster was created by Dan Romero and Varun Srinivasan
- It's a sufficiently decentralized social network protocol
- Built on Ethereum/Optimism blockchain
- Users own their social graph and data
- Accounts are identified by FIDs (Farcaster IDs)

Key Facts about HomieHouse:
- A social hub built on Farcaster protocol
- Users can view feeds, compose casts, and interact with the Farcaster network
- Integrates with Farcaster AuthKit for authentication

Your Capabilities:
- Analyze casts that users are viewing (cast context will be provided in the conversation)
- Search for Farcaster casts by keyword or topic using available tools
- Get recent casts from specific Farcaster users
- Get real-time cryptocurrency token information (price, market cap, volume, liquidity)
- Search for tokens by name, symbol, or contract address
- Provide comprehensive token analysis with risk assessment
- Explain tokens, crypto concepts, and blockchain technology
- Provide context about users and trends
- Analyze sentiment and engagement metrics
- Explain technical terms and abbreviations
- Identify potential scams or risky content
- Help users understand what they're seeing in their feed

IMPORTANT - Token Information:
- When users ask about token prices, use the get_token_info tool
- For token searches, use the search_tokens tool
- You have access to real-time data from CoinGecko and DexScreener
- Always warn about risks (low liquidity, volatility, scam indicators)
- Provide market metrics: price, market cap, volume, 24h change
- Include contract addresses and links when available
- Never provide financial advice - only factual information

IMPORTANT - Cast Context & Search:
- When cast context is provided, it will be clearly marked at the start of the conversation
- The cast details include: author, content, timestamp, and engagement metrics
- When users ask questions like "what do you think?", "analyze this", "is this legit?", or ask about finding similar casts, they are referring to the provided cast context
- You HAVE search tools available to find similar casts or casts from specific users when asked
- Use the search_farcaster_casts tool to find casts by topic or keyword
- Use the get_user_casts tool to get recent posts from a specific user and their engagement metrics
- When asked for "most engaged cast" from a user, use get_user_casts which returns casts sorted by engagement

Error Handling:
- If a username is not found, help the user by suggesting they verify the spelling
- Farcaster usernames are case-sensitive
- If there's an API error, acknowledge it gracefully and offer alternatives

When analyzing a cast:
- Look at the content, author details, and engagement metrics provided
- Identify the main topic or purpose (e.g., token launch, announcement, question, meme)
- Note any red flags (suspicious addresses, low engagement accounts, scam indicators)
- Provide clear, actionable insights
- When asked to find similar casts, use the search tool to discover examples

Be friendly, concise, and accurate. If you're not certain about something, say so rather than guessing.`;

// Provider selection: Claude for general/analysis/writing, OpenAI for code/math
function selectBestProvider(question: string): 'claude' | 'openai' {
  const lowerQuestion = question.toLowerCase();

  // Keywords that suggest OpenAI (code, math, structured output)
  const openaiKeywords = [
    'code', 'function', 'debug', 'error', 'api', 'typescript',
    'javascript', 'python', 'sql', 'algorithm', 'data structure',
    'calculate', 'math', 'number', 'formula', 'json',
    'parse', 'regex', 'syntax', 'compile', 'implement'
  ];

  let openaiScore = 0;
  for (const keyword of openaiKeywords) {
    if (lowerQuestion.includes(keyword)) openaiScore++;
  }

  if (lowerQuestion.includes('```') || lowerQuestion.includes('function') || lowerQuestion.includes('const')) {
    openaiScore += 2;
  }

  return openaiScore >= 2 ? 'openai' : 'claude'; // Claude is the default primary
}

// Detect if user is asking for a profile and extract username
function detectProfileRequest(question: string): string | null {
  const lowerQuestion = question.toLowerCase();
  
  // Profile request patterns
  const patterns = [
    /profile (?:of|for) @?(\w+)/i,
    /who is @?(\w+)/i,
    /tell me about @?(\w+)/i,
    /info (?:on|about) @?(\w+)/i,
    /pull (?:the )?profile (?:of|for) @?(\w+)/i,
    /get (?:the )?profile (?:of|for) @?(\w+)/i,
    /show me @?(\w+)(?:'s| )?(?:profile)?/i,
    /look up @?(\w+)/i,
    /find @?(\w+)(?:'s| )?(?:profile)?/i,
  ];
  
  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // Check for standalone @mention or username in question
  const mentionMatch = question.match(/@(\w+)/);
  if (mentionMatch && (lowerQuestion.includes('profile') || lowerQuestion.includes('who'))) {
    return mentionMatch[1];
  }
  
  return null;
}

// Extract cast hash or URL from question
function extractCastReference(question: string): string | null {
  // Match cast URLs: https://warpcast.com/username/0x123...
  const warpcastUrlMatch = question.match(/warpcast\.com\/\w+\/(0x[a-fA-F0-9]+)/);
  if (warpcastUrlMatch) {
    return warpcastUrlMatch[1];
  }
  
  // Match direct hash references: 0x followed by hex
  const hashMatch = question.match(/(0x[a-fA-F0-9]{8,})/);
  if (hashMatch) {
    return hashMatch[1];
  }
  
  // Match HomieHouse cast URLs: /cast/0x123...
  const homieUrlMatch = question.match(/\/cast\/(0x[a-fA-F0-9]+)/);
  if (homieUrlMatch) {
    return homieUrlMatch[1];
  }
  
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HyperSnap (decentralised Farcaster node) helpers
// Public read-only node: https://haatz.quilibrium.com
// Compatible with the standard Farcaster HTTP API (Snapchain / Hub v1)
// ─────────────────────────────────────────────────────────────────────────────

const HYPERSNAP_NODE = process.env.HYPERSNAP_NODE_URL || 'https://haatz.quilibrium.com';

interface HyperSnapCast {
  data: {
    type: string;
    fid: number;
    timestamp: number;
    network: string;
    castAddBody: {
      text: string;
      mentions: number[];
      mentionsPositions: number[];
      embeds: { url?: string; castId?: { fid: number; hash: string } }[];
      parentCastId: { fid: number; hash: string } | null;
      parentUrl: string | null;
      type: string;
    };
  };
  hash: string;
  hashScheme: string;
  signature: string;
  signatureScheme: string;
  signer: string;
}

interface HyperSnapCastsResponse {
  messages: HyperSnapCast[];
  nextPageToken?: string;
}

/** Fetch recent casts for a FID from the HyperSnap node */
async function fetchHyperSnapCastsByFid(
  fid: number,
  pageSize = 10,
  pageToken?: string
): Promise<HyperSnapCastsResponse | null> {
  try {
    const params = new URLSearchParams({ fid: String(fid), pageSize: String(pageSize) });
    if (pageToken) params.set('pageToken', pageToken);
    const url = `${HYPERSNAP_NODE}/v1/castsByFid?${params}`;
    const res = await fetch(url, { headers: { accept: 'application/json' }, next: { revalidate: 60 } });
    if (!res.ok) {
      console.error(`HyperSnap castsByFid failed: ${res.status}`);
      return null;
    }
    return (await res.json()) as HyperSnapCastsResponse;
  } catch (err) {
    console.error('HyperSnap castsByFid error:', err);
    return null;
  }
}

/** Fetch a single cast by hash + fid from the HyperSnap node */
async function fetchHyperSnapCastByHash(hash: string, fid: number): Promise<HyperSnapCast | null> {
  try {
    const params = new URLSearchParams({ hash, fid: String(fid) });
    const url = `${HYPERSNAP_NODE}/v1/castByHash?${params}`;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) {
      console.error(`HyperSnap castByHash failed: ${res.status}`);
      return null;
    }
    const data = await res.json();
    // Node returns { messages: [...] } even for single cast lookup
    if (data?.messages?.[0]) return data.messages[0] as HyperSnapCast;
    return data as HyperSnapCast;
  } catch (err) {
    console.error('HyperSnap castByHash error:', err);
    return null;
  }
}

/** Fetch casts in a parent channel/URL from the HyperSnap node */
async function fetchHyperSnapCastsByParent(
  parentUrl: string,
  pageSize = 10
): Promise<HyperSnapCastsResponse | null> {
  try {
    const params = new URLSearchParams({ url: parentUrl, pageSize: String(pageSize) });
    const url = `${HYPERSNAP_NODE}/v1/castsByParent?${params}`;
    const res = await fetch(url, { headers: { accept: 'application/json' }, next: { revalidate: 60 } });
    if (!res.ok) {
      console.error(`HyperSnap castsByParent failed: ${res.status}`);
      return null;
    }
    return (await res.json()) as HyperSnapCastsResponse;
  } catch (err) {
    console.error('HyperSnap castsByParent error:', err);
    return null;
  }
}

/** Fetch casts that mention a FID from the HyperSnap node */
async function fetchHyperSnapCastsByMention(
  fid: number,
  pageSize = 10
): Promise<HyperSnapCastsResponse | null> {
  try {
    const params = new URLSearchParams({ fid: String(fid), pageSize: String(pageSize) });
    const url = `${HYPERSNAP_NODE}/v1/castsByMention?${params}`;
    const res = await fetch(url, { headers: { accept: 'application/json' }, next: { revalidate: 60 } });
    if (!res.ok) {
      console.error(`HyperSnap castsByMention failed: ${res.status}`);
      return null;
    }
    return (await res.json()) as HyperSnapCastsResponse;
  } catch (err) {
    console.error('HyperSnap castsByMention error:', err);
    return null;
  }
}

/** Query the HyperSnap node health/info endpoint */
async function fetchHyperSnapNodeInfo(): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${HYPERSNAP_NODE}/v1/info`, {
      headers: { accept: 'application/json' },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Export helpers for use in other routes
export { fetchHyperSnapCastsByFid, fetchHyperSnapCastByHash, fetchHyperSnapCastsByParent, fetchHyperSnapCastsByMention, fetchHyperSnapNodeInfo };

// ─────────────────────────────────────────────────────────────────────────────

// Fetch cast data from Pinata Farcaster API
async function fetchCastData(castHash: string) {
  try {
    const jwt = process.env.PINATA_JWT;
    if (!jwt) {
      console.error('PINATA_JWT not configured');
      return null;
    }

    const url = `https://api.pinata.cloud/v3/farcaster/casts/${encodeURIComponent(castHash)}`;
    console.log(`Fetching cast ${castHash} from Pinata API`);

    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
    });

    if (!response.ok) {
      console.error(`Cast fetch failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    console.log(`Cast fetched successfully: ${castHash}`);
    // Pinata returns { data: { ... } } or { cast: { ... } }
    return data?.data ?? data.cast;
  } catch (error) {
    console.error('Error fetching cast:', error);
    return null;
  }
}

// Fetch profile from Pinata Farcaster API
async function fetchUserProfile(username: string) {
  try {
    const jwt = process.env.PINATA_JWT;
    if (!jwt) {
      console.error('PINATA_JWT not configured');
      return null;
    }

    const url = `https://api.pinata.cloud/v3/farcaster/users/by_username?username=${encodeURIComponent(username)}`;
    console.log(`Fetching profile for ${username} from Pinata API`);

    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
    });

    if (!response.ok) {
      console.error(`Profile fetch failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    console.log(`Profile fetched successfully for ${username}`);
    // Pinata returns { data: { ... } } or { user: { ... } }
    return data?.data ?? data.user;
  } catch (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const logger = createApiLogger('/ask-homie');
  logger.start();

  try {
    // SECURITY: Rate limit (30 per hour per IP)
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const { success: rlOk } = rateLimit(`ask-homie:${ip}`, 30, 3600);
    if (!rlOk) {
      return NextResponse.json({ error: 'Rate limited. Try again later.' }, { status: 429 });
    }

    const {
      messages,
      provider: requestedProvider,
      castContext,
      mode = 'agent',
      userId,
      userContext,
      intent,
      feedback
    } = await req.json();

    logger.info('Processing AI request', { 
      mode, 
      provider: requestedProvider, 
      hasCastContext: !!castContext,
      hasUserContext: !!userContext,
      messageCount: messages?.length 
    });

    // Get or create user ID (from auth or generate temporary)
    const userIdentifier = userId || `temp_${Date.now()}`;

    // If using new agent mode
    if (mode === 'agent') {
      try {
        // Get user profile
        const userProfile = UserProfileStorage.getProfile(userIdentifier);
        
        // Create orchestrator
        const orchestrator = new AgentOrchestrator(userProfile);

        // Get the last user message
        const lastUserMessage = [...messages].reverse().find((m: any) => m.role === 'user');
        const userMessage = lastUserMessage?.content || '';

        // Log cast context if present
        if (castContext) {
          console.log('📋 Cast context received:', {
            author: castContext.author?.username || castContext.author,
            textPreview: castContext.text?.slice(0, 100),
            fullContext: castContext
          });
        }

        // Check if user is asking about a cast (by URL or hash)
        const castHash = extractCastReference(userMessage);
        let fetchedCastData = null;
        
        if (castHash) {
          console.log(`Cast reference detected in agent mode: ${castHash}`);
          fetchedCastData = await fetchCastData(castHash);
        }

        // Use fetched cast data if available, otherwise use provided castContext
        const activeCastContext = fetchedCastData || castContext;

        // Add cast context if provided - make it more prominent
        let contextualMessage = userMessage;
        
        // Add user context if available
        if (userContext?.username) {
          contextualMessage = `[USER CONTEXT: You are chatting with @${userContext.username}${userContext.displayName ? ` (${userContext.displayName})` : ''}, FID: ${userContext.fid}. When they ask about "my" casts, posts, or profile, they are referring to @${userContext.username}.]\n\n` + contextualMessage;
        }
        
        if (activeCastContext) {
          const castDetails = `
═══════════════════════════════════════════
📋 CAST BEING ANALYZED
═══════════════════════════════════════════

👤 Author: @${activeCastContext.author?.username || activeCastContext.author}
   Display Name: ${activeCastContext.author?.display_name || activeCastContext.author}
   FID: ${activeCastContext.author?.fid || 'N/A'}

💬 Cast Content:
"${activeCastContext.text}"

📊 Engagement:
   ❤️  ${activeCastContext.reactions?.likes_count || 0} likes
   🔄 ${activeCastContext.reactions?.recasts_count || 0} recasts  
   💭 ${activeCastContext.replies?.count || 0} replies

🕒 Posted: ${activeCastContext.timestamp ? new Date(activeCastContext.timestamp).toLocaleString() : 'N/A'}
🔗 Hash: ${activeCastContext.hash || 'N/A'}

═══════════════════════════════════════════

👤 User's Question: ${userMessage}

ANALYZE THE CAST ABOVE. When the user asks about "this cast", "annaramirez", or asks to find similar casts, they are referring to the cast shown above. You have search tools available to find similar casts or casts from specific users.`;
          
          contextualMessage = castDetails;
        }

        // Process with feedback if provided
        if (feedback) {
          UserProfileStorage.addFeedback(userIdentifier, feedback.cast, feedback.feedback);
        }

        // Process the request
        const result = await orchestrator.processRequest(contextualMessage, intent || 'auto');

        // If this was a composition, save it
        if (result.role === 'composer' && result.suggestions && result.suggestions.length > 0) {
          result.suggestions.forEach(cast => {
            UserProfileStorage.addCast(userIdentifier, cast);
          });
        }

        return NextResponse.json({
          response: result.content,
          suggestions: result.suggestions,
          agentRole: result.role,
          metadata: result.metadata,
          mode: 'agent',
          userStats: UserProfileStorage.getStats(userIdentifier)
        });
      } catch (agentError) {
        console.error('Agent mode error, falling back to legacy:', agentError);
        // Fall through to legacy mode
      }
    }

    // Legacy mode (original implementation)
    // Get the last user message to analyze
    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === 'user');
    const question = lastUserMessage?.content || '';

    // Check if this is a profile request
    const requestedUsername = detectProfileRequest(question);
    let profileData = null;
    
    if (requestedUsername) {
      console.log(`Profile request detected for: ${requestedUsername}`);
      profileData = await fetchUserProfile(requestedUsername);
    }

    // Check if user is asking about a cast (by URL or hash)
    const castHash = extractCastReference(question);
    let fetchedCastData = null;
    
    if (castHash) {
      console.log(`Cast reference detected: ${castHash}`);
      fetchedCastData = await fetchCastData(castHash);
    }

    // If cast context is provided, prepend it to the conversation
    let conversationMessages = messages;
    
    // Use fetched cast data if available, otherwise use provided castContext
    const activeCastContext = fetchedCastData || castContext;
    
    if (activeCastContext) {
      const contextMessage = {
        role: 'system',
        content: `═══════════════════════════════════════════
📋 CAST BEING ANALYZED
═══════════════════════════════════════════

The user is analyzing a Farcaster cast with these details:

👤 Author: @${activeCastContext.author?.username || activeCastContext.author}
   Display Name: ${activeCastContext.author?.display_name || activeCastContext.author}
   FID: ${activeCastContext.author?.fid || 'N/A'}

💬 Content: "${activeCastContext.text}"

📊 Engagement:
   ❤️  ${activeCastContext.reactions?.likes_count || 0} likes
   🔄 ${activeCastContext.reactions?.recasts_count || 0} recasts
   💭 ${activeCastContext.replies?.count || 0} replies

🕒 Timestamp: ${activeCastContext.timestamp ? new Date(activeCastContext.timestamp).toLocaleString() : 'N/A'}

═══════════════════════════════════════════

When the user asks questions like "what do you think?", "analyze this", "is this legit?", or asks to find similar casts, they are referring to THIS cast above. 

IMPORTANT: You cannot search for other casts on Farcaster. If asked to find similar casts, explain that you can analyze this specific cast in detail but cannot search the network for others. Focus on analyzing the content, author credibility, engagement patterns, and any red flags.`
      };
      conversationMessages = [contextMessage, ...messages];
    }

    // If we have profile data, inject it into the conversation
    if (profileData) {
      const verifiedAddresses = profileData.verified_addresses?.eth_addresses || [];
      const profileContext = {
        role: 'user',
        content: `[PROFILE DATA for @${profileData.username}:
Username: ${profileData.username}
Display Name: ${profileData.display_name || 'N/A'}
FID: ${profileData.fid}
Bio: ${profileData.profile?.bio?.text || 'No bio'}
Followers: ${profileData.follower_count || 0}
Following: ${profileData.following_count || 0}
Verified Addresses: ${verifiedAddresses.length > 0 ? verifiedAddresses.join(', ') : 'None'}
Profile URL: https://warpcast.com/${profileData.username}]`
      };
      conversationMessages = [profileContext, ...conversationMessages];
    }

    // Smart provider selection: use requested provider, or auto-select based on content
    // Claude is primary for general/analysis/writing; OpenAI for code/math
    const selectedProvider = (requestedProvider === 'gemini' || requestedProvider === 'perplexity' || requestedProvider === 'kimi')
      ? 'claude' // Redirect removed providers to Claude
      : (requestedProvider as 'claude' | 'openai' | undefined) || selectBestProvider(question);

    // Initialize clients fresh for this request (picks up rotated keys)
    const openai = getOpenAI();
    const anthropic = getAnthropic();

    let response: string;
    let usedProvider = selectedProvider;

    try {
      if (selectedProvider === 'claude') {
        // Claude is the primary provider for general questions, analysis, and writing
        console.log('Using Claude as primary provider');
        const completion = await anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: conversationMessages.map((msg: any) => ({
            role: msg.role === 'system' ? 'user' : msg.role,
            content: msg.content,
          })),
        });
        response = completion.content[0].type === 'text' ? completion.content[0].text : '';
      } else {
        // OpenAI for code/math/structured output
        console.log('Using OpenAI for code/math response');
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...conversationMessages
          ],
          temperature: 0.7,
          max_tokens: 1024,
        });
        response = completion.choices[0].message.content || '';
      }
    } catch (primaryError) {
      // Fallback chain: Claude → OpenAI (or OpenAI → Claude)
      console.warn(`${selectedProvider} failed, trying fallback:`, primaryError);
      const fallback = selectedProvider === 'claude' ? 'openai' : 'claude';
      usedProvider = fallback;

      if (fallback === 'openai') {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages
          ],
          temperature: 0.7,
          max_tokens: 1024,
        });
        response = completion.choices[0].message.content || '';
      } else {
        const completion = await anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: messages.map((msg: any) => ({
            role: msg.role === 'system' ? 'user' : msg.role,
            content: msg.content,
          })),
        });
        response = completion.content[0].type === 'text' ? completion.content[0].text : '';
      }
    }

    logger.success('AI response generated', { provider: usedProvider, mode: 'legacy' });
    logger.end();
    return NextResponse.json({ response, provider: usedProvider, mode: 'legacy' });
  } catch (error: any) {
    logger.error('AI request failed', error);
    return handleApiError(error, 'POST /ask-homie');
  }
}

// New endpoint for profile management
export async function PATCH(req: NextRequest) {
  const logger = createApiLogger('/ask-homie PATCH');
  logger.start();

  try {
    const { userId, updates } = await req.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    logger.info('Updating user profile', { userId: userId.substring(0, 8) });

    const updatedProfile = UserProfileStorage.updateProfile(userId, updates);
    const stats = UserProfileStorage.getStats(userId);

    logger.success('Profile updated');
    logger.end();
    return NextResponse.json({
      profile: updatedProfile,
      stats
    });
  } catch (error: any) {
    logger.error('Profile update failed', error);
    return handleApiError(error, 'PATCH /ask-homie');
  }
}

// Get user stats
export async function GET(req: NextRequest) {
  const logger = createApiLogger('/ask-homie GET');
  logger.start();

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    logger.info('Fetching user profile', { userId: userId.substring(0, 8) });

    const profile = UserProfileStorage.getProfile(userId);
    const stats = UserProfileStorage.getStats(userId);

    logger.success('Profile fetched');
    logger.end();
    return NextResponse.json({
      profile,
      stats
    });
  } catch (error: any) {
    logger.error('Profile fetch failed', error);
    return handleApiError(error, 'GET /ask-homie');
  }
}

