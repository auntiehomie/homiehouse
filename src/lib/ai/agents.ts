import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { z } from 'zod';

// User profile schema
export const UserProfileSchema = z.object({
  fid: z.number().optional(),
  username: z.string().optional(),
  writingStyle: z.enum(['casual', 'professional', 'technical', 'creative']).default('casual'),
  preferredTone: z.enum(['friendly', 'informative', 'humorous', 'serious']).default('friendly'),
  topics: z.array(z.string()).default([]),
  castLength: z.enum(['short', 'medium', 'long']).default('medium'),
  useEmojis: z.boolean().default(true),
  useHashtags: z.boolean().default(false),
  learningPreferences: z.object({
    previousCasts: z.array(z.string()).default([]),
    feedbackHistory: z.array(z.object({
      cast: z.string(),
      feedback: z.string(),
      timestamp: z.number()
    })).default([]),
    commonPatterns: z.array(z.string()).default([])
  }).default({
    previousCasts: [],
    feedbackHistory: [],
    commonPatterns: []
  })
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

// Agent Types
export type AgentRole = 'composer' | 'analyzer' | 'coach' | 'researcher';

export interface AgentMessage {
  role: AgentRole;
  content: string;
  suggestions?: string[];
  metadata?: Record<string, any>;
}

// Base Agent Class
export class BaseAgent {
  protected llm: ChatOpenAI | ChatAnthropic;
  protected systemPrompt: string;
  protected conversationHistory: BaseMessage[] = [];

  constructor(
    provider: 'openai' | 'anthropic' = 'anthropic',
    systemPrompt: string
  ) {
    if (provider === 'anthropic') {
      this.llm = new ChatAnthropic({
        modelName: 'claude-3-5-sonnet-20240620',
        temperature: 0.7,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY
      });
    } else {
      this.llm = new ChatOpenAI({
        modelName: 'gpt-4o-mini',
        temperature: 0.7,
        openAIApiKey: process.env.OPENAI_API_KEY
      });
    }

    this.systemPrompt = systemPrompt;
  }

  async chat(message: string, context?: string): Promise<string> {
    const messages: BaseMessage[] = [new SystemMessage(this.systemPrompt)];
    
    if (context) {
      messages.push(new SystemMessage(`Context: ${context}`));
    }

    // Add conversation history
    messages.push(...this.conversationHistory);
    messages.push(new HumanMessage(message));

    const response = await this.llm.invoke(messages);
    
    // Update history
    this.conversationHistory.push(new HumanMessage(message));
    this.conversationHistory.push(new AIMessage(response.content as string));

    // Keep only last 10 messages to avoid token limits
    if (this.conversationHistory.length > 10) {
      this.conversationHistory = this.conversationHistory.slice(-10);
    }

    return response.content as string;
  }
}

// Cast Composer Agent - Helps write better Farcaster casts
export class CastComposerAgent extends BaseAgent {
  constructor(userProfile: UserProfile) {
    const systemPrompt = `You are an expert Farcaster cast composer. Your job is to help users write engaging, authentic casts.

User Profile:
- Writing Style: ${userProfile.writingStyle}
- Preferred Tone: ${userProfile.preferredTone}
- Cast Length Preference: ${userProfile.castLength}
- Use Emojis: ${userProfile.useEmojis ? 'Yes' : 'No'}
- Use Hashtags: ${userProfile.useHashtags ? 'Yes' : 'No'}
- Topics of Interest: ${userProfile.topics.join(', ') || 'Various'}

Guidelines:
1. Keep casts under 320 characters (Farcaster limit)
2. Match the user's style and tone
3. Make it authentic and engaging
4. Suggest improvements, don't rewrite completely
5. Offer 2-3 alternatives when appropriate
6. Consider Farcaster culture and best practices

When helping:
- Ask clarifying questions if needed
- Provide specific, actionable suggestions
- Explain WHY a change would improve the cast
- Learn from user feedback to improve future suggestions`;

    super('anthropic', systemPrompt);
  }

  async composeCast(
    userInput: string,
    context?: { topic?: string; replyTo?: string }
  ): Promise<{
    suggestions: string[];
    reasoning: string;
    tips: string[];
  }> {
    let prompt = `Help me write a Farcaster cast based on this: "${userInput}"`;
    
    if (context?.topic) {
      prompt += `\nTopic focus: ${context.topic}`;
    }
    if (context?.replyTo) {
      prompt += `\nReplying to: "${context.replyTo}"`;
    }

    prompt += '\n\nProvide 2-3 cast suggestions with brief reasoning for each.';

    const response = await this.chat(prompt);
    
    // Parse response to extract suggestions
    return this.parseComposerResponse(response);
  }

  private parseComposerResponse(response: string): {
    suggestions: string[];
    reasoning: string;
    tips: string[];
  } {
    const lines = response.split('\n').filter(l => l.trim());
    const suggestions: string[] = [];
    const tips: string[] = [];
    let reasoning = '';

    for (const line of lines) {
      // Look for numbered suggestions or quotes
      if (/^\d+[\.\)]/.test(line) || line.startsWith('"') || line.startsWith('•')) {
        const cleaned = line.replace(/^\d+[\.\)]\s*/, '').replace(/^["•]\s*/, '').replace(/"$/, '').trim();
        if (cleaned.length > 0 && cleaned.length <= 320) {
          suggestions.push(cleaned);
        }
      } else if (line.toLowerCase().includes('tip') || line.toLowerCase().includes('suggestion')) {
        tips.push(line);
      } else if (!reasoning && line.length > 20) {
        reasoning = line;
      }
    }

    return { suggestions, reasoning, tips };
  }
}

// Farcaster Coach Agent - Provides learning and improvement feedback
export class FarcasterCoachAgent extends BaseAgent {
  constructor() {
    const systemPrompt = `You are a Farcaster growth coach. You help users improve their Farcaster presence through:

1. Cast Quality Analysis - Review casts for engagement potential
2. Pattern Recognition - Identify what works for this user
3. Personalized Tips - Suggest improvements based on their style
4. Engagement Strategy - Help grow their audience authentically

Key Principles:
- Be encouraging but honest
- Focus on actionable feedback
- Help users find their authentic voice
- Avoid generic social media advice
- Understand Farcaster culture and norms

When analyzing casts:
- Consider timing, tone, length, and content
- Look for engagement hooks
- Check for clarity and authenticity
- Suggest specific improvements`;

    super('anthropic', systemPrompt);
  }

  async analyzeCast(castOrMessage: string, metrics?: { likes?: number; recasts?: number; replies?: number }): Promise<string> {
    // Check if this is a structured context message or just a cast
    const hasStructuredContext = castOrMessage.includes('Cast Author:') || 
                                  castOrMessage.includes('Cast Content:') ||
                                  castOrMessage.includes('IMPORTANT CONTEXT');
    
    let prompt: string;
    
    if (hasStructuredContext) {
      // Use the full context message as-is since it's already well-formatted
      prompt = `${castOrMessage}

Please provide thoughtful analysis of this cast. Consider:
- The cast's message and intent
- Tone and writing style
- Engagement potential
- What makes it interesting or noteworthy
- Any suggestions for similar future casts`;
    } else {
      // Simple cast analysis
      prompt = `Analyze this Farcaster cast: "${castOrMessage}"`;
      
      if (metrics) {
        prompt += `\nMetrics: ${metrics.likes || 0} likes, ${metrics.recasts || 0} recasts, ${metrics.replies || 0} replies`;
      }

      prompt += '\n\nProvide specific feedback on what works and what could be improved.';
    }

    return this.chat(prompt);
  }

  async generateLearningInsights(
    previousCasts: string[],
    feedbackHistory: Array<{ cast: string; feedback: string }>
  ): Promise<string> {
    const prompt = `Based on these previous casts and feedback, what patterns do you notice? What should the user focus on improving?

Previous Casts:
${previousCasts.slice(-5).map((c, i) => `${i + 1}. "${c}"`).join('\n')}

Recent Feedback:
${feedbackHistory.slice(-3).map(f => `Cast: "${f.cast}"\nFeedback: ${f.feedback}`).join('\n\n')}

Provide 3-5 key learning insights and actionable recommendations.`;

    return this.chat(prompt);
  }
}

// Farcaster Research Agent - Helps with research and context
export class FarcasterResearchAgent extends BaseAgent {
  constructor() {
    const systemPrompt = `You are a Farcaster research assistant. You help users:

1. Understand trending topics and conversations
2. Learn about users, projects, and communities
3. Get context on technical concepts and terms
4. Discover relevant channels and discussions

Farcaster Knowledge:
- Farcaster is a sufficiently decentralized social protocol
- Built on Ethereum/Optimism
- Users own their social graph via FIDs
- Casts are the equivalent of tweets
- Channels are topic-based communities
- Frames enable interactive experiences

Be accurate, cite what you know, and admit when you're not certain.`;

    super('anthropic', systemPrompt);
  }

  async research(query: string, context?: string): Promise<string> {
    let prompt = `Research and explain: ${query}`;
    
    if (context) {
      prompt += `\n\nContext: ${context}`;
    }

    return this.chat(prompt);
  }
}

// Search for similar casts to enrich context
async function searchSimilarCasts(castText: string): Promise<string> {
  try {
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      console.log('NEYNAR_API_KEY not configured for cast search');
      return '';
    }

    // Extract keywords from the cast
    const keywords = extractKeywordsForSearch(castText);
    if (keywords.length === 0) return '';

    console.log(`🔍 Searching for similar casts about: ${keywords.slice(0, 3).join(', ')}`);

    // Search for casts with similar content
    const searchQuery = keywords.slice(0, 3).join(' ');
    const url = `https://api.neynar.com/v2/farcaster/cast/search?q=${encodeURIComponent(searchQuery)}&limit=10`;

    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'api_key': apiKey,
      },
    });

    if (!response.ok) {
      console.error(`Cast search failed: ${response.status}`);
      return '';
    }

    const data = await response.json();
    const casts = data.casts || [];

    if (casts.length === 0) {
      console.log('📭 No similar casts found');
      return '';
    }

    // Filter for relevant, engaging casts
    const relevantCasts = casts
      .filter((c: any) => {
        // Skip if it's too short or too old
        const hoursOld = (Date.now() - new Date(c.timestamp).getTime()) / (1000 * 60 * 60);
        return c.text.length > 50 && hoursOld < 48; // Last 48 hours
      })
      .slice(0, 5);

    if (relevantCasts.length === 0) {
      console.log('📭 No recent relevant casts found');
      return '';
    }

    console.log(`✅ Found ${relevantCasts.length} similar casts for context`);

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
function extractKeywordsForSearch(text: string): string[] {
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

// Agent Orchestrator - Coordinates multiple agents
export class AgentOrchestrator {
  private composer: CastComposerAgent;
  private coach: FarcasterCoachAgent;
  private researcher: FarcasterResearchAgent;
  private userProfile: UserProfile;

  constructor(userProfile: UserProfile) {
    this.userProfile = userProfile;
    this.composer = new CastComposerAgent(userProfile);
    this.coach = new FarcasterCoachAgent();
    this.researcher = new FarcasterResearchAgent();
  }

  async processRequest(
    message: string,
    intent: 'compose' | 'analyze' | 'learn' | 'research' | 'curate' | 'auto' = 'auto'
  ): Promise<AgentMessage> {
    // Auto-detect intent if not specified
    if (intent === 'auto') {
      intent = this.detectIntent(message);
      console.log(`🎯 Auto-detected intent: ${intent}`);
    }

    // Check if message contains cast context (for analysis)
    const hasCastContext = message.includes('Cast Author:') || 
                           message.includes('Cast Content:') || 
                           message.includes('IMPORTANT CONTEXT');
    
    if (hasCastContext) {
      console.log('📋 Cast context detected in message');
    }
    
    let enrichedMessage = message;

    // If analyzing a cast, search for similar casts to enrich context
    if (hasCastContext) {
      console.log('📊 Detected cast context, searching for similar casts...');
      
      // Extract the cast text from the context - try multiple patterns
      let castText = '';
      
      // Pattern 1: Cast Content: "..."
      const contentMatch = message.match(/Cast Content: "([^"]+)"/);
      if (contentMatch && contentMatch[1]) {
        castText = contentMatch[1];
      }
      
      // Pattern 2: text field in context
      const textMatch = message.match(/text:\s*"([^"]+)"/i);
      if (!castText && textMatch && textMatch[1]) {
        castText = textMatch[1];
      }

      if (castText && castText.length > 20) {
        console.log(`🔍 Searching for similar casts to: "${castText.slice(0, 80)}..."`);
        const similarCastsContext = await searchSimilarCasts(castText);
        if (similarCastsContext) {
          enrichedMessage = message + similarCastsContext;
          console.log('✅ Enriched context with similar casts');
        }
      } else {
        console.log('⚠️ Could not extract cast text for similar search');
      }
    }

    switch (intent) {
      case 'compose':
        const composerResult = await this.composer.composeCast(enrichedMessage);
        return {
          role: 'composer',
          content: composerResult.reasoning,
          suggestions: composerResult.suggestions,
          metadata: { tips: composerResult.tips }
        };

      case 'analyze':
        const analysis = await this.coach.analyzeCast(enrichedMessage);
        return {
          role: 'coach',
          content: analysis
        };

      case 'learn':
        const insights = await this.coach.generateLearningInsights(
          this.userProfile.learningPreferences.previousCasts,
          this.userProfile.learningPreferences.feedbackHistory
        );
        return {
          role: 'coach',
          content: insights
        };

      case 'research':
        const research = await this.researcher.research(enrichedMessage);
        return {
          role: 'researcher',
          content: research
        };

      case 'curate':
        const curationResponse = await this.handleFeedCuration(enrichedMessage);
        return {
          role: 'coach',
          content: curationResponse.content,
          metadata: curationResponse.metadata
        };

      default:
        return {
          role: 'coach',
          content: 'I can help you compose casts, analyze your content, learn from feedback, or research Farcaster topics. What would you like to do?'
        };
    }
  }

  private async handleFeedCuration(message: string): Promise<{ content: string; metadata: any }> {
    const systemPrompt = `You are a helpful Farcaster feed curation assistant. Your job is to help users customize their home feed by suggesting topics, channels, and interests they might want to see more of.

When users ask about feed customization, suggest specific interests as single-word or short phrases (e.g., "crypto", "nft", "art", "trading", "tech", "politics", "music").

If users mention specific topics they like or want to see more of, extract those as interest keywords.

Be conversational and helpful. Explain how their interests will help prioritize relevant content in their feed.`;

    const contextMessage = `The user currently wants to customize their Farcaster feed. ${message}

Based on what they've said, suggest 3-5 specific interests they might want to add to their feed. Format your response as a friendly explanation followed by a list of suggested interests.`;

    const tempAgent = new BaseAgent('anthropic', systemPrompt);
    const response = await tempAgent.chat(contextMessage);

    // Extract suggested interests from response (look for common patterns)
    const suggestedInterests: string[] = [];
    const interestMatches = response.match(/["']([a-zA-Z0-9\-]+)["']/g);
    if (interestMatches) {
      interestMatches.forEach(match => {
        const interest = match.replace(/["']/g, '');
        if (interest.length >= 3 && interest.length <= 20) {
          suggestedInterests.push(interest);
        }
      });
    }

    return {
      content: response,
      metadata: {
        suggestedInterests: suggestedInterests.slice(0, 5)
      }
    };
  }

  private detectIntent(message: string): 'compose' | 'analyze' | 'learn' | 'research' | 'curate' {
    const lower = message.toLowerCase();

    // Check if cast context is present (user is asking about a specific cast)
    const hasCastContext = message.includes('Cast Author:') || 
                           message.includes('Cast Content:') || 
                           message.includes('IMPORTANT CONTEXT');
    
    // If cast context is present, prioritize analyze intent for most questions
    if (hasCastContext) {
      // Questions about the cast should be analyze
      if (
        lower.includes('what do you think') ||
        lower.includes('your thoughts') ||
        lower.includes('opinion') ||
        lower.includes('analyze') ||
        lower.includes('why') ||
        lower.includes('how') ||
        lower.includes('what') ||
        lower.includes('this cast') ||
        lower.includes('about this') ||
        lower.includes('tell me about')
      ) {
        return 'analyze';
      }
    }

    // Curate intent (feed customization)
    if (
      lower.includes('curate') ||
      lower.includes('customize my feed') ||
      lower.includes('feed preferences') ||
      lower.includes('what should i follow') ||
      lower.includes('topics i like') ||
      lower.includes('interests') ||
      lower.includes('show me more') ||
      lower.includes('see less') ||
      lower.includes('filter my feed')
    ) {
      return 'curate';
    }

    // Compose intent
    if (
      lower.includes('write') ||
      lower.includes('compose') ||
      lower.includes('create a cast') ||
      lower.includes('help me post') ||
      lower.includes('how should i say')
    ) {
      return 'compose';
    }

    // Analyze intent
    if (
      lower.includes('analyze') ||
      lower.includes('feedback on') ||
      lower.includes('review this') ||
      lower.includes('thoughts on this cast') ||
      lower.includes('how is this')
    ) {
      return 'analyze';
    }

    // Learn intent
    if (
      lower.includes('improve') ||
      lower.includes('better at') ||
      lower.includes('learn') ||
      lower.includes('tips') ||
      lower.includes('advice')
    ) {
      return 'learn';
    }

    // Research intent
    if (
      lower.includes('what is') ||
      lower.includes('who is') ||
      lower.includes('explain') ||
      lower.includes('tell me about') ||
      lower.includes('research')
    ) {
      return 'research';
    }

    // Default to compose for shorter messages, research for longer
    return message.length < 100 ? 'compose' : 'research';
  }

  updateUserProfile(updates: Partial<UserProfile>): void {
    this.userProfile = { ...this.userProfile, ...updates };
    // Recreate composer with updated profile
    this.composer = new CastComposerAgent(this.userProfile);
  }

  addFeedback(cast: string, feedback: string): void {
    this.userProfile.learningPreferences.feedbackHistory.push({
      cast,
      feedback,
      timestamp: Date.now()
    });
  }

  addCast(cast: string): void {
    this.userProfile.learningPreferences.previousCasts.push(cast);
    // Keep only last 50 casts
    if (this.userProfile.learningPreferences.previousCasts.length > 50) {
      this.userProfile.learningPreferences.previousCasts.shift();
    }
  }
}
