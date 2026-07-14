# @homiehouselol Farcaster Bot

## Quick Start

### Option 1: Use Warpcast Signer (Recommended)

**Step 1: Get your signer from Warpcast**

1. Go to https://warpcast.com/~/settings/security
2. Click "Generate Signer"
3. Save the **Private Key** and **Public Key** (you'll need both)

**Step 2: Register your signer's FID**

After generating the signer, you'll get a Farcaster ID (FID). This is your bot's identity.

**Step 3: Configure environment**

Create `.env` file:

```env
# From Warpcast signer
SIGNER_PRIVATE_KEY_HEX=your_private_key_here
SIGNER_PUBLIC_KEY_HEX=your_public_key_here

# Your bot's FID (from Warpcast)
APP_FID=your_bot_fid_here

# AI provider
ANTHROPIC_API_KEY=your_anthropic_key_here

# Supabase (optional, for knowledge base)
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_key_here
```

**Step 4: Run the bot**

```bash
cd homiehouse/homiehouselol-bot
npm run build
npm start
```

### Option 2: Use Existing Neynar (Current Setup)

If you just want to keep using Neynar but want @homiehouselol to be separate from @auntiehomie:

1. Create a new signer in Neynar for @homiehouselol
2. Set different `APP_FID` and `NEYNAR_SIGNER_UUID`
3. Copy bot code to `homiehouselol-bot` directory
4. Update system prompt to use different persona (already done!)

## Personality

@homiehouselol is your friendly midwestern Farcaster buddy who:
- Explains crypto/AI in simple terms
- Answers questions helpfully
- Posts daily curated links
- Helps new users get started

See `homiehouselol-persona.txt` for the full personality.

## Features

1. **Mention responses** - Replies to @mentions with helpful answers
2. **Proactive posting** - Daily digest of 3 links
3. **Onboarding help** - Welcome new users automatically
4. **Knowledge base** - Pre-populated Q&A for common questions

## Deployment

Deploy to Render/Vercel:

```bash
# Build
npm run build

# Deploy
npm start
```

Set environment variables in your deployment platform.

## Maintenance

- Bot tracks replies to avoid duplicates
- Replies expire after 7 days
- Monitor logs for errors
- Adjust persona if needed

## Next Steps

1. ✅ Bot infrastructure ready
2. ⏳ Get Warpcast signer (or new Neynar signer)
3. ⏳ Test with sample mentions
4. ⏳ Deploy to production
5. 🎉 Announce @homiehouselol is live!
