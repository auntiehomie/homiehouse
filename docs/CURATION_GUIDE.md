# Feed Curation System

The HomieHouse feed curation system allows users to customize their feed by creating include/exclude filters based on various criteria.

## Features

Users can curate their feeds using the following preference types:

### 1. **Keywords**
Filter casts containing specific keywords
- **Include**: Show more casts with keywords like "crypto", "AI", "web3"
- **Exclude**: Hide casts with unwanted terms

### 2. **Channels**
Filter by Farcaster channel
- **Include**: Prioritize casts from specific channels
- **Exclude**: Hide casts from certain channels

### 3. **Authors**
Filter by specific users (FID or username)
- **Include**: Show more content from favorite creators
- **Exclude**: Hide casts from specific users

### 4. **Content Type**
Filter by media type:
- `has_image` - Casts with images
- `has_video` - Casts with videos
- `has_link` - Casts with embedded links
- `text_only` - Text-only casts

### 5. **Minimum Likes**
Show only casts with a minimum number of likes
- Example: Set to "10" to only see casts with 10+ likes

### 6. **Maximum Length**
Filter casts by character length
- Example: Set to "280" to only see shorter casts

## Setup Instructions

### 1. Database Setup

Run the migration SQL in your Supabase SQL Editor:

```bash
# Location: server/curation_migration.sql
```

This creates the `user_curation_preferences` table to store user preferences.

### 2. Server Configuration

The server is already configured with curation endpoints at:
- `GET /api/curation?fid={fid}` - Get preferences
- `POST /api/curation` - Add preference
- `PUT /api/curation` - Update preference
- `DELETE /api/curation?id={id}` - Delete preference

### 3. Environment Variables

Ensure your `.env` files have Supabase credentials:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

## How It Works

### Priority System

Each preference has a priority value (default: 0). Higher priority preferences are applied first.

### Filter Application

1. **Exclude filters** are applied first, removing unwanted content
2. **Include filters** boost matching content to the top
3. Items matching multiple include filters get higher boost scores

### Example Use Cases

#### Crypto Enthusiast
```
✅ Include: keyword "crypto" (priority: 2)
✅ Include: keyword "ethereum" (priority: 2)
✅ Include: channel "base" (priority: 1)
❌ Exclude: keyword "scam"
❌ Exclude: content_type "has_video" (if you prefer text)
```

#### News Consumer
```
✅ Include: min_likes 50 (only popular posts)
✅ Include: content_type "has_link" (articles)
❌ Exclude: keyword "shitpost"
❌ Exclude: max_length 50 (no short posts)
```

#### Art Lover
```
✅ Include: content_type "has_image" (priority: 3)
✅ Include: channel "art" (priority: 2)
✅ Include: keyword "artist" (priority: 1)
```

## Usage

### Accessing Curation Settings

1. Navigate to the home feed
2. Click the "⚙️ Curate" button in the feed tabs
3. Add, modify, or delete preferences

### Adding a Preference

1. Select preference type (keyword, channel, etc.)
2. Choose action (Include or Exclude)
3. Enter the value
4. Set priority (optional, higher = more important)
5. Click "Add Preference"

### Managing Preferences

- View all your current preferences in the settings modal
- Delete unwanted preferences by clicking "Delete"
- Preferences are applied automatically to your feed

## Technical Details

### Database Schema

```sql
CREATE TABLE user_curation_preferences (
    id BIGSERIAL PRIMARY KEY,
    fid BIGINT NOT NULL,
    preference_type TEXT NOT NULL,
    preference_value TEXT NOT NULL,
    action TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### API Endpoints

#### Get Preferences
```typescript
GET /api/curation?fid=123&type=keyword
Response: { ok: true, preferences: [...] }
```

#### Add Preference
```typescript
POST /api/curation
Body: {
  fid: 123,
  preference_type: "keyword",
  preference_value: "crypto",
  action: "include",
  priority: 1
}
```

#### Update Preference
```typescript
PUT /api/curation
Body: {
  id: 456,
  priority: 2
}
```

#### Delete Preference
```typescript
DELETE /api/curation?id=456
```

## Best Practices

1. **Start Simple**: Begin with 2-3 preferences and expand gradually
2. **Use Priorities**: Set higher priorities for your most important filters
3. **Balance Include/Exclude**: Too many excludes can make your feed empty
4. **Test and Iterate**: Adjust preferences based on what you see in your feed
5. **Clean Up**: Remove outdated preferences to keep your feed fresh

## Troubleshooting

### Feed is Empty
- Check if exclude filters are too aggressive
- Reduce minimum likes threshold
- Remove some exclude preferences

### Not Seeing Expected Content
- Verify preference values match exactly (e.g., channel names)
- Check priority settings
- Ensure you're signed in with the correct account

### Changes Not Appearing
- Refresh the page to reload preferences
- Check browser console for errors
- Verify database connection

## Future Enhancements

Potential additions to the curation system:
- Time-based filters (recent content only)
- Language detection and filtering
- Engagement rate thresholds
- Combination filters (AND/OR logic)
- Saved filter presets
- Import/export preferences
- AI-powered content recommendations

## Support

For issues or questions:
1. Check the browser console for errors
2. Verify Supabase connection
3. Ensure server is running on port 3001
4. Check that the database migration was successful
