# Ask Homie Mini App

Farcaster Mini App implementation for the Ask Homie AI assistant.

## 🏗️ Setup Complete

### Files Created

1. **[/mini/ask-homie/page.tsx](src/app/mini/ask-homie/page.tsx)** - Mini app client component
   - Initializes Farcaster SDK
   - Fetches user context (FID, username, etc.)
   - Renders AgentChat component
   - Calls `sdk.actions.ready()` when loaded

2. **[/mini/ask-homie/layout.tsx](src/app/mini/ask-homie/layout.tsx)** - Mini app metadata
   - Defines `fc:miniapp` embed configuration
   - Sets up OpenGraph preview image
   - Configures splash screen

3. **[/.well-known/farcaster.json/route.ts](src/app/.well-known/farcaster.json/route.ts)** - Mini app manifest
   - ⚠️ **REQUIRES SIGNING** (see steps below)
   - Defines app metadata and account association

4. **[/og-ask-homie.png/route.tsx](src/app/og-ask-homie.png/route.tsx)** - Preview image generator
   - Creates 1200x800px (3:2 ratio) OG image
   - Purple gradient with house emoji

5. **[/icon-512.png/route.tsx](src/app/icon-512.png/route.tsx)** - App icon generator
   - Creates 200x200px icon
   - Used for splash screen

## 🔐 Required: Sign Your Manifest

**YOU MUST DO THIS BEFORE THE MINI APP WILL WORK:**

1. **Enable Developer Mode** in Farcaster:
   - Open Warpcast app
   - Go to Settings → Advanced → Enable "Developer Mode"

2. **Generate Signed Manifest**:
   - Visit: https://farcaster.xyz/~/settings/developer-tools
   - Click "Create Manifest"
   - Enter domain: `homiehouse.xyz`
   - Copy the generated `accountAssociation` object

3. **Update Manifest File**:
   - Open [/.well-known/farcaster.json/route.ts](src/app/.well-known/farcaster.json/route.ts)
   - Replace placeholders in `accountAssociation`:
     ```typescript
     accountAssociation: {
       header: "REPLACE_WITH_GENERATED_HEADER",
       payload: "REPLACE_WITH_GENERATED_PAYLOAD",
       signature: "REPLACE_WITH_GENERATED_SIGNATURE"
     }
     ```
   - Save and commit

## 🧪 Testing

### 1. Deploy to Vercel
```bash
git add .
git commit -m "Add Ask Homie mini app"
git push origin master
```

### 2. Preview Tool
After deployment, test at:
```
https://farcaster.xyz/~/developers/mini-apps/preview?url=https%3A%2F%2Fhomiehouse.xyz%2Fmini%2Fask-homie
```

### 3. Share in Farcaster
Create a cast with this format:
```
Check out Ask Homie! 🏡✨

https://homiehouse.xyz/mini/ask-homie
```

The `fc:miniapp` metadata will automatically create a launchable mini app button.

## 📊 What to Test

- [ ] App loads without infinite splash screen
- [ ] User context displays correctly (FID, username)
- [ ] AgentChat interface works
- [ ] Messages send and receive properly
- [ ] AI responses are relevant
- [ ] No console errors

## 🎨 Customization

### Update Images
Replace the dynamic image generators with static files in `/public`:
1. Create `public/og-ask-homie.png` (1200x800px, 3:2 ratio)
2. Create `public/icon-512.png` (200x200px)
3. Update URLs in manifest and layout files

### Adjust Colors
In [/mini/ask-homie/page.tsx](src/app/mini/ask-homie/page.tsx):
```tsx
// Header background
<div className="bg-gradient-to-r from-purple-600 to-indigo-600">

// Loading spinner color
<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600">
```

## 📚 Resources

- [Farcaster Mini Apps Docs](https://miniapps.farcaster.xyz/docs/getting-started)
- [Agent Development Guide](https://miniapps.farcaster.xyz/docs/guides/agents-checklist)
- [SDK Reference](https://github.com/farcasterxyz/miniapp-sdk)

## 🐛 Troubleshooting

### Infinite Splash Screen
- Verify `sdk.actions.ready()` is called
- Check console for SDK errors
- Ensure manifest is properly signed

### Mini App Not Launching
- Verify manifest signature is correct
- Check that URLs in manifest match your domain
- Test manifest endpoint: `https://homiehouse.xyz/.well-known/farcaster.json`

### User Context Not Loading
- Ensure SDK is initialized before calling `sdk.context`
- Check that user is logged into Farcaster
- Verify app has proper permissions

## ✅ Next Steps

1. **REQUIRED**: Sign manifest (see above)
2. Deploy to Vercel
3. Test in preview tool
4. Share in a Farcaster cast
5. Monitor for errors and user feedback

---

**Status**: ⚠️ Awaiting manifest signing before launch
