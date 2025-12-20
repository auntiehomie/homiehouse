This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Enabling real Farcaster feeds (Neynar)

This project ships with a local dev mock for Farcaster (used when `window.sdk` is not present) so the UI works offline.

If you'd like to show your actual Farcaster home feed in the app, you can enable a server-side proxy to a Farcaster data provider (we include an example proxy to Neynar).

1. Sign up for Neynar (or another Farcaster data provider) and obtain an API key. Neynar docs: https://neynar.com/ or https://docs.neynar.com/
2. Copy the example env file and add your key:

```bash
cp .env.local.example .env.local
# edit .env.local and set NEYNAR_API_KEY=your_api_key_here
```

3. Restart the dev server:

```bash
npm run dev
```

4. When signed in with AuthKit, the `FeedList` component will request `/api/feed?fid=<your-fid>` and the server will proxy Neynar's feed responses. If `NEYNAR_API_KEY` is not set the endpoint returns 501 and the client will fall back to the host SDK or the dev mock.

Notes:
- Using a third-party provider may incur rate limits or costs — check the provider's docs.
- If you prefer to self-host, you can run a Snapchain node and point `/api/feed` at it instead of Neynar.

## Preparing to deploy to Vercel (recommended)

Before pushing to Git and deploying to Vercel, make sure you do not commit local secrets. This repo's `.gitignore` excludes `.env*` files by default.

1. Create a local env file (if you haven't already) from the example:

```bash
cp .env.local.example .env.local
# edit .env.local and fill values (do NOT commit .env.local)
```

2. In the Vercel dashboard for your project, add the following Environment Variables (Production/Preview/Development as appropriate):

- `NEYNAR_API_KEY` — your Neynar API key (required to enable the server-side feed proxy)
- `FARC_RPC_URL` — optional server RPC URL (e.g. `https://mainnet.optimism.io`) used by the SIWF verifier
- `NEXT_PUBLIC_FARC_RPC_URL` — optional client RPC URL (same as above)

3. Deploy on Vercel. Once deployed, AuthKit will use the production origin and the server-side `/api/siwf` route will verify signatures against the configured RPC.

Quick Git push commands:

```bash
git add -A
git commit -m "Add AuthKit + Neynar proxy and README"
git push origin main
```

If you prefer, I can prepare a commit message and double-check there are no accidental secrets in tracked files before you push — tell me and I will run a quick grep for `.env` references and any hard-coded API keys to be safe.

