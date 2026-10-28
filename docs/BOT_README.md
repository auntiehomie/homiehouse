# Homiehouse Farcaster Bot 🏠

An autonomous AI agent that monitors Farcaster and responds to mentions and replies using Claude.

## What It Does

- 🔔 Monitors @homiehouse for mentions and replies every 30 seconds
- 🧠 Reads conversation context to understand what's being discussed
- 💬 Generates thoughtful, natural replies using Claude
- 📝 Posts responses automatically to Farcaster threads
- 🎯 Tracks replied casts to avoid duplicate responses
- ⏱️ Rate-limits itself (2 seconds between replies)

## Personality

@homiehouse is:
- Friendly and knowledgeable about Farcaster
- Concise (under 280 chars when possible)
- Helpful without being spammy
- Understands Frames, Channels, SnapChain, Degen, Moxie, Higher
- Uses 🏠 as signature emoji

## Setup

### 1. Install Dependencies

```bash
cd bot
npm install
```

### 2. Configure Environment

Your `.env` is already set up with:
- `FARCASTER_API_KEY` - For Farcaster API
- `FARCASTER_SIGNER_UUID` - Your approved signer
- `ANTHROPIC_API_KEY` - For Claude AI
- `APP_FID` - Your Farcaster ID (1987078)
- `POLL_INTERVAL` - Check every 30 seconds (30000ms)
- `BOT_USERNAME` - homiehouse

### 3. Build

```bash
npm run build
```

### 4. Run

**Production:**
```bash
npm start
```

**Development (with rebuild):**
```bash
npm run dev
```

## How It Works

1. **Poll Notifications** - Every 30s, checks Farcaster API for mentions/replies
2. **Get Context** - Fetches conversation thread (parent cast + recent replies)
3. **Generate Reply** - Claude analyzes context and creates natural response
4. **Post Response** - Uses your signer to reply in the thread
5. **Track State** - Saves replied cast hashes to `replied_casts.json`

## Memory

The bot maintains `replied_casts.json` to:
- Avoid replying to the same cast twice
- Auto-cleanup old replies (keeps 7 days)
- Persist across restarts

## Rate Limiting

- ⏱️ 2 second delay between replies
- 🗑️ Only processes new notifications
- 🚫 Never replies to its own casts

## Running 24/7

### Option 1: PM2 (Recommended)

```bash
npm install -g pm2
pm2 start dist/index.js --name homiehouse-bot
pm2 save
pm2 startup
```

### Option 2: Windows Service

Use [node-windows](https://www.npmjs.com/package/node-windows) to install as a service.

### Option 3: Hosting

Deploy to:
- **Railway** - Zero-config Node.js hosting
- **Render** - Free tier with background workers
- **Fly.io** - Global edge deployment

## Monitoring

The bot logs:
```
🏠 Homiehouse Bot starting...
📬 Found 3 notifications
💬 New notification from @username:
   "Great post!"
   🤖 Generated reply: "Thanks! 🏠"
   ✅ Posted reply to 0x123...
```

## Customization

Edit [src/index.ts](src/index.ts) to:

**Change personality:**
```typescript
const BOT_PERSONALITY = `Your custom personality...`;
```

**Adjust poll interval:**
```env
POLL_INTERVAL=60000  # Check every minute
```

**Filter notifications:**
```typescript
// Only reply to mentions, not all replies
type: ['mention']
```

## Safety Features

- ✅ Deduplication (won't double-reply)
- ✅ Self-reply prevention
- ✅ Rate limiting
- ✅ Conversation context awareness
- ✅ Graceful error handling

## Example Interactions

**User:** "@homiehouse what's SnapChain?"
**Bot:** "SnapChain is a photo-sharing game on FC where you compete by snapping pics! 📸 Check /snapchain channel 🏠"

**User:** "@homiehouse thoughts on this frame?"
**Bot:** "Love the interactive design! Frames like this make FC way more engaging than just text 🏠"

## Stopping the Bot

**Standard:**
```bash
Ctrl+C
```

**PM2:**
```bash
pm2 stop homiehouse-bot
pm2 delete homiehouse-bot
```

## Logs

**Standard:**
- Output goes to console

**PM2:**
```bash
pm2 logs homiehouse-bot
pm2 logs homiehouse-bot --lines 100
```

---

Now @homiehouse will actively participate in Farcaster conversations! 🏠✨
