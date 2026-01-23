# Feed Curation System Architecture

## Component Structure

```
┌─────────────────────────────────────────────────────────┐
│                    HomieHouse App                       │
│                      (page.tsx)                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │   FeedTrendingTabs.tsx     │
        │                            │
        │  ┌──────────────────────┐  │
        │  │ [Feed] [Trending]    │  │
        │  │ [Following] [Global] │  │
        │  │ [⚙️ Curate]          │  │
        │  └──────────────────────┘  │
        └────────┬───────────────┬───┘
                 │               │
         ┌───────▼─────┐   ┌────▼──────────────┐
         │  FeedList   │   │ CurationSettings  │
         │   .tsx      │   │      .tsx         │
         └─────────────┘   └───────────────────┘
                 │
                 │ Applies curation filters
                 │
                 ▼
         ┌──────────────┐
         │ Curated Feed │
         └──────────────┘
```

## Data Flow

```
User Action (Add Preference)
        │
        ▼
┌─────────────────┐
│ CurationSettings│  ←─── User inputs preferences
│   Component     │
└────────┬────────┘
         │ POST /api/curation
         ▼
┌─────────────────┐
│  Next.js API    │  ←─── Proxy to server
│    Route        │
└────────┬────────┘
         │ POST http://localhost:3001/api/curation
         ▼
┌─────────────────┐
│  Express Server │  ←─── CurationService
│  (index.ts)     │
└────────┬────────┘
         │ Insert into DB
         ▼
┌─────────────────┐
│    Supabase     │  ←─── user_curation_preferences table
│    Database     │
└─────────────────┘

Feed Loading (Apply Filters)
        │
        ▼
┌─────────────────┐
│   FeedList      │  ←─── Loads preferences on mount
│   Component     │
└────────┬────────┘
         │ GET /api/curation?fid=123
         ▼
┌─────────────────┐
│  Next.js API    │
│    Route        │
└────────┬────────┘
         │ GET http://localhost:3001/api/curation
         ▼
┌─────────────────┐
│  Express Server │  ←─── CurationService.getPreferences()
│  (index.ts)     │
└────────┬────────┘
         │ Query DB
         ▼
┌─────────────────┐
│    Supabase     │  ←─── Return user's preferences
│    Database     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   FeedList      │  ←─── Apply filters to feed items
│ applyCuration   │       1. Exclude filters (remove)
│   Filters()     │       2. Include filters (boost)
└────────┬────────┘       3. Sort by boost score
         │
         ▼
┌─────────────────┐
│ Curated Feed    │  ←─── Displayed to user
│   Rendered      │
└─────────────────┘
```

## Database Schema

```sql
user_curation_preferences
├── id (BIGSERIAL)              ← Primary key
├── fid (BIGINT)                ← User's Farcaster ID
├── preference_type (TEXT)      ← 'keyword', 'channel', 'author', etc.
├── preference_value (TEXT)     ← The actual value to filter
├── action (TEXT)               ← 'include' or 'exclude'
├── priority (INTEGER)          ← Higher = applied first
├── created_at (TIMESTAMP)      ← When created
└── updated_at (TIMESTAMP)      ← Last modified

Indexes:
├── idx_curation_fid            ← Fast lookup by user
├── idx_curation_type           ← Fast lookup by type
├── idx_curation_fid_type       ← Combined lookup
└── idx_curation_unique         ← Prevent duplicates
```

## Filter Logic

```
Raw Feed Items
      │
      ▼
┌─────────────────┐
│ Basic Filters   │  ← Muted users, hidden casts, "see less"
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Apply EXCLUDE Preferences      │
│  ─────────────────────────      │
│  For each exclude preference:   │
│    Remove items that match      │
│                                 │
│  Examples:                      │
│  • Hide keyword "spam"          │
│  • Hide author "badactor"       │
│  • Hide channel "noise"         │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Apply INCLUDE Preferences      │
│  ─────────────────────────      │
│  For each include preference:   │
│    Boost items that match       │
│    Add boost score based on:    │
│    - Preference priority        │
│    - Number of matches          │
│                                 │
│  Examples:                      │
│  • Boost keyword "crypto" (+2)  │
│  • Boost channel "base" (+1)    │
│  • Boost has_image (+1)         │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Sort by Boost  │  ← Higher boost score = shown first
└────────┬────────┘
         │
         ▼
   Curated Feed
```

## API Endpoints

### Client → Server

```
GET  /api/curation?fid=123&type=keyword
POST /api/curation
     Body: { fid, preference_type, preference_value, action, priority }
PUT  /api/curation
     Body: { id, ...updates }
DELETE /api/curation?id=456
```

### Response Format

```typescript
// Success
{
  ok: true,
  preferences: [...],  // For GET
  data: {...}          // For POST
}

// Error
{
  ok: false,
  error: "Error message"
}
```

## Example Scenarios

### Scenario 1: Crypto Enthusiast

```
User Preferences:
├── Include: keyword "crypto" (priority: 3)
├── Include: keyword "web3" (priority: 2)
├── Include: channel "base" (priority: 2)
└── Exclude: keyword "scam"

Result:
├── Scam posts → REMOVED
├── Crypto + web3 post → Boost +5
├── Crypto post → Boost +3
├── Web3 post → Boost +2
└── Other posts → Boost 0

Feed Order:
1. Crypto + web3 posts (highest boost)
2. Single-topic posts
3. Regular posts
```

### Scenario 2: Quality Filter

```
User Preferences:
├── Include: min_likes 50 (priority: 1)
├── Include: content_type "has_link" (priority: 1)
└── Exclude: max_length 50

Result:
├── Short posts → REMOVED
├── Popular + has link → Boost +2
├── Popular posts → Boost +1
├── Posts with links → Boost +1
└── Other posts → Boost 0
```

## File Structure

```
homiehouse/
├── src/
│   ├── app/
│   │   └── api/
│   │       └── curation/
│   │           └── route.ts              ← Next.js API routes
│   └── components/
│       ├── CurationSettings.tsx          ← Settings modal UI
│       ├── FeedList.tsx                  ← Feed with filters
│       └── FeedTrendingTabs.tsx          ← Tab navigation
│
├── server/
│   ├── src/
│   │   ├── curation.ts                   ← Curation service
│   │   └── index.ts                      ← Express server
│   └── curation_migration.sql            ← Database schema
│
├── CURATION_GUIDE.md                     ← Usage documentation
├── CURATION_SETUP.md                     ← Setup instructions
└── CURATION_ARCHITECTURE.md              ← This file
```

## Technology Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Backend**: Express.js, Node.js
- **Database**: Supabase (PostgreSQL)
- **State Management**: React useState
- **API**: RESTful endpoints
- **Styling**: Tailwind CSS + custom CSS

## Performance Considerations

1. **Caching**: Preferences loaded once on component mount
2. **Client-side filtering**: Fast filtering without server round-trips
3. **Indexed queries**: Database indexes for fast lookups
4. **Unique constraints**: Prevent duplicate preferences

## Security

1. **User isolation**: FID-based filtering ensures users only see their preferences
2. **Input validation**: Required fields checked on client and server
3. **Error handling**: Graceful fallbacks for DB/network errors
4. **SQL injection**: Protected by Supabase client library

## Future Enhancements

- [ ] Real-time preference sync across devices
- [ ] Preset filter templates
- [ ] AI-powered content recommendations
- [ ] Analytics dashboard (what content you engage with)
- [ ] Share filter presets with friends
- [ ] Schedule filters by time of day
- [ ] Advanced boolean logic (AND/OR combinations)
- [ ] Machine learning content scoring
