import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { BufferMemory, ChatMessageHistory } from 'langchain/memory';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
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
  }).default({})
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
  protected memory: BufferMemory;
  protected systemPrompt: string;

  constructor(
    provider: 'openai' | 'anthropic' = 'anthropic',
    systemPrompt: string
  ) {
    if (provider === 'anthropic') {
      this.llm = new ChatAnthropic({
        modelName: 'claude-3-5-sonnet-20241022',
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
    this.memory = new BufferMemory({
      chatHistory: new ChatMessageHistory(),
      returnMessages: true,
      memoryKey: 'history'
    });
  }

  async chat(message: string, context?: string): Promise<string> {
    const messages: any[] = [new SystemMessage(this.systemPrompt)];
    
    if (context) {
      messages.push(new SystemMessage(`Context: ${context}`));
    }

    // Add memory
    const memoryVars = await this.memory.loadMemoryVariables({});
    if (memoryVars.history) {
      messages.push(...memoryVars.history);
    }

    messages.push(new HumanMessage(message));

    const response = await this.llm.invoke(messages);
    
    // Save to memory
    await this.memory.saveContext(
      { input: message },
      { output: response.content as string }
    );

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

  async analyzeCast(cast: string, metrics?: { likes?: number; recasts?: number; replies?: number }): Promise<string> {
    let prompt = `Analyze this Farcaster cast: "${cast}"`;
    
    if (metrics) {
      prompt += `\nMetrics: ${metrics.likes || 0} likes, ${metrics.recasts || 0} recasts, ${metrics.replies || 0} replies`;
    }

    prompt += '\n\nProvide specific feedback on what works and what could be improved.';

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
    intent: 'compose' | 'analyze' | 'learn' | 'research' | 'auto' = 'auto'
  ): Promise<AgentMessage> {
    // Auto-detect intent if not specified
    if (intent === 'auto') {
      intent = this.detectIntent(message);
    }

    switch (intent) {
      case 'compose':
        const composerResult = await this.composer.composeCast(message);
        return {
          role: 'composer',
          content: composerResult.reasoning,
          suggestions: composerResult.suggestions,
          metadata: { tips: composerResult.tips }
        };

      case 'analyze':
        const analysis = await this.coach.analyzeCast(message);
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
        const research = await this.researcher.research(message);
        return {
          role: 'researcher',
          content: research
        };

      default:
        return {
          role: 'coach',
          content: 'I can help you compose casts, analyze your content, learn from feedback, or research Farcaster topics. What would you like to do?'
        };
    }
  }

  private detectIntent(message: string): 'compose' | 'analyze' | 'learn' | 'research' {
    const lower = message.toLowerCase();

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

    // Default to compose for shorter messages
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
