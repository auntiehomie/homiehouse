/**
 * KB-to-Curriculum Pipeline
 *
 * Reads repository-owned article summaries relevant to each learning track
 * and maps them to source-linked LearningModule objects.
 *
 * This allows learning plans to grow organically as Amanda's knowledge base grows,
 * without requiring manual edits to the hardcoded fallback modules.
 */

import knowledgeBase from '@/content/knowledge-base/articles.json';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KBArticle {
  id: string;
  title: string;
  url: string | null;
  source: string | null;
  tags: string[];
  summary: string | null;
  learning_points: string[] | null;
  author?: string;
  publisher?: string;
  publishedAt?: string;
  caveats?: string;
}

interface RepositoryKBArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  tags: string[];
  summary: string;
  learningPoints: string[];
  addedAt: string | null;
  author?: string;
  publisher?: string;
  publishedAt?: string;
  caveats?: string;
}

export interface LearningModule {
  id: string;
  title: string;
  sourceUrl?: string;
  sourceAuthor?: string;
  sourcePublisher?: string;
  sourcePublishedAt?: string;
  sourceCaveats?: string;
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
  creator: ['creator', 'nft', 'gaming', 'content', 'music', 'creator-economy', 'creator-coins', 'content-coins', 'zora', 'base-app'],
  decentralization: ['web3', 'blockchain', 'dao', 'governance', 'ethereum', 'social network', 'wallet', 'security', 'decentralization', 'privacy', 'network states', 'bitcoin', 'cryptography', 'hypersnap', 'decentralized-social', 'decentralized clients', 'rollup', 'zk-rollup', 'feeds'],
  all: ['ai', 'agents', 'creator', 'crypto', 'web3', 'dao', 'governance', 'ethereum', 'privacy', 'network states', 'bitcoin', 'cryptography', 'defi'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function articleToModule(article: KBArticle, level: string): LearningModule {
  const cleanObjectives = (article.learning_points || [])
    .filter((p) => p.trim().length > 0)
    .slice(0, 4)
    .map((p) => p.replace(/^\d+\.\s*/, '').trim());

  return {
    id: `kb-${article.id}-${slugify(article.title)}`,
    title: article.title,
    sourceUrl: article.url ?? undefined,
    sourceAuthor: article.author,
    sourcePublisher: article.publisher,
    sourcePublishedAt: article.publishedAt,
    sourceCaveats: article.caveats,
    description:
      (article.summary?.slice(0, 800) || `Learn about ${article.title}`) +
      (article.summary && article.summary.length > 800 ? '…' : ''),
    whyItMatters: article.learning_points?.[0]?.replace(/^\d+\.\s*/, '') || 'Expands your understanding of this topic.',
    objectives: cleanObjectives.length
      ? cleanObjectives
      : ['Understand key concepts from this article', 'Apply the lessons to real-world scenarios'],
    estimatedMinutes: 15 + (article.learning_points?.length || 3) * 5,
    difficulty: level === 'beginner' || level === 'advanced' ? level : 'intermediate',
    tags: article.tags.slice(0, 5),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Select relevant articles from the repository corpus and convert them to
 * source-backed modules. This works during plan generation even before the
 * hourly Neon cache sync has run or when the database is unavailable.
 */
export async function getKBModulesForTrack(
  track: string,
  level: string,
  limit = 6
): Promise<LearningModule[]> {
  const tags = TRACK_TAGS[track] ?? [];
  if (!tags.length) return [];

  const articles = knowledgeBase.articles as RepositoryKBArticle[];
  const matching = articles
    .filter((article) => Boolean(article.summary?.trim()) && article.learningPoints.length > 0)
    .map((article) => {
      const articleTags = article.tags.map((tag) => tag.toLowerCase());
      const score = tags.reduce((total, tag) => total + (articleTags.some((articleTag) => articleTag.includes(tag)) ? 1 : 0), 0);
      return { article, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || String(b.article.addedAt ?? '').localeCompare(String(a.article.addedAt ?? '')))
    .slice(0, limit);

  return matching.map(({ article }) => articleToModule({
    id: article.id,
    title: article.title,
    url: article.url,
    source: article.source,
    tags: article.tags,
    summary: article.summary,
    learning_points: article.learningPoints,
    author: article.author,
    publisher: article.publisher,
    publishedAt: article.publishedAt,
    caveats: article.caveats,
  }, level));
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
