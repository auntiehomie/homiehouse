// Example server to verify Quick Auth JWT and return a simple session
// Usage: npm install express @farcaster/quick-auth body-parser
// Run: node examples/server.js

import express from 'express';
import bodyParser from 'body-parser';
import { createClient } from '@farcaster/quick-auth';

const client = createClient();
const app = express();
app.use(bodyParser.json());

app.post('/api/session', async (req, res) => {
  try {
    const token = req.body?.token || (req.headers.authorization || '').replace(/^Bearer\s+/, '');
    if (!token) return res.status(401).json({ error: 'missing token' });
    // verifyJwt returns payload with `sub` = fid
    const payload = await client.verifyJwt({ token, domain: 'your-domain.example' });
    // In production, create a session, set cookies, etc.
    return res.json({ fid: payload.sub });
  } catch (err) {
    console.error('verify failed', err);
    return res.status(401).json({ error: String(err) });
  }
});

app.listen(8787, () => {
  console.log('Example server listening on http://localhost:8787');
});
