/**
 * smoke-test.ts — Comprehensive E2E smoke test for homiehouse.
 *
 * Hits key API routes, important pages, and Frame endpoints.
 * Run with: npx tsx scripts/smoke-test.ts [BASE_URL] [--frame]
 *
 * Defaults to https://homiehouse.vercel.app if no URL is provided.
 * Pass --frame to also test Frame endpoints (requires POST with validation target).
 */

const BASE_URL = process.argv[2] ?? 'https://homiehouse.vercel.app';
const TEST_FRAMES = process.argv.includes('--frame');

interface SmokeResult {
  route: string;
  method: string;
  status: number | string;
  ok: boolean;
  durationMs: number;
  note?: string;
}

async function hit(
  path: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
): Promise<SmokeResult> {
  const url = `${BASE_URL}${path}`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'User-Agent': 'homiehouse-smoke-test/1.0',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      route: `${method} ${path}`,
      method,
      status: res.status,
      ok: res.status >= 200 && res.status < 500, // 4xx is fine for unauthenticated smoke tests
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    return {
      route: `${method} ${path}`,
      method,
      status: err instanceof Error ? err.message : String(err),
      ok: false,
      durationMs: Date.now() - start,
    };
  }
}

// ─── Route registry ──────────────────────────────────────────────────────────
// Grouped by category for readable output. Only routes that can be smoke-tested
// without authentication, cron secrets, or side effects are included.

interface RouteSpec {
  path: string;
  method?: 'GET' | 'POST';
  label: string;
  body?: unknown;
  skip?: string; // reason to skip
}

const CATEGORIES: { name: string; routes: RouteSpec[] }[] = [
  {
    name: 'Core & Health',
    routes: [
      { path: '/api/healthcheck', label: 'healthcheck' },
      { path: '/api/ping', label: 'ping' },
      { path: '/', label: 'home page' },
      { path: '/api/sw', label: 'service worker' },
    ],
  },
  {
    name: 'Public Read — Farcaster',
    routes: [
      { path: '/api/feed', label: 'feed' },
      { path: '/api/trending', label: 'trending' },
      { path: '/api/cast?hash=0x0000000', label: 'cast (invalid hash, expect not-found)', skip: 'needs real hash' },
      { path: '/api/channel/farcaster', label: 'channel', skip: 'needs known channel id' },
      { path: '/api/channels', label: 'channels list' },
      { path: '/api/casts/search?q=web3&limit=2', label: 'cast search' },
      { path: '/api/users/search?q=auntiehomie&limit=3', label: 'user search' },
      { path: '/api/search-users?q=auntiehomie&limit=3', label: 'search users (alt)' },
      { path: '/api/learner-count', label: 'learner count' },
      { path: '/api/notifications', label: 'notifications (unauthed)' },
      { path: '/api/friends?fid=1349780', label: 'friends' },
      { path: '/api/profile?user=auntiehomie', label: 'profile' },
      { path: '/api/follow-status?fid=1349780&targetFid=1349780', label: 'follow status' },
      { path: '/api/my-casts?fid=1349780', label: 'my casts' },
    ],
  },
  {
    name: 'Public Read — Tokens',
    routes: [
      { path: '/api/tokens/search?q=ethereum&limit=2', label: 'token search' },
      { path: '/api/tokens/prices?ids=ethereum', label: 'token prices' },
      { path: '/api/tokens/ethereum', label: 'token detail' },
      { path: '/api/trades?fid=1349780', label: 'trades' },
      { path: '/api/miniapp/stats', label: 'miniapp stats' },
      { path: '/api/mini-apps', label: 'mini apps list' },
    ],
  },
  {
    name: 'Public Read — Learning',
    routes: [
      { path: '/api/learning-progress?fid=1349780', label: 'learning progress' },
      { path: '/api/learning-progress/leaderboard', label: 'leaderboard' },
      { path: '/api/learning-progress/peers?fid=1349780', label: 'peers' },
    ],
  },
  {
    name: 'Public Read — Curated Lists',
    routes: [
      { path: '/api/curated-lists?public=true', label: 'public lists' },
      { path: '/api/curated-lists/followed?fid=1349780', label: 'followed lists' },
      { path: '/api/curated-lists/feed?fid=1349780', label: 'unified feed' },
    ],
  },
  {
    name: 'Write — Gated (expect 401/403/429)',
    routes: [
      { path: '/api/compose-cast', method: 'POST', label: 'compose cast', body: { text: 'test' } },
      { path: '/api/like', method: 'POST', label: 'like', body: { castHash: 'test' } },
      { path: '/api/recast', method: 'POST', label: 'recast', body: { castHash: 'test' } },
      { path: '/api/reply', method: 'POST', label: 'reply', body: { castHash: 'test', text: 'test' } },
      { path: '/api/submit-cast', method: 'POST', label: 'submit cast', body: { text: 'test' } },
      { path: '/api/curate-cast', method: 'POST', label: 'curate cast', body: { castHash: 'test', listName: 'test' } },
      { path: '/api/saved-casts', method: 'POST', label: 'save cast', body: { castHash: 'test' } },
    ],
  },
  {
    name: 'AI Routes — Gated (expect 401/403/429)',
    routes: [
      { path: '/api/lesson?topic=defi&level=beginner', label: 'lesson generation' },
      { path: '/api/learning-plan?goal=defi&level=beginner', label: 'learning plan' },
      { path: '/api/ask-homie', method: 'POST', label: 'ask homie', body: { question: 'what is defi' } },
      { path: '/api/summarize-url', method: 'POST', label: 'summarize url', body: { url: 'https://example.com' } },
      { path: '/api/url-preview?url=https://example.com', label: 'url preview' },
      { path: '/api/agent/x-explain', method: 'POST', label: 'x explain', body: { text: 'test' } },
    ],
  },
  {
    name: 'AI Routes — Cron (expect 401)',
    routes: [
      { path: '/api/llm-diag', label: 'LLM diagnostic' },
    ],
  },
  {
    name: 'Frame Endpoints',
    routes: [
      { path: '/api/frame', method: 'POST', label: 'frame root', body: { untrustedData: {} } },
      { path: '/api/frame/interact', method: 'POST', label: 'frame interact', body: { untrustedData: {} } },
    ],
  },
  {
    name: 'Page Routes',
    routes: [
      { path: '/feed', label: 'feed page' },
      { path: '/learn', label: 'learn page' },
      { path: '/trending', label: 'trending page' },
      { path: '/tokens', label: 'tokens page' },
      { path: '/search', label: 'search page' },
      { path: '/lists', label: 'lists page' },
      { path: '/lists/feed', label: 'lists feed page' },
      { path: '/kb', label: 'kb page' },
      { path: '/hh2', label: 'hh2 page' },
      { path: '/ask-homie', label: 'ask homie page' },
      { path: '/sitemap.xml', label: 'sitemap' },
      { path: '/robots.txt', label: 'robots.txt' },
    ],
  },
];

