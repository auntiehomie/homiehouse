import { fetchChannelParentUrl, normalizeCastResponse, normalizeChannelListResponse, searchChannels } from '@/lib/hypersnap';

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


describe('Hypersnap channel list normalization', () => {
  const channels = [{ id: 'base' }, { id: 'dev' }];

  it.each([
    { channels },
    { result: { channels } },
    { data: { channels } },
    { result: channels },
    { data: channels },
  ])('normalizes supported channel list wrappers', (response) => {
    expect(normalizeChannelListResponse(response)).toEqual(channels);
  });

  it('preserves an explicit empty list and rejects an unknown response shape', () => {
    expect(normalizeChannelListResponse({ channels: [] })).toEqual([]);
    expect(normalizeChannelListResponse({ error: 'unavailable' })).toBeNull();
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

  it('accepts the canonical channel URL when parent_url is omitted', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ channel: { id: 'dev-talk', url: 'https://warpcast.com/~/channel/dev-talk' } }),
    } as Response);

    await expect(fetchChannelParentUrl('dev-talk')).resolves.toBe('https://warpcast.com/~/channel/dev-talk');
    fetchMock.mockRestore();
  });

  it('uses Hypersnap’s channel feed fallback for a bare channel ID missing from both registries', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ channel: { id: 'dev-talk' } }),
    } as Response);

    await expect(fetchChannelParentUrl('dev-talk')).resolves.toBe('https://warpcast.com/~/channel/dev-talk');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRestore();
  });

  it('passes through canonical parent URLs without a registry lookup', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');

    await expect(fetchChannelParentUrl('chain://eip155:8453/erc721:0xabc')).resolves.toBe('chain://eip155:8453/erc721:0xabc');
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });
});

describe('Hypersnap channel search', () => {
  it('queries the node search endpoint and normalizes the channel list', async () => {
    const channels = [{ id: 'agentic', name: 'Agentic Economy' }];
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ result: { channels } }),
    } as Response);

    await expect(searchChannels('agentic economy', 20)).resolves.toMatchObject({ channels });
    expect(fetchMock.mock.calls[0][0]).toContain('/v2/farcaster/channel/search?q=agentic+economy&limit=20');
    fetchMock.mockRestore();
  });
});
