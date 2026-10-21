import { normalizeCastResponse, normalizeChannelListResponse } from '@/lib/hypersnap';

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