// ─── Run ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🏠 Homiehouse smoke test — ${BASE_URL}\n`);

  let totalOk = 0;
  let totalFail = 0;
  let totalSkip = 0;

  for (const cat of CATEGORIES) {
    console.log(`\n── ${cat.name} ──`);

    for (const spec of cat.routes) {
      if (spec.skip) {
        console.log(`  ⏭️  ${spec.path.padEnd(40)} (skipped: ${spec.skip})`);
        totalSkip++;
        continue;
      }

      const method = spec.method ?? 'GET';
      // Skip frame tests unless --frame flag is passed
      if (spec.label.startsWith('frame') && !TEST_FRAMES) {
        console.log(`  ⏭️  ${spec.path.padEnd(40)} (skipped: use --frame to test Frame endpoints)`);
        totalSkip++;
        continue;
      }

      const result = await hit(spec.path, method, spec.body);
      const icon = result.ok ? '✅' : '❌';
      const note = result.note ? ` (${result.note})` : '';

      console.log(
        `  ${icon} ${result.route.padEnd(40)} ${String(result.status).padEnd(10)} ${String(result.durationMs).padStart(4)}ms${note}`,
      );

      if (result.ok) totalOk++;
      else totalFail++;
    }
  }

  // Summary
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`  Total: ${totalOk + totalFail + totalSkip}  ✅ OK: ${totalOk}  ❌ Fail: ${totalFail}  ⏭️ Skip: ${totalSkip}`);
  console.log();

  if (totalFail > 0) {
    console.error(`${totalFail} check(s) FAILED`);
    process.exit(1);
  }

  console.log('All checks passed 🎉');
  process.exit(0);
}

main();