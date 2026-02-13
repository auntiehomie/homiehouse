import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { checkForMentions } from './bot';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// SECURITY: Restrict CORS to app domain
const allowedOrigins = process.env.APP_URL
  ? [process.env.APP_URL]
  : ['https://homiehouse.lol', 'https://homiehouse.fun'];

if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:3000');
}

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'homiehouse-bot', timestamp: new Date().toISOString() });
});

// Manual trigger endpoint (for testing)
app.post('/trigger-bot', async (req, res) => {
  try {
    // SECURITY: Require API key authentication
    const apiKey = req.headers['x-api-key'];
    const expectedKey = process.env.BOT_API_KEY;

    if (!expectedKey) {
      console.error('BOT_API_KEY not configured');
      res.status(500).json({ error: 'Server misconfigured' });
      return;
    }

    if (!apiKey || apiKey !== expectedKey) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const backfill = req.query.backfill === 'true';
    const backfillAliases = req.query.aliasBackfill === 'true' || process.env.BOT_ALIAS_BACKFILL === 'true';
    const maxPages = parseInt(String(req.query.pages || '3'), 10);
    const maxReplies = parseInt(String(req.query.maxReplies || process.env.BOT_MAX_REPLIES_PER_RUN || '1'), 10);

    console.log('Manual bot trigger requested', { backfill, backfillAliases, maxPages, maxReplies });
    const result = await checkForMentions({ backfill, backfillAliases, maxPages, maxReplies });
    res.json(result);
  } catch (error: any) {
    console.error('Manual trigger error:', error);
    // SECURITY: Don't leak error details
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`HomieHouse bot server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Bot will check for mentions every 15 minutes`);

  try {
    const pkgPath = path.join(process.cwd(), 'node_modules', '@neynar', 'nodejs-sdk', 'package.json');
    const pkgRaw = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgRaw);
    console.log(`Neynar SDK version: ${pkg.version || 'unknown'}`);
  } catch (error) {
    console.log('Neynar SDK version: unknown (package.json not found)');
  }
});

// Schedule bot to check for mentions every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  console.log('Scheduled bot check starting...');
  try {
    const maxReplies = parseInt(process.env.BOT_MAX_REPLIES_PER_RUN || '1', 10);
    const result = await checkForMentions({ maxReplies });
    console.log('Bot check complete:', result);
  } catch (error) {
    console.error('Scheduled bot check failed:', error);
  }
});

// Run once on startup
setTimeout(async () => {
  console.log('Running initial bot check...');
  try {
    const backfill = process.env.BOT_BACKFILL_ON_START === 'true';
    const backfillAliases = process.env.BOT_ALIAS_BACKFILL === 'true';
    const maxPages = parseInt(process.env.BOT_BACKFILL_PAGES || '3', 10);
    const maxReplies = parseInt(process.env.BOT_MAX_REPLIES_PER_RUN || '1', 10);
    await checkForMentions({ backfill, backfillAliases, maxPages, maxReplies });
  } catch (error) {
    console.error('Initial check failed:', error);
  }
}, 5000); // Wait 5 seconds after startup
