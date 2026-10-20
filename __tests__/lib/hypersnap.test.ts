import { fetchChannelParentUrl, normalizeCastResponse } from '@/lib/hypersnap';

describe('Hypersnap cast response normalization', () => {
  const cast = { hash: `0x${'b'.repeat(40)}`, text: 'A cast' };

  it.each([
    { cast },
    { result: { cast } },
    { data: { cast } },
    { result: { data: { cast } } },
  ])('normalizes supported response wrappers', (response) => {
    expect(normalizeCastResponse(response).cast).toEqual(cast);
  });

  it('keeps the original payload when it has no cast', () => {
    const response = { error: 'not found' };
    expect(normalizeCastResponse(response)).toBe(response);
  });
});

describe('Hypersnap channel parent URL lookup', () => {
  it('uses the channel registry parent_url instead of constructing a client URL', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ channel: { id: 'dev-talk', parent_url: 'https://warpcast.com/~/channel/dev-talk' } }),
    } as Response);

    await expect(fetchChannelParentUrl('dev-talk')).resolves.toBe('https://warpcast.com/~/channel/dev-talk');
    expect(fetchMock.mock.calls[0][0]).toContain('/v2/farcaster/channel?id=dev-talk&type=id');
    fetchMock.mockRestore();
  });
});
