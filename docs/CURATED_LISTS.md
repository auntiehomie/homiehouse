# Curated Lists - Conversational Bot Feature

## Overview
Users can now ask @homiehouse to curate casts into custom lists through a natural conversation flow. The bot maintains conversation state across multiple replies to complete the curation process.

## How It Works

### User Flow
1. **User mentions bot on a cast they want to curate:**
   - "@homiehouse can you curate this"
   - "@homiehouse save this to my list"
   - "@homiehouse add this to list"

2. **Bot asks which list:**
   - Bot responds: "which list? you have: 'favorites', 'tech', 'art' (or say a new name) 📝"
   - Bot stores conversation state in database (expires in 10 minutes)

3. **User replies with list name:**
   - "favorites" (adds to existing list)
   - "my new collection" (creates new list and adds cast)

4. **Bot confirms:**
   - "added to 'favorites' 🏠✨"
   - Creates list if it doesn't exist
   - Adds cast with metadata to list

### Technical Flow
```
User Cast → Bot Detects "curate" → Creates Conversation State → Asks for List
                                           ↓
User Reply → Bot Retrieves Conversation → Gets List/Creates New → Adds Cast → Ends Conversation
```

## Database Schema

### Tables Created
1. **curated_lists**
   - User's custom lists
   - Fields: id, fid, list_name, description, is_public, timestamps
   - Unique constraint on (fid, list_name)

2. **curated_list_items**
   - Casts saved to lists
   - Fields: id, list_id, cast_hash, cast_author_fid, cast_text, cast_timestamp, added_by_fid, notes
   - Unique constraint on (list_id, cast_hash)

3. **bot_conversations**
   - Multi-turn conversation state
   - Fields: id, user_fid, conversation_type, state, context_data (JSONB), parent_cast_hash, expires_at
   - Auto-expires after 10 minutes

### Running the Migration
1. Connect to your Supabase database
2. Run the SQL in `server/curated_lists_migration.sql`
3. Verify tables were created successfully

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('curated_lists', 'curated_list_items', 'bot_conversations');
```

## API Endpoints

### Get User's Lists
```
GET /api/curated-lists?fid={fid}
Response: { lists: [...] }
```

### Create New List
```
POST /api/curated-lists
Body: { fid, listName, description, isPublic }
Response: { list: {...} }
```

### Delete List
```
DELETE /api/curated-lists?id={id}&fid={fid}
Response: { success: true }
```

### Get List Items
```
GET /api/curated-lists/{id}/items
Response: { items: [...] }
```

### Add Item to List
```
POST /api/curated-lists/{id}/items
Body: { castHash, addedByFid, castData, notes }
Response: { item: {...} }
```

### Remove Item from List
```
DELETE /api/curated-lists/{id}/items?castHash={hash}
Response: { success: true }
```

## Bot Implementation

### Key Components

**Detection Logic** (`bot/src/index.ts`)
- Detects curation keywords: "curate this", "save this to", "add to list"
- Checks for active conversation state
- Routes to conversation handler

**Conversation Handler** (`handleCurationRequest`)
- Manages multi-turn conversation flow
- Stores context (cast hash, author, text, timestamp)
- Creates/updates conversation state
- Handles list creation and item addition

**Services** (`bot/src/curated-lists.ts`)
- `CuratedListService`: CRUD operations for lists and items
- `BotConversationService`: Conversation state management
- Supabase client for database operations

### Conversation States
- `awaiting_list_name`: Bot asked which list, waiting for user response
- Conversations expire after 10 minutes of inactivity

### Context Data Structure
```json
{
  "cast_hash": "0x123...",
  "cast_author_fid": 12345,
  "cast_text": "Original cast text",
  "cast_timestamp": "2024-01-15T12:00:00Z"
}
```

## Environment Variables Required
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
```

## Testing the Feature

### 1. Test Basic Flow
1. Post a cast on Farcaster
2. Reply to it: "@homiehouse curate this"
3. Bot replies: "which list? 📝"
4. Reply: "test collection"
5. Bot replies: "added to 'test collection' 🏠✨"

### 2. Test Existing List
1. Curate another cast: "@homiehouse save this to my list"
2. Bot shows your existing lists
3. Reply with existing list name
4. Bot adds to that list

### 3. Test Conversation Timeout
1. Start curation: "@homiehouse curate this"
2. Wait 11 minutes
3. Try to reply - conversation will have expired, start new one

### 4. Test Duplicate Prevention
1. Add a cast to a list
2. Try to add the same cast again
3. Bot replies: "that cast is already in 'list name' 👍"

## Future Enhancements

### UI Components (Not Yet Implemented)
- View curated lists in app
- Browse casts in each list
- Create lists through UI
- Remove items from lists
- Share public lists

### Potential Features
- List categories/tags
- Collaborative lists (multiple users can add)
- Export lists as JSON/CSV
- Search within lists
- List statistics (most popular casts, etc.)

## Troubleshooting

### Bot Not Responding to Curation Requests
- Check bot logs for errors
- Verify SUPABASE_URL and SUPABASE_KEY are set
- Ensure migration was run successfully
- Check bot is running: `cd bot && npm run dev`

### "Couldn't create that list" Error
- Check list name length (max 100 chars)
- Ensure list name doesn't already exist for user
- Check database connection

### Conversation State Not Persisting
- Verify bot_conversations table exists
- Check expires_at timestamp isn't in the past
- Ensure conversation cleanup isn't running too aggressively

### Cast Not Being Added to List
- Verify cast hash is valid
- Check curated_list_items table for constraint violations
- Ensure list_id exists in curated_lists table

## Code Locations

### Bot Code
- `bot/src/index.ts` - Main bot logic with conversation handling
- `bot/src/curated-lists.ts` - Database service layer
- `bot/package.json` - Dependencies including @supabase/supabase-js

### API Routes
- `src/app/api/curated-lists/route.ts` - List CRUD operations
- `src/app/api/curated-lists/[id]/items/route.ts` - Item CRUD operations

### Database
- `server/curated_lists_migration.sql` - Schema and indexes
- Supabase PostgreSQL instance

## Next Steps

1. **Run the migration** - Apply SQL to create tables
2. **Restart the bot** - Pick up new conversation handling code
3. **Test the flow** - Try curating a cast via bot mention
4. **Build UI** - Create frontend components to view/manage lists
5. **Add to menu** - Create "My Lists" navigation item

The backend is complete and ready to use! The bot can now handle conversational curation. The frontend UI for viewing and managing lists can be built as a future enhancement.
