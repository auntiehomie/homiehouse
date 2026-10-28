import { isPublicIpAddress, safeFetchPublicUrl } from '@/lib/safe-public-fetch';

describe('isPublicIpAddress', () => {
  it.each([
    '0.0.0.0',
    '10.1.2.3',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '198.51.100.7',
    '224.0.0.1',
    '::1',
    'fc00::1',
    'fe80::1',
    '2001:db8::1',
    '::ffff:127.0.0.1',
  ])('rejects non-public address %s', (address) => {
    expect(isPublicIpAddress(address)).toBe(false);
  });

  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])('allows public address %s', (address) => {
    expect(isPublicIpAddress(address)).toBe(true);
  });

  it('rejects malformed addresses', () => {
    expect(isPublicIpAddress('example.com')).toBe(false);
  });

  it.each([
    'http://127.0.0.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://user:pass@example.com/',
    'http://example.com:8080/',
  ])('refuses unsafe URL %s before making a request', async (url) => {
    await expect(safeFetchPublicUrl(url)).rejects.toThrow();
  });
});
