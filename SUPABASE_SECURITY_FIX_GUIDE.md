# Supabase Security Remediation Guide

## Quick Start - Fix CRITICAL Issues First

### 1. IMMEDIATE: Rotate Exposed Credentials (DO NOW!)

Since these keys are exposed in this document:
- SUPABASE_KEY (anon)
- OPENAI_API_KEY
- ANTHROPIC_API_KEY
- NEYNAR_API_KEY
- NEYNAR_SIGNER_UUID
- APP_MNEMONIC

**Steps:**

```bash
# 1. Go to Supabase Dashboard
# https://app.supabase.com → Project → Settings → API

# Generate new anon key
# Copy new key and update .env.local

# 2. Rotate OpenAI Key
# https://platform.openai.com → Settings → API Keys → Create new

# 3. Rotate Anthropic Key
# https://console.anthropic.com → API Keys → Create new

# 4. Rotate Neynar Signer
# https://dev.neynar.com → Create new signer

# 5. Generate new bot mnemonic
# Requires moving funds if applicable
node -e "const bip39 = require('bip39'); console.log(bip39.generateMnemonic());"

# 6. Update CRON_SECRET to 32+ char random
node -e "console.log(require('crypto').randomBytes(32).toString('hex'));"
```

---

### 2. Fix Cron Job Authentication (30 min)

