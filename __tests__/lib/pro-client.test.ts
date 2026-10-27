import { fetchPremiumTrack, fetchProStatus } from '@/lib/pro-client';
import { getAuthHeaders, getStoredFid } from '@/lib/client-auth';
jest.mock('@/lib/client-auth', () => ({ getAuthHeaders: jest.fn(), getStoredFid: jest.fn() }));
const auth = getAuthHeaders as jest.Mock;
const fid = getStoredFid as jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  auth.mockReturnValue({ 'x-session-token': 'read-only-session' });
  fid.mockReturnValue(3103);
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, is_pro: true }) });
});
test('paid Pro status includes read credentials and bypasses stale previews', async () => {
  await expect(fetchProStatus(3103)).resolves.toBe(true);
  expect(auth).toHaveBeenCalledWith('read:all');
  expect(fetch).toHaveBeenCalledWith('/api/pro-status?fid=3103', expect.objectContaining({
    headers: { 'x-session-token': 'read-only-session' }, cache: 'no-store',
  }));
});
test('premium listings and lessons include the same authenticated headers', async () => {
  await fetchPremiumTrack();
  await fetchPremiumTrack('premium/id');
  expect(fetch).toHaveBeenNthCalledWith(1, '/api/premium-track', expect.objectContaining({ headers: { 'x-session-token': 'read-only-session' }, cache: 'no-store' }));
  expect(fetch).toHaveBeenNthCalledWith(2, '/api/premium-track?module=premium%2Fid', expect.objectContaining({ headers: { 'x-session-token': 'read-only-session' } }));
});
test('missing credentials for a saved account cannot masquerade as a free subscription', async () => {
  auth.mockReturnValue(null);
  await expect(fetchProStatus(3103)).rejects.toThrow('Sign in again');
  expect(() => fetchPremiumTrack()).toThrow('Sign in again');
  expect(fetch).not.toHaveBeenCalled();
});
test('only anonymous visitors request public teasers without credentials', async () => {
  auth.mockReturnValue(null); fid.mockReturnValue(null);
  await fetchPremiumTrack();
  expect(fetch).toHaveBeenCalledWith('/api/premium-track', expect.objectContaining({ headers: {}, cache: 'no-store' }));
});
test('an entitlement server failure does not become isPro=false', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({ ok: false, error: 'Access unavailable' }) });
  await expect(fetchProStatus(3103)).rejects.toThrow('Access unavailable');
});
