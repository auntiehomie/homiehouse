/**
 * Dynamic Knowledge Base sync — fetches Amanda's KB index and article context
 * from Rufus-vault and caches them
 * in the Neon `kb_articles` table for the bot to query at runtime.
 *
 * The sync runs hourly via the /api/agent/kb-sync cron. At runtime the bot
 * calls `getRelevantKBArticles()` to pull context for replies and posts
 * without hitting GitHub on every mention.
 */

import { sql } from '@/lib/db';
import { indexKnowledgeBaseArticles } from '@/lib/agent-context';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KBArticle {
  id: number;
  title: string;
  url: string | null;
  source: string | null;
  tags: string[];
  summary: string | null;
  learning_points: string[] | null;
  synced_at: string;
}

// ─── DB schema ────────────────────────────────────────────────────────────────

const CREATE_TABLE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS kb_articles (
    id               SERIAL PRIMARY KEY,
    title            TEXT NOT NULL,
    url              TEXT,
    source           TEXT,
    tags             TEXT[] NOT NULL DEFAULT '{}',
    summary          TEXT,
    learning_points  TEXT[] NOT NULL DEFAULT '{}',
    title_lower      TEXT GENERATED ALWAYS AS (LOWER(title)) STORED,
    synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(title)
  )`,
  `CREATE INDEX IF NOT EXISTS kb_articles_tags ON kb_articles USING GIN (tags)`,
  `CREATE INDEX IF NOT EXISTS kb_articles_title_lower ON kb_articles (title_lower)`,
];

async function ensureTable(): Promise<void> {
  // unsafe() only creates an interpolation fragment; query() executes SQL.
  // Execute each DDL statement separately before touching the article table.
  for (const statement of CREATE_TABLE_STATEMENTS) {
    await sql.query(statement);
  }
}

// ─── GitHub fetch ────────────────────────────────────────────────────────────

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const RUFUS_VAULT_RAW =
  'https://raw.githubusercontent.com/auntiehomie/rufus-vault/master/projects/Knowledge%20Base.md';
const RUFUS_VAULT_CONTEXT_RAW =
  'https://raw.githubusercontent.com/auntiehomie/rufus-vault/master/projects/Knowledge%20Base%20Article%20Context.md';

async function fetchRaw(url: string): Promise<string> {
  const headers: Record<string, string> = { accept: 'text/plain' };
  if (GITHUB_TOKEN) headers.authorization = `Bearer ${GITHUB_TOKEN}`;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`GitHub raw fetch ${res.status}: ${url}`);
  return res.text();
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

interface ParsedEntry {
  title: string;
  url: string | null;
  source: string | null;
  tags: string[];
}

interface ParsedSummary {
  title: string;
  summary: string;
  learningPoints: string[];
  tags: string[];
}

/**
 * Parse the rufus-vault Knowledge Base.md entries table.
 * Table format:
 * | [Title](url) | source | date | tags |
 */
function parseEntriesTable(markdown: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const lines = markdown.split('\n');
  let inTable = false;

  for (const line of lines) {
    // Detect table rows (start with |)
    if (line.trim().startsWith('|') && line.includes('[') && line.includes('](')) {
      inTable = true;
      // Parse: | [Title](url) | source | date | tags |
      const cellMatch = line.match(/^\|\s*\[(.+?)\]\(([^)]+)\)\s*\|\s*([^|]*)\|?\s*([^|]*)\|?\s*([^|]*)\|?/);
      if (cellMatch) {
        const title = cellMatch[1].trim();
        const url = cellMatch[2].trim();
        const source = cellMatch[3].trim() || null;
        const tagsRaw = (cellMatch[5] || cellMatch[4] || '').trim();
        const tags = tagsRaw
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t && t !== '—' && t !== '-');
        entries.push({ title, url, source, tags });
      }
    } else if (inTable && !line.trim().startsWith('|')) {
      // Left the table
      break;
    }
  }

  return entries;
}

/**
 * Parse the article-context file stored alongside Rufus-vault's KB index.
 * Each article is numbered, with a title link, tags, a summary, and 3 learning points.
 */
function parseSummaries(markdown: string): Map<string, ParsedSummary> {
  const summaries = new Map<string, ParsedSummary>();

  // Split on the article delimiter (numbered entries)
  // Pattern: N. [Title](url) — tags
  const articleRegex = /(\d+)\.\s*\[([^\]]+)\]\([^)]+\)\s*—\s*([^\n]*)\n\n\*\*Summary:\*\*\s*([\s\S]*?)\n\n\*\*3 Things I Learned:\*\*\n([\s\S]*?)(?=\n\n\d+\.|\n\n$|$)/g;
  let match: RegExpExecArray | null;

  while ((match = articleRegex.exec(markdown)) !== null) {
    const title = match[2].trim();
    const tagsRaw = match[3].trim();
    const summary = match[4].trim();
    const learningRaw = match[5].trim();

    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t && t !== '—' && t !== '-');

    // Only explicit takeaway bullets are shareable article context. Summary
    // files may include a trailing personalized note or editorial annotation;
    // do not turn that prose into lesson objectives or public bot context.
    const learningPoints = learningRaw
      .split('\n')
      .map((line) => line.match(/^\s*-\s+(.+?)\s*$/)?.[1]?.trim() ?? '')
      .filter((line) => line.length > 0);

    summaries.set(title.toLowerCase(), { title, summary, learningPoints, tags });
  }

  return summaries;
}

// ─── Sync ────────────────────────────────────────────────────────────────────

export interface SyncResult {
  fetched: number;
  upserted: number;
  wouldUpsert?: number;
  errors: string[];
  usable?: number;
  semanticallyIndexed?: number;
}

/**
 * Fetch both sources from GitHub, merge, and upsert into the DB.
 */
export async function syncKnowledgeBase(options: { dryRun?: boolean; skipIndex?: boolean } = {}): Promise<SyncResult> {
  const errors: string[] = [];
  let entries: ParsedEntry[] = [];
  let summaries = new Map<string, ParsedSummary>();
  let contextLoaded = false;

  // Fetch independent sources concurrently to stay within the cron budget.
  await Promise.all([ (async () => {
  try {
    const entriesMd = await fetchRaw(RUFUS_VAULT_RAW);
    entries = parseEntriesTable(entriesMd);
    if (!entries.length) errors.push('entries: source parsed zero articles');
  } catch (err: any) {
    errors.push(`entries: ${err.message}`);
  }

  })(), (async () => {
  try {
    const summariesMd = await fetchRaw(RUFUS_VAULT_CONTEXT_RAW);
    summaries = parseSummaries(summariesMd);
    if (!summaries.size) {
      errors.push('article context: source parsed zero articles');
    } else {
      contextLoaded = true;
    }
  } catch (err: any) {
    errors.push(`article context: ${err.message}`);
  }
  })() ]);

  const fetched = entries.length + summaries.size;
  const wouldUpsert = entries.length;

  // Rufus-vault's index is the canonical allowlist. Without it, do not let a
  // context file alone populate the cache or trigger reconciliation.
  if (!entries.length) {
    return { fetched, upserted: 0, wouldUpsert: 0, errors };
  }

  // A dry run validates both sources and reports the number of rows that would
  // be written without creating tables, upserting rows, or indexing embeddings.
  if (options.dryRun) {
    return { fetched, upserted: 0, wouldUpsert, errors };
  }

  // The index supplies canonical titles, URLs and source tags; matching rows
  // in the Rufus-vault context file enrich those entries with article context.
  await ensureTable();

  let upserted = 0;

  // Upsert from entries table (enriched with summaries where available)
  for (const entry of entries) {
    const sm = summaries.get(entry.title.toLowerCase());
    const tags = entry.tags.length
      ? entry.tags
      : sm?.tags ?? [];
    const summary = sm?.summary ?? null;
    const learningPoints = sm?.learningPoints ?? [];

    try {
      await sql`
        INSERT INTO kb_articles (title, url, source, tags, summary, learning_points)
        VALUES (
          ${entry.title},
          ${entry.url},
          ${entry.source},
          ${tags},
          ${summary},
          ${learningPoints}
        )
        ON CONFLICT (title) DO UPDATE SET
          url = EXCLUDED.url,
          source = EXCLUDED.source,
          tags = EXCLUDED.tags,
          summary = CASE WHEN ${contextLoaded} THEN EXCLUDED.summary ELSE kb_articles.summary END,
          learning_points = CASE WHEN ${contextLoaded} THEN EXCLUDED.learning_points ELSE kb_articles.learning_points END,
          synced_at = NOW()
      `;
      upserted++;
    } catch (err: any) {
      errors.push(`upsert "${entry.title}": ${err.message}`);
    }
  }

  // Remove cached rows that are no longer present in the Rufus-vault index.
  // This also retires legacy summary-only rows from the former second source.
  try {
    const canonicalTitles = entries.map((entry) => entry.title.toLowerCase());
    await sql`
      DELETE FROM kb_articles
      WHERE NOT (LOWER(BTRIM(title)) = ANY(${canonicalTitles}::text[]))
    `;
  } catch (err: any) {
    errors.push(`reconcile canonical KB entries: ${err.message}`);
  }

  // Keep the semantic index aligned with KB summaries so the mention agent
  // can retrieve by meaning as well as the legacy keyword matcher.
  const [health] = await sql`
    SELECT COUNT(*)::int AS usable FROM kb_articles
    WHERE NULLIF(BTRIM(summary), '') IS NOT NULL
       OR COALESCE(array_length(learning_points, 1), 0) > 0
  `;
  const usable = Number(health?.usable || 0);
  if (!usable) errors.push('No content-bearing knowledge-base articles available');
  const semanticallyIndexed = options.skipIndex ? 0 : await indexKnowledgeBaseArticles();

  return { fetched, upserted, usable, semanticallyIndexed, errors };
}

// ─── Query ────────────────────────────────────────────────────────────────────

/**
 * Get all KB articles — used by autonomous posting modes (culture, deep-dive).
 */
export async function getAllKBArticles(limit = 50): Promise<KBArticle[]> {
  try {
    await ensureTable();
    const rows = await sql`
      SELECT * FROM kb_articles ORDER BY synced_at DESC LIMIT ${limit}
    `;
    return rows as unknown as KBArticle[];
  } catch (err) {
    console.warn('[kb-sync] getAllKBArticles failed:', (err as Error).message);
    return [];
  }
}

/**
 * Get KB articles whose tags or title overlap with the query text.
 * Used by the reply cron to inject relevant context when someone mentions @thehomie.
 *
 * Strategy: keyword extraction from the query, then match against tags + title.
 * Returns up to 3 articles with their summaries + learning points.
 */
export async function getRelevantKBArticles(query: string, limit = 3): Promise<KBArticle[]> {
  try {
    await ensureTable();

    // Extract meaningful keywords from the query
    const words = (query.toLowerCase().match(/[a-z0-9]+/g) || [])
      .filter((w) => w.length > 3)
      .filter((w) => !STOPWORDS.has(w));
    if (!words.length) return [];

    // Build a tag overlap query — match articles where any keyword is in tags
    // or where the title contains the keyword
    const tagPattern = words.map((w) => w.replace(/'/g, "''")).join('|');

    const rows = await sql`
      SELECT * FROM kb_articles
      WHERE
        array_to_string(tags, ' ') ~* ${tagPattern}
        OR title ~* ${tagPattern}
        OR summary ~* ${tagPattern}
      ORDER BY
        CASE
          WHEN title ~* ${tagPattern} THEN 0
          WHEN array_to_string(tags, ' ') ~* ${tagPattern} THEN 1
          ELSE 2
        END
      LIMIT ${limit}
    `;

    return rows as unknown as KBArticle[];
  } catch (err) {
    console.warn('[kb-sync] getRelevantKBArticles failed:', (err as Error).message);
    return [];
  }
}

/**
 * Pick a content-bearing KB article for autonomous posting that hasn't been
 * used recently. Title-only index rows are not enough to ground a post.
 */
export async function pickFreshKBArticle(recentTopics: string[] = []): Promise<KBArticle | null> {
  try {
    await ensureTable();
    const used = recentTopics.map((t) => t.toLowerCase().trim()).filter(Boolean);
    if (!used.length) {
      const rows = await sql`
        SELECT * FROM kb_articles
        WHERE NULLIF(BTRIM(summary), '') IS NOT NULL
           OR COALESCE(array_length(learning_points, 1), 0) > 0
        ORDER BY RANDOM() LIMIT 1
      `;
      return (rows as unknown as KBArticle[])[0] ?? null;
    }

    // Exact title matching also recognizes legacy topics truncated to 80 characters.
    // Try to find one not recently used
    const rows = await sql`
      SELECT * FROM kb_articles
      WHERE NOT (LOWER(BTRIM(title)) = ANY(${used}::text[])
        OR LOWER(BTRIM(LEFT(title, 80))) = ANY(${used}::text[]))
        AND (NULLIF(BTRIM(summary), '') IS NOT NULL OR COALESCE(array_length(learning_points, 1), 0) > 0)
      ORDER BY RANDOM() LIMIT 1
    `;
    const fresh = rows as unknown as KBArticle[];
    if (fresh.length) return fresh[0];

    // All content-bearing articles were used recently — fall back to any content-bearing article.
    const allRows = await sql`
      SELECT * FROM kb_articles
      WHERE NULLIF(BTRIM(summary), '') IS NOT NULL
         OR COALESCE(array_length(learning_points, 1), 0) > 0
      ORDER BY RANDOM() LIMIT 1
    `;
    return (allRows as unknown as KBArticle[])[0] ?? null;
  } catch (err) {
    console.warn('[kb-sync] pickFreshKBArticle failed:', (err as Error).message);
    return null;
  }
}

/**
 * Format KB articles as context for the LLM system prompt.
 */
export function formatKBContext(articles: KBArticle[]): string {
  if (!articles.length) return '';

  const parts = articles.map((a) => {
    const lines = [`## ${a.title}`];
    if (a.source) lines.push(`Source: ${a.source}`);
    if (a.url) lines.push(`Source URL: ${a.url}`);
    if (a.tags.length) lines.push(`Tags: ${a.tags.join(', ')}`);
    if (a.summary) lines.push(``, a.summary.slice(0, 800));
    if (a.learning_points?.length) {
      lines.push(``, 'Key points:');
      for (const lp of a.learning_points.slice(0, 3)) {
        lines.push(`- ${lp}`);
      }
    }
    return lines.join('\n');
  });

  return `\n\n---\n# Knowledge Base Context\nUse these articles as background knowledge for your response. Synthesize, don't just repeat them.\n\n${parts.join('\n\n---\n\n')}\n---\n`;
}

