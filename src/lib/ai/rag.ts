/**
 * RAG (Retrieval-Augmented Generation) pipeline for Ask Homie.
 *
 * For a given user question:
 * 1. Detects relevant topics using keyword matching
 * 2. Pulls curated knowledge snippets from the local knowledge base
 * 3. Searches Hypersnap for recent community casts on the topic
 * 4. Returns a combined context string ready to be injected into the LLM prompt
 */

import { getRelevantKnowledge, KNOWLEDGE_TOPICS } from './knowledge';

const HYPERSNAP_BASE =
  process.env.NEXT_PUBLIC_HYPERSNAP_URL || 'https://haatz.quilibrium.com';

export interface RagContext {
  topics: string[];
  knowledge: string;
  liveCasts: string;
  /** Combined context ready to append to the system prompt */
  combined: string;
}

/** Search Hypersnap for recent casts matching a keyword query */
async function searchHypersnapCasts(
  query: string,
  limit = 5,
): Promise<Array<{ username: string; text: string }>> {
  try {
    const qs = new URLSearchParams({ q: query, limit: String(limit) });
    const res = await fetch(
      `${HYPERSNAP_BASE}/v2/farcaster/cast/search?${qs}`,
      { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const casts: any[] = data?.casts ?? data?.result?.casts ?? [];
    return casts
      .filter((c: any) => c.text?.trim())
      .slice(0, limit)
      .map((c: any) => ({
        username: c.author?.username || c.author?.fid || 'unknown',
        text: c.text.replace(/\n+/g, ' ').slice(0, 240),
      }));
  } catch {
    return [];
  }
}

/** Build the full RAG context for a user question */
export async function buildRagContext(question: string): Promise<RagContext> {
  const { topics, content: knowledge } = getRelevantKnowledge(question);

  let liveCasts = '';

  if (topics.length > 0) {
    // Pick the best search query from the first matched topic's keywords
    const primaryTopic = KNOWLEDGE_TOPICS.find(t => t.id === topics[0]);
    // Use the first keyword that appears in the question, or the first keyword overall
    const q = question.toLowerCase();
    const searchTerm =
      primaryTopic?.keywords.find(kw => q.includes(kw)) ||
      primaryTopic?.keywords[0] ||
      question.slice(0, 40);

    const casts = await searchHypersnapCasts(searchTerm, 12);

    if (casts.length > 0) {
      liveCasts =
        `## What the Farcaster community is saying about "${searchTerm}"\n` +
        casts.map(c => `- @${c.username}: "${c.text}"`).join('\n');
    }
  }

  const parts: string[] = [];
  if (knowledge) parts.push(`# Background Knowledge\n${knowledge}`);
  if (liveCasts) parts.push(liveCasts);

  const combined =
    parts.length > 0
      ? `\n\n---\n# Relevant Context for This Question\n${parts.join('\n\n')}\n---\n`
      : '';

  return { topics, knowledge, liveCasts, combined };
}
