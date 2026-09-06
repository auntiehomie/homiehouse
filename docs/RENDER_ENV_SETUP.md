# Render Environment Variables Setup

Add these environment variables in your Render dashboard for the homiehouse-server:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your_supabase_anon_key_here
```

## Steps:
1. Go to your homiehouse service on Render
2. Click "Environment" in the left sidebar
3. Add both variables above
4. Click "Save Changes"
5. Render will automatically redeploy

## What was fixed:
- ✅ Added `dotenv.config()` in db.ts to load environment variables
- ✅ Fixed reply hash capture from Farcaster API API response
- ✅ Database now properly tracks all bot replies
- ✅ Tested and confirmed database writes work locally

## Verify it's working:
After deploy, check your Supabase dashboard:
https://your-project-id.supabase.co/project/_/editor

The bot_replies table should start populating with parent_hash entries when the bot replies to mentions.
