# Farcaster Cast Search Feature

## Overview
Added AI-powered search capabilities to the Ask Homie assistant, allowing it to search for Farcaster casts by keyword/topic and retrieve casts from specific users.

## Implementation Date
January 2025

## What Was Added

### 1. Search Functions in Neynar Library
**File:** `src/lib/neynar.ts`

Added two new Neynar API wrapper functions:

#### `searchCasts(query: string, limit: number = 10)`
- Searches for casts matching a keyword or phrase
- Uses Neynar API endpoint: `/cast/search`
- Returns array of matching casts with author info and engagement metrics
- Max limit: 25 casts

#### `getCastsByUsername(username: string, limit: number = 25)`
- Fetches recent casts from a specific Farcaster user
- First looks up user by username to get their FID
- Then fetches their casts via `/feed/user/{fid}/casts`
- Max limit: 100 casts

### 2. LangChain Tool Integration
**File:** `src/lib/ai/agents.ts`

#### Created Tool Wrappers

**`createSearchCastsTool()`**
- LangChain DynamicStructuredTool wrapper for searchCasts()
- Tool name: `search_farcaster_casts`
- Schema: `{ query: string, limit?: number }`
- Description guides AI when to use this tool (finding casts about topics)

**`createGetCastsByUserTool()`**
- LangChain DynamicStructuredTool wrapper for getCastsByUsername()
- Tool name: `get_user_casts`
- Schema: `{ username: string, limit?: number }`
- Description guides AI when to use this tool (analyzing user posting style)

#### Enhanced BaseAgent Class
- Added `tools` property to store available tools
- Updated constructor to accept tools array
- Enhanced `chat()` method to:
  - Bind tools to the LLM using `bindTools()`
  - Detect when model wants to use tools (checks `tool_calls`)
  - Execute tool calls automatically
  - Pass tool results back to model for final response
  - Handle tool errors gracefully

#### Updated FarcasterCoachAgent
- Now uses OpenAI (GPT-4o) as primary provider (better tool calling support)
- System prompt updated to mention 5 capabilities including "Cast Discovery"
- Lists available tools in system prompt
- Automatically has both search tools available
- Instructs AI to use search tools when asked to find similar casts

### 3. API Route Updates
**File:** `src/app/api/ask-homie/route.ts`

#### Updated System Prompts

**Agent Mode:**
- Changed from "You cannot search for other casts" to "You have search tools available"
- Added guidance: "Use the search_farcaster_casts tool to find casts by topic or keyword"

**Legacy Mode (SYSTEM_PROMPT):**
- Updated capabilities list to include search functionality
- Added tool usage instructions
- Removed limitation about not being able to search

## How It Works

### User Flow
1. User selects a cast in Ask Homie
2. User asks: "can you find similar casts to this one?"
3. AI agent receives the request with full cast context
4. AI decides to use `search_farcaster_casts` tool
5. Tool extracts keywords from the cast and searches Farcaster
6. Results returned as JSON to the AI
7. AI analyzes results and presents them to user in natural language

### Technical Flow
```
User Request
    ↓
AgentOrchestrator (agent mode)
    ↓
FarcasterCoachAgent.chat()
    ↓
GPT-4o with tools bound
    ↓
Model decides to call tool
    ↓
Tool executed: searchCasts() → Neynar API
    ↓
Results returned to model
    ↓
Model generates final response with results
    ↓
User receives natural language answer with cast examples
```

## Example Interactions

### Search by Topic
```
User: "Find casts about AI agents"
AI: [Uses search_farcaster_casts tool with query="AI agents"]
AI: "I found several interesting casts about AI agents:
1. @user1: "Just built my first AI agent with..."
2. @user2: "The future of AI agents is..."
```

### Find Similar Casts
```
User: [Viewing cast about NFT launch]
User: "Find similar casts to this"
AI: [Uses search_farcaster_casts tool with keywords from current cast]
AI: "Here are similar casts about NFT launches:..."
```

### Analyze User's Posting Style
```
User: "What does @dwr post about?"
AI: [Uses get_user_casts tool with username="dwr"]
AI: "Based on @dwr's recent casts, they primarily post about:
- Farcaster protocol updates
- Web3 development
- Decentralization..."
```

## Technical Details

### Dependencies Added
```typescript
import { DynamicStructuredTool } from '@langchain/core/tools';
import { searchCasts, getCastsByUsername } from '../neynar';
```

### Tool Calling Support
- **OpenAI GPT-4o**: Full native support for function calling
- **Anthropic Claude**: Also supports tool use (backup provider)
- Both providers can invoke tools and process results

### Error Handling
- Tools catch and return friendly error messages
- If a tool fails, AI still receives partial results or error explanation
- Doesn't break the conversation flow

## Configuration

### Environment Variables Required
No additional environment variables needed. Uses existing:
- `NEYNAR_API_KEY` - Already configured for Neynar API access

### Limits
- Search casts: Max 25 results per query
- User casts: Max 100 results per query
- Rate limits follow Neynar API restrictions

## Performance Considerations

### Tool Execution Time
- searchCasts: ~500-1000ms (Neynar API latency)
- getCastsByUsername: ~700-1200ms (2 API calls: user lookup + feed fetch)
- Total AI response: +1-2s when using tools

### Token Usage
- Tool results are JSON, can be verbose
- Limited to reasonable result counts to avoid token overflow
- Results truncated if needed

## Testing Recommendations

### Manual Tests
1. **Basic Search**: Ask "find casts about Farcaster"
2. **Similar Cast**: View a cast, ask "find similar ones"
3. **User Analysis**: Ask "what does @username post about?"
4. **Error Case**: Search for nonsense terms
5. **No Results**: Search for very specific query with no matches

### Monitoring
- Check Vercel logs for tool execution
- Monitor Neynar API usage
- Track AI response times with tool calls vs without

## Future Enhancements

### Potential Additions
1. **Channel Search**: Search casts within specific channels
2. **Time Filters**: Find casts from last 24 hours, week, etc.
3. **Engagement Filters**: Only show casts with >X likes
4. **Advanced Queries**: Boolean operators (AND, OR, NOT)
5. **Cast Threads**: Fetch entire conversation threads
6. **Trending Topics**: Discover what's trending on Farcaster
7. **User Comparison**: Compare posting styles of multiple users

### Optimization Ideas
1. **Caching**: Cache frequent search queries
2. **Pagination**: Support fetching more results
3. **Parallel Searches**: Run multiple searches simultaneously
4. **Result Ranking**: Re-rank results by relevance
5. **Semantic Search**: Use embeddings for better matching

## Related Documentation
- [Neynar API Documentation](https://docs.neynar.com/)
- [LangChain Tools Guide](https://js.langchain.com/docs/modules/agents/tools/)
- [BOT_INTELLIGENCE.md](./BOT_INTELLIGENCE.md) - Agent system architecture
- [AI_FRAMEWORK.md](./AI_FRAMEWORK.md) - Overall AI implementation

## Troubleshooting

### Tool Not Being Called
- Check system prompt mentions tools
- Verify tools are bound to agent
- Try being more explicit: "use the search tool to find..."

### Search Returns No Results
- Very specific queries may have no matches
- Try broader keywords
- Check Neynar API status

### Tool Execution Errors
- Check Neynar API key is valid
- Monitor rate limits
- Verify network connectivity

## Maintenance Notes

### When Updating
- If Neynar API changes, update wrapper functions in neynar.ts
- If adding new tools, follow the pattern in agents.ts
- Update system prompts to guide AI on tool usage
- Test tool calling with both OpenAI and Claude providers
