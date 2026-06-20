# Authentication Setup & Troubleshooting

## Common Issue: "Failed to connect"

If users see a "Failed to connect - We were unable to connect the app" error, it's likely due to missing configuration.

## Root Cause

The app uses **Neynar Sign in with Neynar (SIWN)** for authentication, which requires a Client ID to be configured. Without it, the authentication flow cannot initialize.

## Solution

### Step 1: Get Your Neynar Client ID

1. Go to https://dev.neynar.com/
2. Sign in with your Farcaster account
3. Click "Create App" or select an existing app
4. Copy your **Client ID** (looks like: `abc123def456...`)

### Step 2: Add to Environment Variables

Create or edit `.env.local` in your project root:

```env
NEXT_PUBLIC_NEYNAR_CLIENT_ID=your_client_id_here
```

**Important**: The variable must start with `NEXT_PUBLIC_` to be available in the browser.

### Step 3: Restart Development Server

```bash
# Stop the current server (Ctrl+C)
npm run dev
```

### Step 4: Test Authentication

1. Open http://localhost:3000
2. Click "Sign in"
3. Scan QR code with Warpcast app
4. Approve the signer
5. You should be logged in ✅

## Deployment (Vercel/Production)

Don't forget to add the environment variable to your deployment platform:

### Vercel
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add: `NEXT_PUBLIC_NEYNAR_CLIENT_ID` = `your_client_id`
4. Redeploy

### Other Platforms
Add the environment variable according to your platform's documentation.

## Error Messages You Might See

### "Configuration Required" Page
- **Cause**: Missing `NEXT_PUBLIC_NEYNAR_CLIENT_ID`
- **Solution**: Follow steps above

### "Failed to connect"
- **Cause**: Invalid or missing Client ID
- **Solution**: Verify your Client ID is correct and environment variable is set

### Auth Modal Doesn't Open
- **Cause**: Client ID not loaded
- **Solution**: Check browser console for errors, verify `.env.local` is in root directory

### QR Code Doesn't Work
- **Cause**: Network or Neynar service issue
- **Solution**: Try again, check https://status.neynar.com/

## Additional Requirements

### For Full Functionality

Your `.env.local` should also include:

```env
# Authentication (Required)
NEXT_PUBLIC_NEYNAR_CLIENT_ID=your_client_id_here
NEYNAR_API_KEY=your_api_key_here

# Database (Required for bot features)
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key

# AI Features (Optional)
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key
PERPLEXITY_API_KEY=your_perplexity_key

# Bot Configuration (Optional)
APP_FID=your_farcaster_fid
NEYNAR_SIGNER_UUID=your_signer_uuid
```

## Verification

### Check if Environment Variable is Set

Add this temporarily to `src/app/page.tsx`:

```tsx
useEffect(() => {
  console.log('Client ID configured:', !!process.env.NEXT_PUBLIC_NEYNAR_CLIENT_ID);
}, []);
```

Should log: `Client ID configured: true`

### Check Network Requests

1. Open browser DevTools (F12)
2. Go to Network tab
3. Try to sign in
4. Look for requests to `neynar.com` - they should not be blocked

## Still Having Issues?

1. **Check `.env.local` location**: Must be in project root (same folder as `package.json`)
2. **Check variable name**: Must be exactly `NEXT_PUBLIC_NEYNAR_CLIENT_ID`
3. **Restart server**: Changes to `.env.local` require a server restart
4. **Clear browser cache**: Sometimes cached JavaScript doesn't pick up new variables
5. **Check Neynar status**: Visit https://status.neynar.com/

## For Repository Owner

If you're sharing this project with others:

1. Create `.env.example` with template variables (no actual keys)
2. Add `.env.local` to `.gitignore` (should already be there)
3. Document setup in README
4. Consider adding setup validation on app startup

## Security Notes

- ✅ `NEXT_PUBLIC_*` variables are safe to expose (they're in client-side JavaScript anyway)
- ❌ Never commit actual API keys to git
- ❌ Server-only secrets (like `ANTHROPIC_API_KEY`) should NOT have `NEXT_PUBLIC_` prefix
- ✅ Use environment variables in production, not hardcoded values

## Related Documentation

- [Neynar SIWN Documentation](https://docs.neynar.com/docs/how-to-let-users-connect-farcaster-accounts-with-write-access-for-free-using-sign-in-with-neynar-siwn)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [NEYNAR_AUTH_MIGRATION.md](./NEYNAR_AUTH_MIGRATION.md) - Migration guide from Privy to Neynar
