import knowledgeBase from '@/content/knowledge-base/articles.json';
import { getKBModulesForTrack } from '@/lib/kb-curriculum';

it('turns repository AI sources into beginner modules with source links and takeaways', async () => {
  const modules = await getKBModulesForTrack('ai', 'beginner', 6);
  expect(modules.length).toBeGreaterThan(0);
  expect(modules.length).toBeLessThanOrEqual(6);
  // The article may fall outside the top six as the corpus grows.
  const allAiModules = await getKBModulesForTrack('ai', 'beginner', knowledgeBase.articles.length);
  const agents = allAiModules.find((module) => module.title === 'Building effective agents');
  expect(agents).toMatchObject({
    sourceUrl: 'https://www.anthropic.com/research/building-effective-agents',
    difficulty: 'beginner',
    tags: expect.arrayContaining(['ai', 'agents']),
  });
  expect(agents?.objectives.length).toBeGreaterThanOrEqual(2);
  expect(agents?.description).toContain('predetermined workflows');
});

it('selects topic-specific sources for creator and general learning tracks', async () => {
  const creatorModules = await getKBModulesForTrack('creator', 'intermediate');
  expect(creatorModules.length).toBeGreaterThan(0);
  expect(creatorModules.some((module) => /Zora|creator coin|NFT/i.test(module.title))).toBe(true);
  expect(creatorModules.every((module) => module.difficulty === 'intermediate' && module.sourceUrl?.startsWith('https://'))).toBe(true);

  const allModules = await getKBModulesForTrack('all', 'advanced', 3);
  expect(allModules).toHaveLength(3);
  expect(allModules.every((module) => module.difficulty === 'advanced')).toBe(true);
});

it('keeps the corpus curated and complete enough for module generation', () => {
  const ids = knowledgeBase.articles.map((article) => article.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(knowledgeBase.articles.length).toBeGreaterThanOrEqual(25);
  expect(knowledgeBase.articles.every((article) =>
    article.url.startsWith('https://') &&
    article.summary.trim().length > 0 &&
    article.learningPoints.length >= 2
  )).toBe(true);
});


it('turns newly curated Hypersnap sources into source-linked beginner lessons', async () => {
  const modules = await getKBModulesForTrack('decentralization', 'beginner', knowledgeBase.articles.length);
  const module = modules.find((item) => item.title === 'Trending feeds follow the metrics generation');
  expect(module).toMatchObject({
    sourceUrl: 'https://hypersnap.org/updates',
    sourcePublisher: 'Hypersnap',
    sourcePublishedAt: '2026-11-06',
    sourceCaveats: expect.stringContaining('not proof'),
    difficulty: 'beginner',
    tags: expect.arrayContaining(['hypersnap', 'decentralized-social']),
  });
  expect(module?.objectives).toEqual(expect.arrayContaining([
    expect.stringContaining('merged source code'),
  ]));
});
