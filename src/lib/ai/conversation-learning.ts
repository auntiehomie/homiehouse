import { llmChat } from '@/lib/llm';
import { getRelevantKBArticles, formatKBContext } from '@/lib/kb-sync';
import { fetchCast } from '@/lib/hypersnap';
import { CONVERSATION_LEARNING_SYSTEM, learningFormat, type LearningMode } from '@/lib/conversation-learning';

interface LearningMessage { role: 'user' | 'assistant'; content: string }
interface CastExcerpt {
  hash?: string;
  text?: string;
  author?: { username?: string } | string;
  parent_chain?: CastExcerpt[];
  direct_replies?: CastExcerpt[];
  replies?: { casts?: CastExcerpt[] };
}

function excerpt(cast: CastExcerpt) {
  return {
    author: typeof cast.author === 'string' ? cast.author : cast.author?.username,
    text: typeof cast.text === 'string' ? cast.text.slice(0, 3000) : '',
    hash: cast.hash,
  };
}

export async function generateConversationLearning({ mode, messages, castContext, topic }: {
  mode: LearningMode;
  messages: LearningMessage[];
  castContext?: CastExcerpt;
  topic?: string;
}) {
  let cast = castContext;
  let contextSource = cast ? 'provided-excerpt' : 'conversation';
  // Resolve the thread through the same node as the reader. Never fetch arbitrary URLs.
  if (typeof cast?.hash === 'string' && /^(?:0x)?[a-f0-9]{40}$/i.test(cast.hash)) {
    try {
      const result = await fetchCast(cast.hash);
      if (result?.cast) { cast = result.cast; contextSource = 'Hypersnap'; }
    } catch { /* The visible excerpt remains useful when the node is unavailable. */ }
  }
  const thread = cast ? {
    selected: excerpt(cast),
    parents: (Array.isArray(cast.parent_chain) ? cast.parent_chain : []).slice(-6).map(excerpt),
    replies: (Array.isArray(cast.direct_replies) ? cast.direct_replies : Array.isArray(cast.replies?.casts) ? cast.replies.casts : []).slice(0, 8).map(excerpt),
    scope: 'Available excerpts only; not necessarily the complete thread.',
  } : undefined;
  const history = messages.slice(-10).map(message => ({ role: message.role, content: message.content.slice(0, 6000) }));
  const query = [topic, history.slice(-3).map(message => message.content).join(' '), cast?.text].filter(Boolean).join(' ').slice(0, 6000);
  const articles = await getRelevantKBArticles(query, 4);
  const sources = articles.flatMap(article => {
    if (!article.url || (!article.summary && !article.learning_points?.length)) return [];
    try {
      const url = new URL(article.url);
      return url.protocol === 'https:' ? [{ title: article.title, url: url.href }] : [];
    } catch { return []; }
  });
  const { message } = await llmChat({
    messages: [
      { role: 'system', content: `${CONVERSATION_LEARNING_SYSTEM}\n${learningFormat(mode)}\nThe supplied background is not live web verification.` },
      { role: 'user', content: JSON.stringify({
        chosenTopic: topic?.slice(0, 200) || null,
        source: contextSource,
        thread,
        background: formatKBContext(articles),
        supportingSources: sources,
        previousExchangeAndCurrentQuestion: history,
      }) },
    ],
    maxTokens: mode === 'lesson' ? 3800 : 1200,
    temperature: 0.4,
    timeoutMs: 20000,
  });
  if (!message.content?.trim()) throw new Error('Learning provider returned an empty response');
  return {
    response: message.content,
    suggestions: [],
    agentRole: 'researcher',
    metadata: { learningMode: mode, topic: topic || null, contextSource, sources, liveWebVerified: false },
    mode: 'agent',
  };
}
