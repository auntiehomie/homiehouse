import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AgentOrchestrator } from '@/lib/ai/agents';
import { UserProfileStorage } from '@/lib/ai/storage';

const AI_PROVIDER = process.env.AI_PROVIDER || 'openai'; // 'openai' or 'claude'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Only initialize Gemini if API key is available
const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const gemini = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

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
- When asked about a Farcaster user profile (e.g., "who is @username" or "profile of username"), you can fetch and display their profile information
- Analyze casts, explain tokens and crypto concepts
- Provide context about users and trends
- Analyze sentiment and engagement
- Explain technical terms and abbreviations
- Identify potential scams or risky content

When asked for a profile:
- If you receive profile data, format it nicely with their bio, follower count, and verified addresses
- If you don't have the data, politely say you can look it up but need the username

Be friendly, concise, and accurate. If you're not certain about something, say so rather than guessing.`;

// Intelligent provider selection based on question content
function selectBestProvider(question: string): 'gemini' | 'claude' | 'openai' {
  const lowerQuestion = question.toLowerCase();
  
  // Keywords that suggest Gemini with web search would be better
  const geminiKeywords = [
    'search', 'find', 'latest', 'current', 'news', 'recent', 'today',
    'what is', 'explain', 'tell me about', 'link', 'url', 'website',
    'https://', 'http://', '.com', 'article', 'documentation',
    'weather', 'price', 'trending', 'happening', 'now'
  ];
  
  // Keywords that suggest Claude would be better
  const claudeKeywords = [
    'write', 'story', 'creative', 'essay', 'poem', 'philosophical',
    'explain like', 'eli5', 'analogy', 'metaphor', 'analyze',
    'opinion', 'think about', 'perspective', 'nuance', 'ethics',
    'summarize', 'rewrite', 'improve', 'feedback', 'critique'
  ];
  
  // Keywords that suggest OpenAI would be better
  const openaiKeywords = [
    'code', 'function', 'debug', 'error', 'api', 'typescript',
    'javascript', 'python', 'sql', 'algorithm', 'data structure',
    'calculate', 'math', 'number', 'formula', 'json',
    'parse', 'regex', 'syntax', 'compile', 'implement'
  ];
  
  let geminiScore = 0;
  let claudeScore = 0;
  let openaiScore = 0;
  
  // Count keyword matches
  for (const keyword of geminiKeywords) {
    if (lowerQuestion.includes(keyword)) geminiScore++;
  }
  
  for (const keyword of claudeKeywords) {
    if (lowerQuestion.includes(keyword)) claudeScore++;
  }
  
  for (const keyword of openaiKeywords) {
    if (lowerQuestion.includes(keyword)) openaiScore++;
  }
  
  // Check for URLs in the question - strong signal for Gemini
  if (/https?:\/\/[^\s]+/.test(question)) {
    geminiScore += 3;
  }
  
  // Additional heuristics
  if (lowerQuestion.includes('?') && lowerQuestion.split(' ').length > 15) {
    // Long questions tend to be better for Claude's analysis
    claudeScore++;
  }
  
  if (lowerQuestion.includes('```') || lowerQuestion.includes('function') || lowerQuestion.includes('const')) {
    // Code blocks suggest technical question
    openaiScore += 2;
  }
  
  // Return provider with highest score
  if (geminiScore > claudeScore && geminiScore > openaiScore) return 'gemini';
  if (openaiScore > claudeScore) return 'openai';
  return 'claude'; // Default to Claude for general questions
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

// Fetch profile directly from Neynar API
async function fetchUserProfile(username: string) {
  try {
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      console.error('NEYNAR_API_KEY not configured');
      return null;
    }

    const url = `https://api.neynar.com/v2/farcaster/user/by_username?username=${username}`;
    console.log(`Fetching profile for ${username} from Neynar API`);
    
    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'api_key': apiKey,
      },
    });
    
    if (!response.ok) {
      console.error(`Profile fetch failed: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`Profile fetched successfully for ${username}`);
    return data.user;
  } catch (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { 
      messages, 
      provider: requestedProvider, 
      castContext,
      mode = 'agent', // 'agent' or 'legacy'
      userId,
      intent,
      feedback
    } = await req.json();

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

        // Add cast context if provided
        let contextualMessage = userMessage;
        if (castContext) {
          contextualMessage = `[Context: Cast from @${castContext.author}: "${castContext.text}"]\n\n${userMessage}`;
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

    // If cast context is provided, prepend it to the conversation
    let conversationMessages = messages;
    if (castContext) {
      const contextMessage = {
        role: 'user',
        content: `[CONTEXT: Farcaster cast from @${castContext.author}: "${castContext.text}"]`
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
    const selectedProvider = requestedProvider || selectBestProvider(question);

    let response: string;
    let usedProvider = selectedProvider;

    try {
      if (selectedProvider === 'gemini' && gemini) {
        // Use Gemini with web search capability
        console.log('Using Gemini for web-enhanced response');
        const model = gemini.getGenerativeModel({ 
          model: 'gemini-2.0-flash-exp',
          systemInstruction: SYSTEM_PROMPT
        });
        
        // Build conversation history for Gemini
        const geminiHistory = conversationMessages
          .filter((msg: any) => msg.role !== 'system')
          .map((msg: any) => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          }));
        
        const result = await model.generateContent({
          contents: geminiHistory,
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 1024,
          }
        });
        
        response = result.response.text();
      } else if (selectedProvider === 'gemini' && !gemini) {
        // Fallback to Claude if Gemini is not available
        console.log('Gemini not available, falling back to Claude');
        const completion = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: conversationMessages.map((msg: any) => ({
            role: msg.role === 'system' ? 'user' : msg.role,
            content: msg.content,
          })),
        });

        response = completion.content[0].type === 'text' ? completion.content[0].text : '';
        usedProvider = 'claude';
      } else if (selectedProvider === 'claude') {
        // Use Claude (Anthropic)
        const completion = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: conversationMessages.map((msg: any) => ({
            role: msg.role === 'system' ? 'user' : msg.role,
            content: msg.content,
          })),
        });

        response = completion.content[0].type === 'text' ? completion.content[0].text : '';
      } else {
        // Use OpenAI
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: SYSTEM_PROMPT
            },
            ...conversationMessages
          ],
          temperature: 0.7,
          max_tokens: 500,
        });

        response = completion.choices[0].message.content || '';
      }
    } catch (primaryError) {
      // Fallback to alternate provider if primary fails
      console.warn(`${selectedProvider} failed, trying fallback provider:`, primaryError);
      
      const fallbackProvider = selectedProvider === 'claude' ? 'openai' : 'claude';
      usedProvider = `${fallbackProvider} (fallback)`;

      if (fallbackProvider === 'claude') {
        const completion = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: messages.map((msg: any) => ({
            role: msg.role === 'system' ? 'user' : msg.role,
            content: msg.content,
          })),
        });

        response = completion.content[0].type === 'text' ? completion.content[0].text : '';
      } else {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: SYSTEM_PROMPT
            },
            ...messages
          ],
          temperature: 0.7,
          max_tokens: 500,
        });

        response = completion.choices[0].message.content || '';
      }
    }

    return NextResponse.json({ response, provider: usedProvider, mode: 'legacy' });
  } catch (error) {
    console.error(`Error calling AI:`, error);
    return NextResponse.json(
      { error: `Failed to get response from AI` },
      { status: 500 }
    );
  }
}

// New endpoint for profile management
export async function PATCH(req: NextRequest) {
  try {
    const { userId, updates } = await req.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const updatedProfile = UserProfileStorage.updateProfile(userId, updates);
    const stats = UserProfileStorage.getStats(userId);

    return NextResponse.json({
      profile: updatedProfile,
      stats
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

// Get user stats
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const profile = UserProfileStorage.getProfile(userId);
    const stats = UserProfileStorage.getStats(userId);

    return NextResponse.json({
      profile,
      stats
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}
