# Simple Feed Curation System

## Overview

The feed curation system has been simplified to use interest-based tags instead of complex preference rules. Users can now customize their home feed through a simple interface or by chatting with @homiehouse.

## How It Works

### 1. Interest Management

Users manage their feed interests through tags stored in `localStorage` under the key `hh_feed_interests`.

**UI Location:** Home feed → Settings icon → "Customize Your Feed" modal

### 2. Adding Interests

Users can add interests in two ways:

#### Quick Add
Pre-defined popular topics:
- crypto, nft, art, trading, tech, memes, music, sports, gaming, politics, defi, dao, ai, web3, onchain

#### Manual Add
Users type custom interests (3-20 characters)

#### Chat with @homiehouse
Navigate to `/ask-homie` and say things like:
- "help me curate my feed"
- "I want to see more trading content"
- "customize my feed preferences"
- "what topics should I follow"

### 3. Feed Filtering

The `FeedList` component scores and sorts casts based on interest matching:

**Scoring Algorithm:**
- Text match: +10 points (cast text contains interest keyword)
- Channel match: +15 points (cast is in a channel matching the interest)
- Hashtag match: +12 points (cast has hashtag matching the interest)

Casts are then sorted by score (highest first), so relevant content appears at the top.

### 4. Agent Integration

The `AgentOrchestrator` in `src/lib/ai/agents.ts` has a new `curate` intent that:
- Detects when users want to customize their feed
- Suggests relevant interests based on user input
- Provides conversational guidance on feed customization

**Trigger Keywords:**
- curate, customize my feed, feed preferences, interests, show me more, filter my feed

## Implementation Details

### Client-Side Components

**FeedCurationChat.tsx**
- New component replacing the complex `CurationSettings`
- Simple tag-based UI for managing interests
- Link to Ask Homie for personalized help
- Located: `src/components/FeedCurationChat.tsx`

**FeedList.tsx**
- Enhanced with `getUserInterests()` and `scoreCast()` functions
- Filters and sorts feed based on interest scores
- Maintains existing mute/hide functionality
- Located: `src/components/FeedList.tsx`

### AI Agent

**agents.ts - AgentOrchestrator**
- New `curate` intent added to `processRequest()`
- `handleFeedCuration()` method for conversational curation
- `detectIntent()` updated to recognize feed customization requests
- Returns suggested interests in response metadata

### Storage

**localStorage Keys:**
- `hh_feed_interests`: Array of interest strings
- Example: `["crypto", "nft", "trading", "art"]`

## User Flow

1. User opens home feed
2. Clicks settings icon
3. Opens "Customize Your Feed" modal
4. Adds interests via:
   - Quick add buttons
   - Manual text input
   - Or clicks "Chat with @homiehouse"
5. Interests are saved to localStorage
6. Feed automatically re-sorts to prioritize matching content

## Benefits Over Old System

### Old System (CurationSettings)
- Complex UI with multiple filters
- Keyword/channel/author preference rules
- Priority scores and weights
- Server-side API dependency
- Reported "fetch failed" errors

### New System (FeedCurationChat)
- Simple tag-based interests
- Client-side filtering (fast, no API calls)
- Conversational AI integration
- No database or server dependency
- Clear, intuitive UI

## Future Enhancements

1. **Persistent Storage**: Move from localStorage to user profile/database
2. **Smart Suggestions**: Analyze user's liked/recast history to suggest interests
3. **Channel Discovery**: Recommend channels based on interests
4. **Interest Analytics**: Show which interests drive the most engagement
5. **Seasonal Interests**: Temporary interests that auto-expire
6. **Negative Interests**: Topics to avoid (see less of)
7. **Bot Integration**: @homiehouse can automatically update user interests based on conversations

## Testing

To test the system:

1. Sign in to HomieHouse
2. Navigate to home feed
3. Click settings/curation icon
4. Add interests like "crypto", "art", "trading"
5. Close modal and observe feed re-ordering
6. Open browser DevTools → Console to see scoring logs (if added)
7. Test chat integration:
   - Go to `/ask-homie`
   - Say "help me curate my feed"
   - Agent should provide interest suggestions

## API Integration (Optional)

While the current system works client-side, you can optionally enhance it with API support:

```typescript
// Save interests to database
POST /api/user/interests
Body: { interests: ["crypto", "nft"] }

// Fetch curated feed from server
GET /api/feed/curated?fid=123
Response: Server applies interest filtering
```

This would enable:
- Cross-device sync
- More sophisticated ML-based filtering
- Better performance for large feeds
