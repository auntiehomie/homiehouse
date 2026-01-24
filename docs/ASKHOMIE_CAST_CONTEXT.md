# Ask Homie Cast Context & Similar Cast Search

## Overview

Ask Homie can now read and analyze cast context with enriched information from similar casts across Farcaster. This makes the AI much more contextually aware and able to provide better analysis.

## Features

### 1. **Cast Context Reading**
When you select a cast to analyze, Ask Homie:
- Reads the full cast content
- Gets author information
- Sees engagement metrics (likes, recasts, replies)
- Understands the timestamp and context

### 2. **Similar Cast Search** (NEW!)
For every cast analysis, Ask Homie:
- Extracts key topics from the cast
- Searches Farcaster for similar recent discussions
- Finds 5 most relevant related casts (last 48 hours)
- Includes engagement data from those casts
- Uses all this context to provide informed analysis

### 3. **Smart Context Enrichment**
The AI receives:
- **Original cast data**: Author, content, engagement
- **Similar discussions**: What others are saying about the same topic
- **User history**: Past interactions with Ask Homie
- **Intent detection**: Auto-detects if you want analysis, composition help, etc.

## How It Works

### Architecture Flow

```
User selects cast → AgentChat sends castContext
                           ↓
                    API receives context
                           ↓
                    Extracts cast text
                           ↓
                    Searches for similar casts
                           ↓
                    Enriches context with findings
                           ↓
                    AI analyzes with full context
                           ↓
                    Returns informed response
```

### Example Interaction

**User:** Clicks on a cast about "Base L2 integration"
**User:** Types "what do you think?"

**Behind the scenes:**
1. AgentChat sends cast context to API
2. API detects cast context with text about Base
3. Searches Farcaster for recent casts about "base integration"
4. Finds 5 similar discussions:
   - @alice: "Base fees are amazing..."
   - @bob: "Just migrated to Base..."
   - @carol: "Base + Farcaster = 🔥"
5. AI receives all this context
6. AI responds: "This cast aligns with the community sentiment about Base - lots of excitement about the low fees and smooth experience. The integration seems to be getting positive reactions across multiple conversations."

## Usage

### In the UI

1. **Navigate to a cast** (Feed, Profile, or direct link)
2. **Click "Ask Homie" or the chat icon** on the cast
3. **Ask your question** about the cast
   - "What do you think?"
   - "Is this legit?"
   - "Explain this"
   - "What's the sentiment?"

### Supported Questions

- **Analysis**: "What's your take?" "Analyze this"
- **Sentiment**: "What do people think?" "Is this positive?"
- **Legitimacy**: "Is this a scam?" "Can I trust this?"
- **Explanation**: "What does this mean?" "Explain this cast"
- **Context**: "What's happening?" "Why is this trending?"

## Technical Details

### Cast Context Format

```typescript
castContext: {
  author: {
    username: string;
    display_name: string;
    fid: number;
  };
  text: string;
  timestamp: string;
  reactions: {
    likes_count: number;
    recasts_count: number;
  };
  replies: {
    count: number;
  };
}
```

### Similar Cast Search

**Function**: `searchSimilarCasts(castText: string)`

**Process:**
1. Extract keywords (removes stop words, URLs, mentions)
2. Build search query from top 3 keywords
3. Call Neynar Search API
4. Filter for:
   - Recent (last 48 hours)
   - Minimum length (50+ chars)
   - Has engagement
5. Return top 5 results

**API Call:**
```typescript
GET https://api.neynar.com/v2/farcaster/cast/search
  ?q={keywords}
  &limit=10
```

### Context Enrichment

The enriched message includes:

```
IMPORTANT CONTEXT - User is analyzing this Farcaster cast:

Cast Author: @username
Display Name: User Name
Cast Content: "Original cast text..."
Timestamp: Jan 24, 2026 10:30 AM
Engagement: 42 likes, 8 recasts, 15 replies

**Related discussions on Farcaster:**
1. @user1: "Similar topic discussion..." (50 engagement)
2. @user2: "Another related cast..." (35 engagement)
3. @user3: "More context about this..." (28 engagement)

User's Question: {user question}
```

## Logging & Debugging

### Server Logs

Watch for these log messages:

```
📋 Cast context received: { author: 'username', textPreview: '...' }
📊 Detected cast context, searching for similar casts...
🔍 Searching for similar casts to: "cast text preview..."
🔍 Searching for similar casts about: base, integration, new
✅ Found 5 similar casts for context
✅ Enriched context with similar casts
```

