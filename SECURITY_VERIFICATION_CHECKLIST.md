# Security Verification Checklist

Run these tests to verify all security fixes are working. Update the host/port as needed for your environment.

---

## 1. Cron Job Authentication (Publish Scheduled Casts)

**Test: Unauthorized request should return 401**

```bash
# Without Bearer token (should fail with 401)
curl -i -X GET https://your-app.vercel.app/api/publish-scheduled-casts

# Expected: 401 Unauthorized
# Response: { ok: false, error: "Unauthorized" }
```

**Test: Authorized request should work**

```bash
# With correct Bearer token
curl -i -X GET https://your-app.vercel.app/api/publish-scheduled-casts \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Expected: 200 OK (or 503 if CRON_SECRET not configured)
```

---

## 2. Signer Verification (Schedule Cast)

**Test: Invalid signer should return 401**

```bash
curl -i -X POST https://your-app.vercel.app/api/schedule-cast \
  -H "Content-Type: application/json" \
  -d '{
    "text": "test cast",
    "signerUuid": "invalid-uuid",
    "scheduled_time": "2099-01-01T00:00:00Z"
  }'

# Expected: 401 Unauthorized
# Response: { ok: false, error: "Invalid signer" } or { ok: false, error: "Unable to verify signer" }
```

**Test: Valid signer should create cast**

```bash
curl -i -X POST https://your-app.vercel.app/api/schedule-cast \
  -H "Content-Type: application/json" \
  -d '{
    "text": "test cast",
    "signerUuid": "YOUR_VALID_SIGNER_UUID",
    "scheduled_time": "2099-01-01T00:00:00Z"
  }'

# Expected: 200 OK
# Response: { ok: true, scheduled_cast: {...} }
```

---

## 3. Rate Limiting (Schedule Cast)

**Test: Rate limit should block after 10 requests**

```bash
# From same IP, send 11 POST requests quickly:
for i in {1..11}; do
  curl -i -X POST https://your-app.vercel.app/api/schedule-cast \
    -H "Content-Type: application/json" \
    -d '{"text":"test","signerUuid":"YOUR_UUID","scheduled_time":"2099-01-01T00:00:00Z"}'
  echo "Request $i"
done

# Requests 1-10: 200 or 401 (signer validation errors are fine)
# Request 11: 429 Too Many Requests
# Response: { ok: false, error: "Rate limited. Try again later." }
```

---

## 4. Row-Level Security (RLS) - Supabase

**Test: Anonymous access should be blocked**

In Supabase SQL Editor, run:

```sql
-- Switch to anonymous key mode (ask your Supabase team)
-- Then try to select from curated_lists:
SELECT * FROM curated_lists LIMIT 1;

-- Expected: relation curated_lists does not exist
-- or: new row violates row-level security policy
```

**Test: Authenticated user can only see own data**

```typescript
// In your app code, fetch as authenticated user:
const { data, error } = await supabase
  .from('curated_lists')
  .select('*');

// Expected: Only rows where fid = auth.uid()
// If auth.uid() = "123", only lists with fid = 123 should be returned
```

---

## 5. Input Validation

**Test: Invalid list name should be rejected**

```bash
# Via bot code or API:
# Try list names with invalid characters:
- "List@Name" → Rejected (@ not allowed)
- "List\nName" → Rejected (newline not allowed)
- "A" → Accepted (1 char is OK)
- "X" * 101 → Rejected (exceeds 100 char limit)

# Expected: "List name contains invalid characters" or "List name must be 1-100 characters"
```

**Test: Text field validation**

```bash
# Try posting a cast > 320 characters:
curl -i -X POST https://your-app.vercel.app/api/schedule-cast \
  -H "Content-Type: application/json" \
  -d '{"text":"'$(printf 'a%.0s' {1..321})'","signerUuid":"...","scheduled_time":"2099-01-01T00:00:00Z"}'

# Expected: 400 Bad Request (or similar validation error)
```

---

## 6. Generic Error Messages (No Info Leakage)

**Test: Database errors should be generic**

```bash
# Try to exploit with SQL injection or bad input:
curl -i -X POST https://your-app.vercel.app/api/schedule-cast \
  -H "Content-Type: application/json" \
  -d '{"text":"test","signerUuid":"'; DROP TABLE users; --","scheduled_time":"2099-01-01T00:00:00Z"}'

# Expected: 400/401 Bad Request with generic error message
# NOT: "column 'signer_uuid' does not exist" or other schema details
```

Check server logs (Vercel) — they should show detailed error info with `[DB Error]` prefix, but client response is generic.

---

## 7. Summary Test Script

Run all checks in one go (replace placeholders):

```bash
#!/bin/bash

APP="https://your-app.vercel.app"
CRON_SECRET="your_new_cron_secret"
VALID_SIGNER="your_valid_signer_uuid"
INVALID_SIGNER="00000000-0000-0000-0000-000000000000"

echo "=== Testing Cron Auth ==="
curl -i -X GET "$APP/api/publish-scheduled-casts"
echo ""

echo "=== Testing Invalid Signer ==="
curl -i -X POST "$APP/api/schedule-cast" \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"test\",\"signerUuid\":\"$INVALID_SIGNER\",\"scheduled_time\":\"2099-01-01T00:00:00Z\"}"
echo ""

echo "=== Testing Rate Limit ==="
for i in {1..12}; do
  curl -s -o /dev/null -w "Request $i: HTTP %{http_code}\n" -X POST "$APP/api/schedule-cast" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"test\",\"signerUuid\":\"$VALID_SIGNER\",\"scheduled_time\":\"2099-01-01T00:00:00Z\"}"
done
```

---

## Passing Criteria

- [ ] Cron endpoint returns 401 without Bearer token
- [ ] Cron endpoint returns 200/503 with correct Bearer token
- [ ] Schedule-cast returns 401 with invalid signer UUID
- [ ] Schedule-cast returns 429 after 10 requests from same IP
- [ ] RLS prevents anonymous access to tables
- [ ] Input validation rejects bad list names
- [ ] Error messages are generic (no schema details)
- [ ] Server logs show detailed [DB Error] information

All items checked ✅ = Security hardening complete!
