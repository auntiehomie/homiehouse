# Bot Cast Stream Context

## Overview

Your bot now searches for similar casts across Farcaster to build richer, more contextually-aware responses. Instead of only reading the immediate conversation thread, it searches the cast stream for related discussions.

## How It Works

### 1. **Keyword Extraction**
When someone mentions the bot, it extracts key topics from their message:
- Removes URLs, mentions, and punctuation
- Filters out common stop words
- Identifies the top 5 most relevant keywords

### 2. **Cast Stream Search**
Uses the Neynar Search API to find similar casts:
- Searches for casts containing those keywords
- Filters for recent casts (last 48 hours)
- Prioritizes longer, more substantial content
- Gets engagement metrics (likes + replies)

### 3. **Context Building**
Combines multiple context sources:
- **Conversation thread**: Parent cast + replies
- **User memory**: Past interactions with this user
- **Similar casts**: Related discussions from the feed (NEW!)

### 4. **Smart Reply Generation**
AI gets comprehensive context to generate better responses:
```
User mentions bot about "crypto wallet security"
  ↓
Bot searches for similar casts about those topics
  ↓
Finds 5 recent discussions about wallet security
  ↓
Includes those as context for the AI
  ↓
AI generates informed, contextual reply
```

## Example Flow

**User:** "@homiehouse what do you think about the new Base integration?"

**Bot Process:**
1. Extracts keywords: `["base", "integration", "new"]`
2. Searches cast stream for similar discussions
3. Finds:
   - @alice: "Base integration is smooth, loving the speed..."
   - @bob: "Just deployed on Base, gas fees are amazing..."
   - @carol: "Base + Farcaster integration working great..."
4. Uses this context to generate informed reply
5. Posts: "base is looking solid, people seem hyped about the speed 🏠"

## Configuration

No additional setup needed! The feature uses your existing `NEYNAR_API_KEY`.

### Search Parameters
- **Keyword limit**: Top 5 keywords extracted
- **Search results**: 10 casts fetched
- **Relevance filter**: Recent (48 hours), minimum 50 chars
- **Context limit**: Top 5 most relevant shown to AI

## Benefits

### Before (Only Thread Context)
```
User mentions bot
  ↓
Bot reads conversation thread
  ↓
Generates reply based on limited context
```

**Limited to**: What's in this specific conversation

### After (With Cast Stream)
```
User mentions bot
  ↓
Bot reads conversation thread
  ↓
Bot searches similar discussions
  ↓
Generates reply with ecosystem awareness
```

**Enhanced with**: What the entire Farcaster community is saying

## Performance

- **Search time**: ~200-500ms per mention
- **API calls**: +1 search call per reply
- **Context quality**: +3-5 relevant casts per reply
- **Total latency**: Adds ~0.5s to reply time

## Logging

You'll see new log messages:
```
🔍 Searching for similar casts about: base, integration, new
✅ Found 5 similar casts for context
📭 No similar casts found
```

## API Usage

Uses Neynar's `searchCasts` endpoint:
```typescript
neynar.searchCasts({
  q: 'search query',
  limit: 10
})
```

**Rate limits**: Same as other Neynar API calls (depends on your plan)

## When Search is Skipped

The bot won't search if:
- No meaningful keywords can be extracted
- Cast text is too short (< 10 words)
- Search fails or times out (falls back gracefully)

## Future Enhancements

Potential improvements:
1. **Channel-specific search**: Only search within the cast's channel
2. **Time-based relevance**: Adjust recency filter based on topic
3. **Engagement weighting**: Prioritize highly-engaged discussions
4. **Semantic similarity**: Use embeddings for better matching
5. **Cache popular searches**: Reduce API calls for common topics

## Troubleshooting

### "No similar casts found"
- Normal for very niche or new topics
- Bot will still reply using thread context + memory
- Not an error, just means the search didn't find relevant matches

### Search errors
- Bot gracefully falls back to conversation context
- Check Neynar API status if persistent
- Verify `NEYNAR_API_KEY` has search permissions

## Testing

Test the feature by mentioning the bot about popular topics:

```bash
# Good test topics (likely to find similar casts):
- "crypto" 
- "farcaster"
- "base"
- "nft"
- "defi"

# Will have fewer results:
- Very specific technical questions
- New/breaking topics
- Niche discussions
```

Monitor logs to see search results in real-time.
