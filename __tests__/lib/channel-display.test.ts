import { channelDisplayName } from '@/lib/channel-display';

describe('channelDisplayName', () => {
  it('uses a readable name while retaining the ID separately for posting', () => {
    expect(channelDisplayName({ id: 'chain://0xabc', name: 'Homie' })).toBe('Homie');
  });
  it('falls back to a readable channel ID', () => {
    expect(channelDisplayName({ id: 'ethereum', name: '' })).toBe('ethereum');
  });
  it('does not present raw addresses or URLs as names', () => {
    expect(channelDisplayName({ id: 'eip155:8453/erc20:0x123', name: 'eip155:8453/erc20:0x123' })).toBeNull();
    expect(channelDisplayName({ id: '0x1234567890123456789012345678901234567890' })).toBeNull();
  });
});
