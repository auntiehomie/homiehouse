import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { AgentOrchestrator } from '@/lib/ai/agents';
import { UserProfileStorage } from '@/lib/ai/storage';

const AI_PROVIDER = process.env.AI_PROVIDER || 'openai'; // 'openai' or 'claude'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

When analyzing Farcaster casts:
- Help explain tokens, projects, and crypto concepts mentioned
- Provide context about users and trends
- Analyze sentiment and engagement
- Explain technical terms and abbreviations
- Identify potential scams or risky content

Be friendly, concise, and accurate. If you're not certain about something, say so rather than guessing.`;

// Intelligent provider selection based on question content
function selectBestProvider(question: string): 'claude' | 'openai' {
  const lowerQuestion = question.toLowerCase();
  
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
  
  let claudeScore = 0;
  let openaiScore = 0;
  
  // Count keyword matches
  for (const keyword of claudeKeywords) {
    if (lowerQuestion.includes(keyword)) claudeScore++;
  }
  
  for (const keyword of openaiKeywords) {
    if (lowerQuestion.includes(keyword)) openaiScore++;
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
  
  // Default to Claude if no clear winner (Claude handles general questions well)
  return openaiScore > claudeScore ? 'openai' : 'claude';
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

    // If cast context is provided, prepend it to the conversation
    let conversationMessages = messages;
    if (castContext) {
      const contextMessage = {
        role: 'user',
        content: `[CONTEXT: Farcaster cast from @${castContext.author}: "${castContext.text}"]`
      };
      conversationMessages = [contextMessage, ...messages];
    }

    // Smart provider selection: use requested provider, or auto-select based on content
    const selectedProvider = requestedProvider || selectBestProvider(question);

    let response: string;
    let usedProvider = selectedProvider;

    try {
      if (selectedProvider === 'claude') {
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
