import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { AgentOrchestrator } from '@/lib/ai/agents';
import { UserProfileStorage } from '@/lib/ai/storage';
import { createApiLogger } from '@/lib/logger';
import { handleApiError } from '@/lib/errors';
import { rateLimit } from '@/lib/ratelimit';
import { buildRagContext } from '@/lib/ai/rag';

// Increase timeout for agent tool calls and processing
export const maxDuration = 30; // 30 seconds for Pro plan, will use max available on free plan

/** Ollama — self-hosted open-source LLM (OpenAI-compatible API) */
function getOllama(): OpenAI | null {
  const url = process.env.OLLAMA_URL;
  if (!url) return null;
  return new OpenAI({ baseURL: `${url}/v1`, apiKey: 'ollama' });
}

/** Groq — free-tier API serving open-source models (Llama 3.1 70B, Mixtral) */
function getGroq(): OpenAI | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey });
}

function getLocalModel(): string {
  return process.env.OLLAMA_MODEL || 'llama3.2';
}

function getGroqModel(): string {
  return process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
}


const SYSTEM_PROMPT = `You are Homie, the AI assistant for HomieHouse — a Farcaster-based social client.

Your primary purpose is to help users understand and navigate the crypto/Web3 ecosystem, especially:
- **Farcaster** (protocol, clients, channels, signers, frames, mini apps)
- **Ethereum & L2s** (Optimism, Base, Arbitrum, gas, smart contracts, DeFi)
- **Decentralization** (Web3 philosophy, DAOs, public goods, data sovereignty)
- **Privacy** (ZK proofs, self-custody, encryption, seed phrases)
- **AI in Web3** (open-source models, Ollama, Groq, Bittensor, AI agents)
- **Crypto culture** (NFTs, memes, degen, gm/wagmi, Farcaster-specific slang)

HomieHouse facts:
- A Farcaster social hub — browse feeds, compose casts, explore channels
- Uses Hypersnap (haatz.quilibrium.com) as its Farcaster hub
- When context from Relevant Context sections is provided below, use it to ground your answers in real community data

Your capabilities:
- Teach and explain crypto/Web3 concepts clearly at any level (beginner to expert)
- Analyze casts users are viewing (cast context will be marked in the conversation)
- Search Farcaster for casts on topics the user is curious about
- Provide token info (price, market cap, risk) — use get_token_info and search_tokens tools
- Analyze user profiles and engagement patterns
- Identify red flags: scams, suspicious tokens, low-effort shills

Guidelines:
- Be educational first — when someone asks about a concept, explain it well before jumping to opinions
- Cite real community casts when provided in the context block
- Always recommend self-custody and verify sources
- Never give financial advice — only factual information
- For token questions: always flag risks (low liquidity, no audit, anonymous team, honeypot signals)
- If cast context is provided, the user is asking about THAT specific cast
- Farcaster usernames are case-sensitive
- Be concise but complete. Bullet points > paragraphs for technical explanations
- Use the search_farcaster_casts tool when users want to explore a topic deeper
- When in doubt, say so — don't hallucinate facts about specific projects or prices`;

type Provider = 'ollama' | 'groq';

// Provider selection: Ollama → Groq → Claude → OpenAI

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
          // Collect any URLs embedded in the cast
          const embedUrls: string[] = [];
          if (Array.isArray(activeCastContext.embeds)) {
            for (const embed of activeCastContext.embeds) {
              if (embed?.url && embed.url.startsWith('https://')) embedUrls.push(embed.url);
            }
          }
          // Also scan the cast text for https:// links
          const textUrlMatches = (activeCastContext.text || '').match(/https?:\/\/[^\s]+/g) || [];
          for (const u of textUrlMatches) {
            if (!embedUrls.includes(u)) embedUrls.push(u);
          }

          const urlSection = embedUrls.length > 0
            ? `\n🔗 Embedded URLs:\n${embedUrls.map(u => `   • ${u}`).join('\n')}\n   (You can use the fetch_url tool to read any of these links)`
            : '';

          const castDetails = `
═══════════════════════════════════════════
📋 CAST BEING ANALYZED
═══════════════════════════════════════════

👤 Author: @${activeCastContext.author?.username || activeCastContext.author}
   Display Name: ${activeCastContext.author?.display_name || activeCastContext.author}
   FID: ${activeCastContext.author?.fid || 'N/A'}

💬 Cast Content:
"${activeCastContext.text}"
${urlSection}
📊 Engagement:
   ❤️  ${activeCastContext.reactions?.likes_count || 0} likes
   🔄 ${activeCastContext.reactions?.recasts_count || 0} recasts
   💭 ${activeCastContext.replies?.count || 0} replies

🕒 Posted: ${activeCastContext.timestamp ? new Date(activeCastContext.timestamp).toLocaleString() : 'N/A'}
🔗 Hash: ${activeCastContext.hash || 'N/A'}

═══════════════════════════════════════════

👤 User's Question: ${userMessage}

ANALYZE THE CAST ABOVE. When the user asks about "this cast" or asks to find similar casts, they are referring to the cast shown above. If the user asks to read a URL or website, use the fetch_url tool on the relevant embedded URL.`;
          
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
      } catch (agentError: any) {
        console.error('[ask-homie] Agent mode error, falling back to legacy:', agentError?.message || agentError);
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

    // Build RAG context (knowledge base + live Hypersnap casts for this topic)
    const ragCtx = await buildRagContext(question).catch(() => ({
      topics: [], knowledge: '', liveCasts: '', combined: '',
    }));
    const systemWithRag = ragCtx.combined
      ? SYSTEM_PROMPT + ragCtx.combined
      : SYSTEM_PROMPT;

    // Provider chain: Ollama (self-hosted) → Groq (free cloud) — no paid APIs
    const ollamaClient = getOllama();
    const groqClient = getGroq();

    async function callOpenAICompat(
      client: OpenAI,
      model: string,
      msgs: any[],
    ): Promise<string> {
      const completion = await client.chat.completions.create({
        model,
        messages: [{ role: 'system', content: systemWithRag }, ...msgs],
        temperature: 0.7,
        max_tokens: 1024,
      });
      return completion.choices[0].message.content || '';
    }

    let response: string;
    let usedProvider: string;

    if (ollamaClient) {
      console.log(`[ask-homie] Using Ollama (${getLocalModel()})`);
      usedProvider = 'ollama';
      response = await callOpenAICompat(ollamaClient, getLocalModel(), conversationMessages);
    } else if (groqClient) {
      console.log(`[ask-homie] Using Groq (${getGroqModel()})`);
      usedProvider = 'groq';
      response = await callOpenAICompat(groqClient, getGroqModel(), conversationMessages);
    } else {
      console.error('[ask-homie] No AI provider configured. Set GROQ_API_KEY or OLLAMA_URL.');
      return NextResponse.json(
        { error: 'AI service not configured. Please set GROQ_API_KEY in Vercel environment variables.' },
        { status: 503 },
      );
    }

    logger.success('AI response generated', { provider: usedProvider, topics: ragCtx.topics, mode: 'legacy' });
    logger.end();
    return NextResponse.json({ response, provider: usedProvider, topics: ragCtx.topics, mode: 'legacy' });
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

