/**
 * Syncs the curated, repository-owned Homiehouse learning corpus into Neon.
 * The repository is the source of truth; Neon is a query/embedding cache.
 */

import { sql } from '@/lib/db';
import { indexKnowledgeBaseArticles } from '@/lib/agent-context';
import knowledgeBase from '@/content/knowledge-base/articles.json';

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

export interface CuratedKBArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  tags: string[];
  summary: string;
  learningPoints: string[];
  addedAt: string | null;
  reviewStatus: 'curated-summary';
}

export interface SyncResult {
  fetched: number;
  upserted: number;
  wouldUpsert?: number;
  errors: string[];
  usable?: number;
  semanticallyIndexed?: number;
}

// ─── Repository corpus sync ──────────────────────────────────────────────────

/**
 * The repository JSON is reviewed, topic-scoped content. Personal notes and
 * source documents from the broader Rufus Vault are deliberately excluded.
 */
export async function syncKnowledgeBase(options: { dryRun?: boolean; skipIndex?: boolean } = {}): Promise<SyncResult> {
  const errors: string[] = [];
  const entries = knowledgeBase.articles as CuratedKBArticle[];
  const validEntries = entries.filter((article) =>
    Boolean(article.id && article.title && article.url && article.source && article.summary) &&
    Array.isArray(article.tags) && article.tags.length > 0 &&
    Array.isArray(article.learningPoints) && article.learningPoints.length >= 2
  );
  if (validEntries.length !== entries.length) {
    return { fetched: entries.length, upserted: 0, wouldUpsert: 0, errors: ['Repository knowledge base contains an invalid article record'] };
  }

  const fetched = validEntries.length;
  const wouldUpsert = validEntries.length;
  if (!validEntries.length) {
    return { fetched, upserted: 0, wouldUpsert: 0, errors: [...errors, 'Repository knowledge base contains no usable articles'] };
  }
  if (options.dryRun) return { fetched, upserted: 0, wouldUpsert, errors };

  await ensureTable();
  let upserted = 0;
  for (const article of validEntries) {
    try {
      await sql`
        INSERT INTO kb_articles (title, url, source, tags, summary, learning_points)
        VALUES (${article.title}, ${article.url}, ${article.source}, ${article.tags}, ${article.summary}, ${article.learningPoints})
        ON CONFLICT (title) DO UPDATE SET
          url = EXCLUDED.url,
          source = EXCLUDED.source,
          tags = EXCLUDED.tags,
          summary = EXCLUDED.summary,
          learning_points = EXCLUDED.learning_points,
          synced_at = NOW()
      `;
      upserted++;
    } catch (err) {
      errors.push(`upsert "${article.title}": ${(err as Error).message}`);
    }
  }

  try {
    const canonicalTitles = validEntries.map((article) => article.title.toLowerCase());
    await sql`
      DELETE FROM kb_articles
      WHERE NOT (LOWER(BTRIM(title)) = ANY(${canonicalTitles}::text[]))
    `;
  } catch (err) {
    errors.push(`reconcile repository knowledge base: ${(err as Error).message}`);
  }

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
      .filter((w) => w.length > 3 || SHORT_TOPIC_WORDS.has(w))
      .filter((w) => !STOPWORDS.has(w));
    if (!words.length) return [];

    // Build a tag overlap query — match articles where any keyword is in tags
    // or where the title contains the keyword
    // Match short topic acronyms as whole words so AI does not match unrelated text.
    const tagPattern = [...new Set(words)]
      .map((word) => SHORT_TOPIC_WORDS.has(word) ? `\\m${word}\\M` : word)
      .join('|');

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

const SHORT_TOPIC_WORDS = new Set(['ai', 'dao', 'daos', 'zk', 'nft', 'nfts', 'defi', 'llm', 'llms']);

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
