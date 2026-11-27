/**
 * Bounded, read-only Hypersnap snapshot for the Community ranking experiment.
 * This is a manual poll/replay tool, not a production feed dependency.
 */
type User = { fid?: number };
type Reaction = { cast?: { author?: User } };
type Cast = {
  hash?: string;
  author?: User & { username?: string };
  text?: string;
  timestamp?: string | number;
  reactions?: { likes_count?: number; recasts_count?: number };
  replies?: { count?: number };
};
type Edge = {
  from: number;
  to: number;
  weight: number;
  kind: "follow" | "like" | "recast";
};

const base = (
  process.env.MY_HYPERSNAP_NODE_URL ||
  process.env.HYPERSNAP_NODE_URL ||
  process.env.NEXT_PUBLIC_HYPERSNAP_URL ||
  process.env.HYPERSNAP_FALLBACK_URL ||
  "https://haatz.quilibrium.com"
).replace(/\/$/u, "");
const viewerFid = Number(process.env.COMMUNITY_EXPERIMENT_FID);
const FEED_LIMIT = 50;
const SPAM_AUDIT_PAGES = 2;
const SPAM_THRESHOLD = 0.95;
const SPAM_RANK_PENALTY = 10;
const spamAuditEnabled = process.env.COMMUNITY_EXPERIMENT_SPAM_AUDIT === "1";
const reviewPath = process.env.COMMUNITY_EXPERIMENT_SPAM_REVIEW_OUTPUT;
const outputPath = process.env.COMMUNITY_EXPERIMENT_OUTPUT;

function castHash(hash?: string): string | null {
  return hash && /^0x[0-9a-f]{40}$/iu.test(hash) ? hash.toLowerCase() : null;
}

async function fetchSpamScores(
  hashes: string[],
): Promise<Record<string, unknown>> {
  if (!hashes.length) return {};
  const url = new URL("https://spam.quilcast.com/scores");
  url.searchParams.set("h", hashes.join(","));
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(5_000),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`Quilcast returned HTTP ${response.status}`);
  const scores: unknown = await response.json();
  if (!scores || typeof scores !== "object" || Array.isArray(scores))
    throw new Error("Quilcast returned an invalid score map");
  return scores as Record<string, unknown>;
}

async function auditSpam(rows: { hash: string | null; nodeOrder: number }[]) {
  const hashes = [...new Set(rows.flatMap(({ hash }) => (hash ? [hash] : [])))];
  let scores: Record<string, unknown> = {};
  let lookupError: string | null = null;
  try {
    scores = await fetchSpamScores(hashes);
  } catch (error) {
    lookupError = error instanceof Error ? error.message : "Quilcast lookup failed";
  }

  const coverage = { scored: 0, unscored: 0, lookupFailed: 0, invalidHash: 0 };
  const casts = rows.map(({ hash, nodeOrder }) => {
    const value = hash ? scores[hash] : undefined;
    const spamScore =
      typeof value === "number" && value >= 0 && value <= 1 ? value : null;
    const status = !hash
      ? "invalidHash"
      : value === null
        ? "unscored"
        : spamScore === null
          ? "lookupFailed"
          : "scored";
    coverage[status]++;
    const penalty =
      spamScore !== null && spamScore >= SPAM_THRESHOLD ? SPAM_RANK_PENALTY : 0;
    return { hash, nodeOrder, spamScore, status, penalty };
  });
  const simulatedOrder = casts.slice().sort(
    (a, b) =>
      a.nodeOrder + a.penalty - (b.nodeOrder + b.penalty) ||
      a.penalty - b.penalty ||
      a.nodeOrder - b.nodeOrder,
  );
  return {
    coverage,
    lookupError,
    threshold: SPAM_THRESHOLD,
    rankPenalty: SPAM_RANK_PENALTY,
    casts: simulatedOrder.map((cast, index) => ({
      ...cast,
      simulatedRank: index + 1,
      rankChange: index + 1 - cast.nodeOrder,
    })),
  };
}

const FOLLOW_LIMIT = 100;
const ACTOR_SAMPLE = 20;
const REACTION_LIMIT = 25;
const CONCURRENCY = 4;

