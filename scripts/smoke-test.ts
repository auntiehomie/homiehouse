/**
 * smoke-test.ts — Basic E2E smoke test for homiehouse.
 *
 * Hits key API routes and asserts 200 responses.
 * Run with: npx tsx scripts/smoke-test.ts [BASE_URL]
 *
 * Defaults to https://homiehouse.vercel.app if no URL is provided.
 */

const BASE_URL = process.argv[2] ?? 'https://homiehouse.vercel.app';

interface SmokeResult {
  route: string;
  status: number | string;
  ok: boolean;
  durationMs: number;
}

async function hit(path: string): Promise<SmokeResult> {
  const url = `${BASE_URL}${path}`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'homiehouse-smoke-test/1.0' },
    });
    return {
      route: path,
      status: res.status,
      ok: res.status >= 200 && res.status < 400,
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    return {
      route: path,
      status: err instanceof Error ? err.message : String(err),
      ok: false,
      durationMs: Date.now() - start,
    };
  }
}

const ROUTES = ['/api/healthcheck', '/api/notifications', '/'];

async function main() {
  console.log(`\n🏠 Homiehouse smoke test — ${BASE_URL}\n`);
  const results = await Promise.all(ROUTES.map(hit));

  let allOk = true;
  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    console.log(`  ${icon} ${r.route.padEnd(25)} ${String(r.status).padEnd(6)} ${r.durationMs}ms`);
    if (!r.ok) allOk = false;
  }

  console.log();
  if (allOk) {
    console.log('All checks passed 🎉');
    process.exit(0);
  } else {
    console.error('One or more checks FAILED');
    process.exit(1);
  }
}

main();