**File:** [src/app/api/publish-scheduled-casts/route.ts](src/app/api/publish-scheduled-casts/route.ts#L62-L75)

**Current (Vulnerable):**
```typescript
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  console.log('⚠️ Cron job auth failed, but proceeding'); // ← DOESN'T BLOCK!
}
```

**Fixed:**
```typescript
export async function GET(req: NextRequest) {
  return await handlePublishScheduledCasts(req);
}

async function handlePublishScheduledCasts(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || cronSecret.length < 32) {
      console.error('❌ CRON_SECRET not configured');
      return NextResponse.json(
        { ok: false, error: 'Service unavailable' },
        { status: 503 }
      );
    }

    const authHeader = req.headers.get('authorization');
    
    // ENFORCE auth - don't just warn
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('❌ Unauthorized cron request from:', req.ip);
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('✅ Cron job authenticated');
    
    // ... rest of function
  }
}
```

---

### 3. Add User Ownership Verification (1 hour)

**File:** [src/app/api/schedule-cast/route.ts](src/app/api/schedule-cast/route.ts#L15-L50)

**Current (Vulnerable):**
```typescript
const body = await req.json();
const { text, signerUuid, fid, embeds = [] } = body;

if (!text || !signerUuid || !fid) {
  return NextResponse.json(...);
}

// Directly uses client-provided fid!
const insertData: any = {
  user_fid: fid,  // ← TRUSTS CLIENT!
  signer_uuid: signerUuid,
  ...
};
```

**Fixed:**
```typescript
import { neynarFetch } from '@/lib/neynar';

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await req.json();
    const { text, signerUuid, embeds = [], scheduled_time, channelKey } = body;

    // Validation
    if (!text || !signerUuid || !scheduled_time) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // NEW: Verify signer UUID is valid
    let signerData;
    try {
      const response = await neynarFetch(`/signer/${signerUuid}`, {}, 'GET');
      if (!response || !response.fid) {
        return NextResponse.json(
          { ok: false, error: 'Invalid signer' },
          { status: 401 }
        );
      }
      signerData = response;
    } catch (error) {
      return NextResponse.json(
        { ok: false, error: 'Unable to verify signer' },
        { status: 401 }
      );
    }

    // NEW: Use verified FID from signer, not client input!
    const fid = signerData.fid;

    // Rest of function uses verified FID
    const insertData: any = {
      user_fid: fid,  // ✅ NOW VERIFIED
      signer_uuid: signerUuid,
      text,
      embeds: embeds,
      scheduled_time: scheduledDate.toISOString(),
      status: 'pending'
    };

    if (channelKey) {
      insertData.channel_id = channelKey;
    }

    const { data, error } = await supabase
      .from('scheduled_casts')
      .insert(insertData)
      .select()
      .single();

    // ... rest of function
  }
}
```

---

### 4. Enable Row-Level Security in Supabase (30 min)

**Location:** Supabase Dashboard → SQL Editor

```sql
-- 1. Enable RLS on all tables
ALTER TABLE curated_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE curated_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_casts ENABLE ROW LEVEL SECURITY;

-- 2. Clear any existing policies
DROP POLICY IF EXISTS "Enable all for anon" ON curated_lists;
DROP POLICY IF EXISTS "Enable all for anon" ON curated_list_items;
DROP POLICY IF EXISTS "Enable all for anon" ON scheduled_casts;

-- 3. Create policies for curated_lists
CREATE POLICY "Users can read own lists"
  ON curated_lists FOR SELECT
  USING (auth.uid()::text = fid::text);

CREATE POLICY "Users can create own lists"
  ON curated_lists FOR INSERT
  WITH CHECK (auth.uid()::text = fid::text);

CREATE POLICY "Users can update own lists"
  ON curated_lists FOR UPDATE
  USING (auth.uid()::text = fid::text);

CREATE POLICY "Users can delete own lists"
  ON curated_lists FOR DELETE
  USING (auth.uid()::text = fid::text);

-- 4. Create policies for scheduled_casts
CREATE POLICY "Users can read own casts"
  ON scheduled_casts FOR SELECT
  USING (auth.uid()::text = user_fid::text);

CREATE POLICY "Users can create own casts"
  ON scheduled_casts FOR INSERT
  WITH CHECK (auth.uid()::text = user_fid::text);

CREATE POLICY "Users can update own casts"
  ON scheduled_casts FOR UPDATE
  USING (auth.uid()::text = user_fid::text);

CREATE POLICY "Users can delete own casts"
  ON scheduled_casts FOR DELETE
  USING (auth.uid()::text = user_fid::text);

-- 5. Create policies for curated_list_items
CREATE POLICY "Users can manage items in own lists"
  ON curated_list_items FOR ALL
  USING (
    list_id IN (
      SELECT id FROM curated_lists WHERE auth.uid()::text = fid::text
    )
  );
```

**Test RLS:**
```bash
# 1. In Supabase Dashboard, test with anon key
# 2. Try to select from curated_lists
# 3. Should return: "relation curated_lists does not exist"
# (because anon has no access)

# 4. Try to select with your user FID
# 5. Should return your own lists only
```

---

### 5. Add Input Validation (45 min)

**File:** [bot/src/curated-lists.ts](bot/src/curated-lists.ts#L68-L80)

```typescript
// Add at top
function validateListName(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new Error('Invalid list name');
  }

  const trimmed = name.trim();

  if (trimmed.length < 1 || trimmed.length > 100) {
    throw new Error('List name must be 1-100 characters');
  }

  // Allow letters, numbers, spaces, hyphens, underscores
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmed)) {
    throw new Error('List name contains invalid characters');
  }

  return trimmed;
}

// Update createList function
static async createList(fid: number, listName: string, description?: string) {
  try {
    // NEW: Validate input
    const validatedName = validateListName(listName);
    const validatedDesc = description 
      ? description.trim().slice(0, 500)
      : null;

    const { data, error } = await supabase
      .from('curated_lists')
      .insert([{
        fid,
        list_name: validatedName,  // ✅ VALIDATED
        description: validatedDesc,  // ✅ VALIDATED
        is_public: isPublic
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { ok: false, error: 'List with this name already exists' };
      }
      console.error('Error creating list:', error);
      return { ok: false, error: 'Failed to create list' };  // Generic error
    }

    return { ok: true, data };
  } catch (error: any) {
    console.error('Exception creating list:', error);
    return { ok: false, error: error?.message || 'Failed to create list' };
  }
}
```

---

### 6. Improve Error Messages (30 min)

**Pattern to follow everywhere:**

```typescript
// ❌ BAD: Leaks information
if (error) {
  return NextResponse.json(
    { 
      error: error.message,  // "column 'fid' does not exist"
      details: error.hint    // Schema information!
    },
    { status: 500 }
  );
}

// ✅ GOOD: Generic message, detailed logging
if (error) {
  console.error('[Database Error]', {
    operation: 'insert_curated_lists',
    code: error.code,
    message: error.message,
    hint: error.hint
  });

  return NextResponse.json(
    { ok: false, error: 'An error occurred' },  // Generic
    { status: 500 }
  );
}
```

---

### 7. Add Rate Limiting (1 hour)

**Install:**
```bash
npm install @upstash/ratelimit @upstash/redis
```

**Create utility:** `src/lib/ratelimit.ts`
```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 h"),  // 10 per hour
});
```

**Use in API routes:**
```typescript
import { ratelimit } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = await ratelimit.limit(`schedule-cast:${ip}`);

  if (!success) {
    return NextResponse.json(
      { ok: false, error: 'Rate limited - try again later' },
      { status: 429 }
    );
  }

  // Continue with request...
}
```

---

## Verification Checklist

After applying fixes, verify:

```bash
# [ ] 1. All secrets rotated (old keys invalidated)
# [ ] 2. New secrets in Vercel environment variables
# [ ] 3. .gitignore includes .env.local
# [ ] 4. Cron endpoint returns 401 without Bearer token
#       curl -X GET https://your-app.vercel.app/api/publish-scheduled-casts
# [ ] 5. RLS enabled on all tables
# [ ] 6. Anonymous key can't access any data
# [ ] 7. Schedule-cast rejects invalid signers
# [ ] 8. Input validation rejects bad list names
# [ ] 9. Errors don't leak database schema
# [ ] 10. Rate limiting kicks in after 10 requests
```

---

## Timeline

| Phase | Duration | Critical? |
|-------|----------|-----------|
| Rotate credentials | 30 min | 🔴 YES - DO TODAY |
| Fix cron auth | 30 min | 🔴 YES - DO TODAY |
| Add user verification | 1 hr | 🔴 YES - DO THIS WEEK |
| Enable RLS | 30 min | 🔴 YES - DO THIS WEEK |
| Input validation | 45 min | 🟠 HIGH - DO THIS WEEK |
| Error messages | 30 min | 🟠 HIGH - DO SOON |
| Rate limiting | 1 hr | 🟡 MEDIUM - THIS MONTH |

---

## Questions?

Refer to:
- [Supabase Security Guide](https://supabase.com/docs/guides/platform/security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/learn/dashboard-app/improving-security)
