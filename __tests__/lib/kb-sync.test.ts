const mockSql = Object.assign(jest.fn(), { query: jest.fn(), unsafe: jest.fn() });
jest.mock('@/lib/db', () => ({ sql: mockSql }));
jest.mock('@/lib/agent-context', () => ({ indexKnowledgeBaseArticles: jest.fn().mockResolvedValue(0) }));

import knowledgeBase from '@/content/knowledge-base/articles.json';
import { syncKnowledgeBase, pickFreshKBArticle, pickKBArticleForPosting, getRelevantKBArticles, formatKBContext } from '@/lib/kb-sync';

beforeEach(() => {
  jest.clearAllMocks();
  mockSql.query.mockResolvedValue([]);
  mockSql.mockResolvedValue([]);
});

it('validates the repository corpus in a dry run without database or network access', async () => {
  const result = await syncKnowledgeBase({ dryRun: true });
  expect(result).toMatchObject({ fetched: knowledgeBase.articles.length, wouldUpsert: knowledgeBase.articles.length, upserted: 0, errors: [] });
  expect(mockSql).not.toHaveBeenCalled();
  expect(mockSql.query).not.toHaveBeenCalled();
});

it('syncs repository articles and reconciles the cache after creating its schema', async () => {
  mockSql.mockImplementation(async (parts: TemplateStringsArray) =>
    parts.join('').includes('COUNT(*)') ? [{ usable: knowledgeBase.articles.length }] : []
  );

  const result = await syncKnowledgeBase({ skipIndex: true });
  expect(mockSql.query).toHaveBeenCalledTimes(3);
  expect(mockSql.query.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS kb_articles');
  expect(mockSql.unsafe).not.toHaveBeenCalled();
  const insertCalls = mockSql.mock.calls.filter((call) => call[0].join('').includes('INSERT INTO kb_articles'));
  expect(insertCalls).toHaveLength(knowledgeBase.articles.length);
  const first = knowledgeBase.articles[0];
  expect(insertCalls[0][1]).toBe(first.title);
  expect(insertCalls[0][2]).toBe(first.url);
  expect(insertCalls[0][5]).toBe(first.summary);
  expect(insertCalls[0][6]).toEqual(first.learningPoints);

  const reconcile = mockSql.mock.calls.find((call) => call[0].join('').includes('DELETE FROM kb_articles'));
  expect(reconcile?.[0].join('')).toContain('LOWER(BTRIM(title))');
  expect(reconcile?.[1]).toEqual(knowledgeBase.articles.map((article) => article.title.toLowerCase()));
  expect(result).toMatchObject({ fetched: knowledgeBase.articles.length, upserted: knowledgeBase.articles.length, usable: knowledgeBase.articles.length, errors: [] });
});

it('uses the selected article summaries as grounded Ask Homie context', async () => {
  const source = knowledgeBase.articles.find((article) => article.title === 'The Meaning of Decentralization')!;
  mockSql.mockResolvedValue([{
    id: 73,
    title: source.title,
    url: source.url,
    source: source.source,
    tags: source.tags,
    summary: source.summary,
    learning_points: source.learningPoints,
  }]);
  const context = formatKBContext(await getRelevantKBArticles('decentralization governance'));
  expect(context).toContain(source.title);
  expect(context).toContain(`Source URL: ${source.url}`);
  expect(context).toContain(source.learningPoints[0]);
  expect(context).not.toContain('personal note');
});

it('uses exact exclusions for titles containing regex syntax', async () => {
  mockSql.mockResolvedValue([{ id: 1, title: 'Wallets', learning_points: [] }]);
  await pickFreshKBArticle(['Wallets (v2) [draft]']);
  expect(mockSql.mock.calls[0][0].join('')).toContain('ANY(');
  expect(mockSql.mock.calls[0][1]).toEqual(['wallets (v2) [draft]']);
});

it('recovers an empty posting cache from the repository corpus without requiring embeddings', async () => {
  mockSql.mockImplementation(async (parts: TemplateStringsArray) => {
    const query = parts.join('');
    if (query.includes('COUNT(*)')) return [{ usable: knowledgeBase.articles.length }];
    if (query.includes('ORDER BY RANDOM')) return mockSql.mock.calls.length === 1 ? [] : [{
      id: 1,
      title: knowledgeBase.articles[0].title,
      summary: knowledgeBase.articles[0].summary,
      learning_points: knowledgeBase.articles[0].learningPoints,
    }];
    return [];
  });
  expect(await pickKBArticleForPosting()).toMatchObject({ title: knowledgeBase.articles[0].title });
  const { indexKnowledgeBaseArticles } = await import('@/lib/agent-context');
  expect(indexKnowledgeBaseArticles).not.toHaveBeenCalled();
});


it('retrieves short topic acronyms without matching them inside unrelated words', async () => {
  await getRelevantKBArticles('How can AI help a DAO?');
  const query = mockSql.mock.calls.find((call) => call[0].join('').includes('SELECT * FROM kb_articles'));
  expect(query).toBeDefined();
  expect(query?.[1]).toContain('\\mai\\M');
  expect(query?.[1]).toContain('\\mdao\\M');
  expect(query?.[1]).not.toContain('how');
});
