# Neynar Authentication Migration Guide

## What Changed

The app has been migrated from Privy to **Neynar's Sign in with Neynar (SIWN)** - the recommended authentication method for Farcaster apps.

## Benefits

✅ **Plug-and-play** - No custom auth flow needed  
✅ **Free for users** - Neynar sponsors signers (35k+ users already approved)  
✅ **One-step onboarding** - Users authenticate once  
✅ **User control** - Users can revoke signers at [app.neynar.com](https://app.neynar.com/connections)  
✅ **No signer management** - Neynar handles everything  

## Setup Steps

### 1. Install Dependencies

```bash
npm install @neynar/react
```

### 2. Get Neynar Client ID

1. Go to [dev.neynar.com](https://dev.neynar.com/)
2. Sign in with your Farcaster account
3. Create a new app or select existing
4. Copy your **Client ID**

### 3. Update Environment Variable

Edit `.env.local`:

```env
NEXT_PUBLIC_NEYNAR_CLIENT_ID=your_actual_client_id_here
```

### 4. Restart Dev Server

```bash
npm run dev
```

## Files Changed

### Created
- `src/components/NeynarAuthProvider.tsx` - Handles auth state and localStorage sync

### Modified
- `src/app/layout.tsx` - Now uses `NeynarContextProvider`
- `src/components/NeynarSignIn.tsx` - Simplified to use `useNeynarContext`
- `src/app/page.tsx` - Uses `useNeynarContext` instead of Privy
- `src/components/BottomNav.tsx` - Uses `useNeynarContext`
- `src/app/trending/page.tsx` - Uses `useNeynarContext`
- `package.json` - Added `@neynar/react` dependency

### Can Be Removed
- `src/components/PrivyAuthProvider.tsx` - No longer needed
- `src/components/PrivySignIn.tsx` - Replaced by Neynar version

## How It Works

1. **User clicks sign in** → Neynar modal opens
2. **User scans QR code** → Warpcast/Farcaster app opens
3. **User approves** → Signer created automatically (sponsored by Neynar)
4. **User authenticated** → Profile stored in localStorage for backward compatibility

## Migration from Old Auth

The new system maintains backward compatibility by storing user data in the same localStorage format:

```javascript
localStorage.setItem('hh_profile', JSON.stringify({
  fid: user.fid,
  username: user.username,
  displayName: user.display_name,
  pfpUrl: user.pfp_url,
  bio: user.profile?.bio?.text || ''
}));
```

All existing components that read from `localStorage.getItem('hh_profile')` will continue to work.

## Testing

1. Start the dev server: `npm run dev`
2. Open http://localhost:3000
3. Click "Sign in"
4. Scan QR code with Warpcast
5. Approve the signer
6. You should be logged in automatically

## Troubleshooting

### "Cannot find module '@neynar/react'"
Run: `npm install @neynar/react`

### Auth modal doesn't appear
Check that `NEXT_PUBLIC_NEYNAR_CLIENT_ID` is set in `.env.local`

### Signer approval fails
- Ensure you're using Warpcast or another Farcaster client
- Check that your Neynar API key is valid
- Verify your app is properly configured at dev.neynar.com

## Documentation

- [Neynar SIWN Docs](https://docs.neynar.com/docs/how-to-let-users-connect-farcaster-accounts-with-write-access-for-free-using-sign-in-with-neynar-siwn)
- [Which Signer to Use](https://docs.neynar.com/docs/which-signer-should-you-use-and-why)
- [Neynar React SDK](https://github.com/neynarxyz/farcaster-examples/tree/main/wownar-react-sdk)

## Production Deployment

Don't forget to add the environment variable to your Vercel/production environment:

```
NEXT_PUBLIC_NEYNAR_CLIENT_ID=your_actual_client_id_here
```
