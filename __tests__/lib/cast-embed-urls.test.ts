import { castEmbedUrls } from '@/lib/cast-embed-urls';

test('includes text-only website links from parent casts and deduplicates attachments', () => {
  expect(castEmbedUrls('Listen https://suno.com/song/abc. Then https://example.com', [{ url: 'https://suno.com/song/abc' }]))
    .toEqual(['https://suno.com/song/abc', 'https://example.com']);
});
test('rejects unsafe schemes and bounds preview requests', () => {
  expect(castEmbedUrls('', ['javascript:alert(1)', null, { url: 'data:text/html,bad' }])).toEqual([]);
  expect(castEmbedUrls('', Array.from({ length: 20 }, (_, i) => `https://example.com/${i}`))).toHaveLength(6);
});
