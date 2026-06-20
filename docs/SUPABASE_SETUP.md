# HomieHouse Bot - Supabase Database Setup

The bot now uses Supabase to track replied casts, preventing duplicate responses even after deploys!

## Setup Instructions

### 1. Install Dependencies

```bash
cd server
npm install
```

This will install the new `@supabase/supabase-js` dependency.

### 2. Add Environment Variables

Add these to your Render environment variables (or `.env` file):

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
```

You can find these in your Supabase project settings → API.

### 3. Verify Database Table

The `bot_replies` table should already exist in your Supabase database from the castkpr project. Verify it has these columns:

- `id` (UUID, primary key)
- `parent_hash` (TEXT, unique)
- `reply_hash` (TEXT)
- `command_type` (TEXT)
- `reply_text` (TEXT)
- `created_at` (TIMESTAMP)

If it doesn't exist, run this SQL in Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS bot_replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_hash TEXT NOT NULL UNIQUE,
  reply_hash TEXT NOT NULL,
  command_type TEXT NOT NULL,
  reply_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS bot_replies_parent_hash_idx ON bot_replies(parent_hash);
CREATE INDEX IF NOT EXISTS bot_replies_created_at_idx ON bot_replies(created_at DESC);
```

## How It Works

**Before (File-based):**
- Stored replied casts in `replied_casts.json`
- File was ephemeral - reset on every deploy
- Caused duplicate replies after each deployment

**Now (Database):**
- Stores replied casts in Supabase `bot_replies` table
- Persists across deploys ✅
- Tracks by parent_hash (the mention cast the bot replies to)
- Prevents duplicates even if the bot restarts

## Workflow

```
User mentions @homiehouse → cast hash: 0xABC123

Bot checks:
1. ✓ In-memory cache (this run)
2. ✓ Supabase database 
3. ✓ Neynar API (double-check for existing replies)

If all clear:
- Generate reply
- Post to Farcaster
- Record in DB: parent_hash = 0xABC123
- Add to in-memory cache

Next time (even after deploy):
- Check DB for 0xABC123
- Found! Skip reply ✅
```

## Monitoring

Check your Supabase dashboard to see all bot replies:

```sql
SELECT 
  parent_hash,
  command_type,
  created_at,
  LEFT(reply_text, 50) as reply_preview
FROM bot_replies
ORDER BY created_at DESC
LIMIT 20;
```

## Disable Startup Check

The bot no longer runs on startup by default. To enable:

```
ENABLE_STARTUP_CHECK=true
```

This prevents deploy spam. The bot will wait for the first 15-minute cron check.
