#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const USER_FID = process.env.USER_FID || '1987078';

if (!NEYNAR_API_KEY || !ANTHROPIC_API_KEY) {
  throw new Error('Missing required environment variables: NEYNAR_API_KEY and ANTHROPIC_API_KEY');
}

const neynar = new NeynarAPIClient({ apiKey: NEYNAR_API_KEY });
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// System prompt for Claude to act as a friendly Farcaster assistant
const FARCASTER_EXPERT_PROMPT = `You are a friendly, knowledgeable Farcaster expert assistant. You help users understand Farcaster casts and the ecosystem.

Key Farcaster concepts you understand:
- **Frames**: Interactive mini-apps embedded in casts (buttons, images, forms)
- **Channels**: Topic-based communities (like /base, /farcaster, /dev)
- **SnapChain**: A gaming/social app on Farcaster where users snap photos and compete
- **Warpcast**: The main Farcaster client app
- **Casts**: Posts on Farcaster (like tweets)
- **Recasts**: Sharing someone else's cast (like retweets)
- **FID**: Farcaster ID (unique user identifier)
- **Power Badge**: Verification for active, quality users
- **Moxie**: Social reputation token earned through engagement
- **Degen**: Community token for the /degen channel
- **Higher**: Aspirational community and token

When analyzing casts, consider:
1. **Context**: What channel/topic is this about?
2. **Engagement**: Should the user respond? Like? Recast?
3. **Relevance**: How does this relate to their interests?
4. **Social dynamics**: Who posted it? Are they influential?
5. **Actionable insights**: What can the user do with this information?

Be conversational, helpful, and insightful - like a friend who really knows Farcaster would be.`;

// Define MCP tools
const tools: Tool[] = [
  {
    name: 'get_cast_details',
    description: 'Get detailed information about a specific Farcaster cast by hash or URL. Returns cast content, author, engagement metrics, and provides AI-powered insights.',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: {
          type: 'string',
          description: 'Cast hash or Warpcast URL (e.g., 0x123... or https://warpcast.com/username/0x123...)',
        },
      },
      required: ['identifier'],
    },
  },
  {
    name: 'read_feed',
    description: 'Read the Farcaster feed and get AI-powered insights. Can filter by feed type (following, global) or specific channel.',
    inputSchema: {
      type: 'object',
      properties: {
        feed_type: {
          type: 'string',
          enum: ['following', 'global', 'channel'],
          description: 'Type of feed to read',
        },
        channel: {
          type: 'string',
          description: 'Channel ID (e.g., "base", "farcaster", "degen") - only used when feed_type is "channel"',
        },
        limit: {
          type: 'number',
          description: 'Number of casts to retrieve (default: 10, max: 25)',
          default: 10,
        },
        get_insights: {
          type: 'boolean',
          description: 'Whether to generate AI insights for the feed (default: true)',
          default: true,
        },
      },
      required: ['feed_type'],
    },
  },
  {
    name: 'get_user_profile',
    description: 'Get detailed information about a Farcaster user by FID or username.',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: {
          type: 'string',
          description: 'FID number or username (without @)',
        },
      },
      required: ['identifier'],
    },
  },
  {
    name: 'search_casts',
    description: 'Search for Farcaster casts by keyword or phrase and get AI insights.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        limit: {
          type: 'number',
          description: 'Number of results (default: 10, max: 25)',
          default: 10,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'explain_cast',
    description: 'Get a friendly, detailed explanation of a cast - what it means, context, and suggested actions.',
    inputSchema: {
      type: 'object',
      properties: {
        cast_hash: {
          type: 'string',
          description: 'Hash of the cast to explain',
        },
      },
      required: ['cast_hash'],
    },
  },
];

// Helper: Extract cast hash from URL or hash
function extractCastHash(identifier: string): string {
  if (identifier.startsWith('http')) {
    const match = identifier.match(/0x[a-fA-F0-9]+/);
    return match ? match[0] : identifier;
  }
  return identifier;
}

// Helper: Get AI insights using Claude
async function getAIInsights(prompt: string): Promise<string> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20250122',
      max_tokens: 1024,
      system: FARCASTER_EXPERT_PROMPT,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textContent = message.content.find((block) => block.type === 'text');
    return textContent && 'text' in textContent ? textContent.text : 'No insights generated.';
  } catch (error) {
    console.error('Error getting AI insights:', error);
    return 'Unable to generate insights at this time.';
  }
}

// Helper: Format cast for display
function formatCast(cast: any): string {
  const author = cast.author;
  const metrics = cast.reactions || {};
  
  return `
**@${author.username}** (FID: ${author.fid})${author.power_badge ? ' 🔵' : ''}
${cast.text}
${cast.embeds?.length ? `\n📎 Embeds: ${cast.embeds.length}` : ''}
❤️ ${metrics.likes_count || 0} | 🔁 ${metrics.recasts_count || 0} | 💬 ${metrics.replies_count || 0}
Posted: ${new Date(cast.timestamp).toLocaleString()}
Hash: ${cast.hash}
`.trim();
}

