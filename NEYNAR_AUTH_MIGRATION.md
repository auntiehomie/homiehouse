# Neynar Authentication Migration

## Overview
Successfully migrated from Farcaster Auth Kit to Neynar authentication for simplified signer management.

## Key Changes

### 1. Authentication Flow
**Before:** @farcaster/auth-kit with manual signer creation and QR code approval modals
**After:** Direct Neynar authentication with integrated signer management

### 2. Updated Files

#### SignInWithFarcaster.tsx
- Removed all AuthKit dependencies
- Implemented Neynar OAuth flow with window polling
- Auth flow now:
  1. POST to `/api/neynar-auth` creates a signer
  2. Opens Neynar approval page in popup window
  3. Polls GET `/api/neynar-auth?token=...` every 2 seconds
  4. On approval, saves profile with signerUuid to localStorage
  5. Maintains backward compatibility by saving signer to `signer_{fid}` format

#### /api/neynar-auth/route.ts (NEW)
- POST endpoint: Creates managed signer via Neynar API, returns approval URL and session token
- GET endpoint: Checks signer status, returns user profile when approved
- Uses in-memory session storage (consider Redis for production)
- Auto-cleans expired sessions after 5 minutes

#### AuthKitProviderWrapper.tsx
- Removed AuthKit provider
- Now just passes through children (kept for backward compatibility)

#### FeedList.tsx
- Removed `useProfile()` hook
- Created `getProfile()` helper function to read from localStorage
- Updated useEffect dependencies

#### TrendingList.tsx
- Removed `useProfile()` hook
- Reads profile directly from localStorage
- Simplified useEffect dependencies

#### SignerManager.tsx
- Removed `useProfile()` hook
- Loads profile from localStorage in useEffect
- Changed `isAuthenticated` check to `!profile`

#### page.tsx
- Removed unused `useProfile` import

## Benefits

1. **Single Approval**: Users approve signer once during sign-in, not for each action
2. **Cleaner Flow**: No QR code modals during interactions (like, recast, reply, quote)
3. **Simpler Code**: Removed complex modal states and approval checking logic
4. **Better UX**: Streamlined authentication matching apps like Recaster

## Backward Compatibility

- Profile stored at `localStorage.hh_profile` (unchanged)
- Signer also stored at `localStorage.signer_{fid}` with status 'approved'
- Existing components using `getSignerUuid()` continue to work

## Testing Checklist

- [ ] Sign in with Farcaster works
- [ ] Profile displays after sign in
- [ ] Feed loads correctly
- [ ] Like/recast/reply work without additional approvals
- [ ] Quote cast works without 403 errors
- [ ] Sign out clears both profile and signer data

## Environment Variables Required

```
NEYNAR_API_KEY=your_neynar_api_key
```

## Next Steps (Optional)

1. Remove `@farcaster/auth-kit` from package.json dependencies
2. Replace in-memory session storage with Redis for production scaling
3. Add error handling for network failures during polling
4. Consider adding session expiry UI feedback
