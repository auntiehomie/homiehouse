# Bot Reply Tracking - Database Setup

## ⚠️ IMPORTANT: Current Issue

The bot is currently using file-based storage (`replied_casts.json`) which **DOES NOT WORK** in serverless environments like Vercel because:

1. Each serverless function instance has its own ephemeral filesystem
2. Files are wiped when instances shut down (every few minutes)
3. Multiple concurrent instances don't share the same filesystem
4. This causes the bot to send duplicate replies

## ✅ Solution: Use Vercel KV (Redis)

### Step 1: Install Vercel KV

```bash
npm install @vercel/kv
```

### Step 2: Set up KV in Vercel Dashboard

1. Go to your Vercel project dashboard
2. Click on "Storage" tab
3. Create a new KV database
4. Vercel will automatically add the environment variables

### Step 3: Update the Bot Code

Replace the file-based functions in `src/app/api/bot/check/route.ts`:

```typescript
import { kv } from '@vercel/kv';

// Remove these file-based functions:
// - loadRepliedCasts()
// - saveRepliedCast()

// Replace with KV-based functions:
async function hasRepliedToKey(key: string): Promise<boolean> {
  const exists = await kv.exists(key);
  return exists === 1;
}

async function markAsReplied(key: string) {
  // Store with 30-day expiration (2592000 seconds)
  await kv.setex(key, 2592000, Date.now().toString());
  console.log(`Saved ${key} to KV storage`);
}

// In the GET handler, replace:
// const repliedCasts = loadRepliedCasts();
// if (repliedCasts.has(key))

// With:
// if (await hasRepliedToKey(key))

// And replace:
// saveRepliedCast(key)

// With:
// await markAsReplied(key)
```

### Step 4: Update the Loop Logic

```typescript
// Check if we've already replied to ANY of these keys
let alreadyReplied = false;
for (const key of trackingKeys) {
  if (await hasRepliedToKey(key) || repliedCastsCache.has(key)) {
    console.log(`✓ Already replied to ${key}, skipping entire thread`);
    alreadyReplied = true;
    break;
  }
}

// When saving:
for (const key of trackingKeys) {
  await markAsReplied(key);
  repliedCastsCache.set(key, Date.now());
}
```

## Alternative: Use Supabase (Free PostgreSQL)

If you prefer PostgreSQL:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Create table:
// CREATE TABLE replied_casts (
//   tracking_key TEXT PRIMARY KEY,
//   replied_at TIMESTAMP DEFAULT NOW()
// );

async function hasRepliedToKey(key: string): Promise<boolean> {
  const { data } = await supabase
    .from('replied_casts')
    .select('tracking_key')
    .eq('tracking_key', key)
    .single();
  return !!data;
}

async function markAsReplied(key: string) {
  await supabase
    .from('replied_casts')
    .insert({ tracking_key: key });
}
```

## Quick Test

After implementing KV, test by:

1. Deploy to Vercel
2. Trigger the bot by mentioning it
3. Check Vercel logs to see KV operations
4. Mention it again in the same thread - it should NOT reply twice

## Notes

- Vercel KV is free for up to 256MB storage
- Each tracking key is very small (~50 bytes)
- 30-day expiration keeps the database clean
- Multiple serverless instances can safely check/write to KV simultaneously
