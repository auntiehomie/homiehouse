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

// Run once on startup
setTimeout(async () => {
  console.log('🚀 Running initial bot check...');
  try {
    await checkForMentions();
  } catch (error) {
    console.error('Initial check failed:', error);
  }
}, 5000); // Wait 5 seconds after startup
