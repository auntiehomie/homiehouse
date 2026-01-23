import { NeynarAPIClient } from '@neynar/nodejs-sdk';

const neynar = new NeynarAPIClient(process.env.NEYNAR_API_KEY!);

interface FeedInsight {
  trendingTopics: string[];
  popularCasts: Array<{
    text: string;
    author: string;
    likes: number;
    channel?: string;
  }>;
  channelActivity: Map<string, string[]>;
  recentConversations: Array<{
    topic: string;
    context: string;
  }>;
  timestamp: number;
}

// Cache feed insights for 15 minutes
let feedInsightsCache: FeedInsight | null = null;
const FEED_CACHE_TTL = 900000; // 15 minutes

/**
 * Fetch and analyze the global Farcaster feed for context
 */
export async function getFeedIntelligence(): Promise<string> {
  try {
    // Return cached insights if fresh
    if (feedInsightsCache && Date.now() - feedInsightsCache.timestamp < FEED_CACHE_TTL) {
      return formatFeedInsights(feedInsightsCache);
    }

    console.log('🌐 Fetching feed intelligence from Farcaster...');

    // Fetch trending casts
    const trendingResponse = await neynar.fetchTrendingFeed({
      limit: 20,
      timeWindow: '24h' as any
    });

    const insights: FeedInsight = {
      trendingTopics: [],
      popularCasts: [],
      channelActivity: new Map(),
      recentConversations: [],
      timestamp: Date.now()
    };

    // Extract trending topics and popular content
    const topicCounts = new Map<string, number>();
    const channelTopics = new Map<string, Set<string>>();

    for (const cast of trendingResponse.casts) {
      // Collect popular casts
      if (cast.reactions.likes_count > 10) {
        insights.popularCasts.push({
          text: cast.text.slice(0, 150),
          author: cast.author.username,
          likes: cast.reactions.likes_count,
          channel: cast.channel?.name
        });
      }

      // Track channel activity
      if (cast.channel?.name) {
        const channelName = cast.channel.name;
        if (!channelTopics.has(channelName)) {
          channelTopics.set(channelName, new Set());
        }
        
        // Extract keywords from cast
        const keywords = extractKeywords(cast.text);
        keywords.forEach(kw => channelTopics.get(channelName)?.add(kw));
      }

      // Count topic mentions
      extractKeywords(cast.text).forEach(topic => {
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
      });
    }

    // Get top trending topics
    insights.trendingTopics = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic]) => topic);

    // Build channel activity context
    for (const [channel, topics] of channelTopics.entries()) {
      if (topics.size > 0) {
        insights.channelActivity.set(channel, Array.from(topics).slice(0, 5));
      }
    }

    // Cache the results
    feedInsightsCache = insights;
    console.log(`✓ Feed intelligence cached: ${insights.trendingTopics.length} trending topics`);

    return formatFeedInsights(insights);
  } catch (error) {
    console.error('Error fetching feed intelligence:', error);
    return '';
  }
}

/**
 * Get context about a specific channel from recent activity
 */
export async function getChannelContext(channelId: string): Promise<string> {
  try {
    console.log(`🔍 Fetching context for channel: ${channelId}`);

    const response = await neynar.fetchFeed('filter', {
      filterType: 'channel_id',
      channelId,
      limit: 15
    });

    const topics = new Set<string>();
    const recentDiscussions: string[] = [];

    for (const cast of response.casts.slice(0, 10)) {
      // Extract keywords
      const keywords = extractKeywords(cast.text);
      keywords.forEach(kw => topics.add(kw));

      // Collect discussion snippets
      if (cast.text.length > 50 && cast.reactions.likes_count > 3) {
        recentDiscussions.push(cast.text.slice(0, 100));
      }
    }

    let context = `\n\nCHANNEL /${channelId} CONTEXT:`;
    
    if (topics.size > 0) {
      const topicList = Array.from(topics).slice(0, 8).join(', ');
      context += `\n- Current topics: ${topicList}`;
    }

    if (recentDiscussions.length > 0) {
      context += `\n- Recent discussions involve: ${recentDiscussions[0]}`;
    }

    return context;
  } catch (error) {
    console.error(`Error fetching channel context for ${channelId}:`, error);
    return '';
  }
}

/**
 * Analyze a user's network and interactions for better context
 */
export async function getUserNetworkContext(fid: number): Promise<string> {
  try {
    console.log(`👥 Analyzing network for FID ${fid}`);

    // Get user's recent casts to understand their network
    const userCasts = await neynar.fetchCastsForUser(fid, { limit: 10 });

    const interactions = new Set<string>();
    const mentionedTopics = new Set<string>();

    for (const cast of userCasts.casts) {
      // Track who they interact with
      const parentAuthor = (cast as any).parent_author;
      if (parentAuthor?.username) {
        interactions.add(parentAuthor.username);
      }

      // Track what they talk about
      extractKeywords(cast.text).forEach(topic => mentionedTopics.add(topic));
    }

    let context = '';
    
    if (interactions.size > 0) {
      const userList = Array.from(interactions).slice(0, 5).join(', ');
      context += `\n- Often interacts with: ${userList}`;
    }

    if (mentionedTopics.size > 0) {
      const topicList = Array.from(mentionedTopics).slice(0, 6).join(', ');
      context += `\n- Recently discussed: ${topicList}`;
    }

    return context;
  } catch (error) {
    console.error(`Error fetching network context for FID ${fid}:`, error);
    return '';
  }
}

