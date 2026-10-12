const mockSql = Object.assign(jest.fn(), { query: jest.fn(), unsafe: jest.fn() });
jest.mock('@/lib/db', () => ({ sql: mockSql }));
jest.mock('@/lib/agent-context', () => ({ indexKnowledgeBaseArticles: jest.fn().mockResolvedValue(0) }));
import { syncKnowledgeBase, pickFreshKBArticle, pickKBArticleForPosting } from '@/lib/kb-sync';

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