// MCP Server
const server = new Server(
  {
    name: 'homiehouse-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    return {
      content: [{ type: 'text', text: 'Error: No arguments provided' }],
      isError: true,
    };
  }

  try {
    switch (name) {
      case 'get_cast_details': {
        const hash = extractCastHash(args.identifier as string);
        const response = await fetch(
          `https://api.neynar.com/v2/farcaster/cast?identifier=${hash}&type=hash`,
          {
            headers: {
              accept: 'application/json',
              api_key: NEYNAR_API_KEY!,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch cast: ${response.statusText}`);
        }

        const data = await response.json();
        const cast = data.cast;

        const formattedCast = formatCast(cast);
        
        // Get AI insights
        const insights = await getAIInsights(
          `Analyze this Farcaster cast and provide friendly insights:\n\n${formattedCast}`
        );

        return {
          content: [
            {
              type: 'text',
              text: `${formattedCast}\n\n---\n\n**🤖 Insights:**\n${insights}`,
            },
          ],
        };
      }

      case 'read_feed': {
        const feedType = args.feed_type as string;
        const channel = args.channel as string | undefined;
        const limit = Math.min((args.limit as number) || 10, 25);
        const getInsights = args.get_insights !== false;

        let url = 'https://api.neynar.com/v2/farcaster/feed';
        const params = new URLSearchParams({
          limit: limit.toString(),
          viewer_fid: USER_FID,
        });

        if (feedType === 'following') {
          url += '/following';
          params.append('fid', USER_FID);
        } else if (feedType === 'channel' && channel) {
          url += `/channels?channel_ids=${channel}`;
        } else {
          url += '?feed_type=filter&filter_type=global_trending';
        }

        const response = await fetch(`${url}?${params}`, {
          headers: {
            accept: 'application/json',
            api_key: NEYNAR_API_KEY!,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch feed: ${response.statusText}`);
        }

        const data = await response.json();
        const casts = data.casts || [];

        let feedSummary = casts.map((cast: any, idx: number) => 
          `\n**${idx + 1}.** ${formatCast(cast)}`
        ).join('\n\n---\n');

        let insights = '';
        if (getInsights && casts.length > 0) {
          insights = await getAIInsights(
            `Here's the current ${feedType} feed${channel ? ` in /${channel}` : ''}:\n\n${feedSummary}\n\nProvide a friendly overview of what's happening and what the user should pay attention to.`
          );
        }

        return {
          content: [
            {
              type: 'text',
              text: insights 
                ? `**📱 ${feedType.toUpperCase()} Feed${channel ? ` - /${channel}` : ''}**\n\n${feedSummary}\n\n---\n\n**🤖 Insights:**\n${insights}`
                : `**📱 ${feedType.toUpperCase()} Feed${channel ? ` - /${channel}` : ''}**\n\n${feedSummary}`,
            },
          ],
        };
      }

      case 'get_user_profile': {
        const identifier = args.identifier as string;
        const isNumeric = /^\d+$/.test(identifier);
        
        const url = isNumeric
          ? `https://api.neynar.com/v2/farcaster/user/bulk?fids=${identifier}`
          : `https://api.neynar.com/v1/farcaster/user-by-username?username=${identifier}`;

        const response = await fetch(url, {
          headers: {
            accept: 'application/json',
            api_key: NEYNAR_API_KEY!,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch user: ${response.statusText}`);
        }

        const data = await response.json();
        const user = isNumeric ? data.users[0] : data.result.user;

        const profile = `
**${user.display_name}** (@${user.username})${user.power_badge ? ' 🔵' : ''}
FID: ${user.fid}
${user.profile.bio.text || 'No bio'}

👥 Following: ${user.following_count || 0} | Followers: ${user.follower_count || 0}
${user.verified_addresses?.eth_addresses?.length ? `\n💎 ETH: ${user.verified_addresses.eth_addresses[0]}` : ''}
`.trim();

        const insights = await getAIInsights(
          `Tell me about this Farcaster user:\n\n${profile}`
        );

        return {
          content: [
            {
              type: 'text',
              text: `${profile}\n\n---\n\n**🤖 Insights:**\n${insights}`,
            },
          ],
        };
      }

      case 'search_casts': {
        const query = args.query as string;
        const limit = Math.min((args.limit as number) || 10, 25);

        const response = await fetch(
          `https://api.neynar.com/v2/farcaster/cast/search?q=${encodeURIComponent(query)}&limit=${limit}`,
          {
            headers: {
              accept: 'application/json',
              api_key: NEYNAR_API_KEY!,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to search: ${response.statusText}`);
        }

        const data = await response.json();
        const casts = data.casts || [];

        const results = casts.map((cast: any, idx: number) => 
          `\n**${idx + 1}.** ${formatCast(cast)}`
        ).join('\n\n---\n');

        const insights = await getAIInsights(
          `Search results for "${query}":\n\n${results}\n\nSummarize what's being discussed and highlight interesting findings.`
        );

        return {
          content: [
            {
              type: 'text',
              text: `**🔍 Search: "${query}"**\n\n${results}\n\n---\n\n**🤖 Insights:**\n${insights}`,
            },
          ],
        };
      }

      case 'explain_cast': {
        const hash = args.cast_hash as string;
        
        const response = await fetch(
          `https://api.neynar.com/v2/farcaster/cast?identifier=${hash}&type=hash`,
          {
            headers: {
              accept: 'application/json',
              api_key: NEYNAR_API_KEY!,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch cast: ${response.statusText}`);
        }

        const data = await response.json();
        const cast = data.cast;

        const formattedCast = formatCast(cast);
        
        const explanation = await getAIInsights(
          `Explain this Farcaster cast in detail - what it means, the context, why it matters, and what the user should do (like, recast, reply, ignore, etc.):\n\n${formattedCast}`
        );

        return {
          content: [
            {
              type: 'text',
              text: `${formattedCast}\n\n---\n\n**💡 Explanation:**\n${explanation}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Homiehouse MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
