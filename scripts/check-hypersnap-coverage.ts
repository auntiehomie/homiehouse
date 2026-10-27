/**
 * Read-only Hypersnap coverage probe for Homiehouse.
 *
 * Usage:
 *   FID=3 CAST_HASH=0x... npx tsx scripts/check-hypersnap-coverage.ts
 *
 * Uses MY_HYPERSNAP_NODE_URL, HYPERSNAP_NODE_URL, or the legacy
 * SNAPCHAIN_NODE_URL (which Homiehouse uses for the operator's Hypersnap node).
 * No endpoint URLs, cast text, credentials, or reaction identities are printed.
 */
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

const fid = Number(process.env.FID || '3');
const castHash = process.env.CAST_HASH?.trim();
const baseUrl = (
  process.env.MY_HYPERSNAP_NODE_URL
  || process.env.HYPERSNAP_NODE_URL
  || process.env.SNAPCHAIN_NODE_URL
  || process.env.NEXT_PUBLIC_HYPERSNAP_URL
  || 'https://haatz.quilibrium.com'
).trim().replace(/\/$/, '');
const productionBase = (process.env.HOMIEHOUSE_PRODUCTION_URL || 'https://homiehouse.lol').replace(/\/$/, '');
const maxPages = Math.max(1, Math.min(Number(process.env.MAX_PAGES) || 10, 50));
const pageSize = 50;

if (!Number.isSafeInteger(fid) || fid <= 0) throw new Error('FID must be a positive integer');
if (!castHash) throw new Error('CAST_HASH is required so the probe can check cast reactions');

type JsonRecord = Record<string, unknown>;
type ProbeResponse = { status: number; data: unknown; keys: string[]; error?: string };

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? value as JsonRecord : {};
}

async function readJson(url: string): Promise<ProbeResponse> {
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(12_000) });
    const body = await response.json().catch(() => null);
    return {
      status: response.status,
      data: body,
      keys: body && typeof body === 'object' ? Object.keys(body) : [],
      ...(!response.ok ? { error: `HTTP ${response.status}` } : {}),
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : 'request error';
    return { status: 0, data: null, keys: [], error: name };
  }
}

function nextCursor(data: unknown): string | null {
  const body = record(data);
  const value = record(body.next).cursor ?? body.next_cursor ?? body.cursor;
  return value === undefined || value === null || value === '' ? null : String(value);
}

function rows(data: unknown, names: string[]): unknown[] {
  const body = record(data);
  for (const name of names) if (Array.isArray(body[name])) return body[name];
  if (Array.isArray(body.result)) return body.result;
  return [];
}

async function collect(endpoint: string, listNames: string[]): Promise<{
  firstStatus: number; pages: number; count: number; unique: number; duplicateCount: number;
  hasMore: boolean; cursors: string[]; oldestTimestamp: string | null; error?: string;
}> {
  const seen = new Set<string>();
  const cursors: string[] = [];
  let cursor: string | null = null;
  let count = 0;
  let oldestTimestamp: string | null = null;
  let firstStatus = 0;
  let pages = 0;
  let error: string | undefined;

  while (pages < maxPages) {
    const query = new URLSearchParams({ limit: String(pageSize) });
    if (endpoint.includes('user/following') || endpoint.includes('user/casts')) query.set('fid', String(fid));
    if (cursor) query.set('cursor', cursor);
    const response = await readJson(`${baseUrl}${endpoint}?${query}`);
    if (!pages) firstStatus = response.status;
    if (response.error) { error = response.error; break; }
    pages++;
    const items = rows(response.data, listNames);
    count += items.length;
    for (const item of items) {
      const row = record(item);
      const key = String(row.hash ?? row.fid ?? record(row.user).fid ?? row.id ?? '');
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      const timestamp = row.timestamp ?? row.created_at ?? row.createdAt;
      if (timestamp) {
        const normalized = String(timestamp);
        if (!oldestTimestamp || normalized < oldestTimestamp) oldestTimestamp = normalized;
      }
    }
    const next = nextCursor(response.data);
    if (!next || next === cursor) { cursor = null; break; }
    cursors.push(next);
    cursor = next;
  }

  return {
    firstStatus, pages, count, unique: seen.size, duplicateCount: count - seen.size,
    hasMore: Boolean(cursor && pages >= maxPages), cursors, oldestTimestamp, ...(error ? { error } : {}),
  };
}

async function main() {
  const following = await collect('/v2/farcaster/user/following', ['users', 'following', 'follows']);
  const casts = await collect('/v2/farcaster/feed/user/casts', ['casts']);

  const reactionQuery = new URLSearchParams({ hash: castHash!, limit: String(pageSize) });
  const reactions = await readJson(`${baseUrl}/v2/farcaster/reactions/cast?${reactionQuery}`);
  const reactionRows = rows(reactions.data, ['reactions', 'likes', 'result']);

  const trendingQuery = new URLSearchParams({ limit: String(pageSize), time_window: '7d' });
  const trending = await readJson(`${baseUrl}/v2/farcaster/feed/trending?${trendingQuery}`);
  const nodeTrending = rows(trending.data, ['casts']);

  const productionQuery = new URLSearchParams({ feed_type: 'community', fid: String(fid), limit: String(pageSize) });
  const production = await readJson(`${productionBase}/api/feed?${productionQuery}`);
  const productionCasts = rows(production.data, ['data']);
  const nodeHashes = new Set(nodeTrending.map((cast) => record(cast).hash).filter(Boolean));
  const productionHashes = new Set(productionCasts.map((cast) => record(cast).hash).filter(Boolean));
  const overlap = [...nodeHashes].filter((hash) => productionHashes.has(hash)).length;

  console.log(JSON.stringify({
    readOnly: true,
    node: process.env.MY_HYPERSNAP_NODE_URL || process.env.HYPERSNAP_NODE_URL || process.env.SNAPCHAIN_NODE_URL ? 'personal-configured-node' : 'public-fallback',
    fid,
    pageSize,
    maxPages,
    following,
    userCastHistory: casts,
    reactionsForKnownCast: {
      status: reactions.status,
      count: reactionRows.length,
      hasMore: Boolean(nextCursor(reactions.data)),
      keys: reactions.keys,
      ...(reactions.error ? { error: reactions.error } : {}),
    },
    trending: {
      status: trending.status,
      count: nodeTrending.length,
      hasMore: Boolean(nextCursor(trending.data)),
      keys: trending.keys,
      ...(trending.error ? { error: trending.error } : {}),
    },
    productionCommunityComparison: {
      status: production.status,
      count: productionCasts.length,
      hashOverlapWithNodeTrending: overlap,
      ...(production.error ? { error: production.error } : {}),
    },
    note: 'Coverage is limited to the node index and pages sampled here; an empty page or unsupported route does not prove network-wide absence.',
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Coverage probe failed');
  process.exitCode = 1;
});
