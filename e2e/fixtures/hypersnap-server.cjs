// Metadata is rendered on the server, beyond Playwright's browser request mocks.
// Never use live Hypersnap nodes for navigation regression tests.
const http = require('node:http');
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:3001');
  const hash = url.searchParams.get('identifier') || '0x' + 'a'.repeat(40);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    cast: { hash, text: 'Navigation fixture', author: { fid: 321, username: 'navigationtest' }, timestamp: '2026-10-17T12:00:00Z', embeds: [], replies: { count: 0, casts: [] } },
    casts: [], users: [], notifications: [],
  }));
}).listen(3001, '127.0.0.1');
