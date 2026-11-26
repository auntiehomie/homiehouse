import { CASTBOARDS, getCastboard, loadCastboard } from '@/lib/castboards';

describe('curated castboards', () => {
  it('aggregates configured channels, deduplicates hashes, and sorts recent first', async () => {
    const board = CASTBOARDS[0];
    const fetchChannel = jest.fn().mockImplementation(async (channel: string) => ({ casts: [
      { hash: 'shared', text: 'Same cast', timestamp: '2026-01-01T00:00:00Z' },
      { hash: channel, text: channel, timestamp: '2026-02-01T00:00:00Z' },
    ] }));
    const result = await loadCastboard(board, fetchChannel);
    expect(fetchChannel).toHaveBeenCalledTimes(board.channels.length);
    expect(new Set(result.casts.map(c => c.hash)).size).toBe(result.casts.length);
    expect(result.casts.at(-1)?.hash).toBe('shared');
    expect(result.failedChannels).toEqual([]);
    expect(result.casts[0].castboardChannel).toBe(board.channels[0]);
  });
});
