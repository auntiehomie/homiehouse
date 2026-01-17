import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { checkForMentions } from './bot';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'homiehouse-bot', timestamp: new Date().toISOString() });
});

// Manual trigger endpoint (for testing)
app.post('/trigger-bot', async (req, res) => {
  try {
    console.log('Manual bot trigger requested');
    const result = await checkForMentions();
    res.json(result);
  } catch (error: any) {
    console.error('Manual trigger error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🏠 HomieHouse bot server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🤖 Bot will check for mentions every 15 minutes`);
});

// Schedule bot to check for mentions every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  console.log('⏰ Scheduled bot check starting...');
  try {
    const result = await checkForMentions();
    console.log('✅ Bot check complete:', result);
  } catch (error) {
    console.error('❌ Scheduled bot check failed:', error);
  }
});

// Run once on startup (but only if ENABLE_STARTUP_CHECK is true)
if (process.env.ENABLE_STARTUP_CHECK === 'true') {
  setTimeout(async () => {
    console.log('🚀 Running initial bot check (ENABLE_STARTUP_CHECK=true)...');
    try {
      await checkForMentions();
    } catch (error) {
      console.error('Initial check failed:', error);
    }
  }, 10000); // Wait 10 seconds after startup
} else {
  console.log('⏭️  Skipping startup check (set ENABLE_STARTUP_CHECK=true to enable)');
  console.log('⏰ Bot will wait for first scheduled check in 15 minutes');
}