/**
 * Search for relevant casts about a specific topic
 */
export async function searchRelevantCasts(query: string): Promise<string> {
  try {
    console.log(`🔎 Searching casts for: ${query}`);

    const response = await neynar.searchCasts(query, {
      limit: 10
    }) as any;

    if (!response.casts || response.casts.length === 0) {
      return '';
    }

    let context = `\n\nRECENT CASTS ABOUT "${query}":`;
    
    // Get top relevant casts
    const relevantCasts = response.casts
      .filter((cast: any) => cast.reactions.likes_count > 2)
      .slice(0, 3);

    for (const cast of relevantCasts) {
      const snippet = cast.text.slice(0, 120);
      const author = cast.author.username;
      const likes = cast.reactions.likes_count;
      
      context += `\n- @${author} (${likes}❤️): "${snippet}"`;
    }

    return context;
  } catch (error) {
    console.error(`Error searching casts for "${query}":`, error);
    return '';
  }
}

/**
 * Get trending conversations to understand current discourse
 */
export async function getTrendingConversations(): Promise<string> {
  try {
    console.log('💬 Fetching trending conversations...');

    const response = await neynar.fetchTrendingFeed({
      limit: 15,
      timeWindow: '24h' as any
    });

    const conversations: Array<{ topic: string; engagement: number }> = [];
    const topicMap = new Map<string, number>();

    for (const cast of response.casts) {
      // Look for casts with high engagement (conversation starters)
      const engagement = cast.reactions.likes_count + cast.replies.count * 2;
      
      if (engagement > 15 && cast.text.length > 80) {
        // Extract main topic/theme
        const keywords = extractKeywords(cast.text);
        keywords.forEach(kw => {
          topicMap.set(kw, (topicMap.get(kw) || 0) + engagement);
        });
      }
    }

    // Get top conversation topics
    const topConversations = Array.from(topicMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);

    if (topConversations.length === 0) {
      return '';
    }

    return `\n\nTRENDING CONVERSATIONS: ${topConversations.join(', ')}`;
  } catch (error) {
    console.error('Error fetching trending conversations:', error);
    return '';
  }
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): string[] {
  const cleaned = text.toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/[^a-z0-9\s@#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ').filter(w => w.length > 3);
  
  // Common keywords in crypto/tech/farcaster space
  const relevantKeywords = [
    'bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'defi', 'nft', 'dao', 'web3',
    'farcaster', 'warpcast', 'degen', 'base', 'onchain', 'blockchain',
    'token', 'coin', 'wallet', 'trading', 'market', 'price',
    'ai', 'chatgpt', 'claude', 'llm', 'agent', 'model',
    'building', 'shipping', 'launch', 'beta', 'alpha',
    'music', 'art', 'gaming', 'sports', 'tech', 'code',
    'meme', 'vibe', 'based', 'bullish', 'bearish',
    'worldcoin', 'orb', 'world', 'chain', 'solana', 'avax'
  ];

  return words.filter(word => relevantKeywords.includes(word));
}

/**
 * Format feed insights into context string
 */
function formatFeedInsights(insights: FeedInsight): string {
  let context = '\n\nCURRENT FARCASTER CONTEXT:';

  if (insights.trendingTopics.length > 0) {
    context += `\n- Trending: ${insights.trendingTopics.slice(0, 8).join(', ')}`;
  }

  if (insights.popularCasts.length > 0) {
    const topCast = insights.popularCasts[0];
    context += `\n- Hot take: "@${topCast.author}: ${topCast.text.slice(0, 80)}..." (${topCast.likes}❤️)`;
  }

  if (insights.channelActivity.size > 0) {
    const activeChannels = Array.from(insights.channelActivity.keys()).slice(0, 3);
    context += `\n- Active channels: ${activeChannels.map(c => `/${c}`).join(', ')}`;
  }

  return context;
}

/**
 * Get comprehensive context by combining multiple sources
 */
export async function getComprehensiveContext(params: {
  userFid?: number;
  channelId?: string;
  searchQuery?: string;
  includeFeed?: boolean;
}): Promise<string> {
  const contexts: string[] = [];

  try {
    // Get feed intelligence if requested
    if (params.includeFeed !== false) {
      const feedContext = await getFeedIntelligence();
      if (feedContext) contexts.push(feedContext);
    }

    // Get channel context if specified
    if (params.channelId) {
      const channelContext = await getChannelContext(params.channelId);
      if (channelContext) contexts.push(channelContext);
    }

    // Get user network context if specified
    if (params.userFid) {
      const networkContext = await getUserNetworkContext(params.userFid);
      if (networkContext) contexts.push(networkContext);
    }

    // Search for relevant casts if query provided
    if (params.searchQuery) {
      const searchContext = await searchRelevantCasts(params.searchQuery);
      if (searchContext) contexts.push(searchContext);
    }

    return contexts.join('\n');
  } catch (error) {
    console.error('Error building comprehensive context:', error);
    return '';
  }
}
