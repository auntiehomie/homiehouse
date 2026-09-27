/**
 * Persistent semantic context for @thehomie.
 *
 * Farcaster casts and synced knowledge base articles are embedded once and
 * stored in Neon with pgvector. Replies retrieve nearby material by meaning,
 * so the bot can connect a new mention to previous discussions and saved
 * research instead of relying on exact keyword overlap.
 */

import { createHash } from 'node:crypto';
import { sql } from '@/lib/db';

const EMBEDDING_DIMENSIONS = 768;
const EMBEDDING_MODEL = 'gemini-embedding-001';
const MAX_EMBED_TEXT = 6000;
const MAX_EMBED_DOCUMENTS_PER_SYNC = 50;
const MIN_SIMILARITY = 0.48;

export interface ContextDocument {
  key: string;
  type: 'cast' | 'knowledge';
  sourceId: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface RetrievedContextDocument extends ContextDocument {
  similarity: number;
}

export interface FarcasterCastInput {
  hash?: string;
  text?: unknown;
  author?: { fid?: number; username?: string };
  timestamp?: string | number;
  parent_hash?: string;
  parent_url?: string;
  channel?: { id?: string; name?: string };
}

let schemaPromise: Promise<void> | null = null;
const queryEmbeddingCache = new Map<string, { expiresAt: number; promise: Promise<number[] | null> }>();

async function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql.unsafe(`
        CREATE EXTENSION IF NOT EXISTS vector;
        CREATE TABLE IF NOT EXISTS agent_context_documents (
          document_key TEXT PRIMARY KEY,
          source_type TEXT NOT NULL CHECK (source_type IN ('cast', 'knowledge')),
          source_id TEXT NOT NULL,
          title TEXT NOT NULL DEFAULT '',
          content TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          embedding vector(${EMBEDDING_DIMENSIONS}) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS agent_context_documents_embedding_idx
          ON agent_context_documents USING hnsw (embedding vector_cosine_ops);
        CREATE INDEX IF NOT EXISTS agent_context_documents_type_updated_idx
          ON agent_context_documents (source_type, updated_at DESC);
      `);
    })().catch((error) => {
      // Cache only a successful schema setup. A transient DB/extension issue
      // must not permanently disable retrieval for a warm server instance.
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

function digest(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function embeddingRequest(text: string, taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT') {
  return {
    model: `models/${EMBEDDING_MODEL}`,
    content: { parts: [{ text: text.slice(0, MAX_EMBED_TEXT) }] },
    taskType,
    outputDimensionality: EMBEDDING_DIMENSIONS,
  };
}

async function embedBatch(
  texts: string[],
  taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT',
): Promise<number[][] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !texts.length) return null;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          requests: texts.map((text) => embeddingRequest(text, taskType)),
        }),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) {
      console.warn('[agent-context] embedding request failed:', response.status);
      return null;
    }

    const payload = await response.json();
    const vectors: number[][] = (payload.embeddings ?? []).map((item: any) => item.values);
    if (
      vectors.length !== texts.length ||
      vectors.some((vector) => !Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS)
    ) {
      console.warn('[agent-context] embedding response had an unexpected shape');
      return null;
    }
    return vectors;
  } catch (error) {
    console.warn('[agent-context] embedding request unavailable:', (error as Error).message);
    return null;
  }
}

async function embedQuery(text: string): Promise<number[] | null> {
  const key = text.toLowerCase();
  const cached = queryEmbeddingCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = embedBatch([text], 'RETRIEVAL_QUERY').then((vectors) => vectors?.[0] ?? null);
  queryEmbeddingCache.set(key, { expiresAt: Date.now() + 60_000, promise });
  if (queryEmbeddingCache.size > 100) {
    const oldestKey = queryEmbeddingCache.keys().next().value;
    if (oldestKey) queryEmbeddingCache.delete(oldestKey);
  }
  return promise;
}

function vectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`;
}

/** Store newly seen casts; refresh metadata when the same cast is seen again. */
export async function indexFarcasterCasts(
  casts: FarcasterCastInput[],
): Promise<number> {
  const docs = casts.flatMap((cast): ContextDocument[] => {
    const text = normalizeCastText(cast.text);
    if (!cast.hash || !text) return [];
    const username = cast.author?.username?.replace(/^@/, '').slice(0, 80) || 'unknown';
    const channel = cast.channel?.id || cast.channel?.name;
    return [{
      key: `cast:${cast.hash}`,
      type: 'cast',
      sourceId: cast.hash,
      title: `@${username}${channel ? ` in /${channel}` : ''}`,
      content: text,
      metadata: {
        username,
        fid: cast.author?.fid ?? null,
        timestamp: cast.timestamp ?? null,
        parentHash: cast.parent_hash ?? cast.parent_url ?? null,
        channel: channel ?? null,
      },
    }];
  });
  return indexDocuments(docs);
}

/** Save a successful mention/reply pair as an example for future similar casts. */
export async function rememberMentionInteraction(params: {
  cast: FarcasterCastInput;
  threadContext: string;
  reply: string;
}): Promise<void> {
  const castText = normalizeCastText(params.cast.text);
  if (!params.cast.hash || !castText) return;
  const username = params.cast.author?.username?.replace(/^@/, '').slice(0, 80) || 'unknown';
  const context = params.threadContext.slice(0, 1800);
  const content = [
    `Farcaster mention by @${username}: ${castText}`,
    context ? `Thread context: ${context}` : '',
    `@thehomie replied: ${params.reply.slice(0, 1200)}`,
  ].filter(Boolean).join('\n\n');

  await indexDocuments([{
    key: `cast:${params.cast.hash}`,
    type: 'cast',
    sourceId: params.cast.hash,
    title: `Past @thehomie interaction with @${username}`,
    content,
    metadata: {
      username,
      fid: params.cast.author?.fid ?? null,
      parentHash: params.cast.parent_hash ?? params.cast.parent_url ?? null,
      threadContext: context,
      botReply: params.reply.slice(0, 1200),
    },
  }]);
}

/** Index the current synced knowledge base, embedding only changed articles. */
export async function indexKnowledgeBaseArticles(): Promise<number> {
  try {
    await ensureSchema();
    const articles = await sql`
      SELECT id, title, url, source, tags, summary, learning_points
      FROM kb_articles
      WHERE COALESCE(summary, '') <> '' OR cardinality(learning_points) > 0
      ORDER BY synced_at DESC
      LIMIT 500
    `;
    const docs: ContextDocument[] = (articles as any[]).map((article) => {
      const points = Array.isArray(article.learning_points) ? article.learning_points : [];
      const tags = Array.isArray(article.tags) ? article.tags : [];
      return {
        key: `knowledge:${article.id}`,
        type: 'knowledge',
        sourceId: String(article.id),
        title: String(article.title ?? 'Knowledge base article'),
        content: [
          `Title: ${article.title ?? ''}`,
          `Tags: ${tags.join(', ')}`,
          `Summary: ${article.summary ?? ''}`,
          ...points.map((point: string) => `Learning point: ${point}`),
        ].join('\n'),
        metadata: {
          url: article.url ?? null,
          source: article.source ?? null,
          tags,
        },
      };
    });
    return indexDocuments(docs);
  } catch (error) {
    console.warn('[agent-context] KB indexing failed:', (error as Error).message);
    return 0;
  }
}

async function indexDocuments(docs: ContextDocument[]): Promise<number> {
  if (!docs.length) return 0;
  try {
    await ensureSchema();
    const hashes = docs.map((doc) => digest(doc.content));
    const existing = await sql`
      SELECT document_key, content_hash
      FROM agent_context_documents
      WHERE document_key = ANY(${docs.map((doc) => doc.key)}::text[])
    ` as any[];
    const existingHashes = new Map(existing.map((row) => [row.document_key, row.content_hash]));
    const changedDocs = docs.filter((doc, index) => existingHashes.get(doc.key) !== hashes[index]);
    // Gradually backfill larger knowledge bases over successive daily syncs,
    // while keeping each cron's embedding usage and runtime bounded.
    const toEmbed = changedDocs.slice(0, MAX_EMBED_DOCUMENTS_PER_SYNC);
    const vectors = await embedBatch(toEmbed.map((doc) => doc.content), 'RETRIEVAL_DOCUMENT');
    const vectorByKey = new Map<string, number[]>();
    if (vectors) toEmbed.forEach((doc, index) => vectorByKey.set(doc.key, vectors[index]));

    let indexed = 0;
    for (const doc of docs) {
      const vector = vectorByKey.get(doc.key);
      if (vector) {
        const contentHash = digest(doc.content);
        await sql`
          INSERT INTO agent_context_documents
            (document_key, source_type, source_id, title, content, content_hash, metadata, embedding, updated_at)
          VALUES (
            ${doc.key}, ${doc.type}, ${doc.sourceId}, ${doc.title}, ${doc.content}, ${contentHash},
            ${JSON.stringify(doc.metadata ?? {})}::jsonb, ${vectorLiteral(vector)}::vector, NOW()
          )
          ON CONFLICT (document_key) DO UPDATE SET
            source_type = EXCLUDED.source_type,
            source_id = EXCLUDED.source_id,
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            content_hash = EXCLUDED.content_hash,
            metadata = EXCLUDED.metadata,
            embedding = EXCLUDED.embedding,
            updated_at = NOW()
        `;
        indexed++;
      } else if (existingHashes.has(doc.key)) {
        // Keep fresh attribution/reply metadata without paying to re-embed an
        // unchanged cast or article.
        await sql`
          UPDATE agent_context_documents
          SET title = ${doc.title}, metadata = ${JSON.stringify(doc.metadata ?? {})}::jsonb,
              updated_at = NOW()
          WHERE document_key = ${doc.key}
        `;
      }
    }
    await sql`
      DELETE FROM agent_context_documents
      WHERE source_type = 'cast' AND created_at < NOW() - INTERVAL '180 days'
    `;
    return indexed;
  } catch (error) {
    console.warn('[agent-context] document indexing unavailable:', (error as Error).message);
    return 0;
  }
}

/** Retrieve semantically related past casts and knowledge articles. */
export async function searchContextDocuments(
  query: string,
  options: { limit?: number; type?: 'cast' | 'knowledge' } = {},
): Promise<RetrievedContextDocument[]> {
  const cleanQuery = normalizeCastText(query);
  if (!cleanQuery) return [];
  const embedding = await embedQuery(cleanQuery);
  if (!embedding) return [];

  try {
    await ensureSchema();
    const vector = vectorLiteral(embedding);
    const rows = options.type
      ? await sql`
          SELECT document_key, source_type, source_id, title, content, metadata,
                 1 - (embedding <=> ${vector}::vector) AS similarity
          FROM agent_context_documents
          WHERE source_type = ${options.type}
          ORDER BY embedding <=> ${vector}::vector
          LIMIT ${options.limit ?? 4}
        `
      : await sql`
          SELECT document_key, source_type, source_id, title, content, metadata,
                 1 - (embedding <=> ${vector}::vector) AS similarity
          FROM agent_context_documents
          ORDER BY embedding <=> ${vector}::vector
          LIMIT ${options.limit ?? 5}
        `;

    return (rows as any[])
      .map((row) => ({
        key: row.document_key,
        type: row.source_type,
        sourceId: row.source_id,
        title: row.title,
        content: row.content,
        metadata: row.metadata ?? {},
        similarity: Number(row.similarity),
      }))
      .filter((row) => Number.isFinite(row.similarity) && row.similarity >= MIN_SIMILARITY);
  } catch (error) {
    console.warn('[agent-context] semantic search unavailable:', (error as Error).message);
    return [];
  }
}

/**
 * Extract usable text from Hypersnap's normalized and legacy result shapes.
 * Reject placeholder strings so a bad payload never becomes an LLM prompt.
 */
export function normalizeCastText(value: unknown): string {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  const placeholder = text.toLowerCase().replace(/[.!?]+$/, '');
  if (['undefined', 'null', '[object object]'].includes(placeholder)) return '';
  if (!text || /^(undefined|null|\[object object\])$/i.test(text)) return '';
  return text.slice(0, 6000);
}

export function extractCastText(cast: any): string {
  const candidates = [
    cast?.text,
    cast?.cast_text,
    cast?.cast_info?.text,
    cast?.castInfo?.text,
    cast?.cast?.text,
  ];
  for (const candidate of candidates) {
    const text = normalizeCastText(candidate);
    if (text) return text;
  }
  return '';
}

export function extractMentionContent(cast: any): string {
  return extractCastText(cast)
    .replace(/@(?:thehomie|homiehouselol)\b/gi, '')
    .trim()
    .replace(/^(?:undefined|null)[.!?]*$/i, '');
}

export function shouldSearchWeb(text: string): boolean {
  const clean = normalizeCastText(text);
  if (!clean) return false;
  return clean.includes('?') ||
    clean.length >= 100 ||
    /\b(what|why|how|who|when|where|explain|meaning|recent|latest|update|news|thoughts|context)\b/i.test(clean);
}

export function formatRetrievedContext(docs: RetrievedContextDocument[]): string {
  if (!docs.length) return '';
  return docs.map((doc) => {
    const type = doc.type === 'knowledge' ? 'Knowledge base' : 'Similar prior cast';
    const metadata = doc.metadata ?? {};
    const attribution = typeof metadata.username === 'string' ? ` by @${metadata.username}` : '';
    const url = typeof metadata.url === 'string' ? ` (${metadata.url})` : '';
    const reply = typeof metadata.botReply === 'string' ? `\nPrior @thehomie reply: ${metadata.botReply}` : '';
    return `[${type}; relevance ${doc.similarity.toFixed(2)}] ${doc.title}${attribution}${url}\n${doc.content.slice(0, 700)}${reply}`;
  }).join('\n\n');
}