function assertFid(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${name} must be a positive FID`);
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${base}/v2/farcaster/${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok)
    throw new Error(`Hypersnap returned ${response.status} for ${path}`);
  return response.json() as Promise<T>;
}

async function pages<T>(
  path: string,
  key: string,
  limit: number,
  maxPages: number,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(`${base}/v2/farcaster/${path}`);
    url.searchParams.set("limit", String(limit));
    if (cursor) url.searchParams.set("cursor", cursor);
    const result = await get<Record<string, unknown>>(
      `${url.pathname.replace("/v2/farcaster/", "")}${url.search}`,
    );
    const batch = Array.isArray(result[key]) ? (result[key] as T[]) : [];
    items.push(...batch.slice(0, limit));
    const next = result.next as { cursor?: unknown } | undefined;
    cursor =
      typeof next?.cursor === "string" && next.cursor ? next.cursor : undefined;
    if (!cursor || !batch.length) break;
  }
  return items;
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        output[index] = await fn(items[index]);
      }
    }),
  );
  return output;
}

/** Personalized PageRank-style propagation over the bounded sampled graph. */
function propagateTrust(
  edges: Edge[],
  seeds: number[],
  candidates: number[],
  rounds = 12,
  restart = 0.2,
) {
  const seedSet = [...new Set(seeds)].filter(
    (fid) => Number.isSafeInteger(fid) && fid > 0,
  );
  const nodes = new Set<number>([...candidates, ...seedSet]);
  for (const edge of edges) {
    nodes.add(edge.from);
    nodes.add(edge.to);
  }
  const observed = new Set<number>(seedSet);
  for (const edge of edges) {
    observed.add(edge.from);
    observed.add(edge.to);
  }
  const outgoing = new Map<number, Edge[]>();
  for (const edge of edges) {
    if (edge.from === edge.to || !(edge.weight > 0)) continue;
    const list = outgoing.get(edge.from) || [];
    list.push(edge);
    outgoing.set(edge.from, list);
  }
  const normalized = new Map<number, Array<{ to: number; weight: number }>>();
  for (const [from, list] of outgoing) {
    const total = list.reduce((sum, edge) => sum + edge.weight, 0);
    if (total)
      normalized.set(
        from,
        list.map((edge) => ({ to: edge.to, weight: edge.weight / total })),
      );
  }
  const seedWeight = seedSet.length ? 1 / seedSet.length : 0;
  let scores = new Map(
    [...nodes].map((fid) => [fid, seedSet.includes(fid) ? seedWeight : 0]),
  );
  for (let round = 0; round < rounds; round += 1) {
    const next = new Map(
      [...nodes].map((fid) => [
        fid,
        seedSet.includes(fid) ? restart * seedWeight : 0,
      ]),
    );
    for (const [from, targets] of normalized) {
      const sourceScore = scores.get(from) || 0;
      if (!sourceScore) continue;
      for (const { to, weight } of targets)
        next.set(
          to,
          (next.get(to) || 0) + (1 - restart) * sourceScore * weight,
        );
    }
    scores = next;
  }
  const coverage = candidates.length
    ? candidates.filter((fid) => observed.has(fid)).length / candidates.length
    : 0;
  const max = Math.max(0, ...candidates.map((fid) => scores.get(fid) || 0));
  return {
    scores,
    coverage,
    // Relative within this sampled snapshot only; not a network-wide reputation score.
    relative: new Map(
      candidates.map((fid) => [
        fid,
        !observed.has(fid) ? null : max ? (scores.get(fid) || 0) / max : 0,
      ]),
    ),
  };
}

async function main() {
  assertFid(viewerFid, "COMMUNITY_EXPERIMENT_FID");
  if (reviewPath && (!spamAuditEnabled || !outputPath || reviewPath === outputPath))
    throw new Error("Blind review requires the spam audit and distinct review and report output paths");
  const feedPages = spamAuditEnabled ? SPAM_AUDIT_PAGES : 1;
  const [feed, follows] = await Promise.all([
    pages<Cast>("feed/trending", "casts", FEED_LIMIT, feedPages),
    pages<User>(
      `user/following?fid=${viewerFid}`,
      "users",
      50,
      Math.ceil(FOLLOW_LIMIT / 50),
    ),
  ]);
  const eligible = feed.filter(
    (cast) =>
      Number.isSafeInteger(cast.author?.fid) && (cast.author?.fid || 0) > 0,
  );
  const seenHashes = new Set<string>();
  const candidates = spamAuditEnabled
    ? eligible.filter((cast) => {
        const hash = castHash(cast.hash);
        if (!hash) return true;
        if (seenHashes.has(hash)) return false;
        seenHashes.add(hash);
        return true;
      })
    : eligible;
  const followed = follows
    .map((user) => user.fid)
    .filter(
      (fid): fid is number => Number.isSafeInteger(fid) && (fid || 0) > 0,
    );
  const edges: Edge[] = followed.map((fid) => ({
    from: viewerFid,
    to: fid,
    weight: 1,
    kind: "follow",
  }));
  const actors = [...new Set(followed)].slice(0, ACTOR_SAMPLE);

  const interactionEdges = await mapLimit(
    actors,
    CONCURRENCY,
    async (actor) => {
      const [likes, recasts] = await Promise.all([
        pages<Reaction>(
          `reaction/user?fid=${actor}&type=likes`,
          "reactions",
          REACTION_LIMIT,
          1,
        ),
        pages<Reaction>(
          `reaction/user?fid=${actor}&type=recasts`,
          "reactions",
          REACTION_LIMIT,
          1,
        ),
      ]);
      const actorEdges: Edge[] = [];
      const seenEdges = new Set<string>();
      for (const reaction of likes) {
        const target = Number(reaction.cast?.author?.fid);
        const key = `${target}:like`;
        if (
          Number.isSafeInteger(target) &&
          target > 0 &&
          target !== actor &&
          !seenEdges.has(key)
        ) {
          seenEdges.add(key);
          actorEdges.push({ from: actor, to: target, weight: 1, kind: "like" });
        }
      }
      for (const reaction of recasts) {
        const target = Number(reaction.cast?.author?.fid);
        const key = `${target}:recast`;
        if (
          Number.isSafeInteger(target) &&
          target > 0 &&
          target !== actor &&
          !seenEdges.has(key)
        ) {
          seenEdges.add(key);
          actorEdges.push({
            from: actor,
            to: target,
            weight: 2,
            kind: "recast",
          });
        }
      }
      return actorEdges;
    },
  );
  edges.push(...interactionEdges.flat());

  const candidateFids = [
    ...new Set(candidates.map((cast) => cast.author!.fid!)),
  ];
  const trust = propagateTrust(edges, followed, candidateFids);
  const rows = candidates.map((cast, index) => {
    const fid = cast.author!.fid!;
    const activity =
      Math.max(0, cast.reactions?.likes_count || 0) +
      2 * Math.max(0, cast.reactions?.recasts_count || 0) +
      2 * Math.max(0, cast.replies?.count || 0);
    return {
      nodeOrder: index + 1,
      hash: spamAuditEnabled ? castHash(cast.hash) : cast.hash || null,
      authorFid: fid,
      author: cast.author?.username || null,
      authorTrust:
        trust.relative.get(fid) === null
          ? null
          : Number((trust.relative.get(fid) || 0).toFixed(5)),
      castEngagement: activity,
      castQualityReview: null,
    };
  });
  const scoredRows = rows
    .filter((row) => row.authorTrust !== null)
    .sort(
      (a, b) => b.authorTrust! - a.authorTrust! || a.nodeOrder - b.nodeOrder,
    );
  let nextScored = 0;
  const trustOrder = rows.map((row) =>
    row.authorTrust === null ? row : scoredRows[nextScored++],
  );
  const engagementOrder = rows
    .slice()
    .sort(
      (a, b) =>
        b.castEngagement - a.castEngagement || a.nodeOrder - b.nodeOrder,
    );
  const result = {
    experiment: "hypersnap-ego-trust-v0",
    capturedAt: new Date().toISOString(),
    source: base,
    viewerFid,
    limits: {
      feedCandidates: FEED_LIMIT * feedPages,
      followsFetched: follows.length,
      followedActorsSampled: actors.length,
      reactionsPerActorAndType: REACTION_LIMIT,
    },
    graph: {
      distinctEdges: edges.length,
      trustPropagationCoverage: Number(trust.coverage.toFixed(3)),
      seeds: followed.length,
    },
    interpretation:
      "Experimental author-network signal only. It does not assess cast quality, authenticity, accuracy, or full-network reputation. Missing graph coverage is not a negative score.",
    nodeOrder: rows,
    authorTrustOrder: trustOrder,
    castEngagementOrder: engagementOrder,
    ...(spamAuditEnabled ? { spamAudit: await auditSpam(rows) } : {}),
  };
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (outputPath) {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(outputPath, json, { encoding: "utf8", flag: "wx" });
    if (reviewPath) {
      const review = {
        capturedAt: result.capturedAt,
        casts: rows.map(({ hash, authorFid, authorTrust }) => ({
          hash,
          authorFid,
          authorTrust,
          spamLabel: null,
        })),
      };
      await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, {
        encoding: "utf8",
        flag: "wx",
      });
      console.log(`Wrote blind review to ${reviewPath}`);
    }
    console.log(`Wrote snapshot to ${outputPath}`);
  } else {
    console.log(json);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
