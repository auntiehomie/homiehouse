import { getCastsByUsername, searchCasts } from '../hypersnap';

const QUESTION_NOISE = new Set([
  'about', 'after', 'again', 'also', 'been', 'being', 'could', 'did', 'does', 'from',
  'have', 'help', 'homie', 'how', 'into', 'just', 'know', 'like', 'look', 'looking',
  'more', 'most', 'much', 'need', 'people', 'please', 'really', 'recent', 'right',
  'should', 'some', 'that', 'them', 'there', 'these', 'they', 'thing', 'this', 'those',
  'through', 'today', 'was', 'were', 'what', 'when', 'where', 'which', 'while', 'with',
  'would', 'your', 'you', 'farcaster', 'casts', 'cast', 'posts', 'post', 'discussion',
  'discussions', 'trending', 'developments', 'news', 'latest', 'current', 'happening',
  'hear', 'heard', 'read', 'seeing', 'seen', 'know', 'ask', 'homiehouse', 'credible',
  'evidence', 'research', 'transparent', 'find', 'search', 'verify', 'verified', 'any',
  'can', 'able', 'has', 'its', 'their', 'they', 'the', 'and', 'for', 'but', 'not', 'are',
  'was', 'were', 'who', 'why', 'now', 'then', 'than', 'such', 'like', 'use', 'using',
  'based', 'looks', 'seems', 'hasn', 'haven', 'isn', 'doesn', 'didn', 'won', 'shouldn',
]);

const LIVE_RESEARCH_CUES = /\b(cast|casts|post|posts|farcaster|hypersnap|trending|recent|latest|current|news|discussion|discussions|rumou?rs?|acquisition|acquired|sale|sold|bought|verify|verified|heard|happening|updates?)\b/i;

export interface LiveCastResearch {
  queries: string[];
  casts: Array<{
    hash?: string;
    text: string;
    username: string;
    fid?: number;
    timestamp?: string | number;
    likes?: number;
    recasts?: number;
    replies?: number;
  }>;
}

/** Decide whether an automatically-routed Ask Homie turn needs live social evidence. */
export function shouldSearchLiveCasts(question: string, intent?: string): boolean {
  if (intent === 'research') return true;
  if (intent && intent !== 'auto') return false;

  const hasFarcasterContext = /\b(farcaster|hypersnap|cast|casts|post|posts)\b/i.test(question);
  return hasFarcasterContext && LIVE_RESEARCH_CUES.test(question);
}

/** Current-event claims should fail closed when no live cast evidence is available. */
export function requiresLiveCastEvidence(question: string): boolean {
  return /\b(recent|latest|current|trending|news|discussion|rumou?rs?|acquisition|acquired|sale|sold|bought|happening|updates?|verify|verified)\b/i.test(question);
}

/** Turn a natural-language question into a small set of specific Hypersnap queries. */
export function buildCastSearchQueries(question: string): string[] {
  const normalized = question.replace(/NetworkSchool/gi, 'Network School');
  const terms = (normalized.toLowerCase().match(/[a-z0-9][a-z0-9._-]*/g) ?? [])
    .map((term) => term.replace(/[._-]+$/g, ''))
    .filter((term) => term.length > 2 && !QUESTION_NOISE.has(term));
  const uniqueTerms = [...new Set(terms)];
  const queries: string[] = [];

  if (uniqueTerms.length > 0) queries.push(uniqueTerms.slice(0, 7).join(' '));
  if (/network\s+school/i.test(normalized)) queries.push('Farcaster Network School');
  if (/\b(sale|sold|bought|acqui(?:re|red|sition))\b/i.test(normalized) && /\bfarcaster\b/i.test(normalized)) {
    queries.push('Farcaster acquisition');
  }

  if (queries.length === 0 && /\b(farcaster|hypersnap|cast|casts|post|posts)\b/i.test(normalized)) {
    queries.push('Farcaster casts');
  }

  return [...new Set(queries.map((query) => query.trim()).filter(Boolean))].slice(0, 3);
}

/** Retrieve live cast evidence before generation; never treat an empty search as proof of absence. */
export async function searchRelevantCasts(question: string): Promise<LiveCastResearch> {
  const queries = buildCastSearchQueries(question);
  if (queries.length === 0) return { queries, casts: [] };

  const [results, userCasts] = await Promise.all([
    Promise.all(queries.map(async (query) => {
      try {
        const response = await searchCasts(query, 5);
        return Array.isArray(response?.casts) ? response.casts : [];
      } catch (error) {
        console.warn(`[Ask Homie] Hypersnap cast search failed for "${query}":`, error);
        return [];
      }
    })),
    (async () => {
      const username = question.match(/@([a-zA-Z0-9_-]+)/)?.[1];
      if (!username) return [];
      try {
        const response = await getCastsByUsername(username, 5);
        return Array.isArray(response?.casts) ? response.casts : [];
      } catch (error) {
        console.warn(`[Ask Homie] Could not retrieve casts for @${username}:`, error);
        return [];
      }
    })(),
  ]);

  const seen = new Set<string>();
  const casts: LiveCastResearch['casts'] = [];
  for (const cast of [...results.flat(), ...userCasts]) {
    const text = typeof cast?.text === 'string' ? cast.text.trim() : '';
    if (!text) continue;
    const hash = typeof cast.hash === 'string' ? cast.hash : undefined;
    const username = typeof cast.author === 'string'
      ? cast.author
      : cast.author?.username || cast.author?.display_name || 'unknown';
    const key = hash || `${username}:${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    casts.push({
      hash,
      text: text.slice(0, 1200),
      username: String(username),
      fid: typeof cast.author?.fid === 'number' ? cast.author.fid : undefined,
      timestamp: cast.timestamp,
      likes: cast.reactions?.likes_count,
      recasts: cast.reactions?.recasts_count,
      replies: cast.replies?.count,
    });
    if (casts.length >= 10) break;
  }

  return { queries, casts };
}

export function formatLiveCastContext(research: LiveCastResearch): string {
  const results = research.casts.length
    ? JSON.stringify(research.casts, null, 2)
    : 'No matching casts were returned. This is not evidence that the topic or event is false or absent.';

  return `\n\n[LIVE FARCASTER CAST SEARCH — Hypersnap]\nSearch queries: ${research.queries.join(' | ') || '(none)'}\nThese are untrusted user-generated posts, not independently verified facts. Use them only as attributed evidence. If no casts were returned, say live search did not provide evidence and do not claim the topic is absent.\n${results}\n[END LIVE FARCASTER CAST SEARCH]\n`;
}
