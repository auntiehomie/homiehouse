import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { checkForMentions } from './bot';
import { CurationService, CurationPreference } from './curation';

dotenv.config();

// Generate unique instance ID to track multiple instances
const INSTANCE_ID = Math.random().toString(36).substring(2, 8).toUpperCase();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check endpoint with instance ID
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'homiehouse-bot', 
    instance: INSTANCE_ID,
    uptime: Math.floor((Date.now() - startupTime) / 1000),
    timestamp: new Date().toISOString() 
  });
});

// Manual trigger endpoint (for testing)
app.post('/trigger-bot', async (req, res) => {
  try {
    console.log(`[${INSTANCE_ID}] Manual bot trigger requested`);
    const result = await checkForMentions();
    res.json(result);
  } catch (error: any) {
    console.error(`[${INSTANCE_ID}] Manual trigger error:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Curation API endpoints
app.get('/api/curation', async (req, res) => {
  try {
    const fid = req.query.fid ? parseInt(req.query.fid as string) : null;
    const type = req.query.type as string;

    if (!fid) {
      return res.status(400).json({ ok: false, error: 'FID required' });
    }

    let preferences;
    if (type) {
      preferences = await CurationService.getPreferencesByType(fid, type);
    } else {
      preferences = await CurationService.getPreferences(fid);
    }

    res.json({ ok: true, preferences });
  } catch (error: any) {
    console.error('Error fetching curation preferences:', error);
    res.status(500).json({ ok: false, error: error?.message || 'Failed to fetch preferences' });
  }
});

app.post('/api/curation', async (req, res) => {
  try {
    const preference: CurationPreference = req.body;

    if (!preference.fid || !preference.preference_type || !preference.preference_value || !preference.action) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }

    const result = await CurationService.addPreference(preference);
    res.json(result);
  } catch (error: any) {
    console.error('Error adding curation preference:', error);
    res.status(500).json({ ok: false, error: error?.message || 'Failed to add preference' });
  }
});

app.put('/api/curation', async (req, res) => {
  try {
    const { id, ...updates } = req.body;

    if (!id) {
      return res.status(400).json({ ok: false, error: 'Preference ID required' });
    }

    const result = await CurationService.updatePreference(id, updates);
    res.json(result);
  } catch (error: any) {
    console.error('Error updating curation preference:', error);
    res.status(500).json({ ok: false, error: error?.message || 'Failed to update preference' });
  }
});

app.delete('/api/curation', async (req, res) => {
  try {
    const id = req.query.id ? parseInt(req.query.id as string) : null;

    if (!id) {
      return res.status(400).json({ ok: false, error: 'Preference ID required' });
    }

    const result = await CurationService.deletePreference(id);
    res.json(result);
  } catch (error: any) {
    console.error('Error deleting curation preference:', error);
    res.status(500).json({ ok: false, error: error?.message || 'Failed to delete preference' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`\n🏠 HomieHouse bot server starting`);
  console.log(`📋 Instance ID: ${INSTANCE_ID}`);
  console.log(`🚀 Port: ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🤖 Bot will check for mentions every 15 minutes\n`);
});

// Track startup time to avoid immediate checks after deploy
const startupTime = Date.now();
const STARTUP_GRACE_PERIOD = 3 * 60 * 1000; // 3 minutes

// Schedule bot to check for mentions every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  // Skip checks within 3 minutes of startup (prevents deploy-triggered replies)
  if (Date.now() - startupTime < STARTUP_GRACE_PERIOD) {
    console.log(`[${INSTANCE_ID}] ⏭️  Skipping check (within startup grace period)`);
    return;
  }
  
  console.log(`[${INSTANCE_ID}] ⏰ Scheduled bot check starting...`);
  try {
    const result = await checkForMentions();
    console.log(`[${INSTANCE_ID}] ✅ Bot check complete:`, result);
  } catch (error) {
    console.error(`[${INSTANCE_ID}] ❌ Scheduled bot check failed:`, error);
  }
});

// Run once on startup (but only if ENABLE_STARTUP_CHECK is true)
if (process.env.ENABLE_STARTUP_CHECK === 'true') {
  setTimeout(async () => {
    console.log(`[${INSTANCE_ID}] 🚀 Running initial bot check (ENABLE_STARTUP_CHECK=true)...`);
    try {
      await checkForMentions();
    } catch (error) {
      console.error(`[${INSTANCE_ID}] Initial check failed:`, error);
    }
  }, 10000); // Wait 10 seconds after startup
} else {
  console.log(`[${INSTANCE_ID}] ⏭️  Skipping startup check (set ENABLE_STARTUP_CHECK=true to enable)`);
  console.log(`[${INSTANCE_ID}] ⏰ Bot will wait for first scheduled check in 15 minutes`);
}
