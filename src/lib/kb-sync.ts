/**
 * Dynamic Knowledge Base sync — fetches Amanda's KB articles from GitHub
 * (rufus-vault entries table + homie-knowledge summaries) and caches them
 * in the Neon `kb_articles` table for the bot to query at runtime.
 *
 * The sync runs daily via the /api/agent/kb-sync cron. At runtime the bot
 * calls `getRelevantKBArticles()` to pull context for replies and posts
 * without hitting GitHub on every mention.
 */

import { sql } from '@/lib/db';

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

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS kb_articles (
    id               SERIAL PRIMARY KEY,
    title            TEXT NOT NULL,
    url              TEXT,
    source           TEXT,
    tags             TEXT[] NOT NULL DEFAULT '{}',
    summary          TEXT,
    learning_points  TEXT[] NOT NULL DEFAULT '{}',
    title_lower       TEXT GENERATED ALWAYS AS (LOWER(title)) STORED,
    synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(title)
  );
  CREATE INDEX IF NOT EXISTS kb_articles_tags ON kb_articles USING GIN (tags);
  CREATE INDEX IF NOT EXISTS kb_articles_title_lower ON kb_articles (title_lower);
`;

async function ensureTable(): Promise<void> {
  await sql.unsafe(CREATE_TABLE_SQL);
}

// ─── GitHub fetch ────────────────────────────────────────────────────────────

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const RUFUS_VAULT_RAW =
  'https://raw.githubusercontent.com/auntiehomie/rufus-vault/master/projects/Knowledge%20Base.md';
const HOMIE_KNOWLEDGE_SUMMARIES_RAW =
  'https://raw.githubusercontent.com/auntiehomie/homie-knowledge/master/organized/Knowledge%20Base/knowledge%20base%20summaries.md';

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
 * Parse the homie-knowledge summaries file.
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

    const learningPoints = learningRaw
      .split('\n')
      .map((l) => l.replace(/^-\s*/, '').trim())
      .filter((l) => l.length > 0);

    summaries.set(title.toLowerCase(), { title, summary, learningPoints, tags });
  }

  return summaries;
}

// ─── Sync ────────────────────────────────────────────────────────────────────

export interface SyncResult {
  fetched: number;
  upserted: number;
  errors: string[];
}

/**
 * Fetch both sources from GitHub, merge, and upsert into the DB.
 */
export async function syncKnowledgeBase(): Promise<SyncResult> {
  const errors: string[] = [];
  let entries: ParsedEntry[] = [];
  let summaries = new Map<string, ParsedSummary>();

  // Fetch entries table from rufus-vault
  try {
    const entriesMd = await fetchRaw(RUFUS_VAULT_RAW);
    entries = parseEntriesTable(entriesMd);
  } catch (err: any) {
    errors.push(`entries: ${err.message}`);
  }

  // Fetch summaries from homie-knowledge
  try {
    const summariesMd = await fetchRaw(HOMIE_KNOWLEDGE_SUMMARIES_RAW);
    summaries = parseSummaries(summariesMd);
  } catch (err: any) {
    errors.push(`summaries: ${err.message}`);
  }

  if (!entries.length && !summaries.size) {
    return { fetched: 0, upserted: 0, errors };
  }

  // Merge: entries table has the canonical titles + URLs + sources.
  // Summaries file has the rich summary + learning points.
  // Also include summaries that don't appear in the entries table.
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
          summary = EXCLUDED.summary,
          learning_points = EXCLUDED.learning_points,
          synced_at = NOW()
      `;
      upserted++;
    } catch (err: any) {
      errors.push(`upsert "${entry.title}": ${err.message}`);
    }
  }

  // Also upsert summaries that aren't in the entries table
  for (const [lowerTitle, sm] of summaries) {
    const existsInEntries = entries.some((e) => e.title.toLowerCase() === lowerTitle);
    if (existsInEntries) continue;

    try {
      await sql`
        INSERT INTO kb_articles (title, url, source, tags, summary, learning_points)
        VALUES (
          ${sm.title},
          NULL,
          NULL,
          ${sm.tags},
          ${sm.summary},
          ${sm.learningPoints}
        )
        ON CONFLICT (title) DO UPDATE SET
          tags = EXCLUDED.tags,
          summary = EXCLUDED.summary,
          learning_points = EXCLUDED.learning_points,
          synced_at = NOW()
      `;
      upserted++;
    } catch (err: any) {
      errors.push(`upsert summary "${sm.title}": ${err.message}`);
    }
  }

  return { fetched: entries.length + summaries.size, upserted, errors };
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
 * Pick a KB article for autonomous posting that hasn't been used recently.
 * Falls back to any article if all have been used.
 */
export async function pickFreshKBArticle(recentTopics: string[] = []): Promise<KBArticle | null> {
  try {
    await ensureTable();
    const used = recentTopics.map((t) => t.toLowerCase().trim()).filter(Boolean);
    if (!used.length) {
      const rows = await sql`SELECT * FROM kb_articles ORDER BY RANDOM() LIMIT 1`;
      return (rows as unknown as KBArticle[])[0] ?? null;
    }

    // Try to find one not recently used
    const usedPattern = used.map((u) => u.replace(/'/g, "''")).join('|');
    const rows = await sql`
      SELECT * FROM kb_articles
      WHERE title !~* ${usedPattern}
      ORDER BY RANDOM() LIMIT 1
    `;
    const fresh = rows as unknown as KBArticle[];
    if (fresh.length) return fresh[0];

    // All used recently — fall back to any
    const allRows = await sql`SELECT * FROM kb_articles ORDER BY RANDOM() LIMIT 1`;
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
