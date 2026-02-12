# Troubleshooting: "Failed to verify signer" on Vercel

## Symptoms
- Error: "Failed to verify signer" or "Unable to verify signer"  
- No logs visible in Vercel console
- Cast posting fails in production but may work locally

## Root Causes

### 1. Missing or Invalid Environment Variables
The most common cause. Verify in Vercel dashboard:

- **NEYNAR_API_KEY**: Must be set. Check that the API key is valid and has not expired.
- **NO_EXTERNAL_LOGS**: If set to `true`, Vercel hides console logs from the dashboard.

### 2. Using Wrong API Endpoint Path
Your client may be sending requests to the wrong endpoint. Both of these should work:

- `POST /api/privy-compose` (primary)
- `POST /api/compose-cast` (legacy alias, newly added)

### 3. Payload Field Mismatch
Some clients send `signer_uuid` (snake_case) instead of `signerUuid` (camelCase).

✅ **Fixed in v1.1.0**: The API now accepts both field names for compatibility.

## Debugging Steps

### Step 1: Enable Vercel Logs
In Vercel dashboard, check that log streaming is enabled:
- Go to your project → Settings → Environment Variables
- Add `DEBUG=*` or `LOG_LEVEL=debug` if needed
- Do NOT set `NO_EXTERNAL_LOGS=true`

### Step 2: Check Environment Variables
```bash
# In Vercel dashboard Settings > Environment Variables, verify:
# ✓ NEYNAR_API_KEY is set
# ✓ APP_FID is set (for signer creation)
# ✓ APP_MNEMONIC is set (for signer creation)
```

### Step 3: Test the Endpoint
```bash
# Test signer verification directly
curl --request POST https://your-app.vercel.app/api/privy-compose \
  --header "Content-Type: application/json" \
  --data '{
    "text": "test",
    "signerUuid": "00000000-0000-0000-0000-000000000000"
  }'

# Expected 401 error (invalid signer):
# { "error": "Invalid signer", "code": "INVALID_SIGNER" }
```

### Step 4: Local Testing
Before deploying, test locally:

```bash
npm run dev

# In another terminal:
curl -X POST http://localhost:3000/api/privy-compose \
  -H "Content-Type: application/json" \
  -d '{
    "text": "test cast",
    "signerUuid": "YOUR_SIGNER_UUID"
  }'
```

### Step 5: Check Neynar API Status
If verification fails on both local and production:

1. Visit https://status.neynar.com
2. Check if Neynar API is operational
3. Verify your API key: https://docs.neynar.com/reference/post-cast
4. Test with a known-good signer UUID

## Recent Changes (v1.1.0)

✅ **Backward Compatibility**: Both `signerUuid` and `signer_uuid` field names are now accepted.

✅ **Enhanced Logging**: 
- Server logs now include API request URLs and headers (with API key masked)
- Client logs now show which field name was provided

✅ **Legacy Endpoint**: `/api/compose-cast` now aliases to `/api/privy-compose` for backward compatibility.

## Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| `Invalid signer` (401) | Signer UUID not found | Verify signer UUID is correct and approved |
| `Unable to verify signer (401)` | Neynar API key invalid | Update `NEYNAR_API_KEY` in Vercel |
| `Signer is not approved` (401) | Signer status is not "approved" | User must approve signer in Warpcast |
| `Signer has no associated FID` (401) | Signer exists but no FID linked | Signer creation failed, create a new one |
| `No response from server` | Timeout or network issue | Check Vercel status and logs |

## Vercel-Specific Issues

### Problem: No logs appear in Vercel dashboard
**Possible causes:**
- Function timeout (>10s on hobby plan, >60s on pro)
- `NO_EXTERNAL_LOGS` environment variable is `true`
- Logs are being swallowed by a middleware

**Fix:**
1. Remove `NO_EXTERNAL_LOGS` if present
2. Check function duration: Vercel dashboard → Functions → Duration
3. Ensure NEYNAR_API_KEY is set (verification calls Neynar API)

### Problem: 401 error but no indication why
**Possible cause:** `verifySignerAuth` function is throwing an AuthError without logging request details

**Fixed in v1.1.0:** Enhanced error logging now includes:
- API request URL
- Response status code
- Response body (if available)
- API key presence (masked for security)

## Next Steps

1. **If logs are still missing**: Check Vercel settings → Environment Variables → "NO_EXTERNAL_LOGS"
2. **If signer verification fails**: Run the test curl command above with your actual signer UUID
3. **If still stuck**: Check Neynar API docs: https://docs.neynar.com/reference/get-signer

---

**Last updated:** v1.1.0  
**Fixes included:**
- ✅ Backward-compatible payload field names
- ✅ Enhanced error logging with request details  
- ✅ Legacy `/api/compose-cast` endpoint alias
- ✅ Environment variable documentation
