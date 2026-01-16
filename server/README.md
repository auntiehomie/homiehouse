# HomieHouse Bot Server

Backend server for the HomieHouse Farcaster bot, running on Render.

## Why a Separate Server?

The bot needs persistent storage and long-running processes, which don't work well in serverless environments like Vercel. By running the bot on Render (a traditional server), we get:

- ✅ Persistent file storage that survives between runs
- ✅ Long-running processes (no cold starts)
- ✅ Scheduled cron jobs that actually work
- ✅ Consistent state across all requests

## Features

- 🤖 Responds to @mentions on Farcaster
- 🧠 Uses Claude and GPT-4 for intelligent replies
- 👁️ GPT-4 Vision for image analysis
- 💾 Persistent storage to prevent duplicate replies
- ⏰ Runs every 15 minutes automatically
- 🔒 Only replies once per thread

## Setup

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Environment Variables

Already configured in `.env`:
- `PORT`: Server port (default 3001)
- `NEYNAR_API_KEY`: Your Neynar API key
- `NEYNAR_SIGNER_UUID`: Bot signer UUID
- `APP_FID`: Bot's Farcaster ID
- `APP_MNEMONIC`: Bot's signing mnemonic
- `OPENAI_API_KEY`: OpenAI API key
- `ANTHROPIC_API_KEY`: Anthropic API key

### 3. Run Locally

```bash
npm run dev
```

The server will:
- Start on port 3001
- Check for mentions every 15 minutes
- Run an initial check 5 seconds after startup

## Deploy to Render

### 1. Create New Web Service

1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repo
4. Configure:
   - **Name**: `homiehouse-bot`
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free (sufficient for bot)

### 2. Add Environment Variables

In Render dashboard, add all environment variables from `.env`:

```
NEYNAR_API_KEY=8C6F1E4E-677E-419A-A8C7-EF849B0E366B
NEYNAR_SIGNER_UUID=0603c233-00c3-4513-9fe1-46d5dd5debeb
APP_FID=1987078
APP_MNEMONIC=amount bike fancy position great clarify bargain genre hub world isolate popular
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### 3. Deploy

Click "Create Web Service" and Render will:
- Clone your repo
- Install dependencies
- Build TypeScript
- Start the server
- Keep it running 24/7

### 4. Verify

Once deployed, check:
- Health endpoint: `https://your-app.onrender.com/health`
- Manual trigger: `POST https://your-app.onrender.com/trigger-bot`

## API Endpoints

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "homiehouse-bot",
  "timestamp": "2026-01-16T12:00:00.000Z"
}
```

### POST /trigger-bot

Manually trigger the bot to check for mentions (useful for testing).

**Response:**
```json
{
  "success": true,
  "checked": 5,
  "replied": 1,
  "timestamp": "2026-01-16T12:00:00.000Z"
}
```

## How It Works

1. **Cron Schedule**: Runs every 15 minutes
2. **Fetch Notifications**: Gets @mentions from Neynar
3. **Check Duplicates**: Looks in `replied_casts.json` file
4. **Verify Thread**: Double-checks the thread for existing bot replies
5. **Generate Reply**: Uses Claude/GPT-4 (with Vision for images)
6. **Post Reply**: Publishes to Farcaster
7. **Save State**: Stores multiple tracking keys (cast, parent, root hashes)

## Monitoring

View logs in Render dashboard:
- ⏰ Scheduled check starts
- 📬 Notifications found
- 🔍 Checking each cast
- ✓ Already replied (skipped)
- 💭 Generating reply
- ✅ Posted reply
- 💾 Saved to storage

## Troubleshooting

### Bot not replying

1. Check Render logs for errors
2. Verify environment variables are set
3. Test with manual trigger: `curl -X POST https://your-app.onrender.com/trigger-bot`

### Duplicate replies

- Should be fixed with persistent storage on Render
- Check logs to see if tracking keys are being saved
- Verify `replied_casts.json` exists and is growing

### Bot replies too slow

- Render free tier may have cold starts
- Upgrade to paid tier for always-on service
- Or reduce cron frequency to keep service warm

## Cost

**Render Free Tier:**
- ✅ Enough for this bot
- ⚠️ May sleep after 15 min of inactivity
- ⚠️ 750 hours/month free (enough for 24/7 with occasional restarts)

**Render Starter ($7/mo):**
- ✅ Always on (no sleeping)
- ✅ Better for production

## Development

```bash
# Install dependencies
npm install

# Run in development mode (auto-reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## File Structure

```
server/
├── src/
│   ├── index.ts       # Express server + cron scheduler
│   └── bot.ts         # Bot logic (mentions, replies)
├── package.json
├── tsconfig.json
├── .env
├── .gitignore
└── README.md
```
