import {
  forgetRecentInteraction,
  loadRecentInteractions,
  rememberRecentInteraction,
} from '@/lib/recent-interactions';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('recent interactions', () => {
  it('stores a minimized, normalized interaction and removes it after undo', () => {
    const storage = new MemoryStorage();
    rememberRecentInteraction({
      type: 'like',
      castHash: '0xabc',
      authorFid: 42,
      authorUsername: '@builder',
      text: '  A useful cast  ',
      channelId: '/base',
    }, storage);

    expect(loadRecentInteractions(storage)).toEqual([expect.objectContaining({
      type: 'like',
      castHash: '0xabc',
      authorUsername: 'builder',
      text: 'A useful cast',
      channelId: 'base',
    })]);

    forgetRecentInteraction('like', '0xabc', storage);
    expect(loadRecentInteractions(storage)).toEqual([]);
  });

  it('deduplicates the same reaction and caps retained history', () => {
    const storage = new MemoryStorage();
    for (let index = 0; index < 35; index += 1) {
      rememberRecentInteraction({
        type: 'recast',
        castHash: `0x${index}`,
        authorFid: index,
        text: `Cast ${index}`,
      }, storage);
    }
    rememberRecentInteraction({
      type: 'recast',
      castHash: '0x34',
      authorFid: 34,
      text: 'Updated cast',
    }, storage);

    const items = loadRecentInteractions(storage);
    expect(items).toHaveLength(30);
    expect(items[0].text).toBe('Updated cast');
  });
});
