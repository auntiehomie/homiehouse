# HomieHouse

A Next.js-based Farcaster social hub with AI integration, feed curation, and comprehensive notifications.

## Features

- 🏠 **Social Hub** - Complete Farcaster feed integration
- 🤖 **Ask Homie** - AI-powered assistant using multiple LLM providers
- 🎯 **Feed Curation** - Customize your feed with advanced filters
- 🔔 **Notifications** - Detailed notifications with actor information
- 💬 **Compose** - Create and share casts
- 👤 **Profiles** - View user profiles and activity
- 💰 **Wallet** - Integrated wallet functionality
- 🔄 **Swap** - Token swapping capabilities

## Documentation

All detailed documentation is available in the [`docs/`](./docs) directory:

### Getting Started
- [Curation Setup](./docs/CURATION_SETUP.md) - Quick setup for feed curation
- [Notifications Quickstart](./docs/NOTIFICATIONS_QUICKSTART.md) - Get started with notifications
- [Supabase Setup](./docs/SUPABASE_SETUP.md) - Database configuration
- [Render Deployment](./docs/RENDER_ENV_SETUP.md) - Deploy to Render

### Feature Guides
- [Curation Guide](./docs/CURATION_GUIDE.md) - Complete feed curation documentation
- [Notifications Guide](./docs/NOTIFICATIONS_GUIDE.md) - Comprehensive notifications guide
- [AI Framework](./docs/AI_FRAMEWORK.md) - AI integration documentation
- [Bot Intelligence](./docs/BOT_INTELLIGENCE.md) - Feed intelligence & context awareness
- [Bot Testing Guide](./docs/BOT_TESTING.md) - Testing bot enhancements

### Technical Documentation
- [Curation Architecture](./docs/CURATION_ARCHITECTURE.md) - Technical architecture details
- [Bot Enhancement Summary](./docs/BOT_ENHANCEMENT_SUMMARY.md) - Latest bot improvements

## Quick Start

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Environment Setup

### ⚠️ Critical Setup Required

The app will **not work** without proper environment configuration.

### Client Environment Variables

Create `.env.local` in the root directory:

```bash
cp .env.example .env.local
```

**Required variables:**
- `NEXT_PUBLIC_FARCASTER_CLIENT_ID` - **REQUIRED** for user authentication
  - Get it at: https://dev.farcaster-api.com/
  - Sign in → Create/Select App → Copy Client ID
- `FARCASTER_API_KEY` - Your Farcaster API API key for Farcaster data

**Minimum .env.local setup:**
```env
NEXT_PUBLIC_FARCASTER_CLIENT_ID=your_client_id_here
FARCASTER_API_KEY=your_api_key_here
```

### Server Environment Variables

The `server/` directory needs its own `.env` file with:
- `FARCASTER_API_KEY` - Farcaster API API key
- `FARCASTER_SIGNER_UUID` - Signer UUID for bot interactions
- `APP_FID` - Your app's Farcaster ID
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_KEY` - Supabase anon/public key
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `PERPLEXITY_API_KEY` - AI provider keys

## Project Structure

```
homiehouse/
├── docs/                  # All documentation
├── src/
│   ├── app/              # Next.js app directory
│   ├── components/       # React components
│   └── lib/              # Utility libraries
├── server/               # Express backend server
│   └── src/              # Server source code
├── public/               # Static assets
└── README.md             # This file
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Enabling real Farcaster feeds (Farcaster API)

This project ships with a local dev mock for Farcaster (used when `window.sdk` is not present) so the UI works offline.

If you'd like to show your actual Farcaster home feed in the app, you can enable a server-side proxy to a Farcaster data provider (we include an example proxy to Farcaster API).

1. Sign up for Farcaster API (or another Farcaster data provider) and obtain an API key. Farcaster API docs: https://farcaster-api.com/ or https://docs.farcaster-api.com/
2. Copy the example env file and add your key:

```bash
cp .env.local.example .env.local
# edit .env.local and set FARCASTER_API_KEY=your_api_key_here
```

3. Restart the dev server:

```bash
npm run dev
```

4. When signed in with AuthKit, the `FeedList` component will request `/api/feed?fid=<your-fid>` and the server will proxy Farcaster API's feed responses. If `FARCASTER_API_KEY` is not set the endpoint returns 501 and the client will fall back to the host SDK or the dev mock.

Notes:
- Using a third-party provider may incur rate limits or costs — check the provider's docs.
- If you prefer to self-host, you can run a Snapchain node and point `/api/feed` at it instead of Farcaster API.

## Preparing to deploy to Vercel (recommended)

Before pushing to Git and deploying to Vercel, make sure you do not commit local secrets. This repo's `.gitignore` excludes `.env*` files by default.

1. Create a local env file (if you haven't already) from the example:

```bash
cp .env.local.example .env.local
# edit .env.local and fill values (do NOT commit .env.local)
```

2. In the Vercel dashboard for your project, add the following Environment Variables (Production/Preview/Development as appropriate):

- `FARCASTER_API_KEY` — your Farcaster API API key (required to enable the server-side feed proxy)
- `FARC_RPC_URL` — optional server RPC URL (e.g. `https://mainnet.optimism.io`) used by the SIWF verifier
- `NEXT_PUBLIC_FARC_RPC_URL` — optional client RPC URL (same as above)

3. Deploy on Vercel. Once deployed, AuthKit will use the production origin and the server-side `/api/siwf` route will verify signatures against the configured RPC.

Quick Git push commands:

```bash
git add -A
git commit -m "Add AuthKit + Farcaster API proxy and README"
git push origin main
```

If you prefer, I can prepare a commit message and double-check there are no accidental secrets in tracked files before you push — tell me and I will run a quick grep for `.env` references and any hard-coded API keys to be safe.

