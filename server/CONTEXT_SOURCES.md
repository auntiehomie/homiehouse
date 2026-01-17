# Context Sources for Smart Replies 🎯

## Current Context Sources (Implemented)

### 1. **User Profile Data** ⭐
```typescript
- Bio/description (first 100 chars)
- Follower count (flags if >1000)
- Power badge status (active community member)
```
**Why**: Understand user's identity, credibility, and interests

### 2. **Recent Posting History** 📝
```typescript
- Last 10 casts analyzed
- Extract topics via hashtags + keywords
- Detect posting style (emoji usage, length)
```
**Keywords tracked**: crypto, nft, art, tech, ai, web3, defi, music, gaming, sports, fitness, food, writing, etc.

**Why**: Learn what they talk about and how they communicate

### 3. **Conversation Thread Context** 💬
```typescript
- Parent cast content (what they're replying to)
- Original author of parent cast
- Thread context up to 150 chars
```
**Why**: Understand conversation flow and context

### 4. **Channel Context** 📺
```typescript
- Channel ID (e.g., /degen, /base, /fitness)
- Channel-specific norms
```
**Why**: Adapt tone and topics to channel culture

### 5. **Enhanced Topic Detection** 🏷️
```typescript
- 40+ keywords across categories
- Hashtag extraction
- Multi-category support
```
**Categories**: crypto, art, tech, AI, social, lifestyle, creative

---

## Additional Context You Can Add

### 6. **Time & Recency Context** ⏰
```typescript
const timeOfDay = new Date().getHours();
const isWeekend = [0, 6].includes(new Date().getDay());

if (timeOfDay < 12) context += "\n- Morning vibes";
if (timeOfDay >= 22) context += "\n- Late night posting";
```

### 7. **Engagement Patterns** 📊
```typescript
// Analyze their casts
const avgLikes = casts.reduce((sum, c) => sum + c.reactions.likes_count, 0) / casts.length;
const avgRecasts = casts.reduce((sum, c) => sum + c.reactions.recasts_count, 0) / casts.length;

if (avgLikes > 10) context += "\n- Creates engaging content";
```

### 8. **Social Graph** 👥
```typescript
// Who they follow (via Neynar)
const following = await neynar.fetchUserFollowing(authorFid, { limit: 50 });
const notableFollows = following.users.filter(u => u.power_badge);

if (notableFollows.length > 0) {
  context += `\n- Follows: ${notableFollows.map(u => u.username).slice(0, 3).join(', ')}`;
}
```

### 9. **Past Bot Conversations** 🧠
```typescript
// Use memory.ts system
const history = memory.getUserHistory(authorFid, 3);
if (history.length > 0) {
  context += `\n- You've talked ${history.length} times before`;
  context += `\n- Last topic: ${extractTopic(history[0].user_message)}`;
}
```

### 10. **Mentioned Users Context** 👤
```typescript
const mentions = cast.text.match(/@\w+/g) || [];
if (mentions.length > 0) {
  context += `\n- Mentioning: ${mentions.join(', ')}`;
  // Could fetch their profiles too for deeper context
}
```

### 11. **Embedded Content Analysis** 🔗
```typescript
const links = cast.embeds?.filter(e => e.url) || [];
const domains = links.map(l => new URL(l.url).hostname);

if (domains.includes('youtube.com')) context += "\n- Sharing video content";
if (domains.includes('github.com')) context += "\n- Sharing code/projects";
```

### 12. **Sentiment Analysis** 😊😢😡
```typescript
// Simple keyword-based sentiment
const positiveWords = ['love', 'great', 'awesome', 'amazing', 'best'];
const negativeWords = ['hate', 'bad', 'worst', 'terrible', 'awful'];

const sentiment = analyzeSentiment(castText);
context += `\n- Mood: ${sentiment}`;
```

### 13. **Language & Tone Detection** 🗣️
```typescript
const hasSarcasm = /yeah right|sure thing|totally/i.test(castText);
const isQuestion = castText.includes('?');
const isExcited = (castText.match(/!/g) || []).length >= 2;

if (isQuestion) context += "\n- Asking a question";
if (isExcited) context += "\n- High energy/excited";
```

### 14. **Meme & Cultural References** 🎭
```typescript
const memeWords = ['gm', 'gn', 'wagmi', 'ngmi', 'ser', 'fren', 'degen', 'lfg'];
const hasMeme = memeWords.some(word => castText.toLowerCase().includes(word));

if (hasMeme) context += "\n- Uses crypto/meme culture";
```

### 15. **Frame Context** 🖼️
```typescript
if (cast.frames?.length > 0) {
  const frame = cast.frames[0];
  context += `\n- Shared a frame: ${frame.title}`;
}
```

---

## Priority Implementation Order

### High Impact (Implement Next)
1. ✅ Past bot conversations (memory integration)
2. ✅ Time/recency context
3. ✅ Engagement patterns

### Medium Impact
4. ⬜ Social graph (who they follow)
5. ⬜ Mentioned users context
6. ⬜ Sentiment analysis

### Nice to Have
7. ⬜ Embedded content analysis
8. ⬜ Language/tone detection
9. ⬜ Meme culture detection
10. ⬜ Frame context

---

## Example: Full Context Build

```typescript
CONTEXT about @alice:
- Bio: "Building cool stuff on Base | Prev: @startup"
- Well-known (2,341 followers)
- Has power badge (active community member)
- Interests: base, building, crypto, nft, web3
- Posts detailed, thoughtful content
- Uses emojis in posts

THREAD CONTEXT:
This is a reply to @bob: "Just launched our new NFT collection! Check it out..."

CHANNEL: /base

ENGAGEMENT: Creates engaging content (avg 15 likes)
PAST CONVERSATIONS: You've talked 3 times before
MOOD: Excited
```

---

## How to Add New Context

1. **Create a context function**:
```typescript
async function getEngagementContext(casts: any[]): Promise<string> {
  const avgLikes = casts.reduce((sum, c) => 
    sum + (c.reactions?.likes_count || 0), 0) / casts.length;
  
  if (avgLikes > 10) return "\n- Creates engaging content";
  return "";
}
```

2. **Call it in getUserContext()**:
```typescript
const engagementCtx = await getEngagementContext(userCasts.casts);
context += engagementCtx;
```

3. **Cache with the rest**:
```typescript
userProfileCache.set(authorFid, {
  context: context, // includes all context
  timestamp: Date.now()
});
```

---

## Context Quality Tips

### ✅ Do:
- Keep context concise (system prompt length matters)
- Cache expensive API calls
- Prioritize relevant context over exhaustive
- Test impact on reply quality
- Handle errors gracefully (context is additive, not required)

### ❌ Don't:
- Fetch unnecessary data
- Add context that doesn't improve replies
- Make too many API calls per reply
- Store sensitive information
- Overwhelm the AI with context

---

## Measuring Context Impact

Track these metrics:
- Reply relevance (manual review)
- User engagement (likes on bot replies)
- Conversation continuity (follow-up replies)
- API cost per reply
- Cache hit rate

---

**The more context, the smarter the bot! 🧠**