const STOPWORDS = new Set([
  'the', 'this', 'that', 'with', 'from', 'have', 'your', 'they', 'will',
  'what', 'when', 'where', 'which', 'there', 'their', 'would', 'could',
  'should', 'about', 'been', 'were', 'more', 'some', 'than', 'into',
  'only', 'also', 'just', 'like', 'even', 'know', 'think', 'make',
  'want', 'need', 'does', 'done', 'going', 'getting', 'really', 'much',
  'very', 'well', 'good', 'great', 'best', 'most', 'such', 'these',
  'those', 'here', 'then', 'them', 'over', 'under', 'after', 'before',
]);

/** Restore an empty cache once per posting run; never generate a title-only post. */
export async function pickKBArticleForPosting(recentTopics: string[] = []): Promise<KBArticle | null> {
  const cached = await pickFreshKBArticle(recentTopics);
  if (cached) return cached;
  console.warn('[kb-sync] Posting cache unavailable; attempting recovery sync');
  const result = await syncKnowledgeBase({ skipIndex: true });
  console.info(`[kb-sync] Recovery: upserted=${result.upserted} usable=${result.usable ?? 0} errors=${result.errors.length}`);
  const recovered = await pickFreshKBArticle(recentTopics);
  if (!recovered) throw new Error('Knowledge-base recovery failed; no grounded posting content available');
  return recovered;
}
