# @homiehouselol Farcaster Bot

**Vibe:** Helpful, practical, casually curious. Not trying to be cool.

## Quick Start

### Get Your Signer

1. Go to **https://farcaster.xyz/settings/security**
2. Generate a new signer
3. Save the hex keys you receive

### Configure Vercel (env vars)

In your Vercel project dashboard, add these environment variables:

```
SIGNER_PRIVATE_KEY_HEX=<your_private_key_hex>
SIGNER_PUBLIC_KEY_HEX=<your_public_key_hex>
APP_FID=<your_bot_fid_from_farcaster>
ANTHROPIC_API_KEY=<your_anthropic_key>
```

### Deploy

Just push to your Git repo - Vercel auto-deploys:

```bash
git push origin master
```

## Vercel Env Vars

- `SIGNER_PRIVATE_KEY_HEX` - Your Farcaster signer private key
- `SIGNER_PUBLIC_KEY_HEX` - Your Farcaster signer public key  
- `APP_FID` - Your bot's Farcaster ID
- `ANTHROPIC_API_KEY` - For AI responses

Supabase is optional (for knowledge base in later versions).

## Personality

@homiehouselol is helpful but not performative:
- Knows the docs, tried the tools
- Explanations are for humans, not technical folks
- Short, direct, no hype
- Uses emojis sparingly (🏠 is the mark)
- 180-250 chars max, usually 1-2 sentences

## Features

- **Mention responses** - Replies to @homiehouselol with helpful answers
- **Polling** - Checks every 60 seconds for @mentions
- **Reply caching** - Avoids duplicate responses for 7 days

## Notes

- Bot uses Farcaster's official API endpoints
- No third-party API dependencies
- Runs lightweight, polls for mentions

## Next Steps

1. ✅ Code is ready
2. ⏳ Add Farcaster signer to Vercel env vars
3. ⏳ Push to Git
4. ⏳ Test with a mention
5. 🎉 Launch
