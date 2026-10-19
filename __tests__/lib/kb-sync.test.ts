const mockSql = Object.assign(jest.fn(), { query: jest.fn(), unsafe: jest.fn() });
jest.mock('@/lib/db', () => ({ sql: mockSql }));
jest.mock('@/lib/agent-context', () => ({ indexKnowledgeBaseArticles: jest.fn().mockResolvedValue(0) }));
import { syncKnowledgeBase, pickFreshKBArticle, pickKBArticleForPosting, getRelevantKBArticles, formatKBContext } from '@/lib/kb-sync';

const entries = '| [Wallets](https://example.com/wallets) | Docs | 2026-10-12 | wallets |';
const summaries = '1. [Wallets](https://example.com/wallets) — wallets\n\n**Summary:** Wallet keys authorize transactions.\n\n**3 Things I Learned:**\n- Protect your seed phrase.\n';
const article = { title: 'Wallets', summary: 'Wallet keys authorize transactions.', learning_points: [] };

beforeEach(() => {
  jest.clearAllMocks();
  mockSql.query.mockResolvedValue([]);
  mockSql.mockResolvedValue([]);
  global.fetch = jest.fn(async (url) => new Response(String(url).includes('rufus-vault') ? entries : summaries)) as typeof fetch;
});

it('executes schema DDL before inserts, and reports usable content', async () => {
  mockSql.mockImplementation(async (parts: TemplateStringsArray) => parts.join('').includes('COUNT(*)') ? [{ usable: 1 }] : []);
  const result = await syncKnowledgeBase({ skipIndex: true });
  expect(mockSql.query).toHaveBeenCalledTimes(3);
  expect(mockSql.query.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS kb_articles');
  expect(mockSql.unsafe).not.toHaveBeenCalled();
  expect(mockSql.query.mock.invocationCallOrder[2]).toBeLessThan(mockSql.mock.invocationCallOrder[0]);
  expect(result).toMatchObject({ upserted: 1, usable: 1, errors: [] });
});

it('does not write or execute DDL in a sync preview', async () => {
  expect(await syncKnowledgeBase({ dryRun: true })).toMatchObject({ wouldUpsert: 1, upserted: 0 });
  expect(mockSql).not.toHaveBeenCalled();
  expect(mockSql.query).not.toHaveBeenCalled();
});

it('reports source failures while preserving an existing enriched row', async () => {
  global.fetch = jest.fn(async (url) => String(url).includes('rufus-vault') ? new Response(entries) : new Response('', { status: 503 })) as typeof fetch;
  mockSql.mockImplementation(async (parts: TemplateStringsArray) => parts.join('').includes('COUNT(*)') ? [{ usable: 1 }] : []);
  const result = await syncKnowledgeBase({ skipIndex: true });
  expect(result.errors[0]).toContain('summaries:');
  const upsert = mockSql.mock.calls[0][0].join('');
  expect(upsert).toContain('COALESCE(NULLIF(BTRIM(EXCLUDED.summary)');
  expect(upsert).toContain('ELSE kb_articles.learning_points END');
});

it('keeps personalized notes out of lesson and bot context while syncing article takeaways', async () => {
  const title = 'The Network State: How to Start a New Country';
  const entry = `| [${title}](https://thenetworkstate.com/book/tns.pdf) | thenetworkstate.com | 2026-10-18 | philosophy, crypto, decentralization, governance, network states |`;
  const summary = `1. [${title}](https://thenetworkstate.com/book/tns.pdf) — philosophy, crypto, decentralization, governance, network states\n\n**Summary:** A book proposing a staged path for building an online-first community that can grow into a network state.\n\n**3 Things I Learned:**\n- A startup society can be valuable before it becomes a network state.\n- Online alignment and trust precede the growth of physical communities.\n- A DAO or online group alone does not meet the book's full definition.\n\n**Why it matters to this reader:** This is a private personal annotation.`;
  global.fetch = jest.fn(async (url) => new Response(String(url).includes('rufus-vault') ? entry : summary)) as typeof fetch;
  mockSql.mockImplementation(async (parts: TemplateStringsArray) => parts.join('').includes('COUNT(*)') ? [{ usable: 1 }] : []);

  const result = await syncKnowledgeBase({ skipIndex: true });
  const insertCall = mockSql.mock.calls.find((call) => call[0].join('').includes('INSERT INTO kb_articles'));
  expect(result).toMatchObject({ upserted: 1, usable: 1, errors: [] });
  expect(insertCall?.[1]).toBe(title);
  expect(insertCall?.[5]).toContain('A book proposing a staged path');
  expect(insertCall?.[6]).toEqual([
    'A startup society can be valuable before it becomes a network state.',
    'Online alignment and trust precede the growth of physical communities.',
    "A DAO or online group alone does not meet the book's full definition.",
  ]);
  expect(JSON.stringify(insertCall?.slice(1))).not.toContain('Why it matters to this reader');

  mockSql.mockResolvedValue([{
    id: 73,
    title,
    url: 'https://thenetworkstate.com/book/tns.pdf',
    source: 'thenetworkstate.com',
    tags: ['philosophy', 'crypto', 'decentralization', 'governance', 'network states'],
    summary: insertCall?.[5],
    learning_points: insertCall?.[6],
  }]);
  const context = formatKBContext(await getRelevantKBArticles('network state governance'));
  expect(context).toContain(title);
  expect(context).toContain('A startup society can be valuable before it becomes a network state.');
  expect(context).not.toContain('Why it matters to this reader');
});

it('uses exact exclusions for titles containing regex syntax', async () => {
  mockSql.mockResolvedValue([article]);
  await pickFreshKBArticle(['Wallets (v2) [draft]']);
  expect(mockSql.mock.calls[0][0].join('')).toContain('ANY(');
  expect(mockSql.mock.calls[0][1]).toEqual(['wallets (v2) [draft]']);
});

it('recovers an empty posting cache without requiring embeddings', async () => {
  mockSql.mockImplementation(async (parts: TemplateStringsArray) => {
    const query = parts.join('');
    if (query.includes('COUNT(*)')) return [{ usable: 1 }];
    if (query.includes('ORDER BY RANDOM')) return mockSql.mock.calls.length === 1 ? [] : [article];
    return [];
  });
  expect(await pickKBArticleForPosting()).toEqual(article);
  const { indexKnowledgeBaseArticles } = await import('@/lib/agent-context');
  expect(indexKnowledgeBaseArticles).not.toHaveBeenCalled();
});

it('fails visibly when neither cache nor source content is available', async () => {
  global.fetch = jest.fn().mockResolvedValue(new Response('', { status: 503 }));
  await expect(pickKBArticleForPosting()).rejects.toThrow('Knowledge-base recovery failed');
});
