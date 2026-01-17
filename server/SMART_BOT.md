# HomieHouse Smart Bot Features 🧠

## Overview
HomieHouse now learns from Farcaster profiles to generate smarter, more personalized replies. The bot analyzes users' posting patterns, interests, and communication style to adapt its responses.

## How It Works

### 1. Profile Learning
When someone mentions the bot, it:
- Fetches their recent 10 casts from Farcaster
- Analyzes their posting style (emoji usage, message length, tone)
- Identifies topics they discuss (crypto, NFTs, tech, AI, etc.)
- Caches this information for 1 hour to avoid rate limits

### 2. Context-Aware Replies
The bot uses the learned context to:
- Match the user's communication style (if they use emojis, bot does too)
- Reference their interests in replies
- Adjust response length based on their typical post length
- Provide more relevant, personalized responses

### 3. Caching System
```typescript
userProfileCache: Map<FID, { context: string, timestamp: number }>
TTL: 1 hour (3600000ms)
```

Prevents excessive API calls and ensures fast response times.

## Technical Implementation

### Profile Analysis
```typescript
async function getUserContext(authorFid, authorUsername) {
  // 1. Check cache
  // 2. Fetch recent casts via Neynar
  // 3. Analyze:
  //    - Topics (keywords like crypto, NFT, AI, etc.)
  //    - Style (emoji usage, avg length)
  //    - Tone (detailed vs punchy)
  // 4. Generate context string
  // 5. Cache for 1 hour
}
```

### Context Integration
The learned context is appended to the system prompt:
```
CONTEXT about @username:
- Interests: crypto, nft, tech
- Posts detailed, thoughtful content
- Uses emojis in posts
```

### Models Used
- **GPT-4 Vision** (gpt-4o): For images + learned context
- **Claude Sonnet** (claude-3-5-sonnet-latest): Primary text replies + context
- **GPT-4 Mini** (gpt-4o-mini): Fallback + context

## Rate Limiting & Safety

### Safeguards
1. **Reply Limit**: Max 1 reply per bot run
2. **Profile Cache**: 1-hour TTL reduces API calls
3. **Error Handling**: Gracefully degrades if profile fetch fails
4. **Duplicate Prevention**: Enhanced tracking with notification IDs

### Tracking Keys
- `notification_{id}` - Prevents duplicate notification processing
- `cast_{hash}` - Tracks specific cast replies
- `parent_{hash}` - Prevents duplicate thread replies
- `root_{hash}` - Tracks conversation roots

## Benefits

### For Users
- More natural, personalized conversations
- Bot "remembers" their interests
- Replies feel contextual, not generic
- Better engagement and relevance

### For the Bot
- Learns organically from interactions
- Improves over time
- Reduces generic responses
- More human-like behavior

## Future Enhancements

### Planned Features
1. **Persistent Memory**: Store learned profiles in database
2. **Sentiment Analysis**: Detect mood and adjust tone
3. **Relationship Tracking**: Remember past conversations
4. **Topic Modeling**: Deep learning of user interests
5. **Network Analysis**: Learn from user's social graph

### Memory System Integration
The `bot/src/memory.ts` system is ready to store:
```typescript
interface UserProfile {
  fid: number;
  username: string;
  topics: string; // JSON array
  posting_style: string; // JSON object
  last_interaction: number;
  interaction_count: number;
}
```

## Usage

### Environment Variables
```env
NEYNAR_API_KEY=your_key
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
APP_FID=your_bot_fid
NEYNAR_SIGNER_UUID=your_signer
```

### Running the Bot
```bash
cd server
npm install
npm run dev
```

### Testing Profile Learning
```bash
# Manual trigger
curl -X POST http://localhost:3001/trigger-bot

# Check logs for profile analysis
# Look for: 🔍 Fetching profile for @username...
#          ✓ Cached profile for @username
```

## Logs to Watch

```
🔍 Fetching profile for @alice...
✓ Cached profile for @alice
💭 Generating reply for 0x1234567...
✅ Posted reply: Hey @alice! Love the NFT project!
```

## API Calls Per Reply

### Without Cache
- 1x Fetch notifications
- 1x Fetch user feed (10 casts)
- 1x Lookup cast conversation
- 1x AI generation (Claude/GPT-4)
- 1x Publish cast

### With Cache (subsequent replies within 1 hour)
- 1x Fetch notifications
- 1x Lookup cast conversation  
- 1x AI generation (Claude/GPT-4)
- 1x Publish cast

**Saves ~20-30% API calls per cached user!**

## Monitoring

### Key Metrics
- Cache hit rate (logged as "📋 Using cached profile")
- Profile fetch time
- Reply quality (manual review)
- User engagement (likes, recasts, follow-ups)

### Debug Mode
Enable verbose logging:
```typescript
console.log('Profile context:', userContext);
```

## Conclusion

HomieHouse is now a learning bot that adapts to each user's unique style and interests. This creates more engaging, personalized interactions while maintaining efficiency through smart caching.

The foundation is set for even more advanced features like persistent memory, sentiment analysis, and relationship tracking.

---

**Built with ❤️ for the Farcaster community**