### No Results Logs

```
📭 No similar casts found
📭 No recent relevant casts found
⚠️ Could not extract cast text for similar search
```

## Performance

### Metrics
- **Cast context detection**: Instant
- **Similar cast search**: ~300-500ms
- **Total analysis time**: 2-4 seconds (including AI processing)
- **API calls per analysis**: 2 (cast data + search)

### Optimization
- Searches only on cast analysis (not on compose/research)
- Caches results for 48 hours (casts are time-sensitive)
- Limits to 5 similar casts to avoid context overflow
- Filters for quality (engagement + length)

## Troubleshooting

### Cast Context Not Detected

**Issue**: AI doesn't seem to see the cast context

**Check:**
1. Verify `castContext` prop is passed to AgentChat
2. Check server logs for "Cast context received"
3. Ensure cast has `.text` field

**Fix:**
```tsx
<AgentChat 
  userId={userId}
  castContext={{
    author: cast.author.username,
    text: cast.text,
    // ... other fields
  }}
/>
```

### Similar Casts Not Found

**Issue**: No related discussions found

**Reasons:**
- Topic is very niche or new
- No recent casts (48 hour window)
- Keywords too generic or too specific
- Search API rate limited

**Not an error** - AI will still analyze with just the original cast context.

### Search Errors

**Issue**: Search fails or times out

**Check:**
1. `NEYNAR_API_KEY` is configured
2. API key has search permissions
3. Neynar API status is healthy
4. Network connectivity

**Fallback**: System gracefully continues without similar casts.

## Environment Variables

Required:
```bash
NEYNAR_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here  # or OPENAI_API_KEY
```

Optional:
```bash
NEXT_PUBLIC_GEMINI_API_KEY=your_key  # For web search
NEXT_PUBLIC_PERPLEXITY_API_KEY=your_key  # For real-time data
```

## Testing

### Manual Test

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Navigate to a cast:**
   - Go to feed
   - Click on any cast
   - Or use direct link: `/cast/0x...`

3. **Open Ask Homie chat:**
   - Click chat icon on cast
   - Type a question

4. **Check logs:**
   ```
   📋 Cast context received
   📊 Detected cast context
   🔍 Searching for similar casts
   ✅ Found X similar casts
   ```

5. **Verify response:**
   - Should mention context from similar casts
   - Should reference what "others are saying"
   - Should provide informed analysis

### Test Cases

**Case 1: Popular Topic**
- Cast about "crypto", "farcaster", "base"
- Should find 5 similar casts
- Response should reference community sentiment

**Case 2: Niche Topic**
- Cast about very specific technical detail
- May find 0-2 similar casts
- Response should still analyze the cast

**Case 3: Question vs Statement**
- Try "what do you think?"
- Try "analyze this cast"
- Both should trigger similar cast search

## Future Enhancements

### Planned
- [ ] Channel-specific search (only search within same channel)
- [ ] Time-range adjustment (older topics = longer time window)
- [ ] Semantic similarity (use embeddings instead of keywords)
- [ ] Cache popular searches (reduce API calls)
- [ ] User preference for search depth

### Ideas
- Thread analysis (analyze full conversation)
- Author history (what else has this user posted?)
- Network analysis (who else is talking about this?)
- Sentiment trends (how has sentiment changed over time?)

## API Reference

### AgentChat Component

```typescript
interface AgentChatProps {
  userId?: string;
  castContext?: {
    author: string | { username: string };
    text: string;
    timestamp?: string;
    reactions?: { likes_count: number; recasts_count: number };
    replies?: { count: number };
  };
  onCastSelect?: (cast: string) => void;
}
```

### API Endpoint

```typescript
POST /api/ask-homie
{
  messages: Message[],
  castContext?: CastContext,
  mode: 'agent' | 'legacy',
  userId?: string,
  intent?: 'compose' | 'analyze' | 'learn' | 'research' | 'auto'
}
```

### Response

```typescript
{
  response: string,
  suggestions?: string[],
  agentRole: 'composer' | 'coach' | 'researcher',
  metadata?: any,
  mode: 'agent',
  userStats?: any
}
```

## Summary

Ask Homie now has **full cast context awareness** with:
- ✅ Direct cast reading
- ✅ Similar cast search
- ✅ Contextual enrichment
- ✅ Informed analysis
- ✅ Community sentiment awareness

This makes the AI assistant much more useful for understanding Farcaster conversations and providing relevant, informed responses.
