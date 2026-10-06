/**
 * KB-to-Curriculum Pipeline
 *
 * Queries the `kb_articles` table for articles relevant to each learning track
 * and maps them to LearningModule objects that can be merged into fallback plans.
 *
 * This allows learning plans to grow organically as Amanda's knowledge base grows,
 * without requiring manual edits to the hardcoded fallback modules.
 */

import { sql } from '@/lib/db';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KBArticle {
  id: number;
  title: string;
  url: string | null;
  source: string | null;
  tags: string[];
  summary: string | null;
  learning_points: string[] | null;
}

export interface LearningModule {
  id: string;
  title: string;
  description: string;
  whyItMatters: string;
  objectives: string[];
  estimatedMinutes: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
}

// ─── Tag-to-track mapping ────────────────────────────────────────────────────

const TRACK_TAGS: Record<string, string[]> = {
  ai: ['ai', 'llm', 'machine-learning', 'agents', 'prompt-injection', 'venice', 'openai', 'claude', 'gpt'],
  finance: ['defi', 'tokens', 'trading', 'crypto', 'finance', 'tokenomics', 'hyperliquid', 'portfolio'],
  creator: ['creator', 'nft', 'gaming', 'content', 'music', 'solidity', 'smart-contract', 'erc'],
  decentralization: ['web3', 'blockchain', 'dao', 'governance', 'ethereum', 'farcaster', 'wallet', 'security'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function inferDifficulty(_tags: string[], index: number): 'beginner' | 'intermediate' | 'advanced' {
  // Simple heuristic: first article is beginner-accessible, later ones get harder
  if (index < 2) return 'beginner';
  if (index < 5) return 'intermediate';
  return 'advanced';
}

function articleToModule(article: KBArticle, index: number): LearningModule {
  const cleanObjectives = (article.learning_points || [])
    .filter((p) => p.trim().length > 0)
    .slice(0, 4)
    .map((p) => p.replace(/^\d+\.\s*/, '').trim());

  return {
    id: `kb-${article.id}-${slugify(article.title)}`,
    title: article.title,
    description:
      (article.summary?.slice(0, 200) || `Learn about ${article.title}`) +
      (article.summary && article.summary.length > 200 ? '…' : ''),
    whyItMatters: article.learning_points?.[0]?.replace(/^\d+\.\s*/, '') || 'Expands your understanding of this topic.',
    objectives: cleanObjectives.length
      ? cleanObjectives
      : ['Understand key concepts from this article', 'Apply the lessons to real-world scenarios'],
    estimatedMinutes: 15 + (article.learning_points?.length || 3) * 5,
    difficulty: inferDifficulty(article.tags, index),
    tags: article.tags.slice(0, 5),
  };
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function ensureTable(): Promise<void> {
  try {
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS kb_articles (
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
      )
    `);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS kb_articles_tags ON kb_articles USING GIN (tags)`);
  } catch {
    // Table may already exist; ignore
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch KB articles relevant to a learning track and level, and convert them
 * to LearningModule objects. Returns an empty array gracefully if the DB is
 * unavailable or empty (e.g. in local dev without Neon).
 */
export async function getKBModulesForTrack(
  track: string,
  _level: string,
  limit = 6
): Promise<LearningModule[]> {
  const tags = TRACK_TAGS[track] ?? [];
  if (!tags.length) return [];

  try {
    await ensureTable();

    // Build a tag-pattern query that matches any of the track's tags
    const tagPattern = tags.map((t) => t.replace(/'/g, "''")).join('|');

    const rows = await sql`
      SELECT id, title, url, source, tags, summary, learning_points
      FROM kb_articles
      WHERE array_to_string(tags, ' ') ~* ${tagPattern}
      ORDER BY synced_at DESC
      LIMIT ${limit}
    `;

    const articles = rows as unknown as KBArticle[];
    return articles.map((a, i) => articleToModule(a, i));
  } catch (err) {
    console.warn('[kb-curriculum] getKBModulesForTrack failed:', (err as Error).message);
    return [];
  }
}

/**
 * Deduplicate modules by title similarity — removes KB modules whose titles
 * closely match existing hardcoded modules.
 */
export function deduplicateModules(
  existing: LearningModule[],
  kbModules: LearningModule[]
): LearningModule[] {
  const existingLower = new Set(
    existing.map((m) => slugify(m.title))
  );

  return kbModules.filter((m) => {
    const slug = slugify(m.title);
    // Check exact slug match and also partial overlaps
    for (const ex of existingLower) {
      if (slug === ex) return false;
      if (ex.length > 6 && slug.includes(ex)) return false;
      if (slug.length > 6 && ex.includes(slug)) return false;
    }
    return true;
  });
}