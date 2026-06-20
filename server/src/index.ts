import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';
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

    console.log('Manual bot trigger requested');
    const result = await checkForMentions();
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
});

// Schedule bot to check for mentions every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  console.log('Scheduled bot check starting...');
  try {
    const result = await checkForMentions();
    console.log('Bot check complete:', result);
  } catch (error) {
    console.error('Scheduled bot check failed:', error);
  }
});

// Run once on startup
setTimeout(async () => {
  console.log('Running initial bot check...');
  try {
    await checkForMentions();
  } catch (error) {
    console.error('Initial check failed:', error);
  }
}, 5000); // Wait 5 seconds after startup
