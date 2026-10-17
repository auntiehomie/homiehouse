import { getAuthHeaders } from '@/lib/client-auth';

describe('checkout credential selection', () => {
  const values = new Map<string, string>();
  beforeEach(() => {
    values.clear();
    const storage = { getItem: (key: string) => values.get(key) ?? null };
    Object.defineProperty(global, 'window', { value: {}, configurable: true });
    Object.defineProperty(global, 'localStorage', { value: storage, configurable: true });
    Object.defineProperty(global, 'sessionStorage', { value: storage, configurable: true });
    values.set('hh_profile', JSON.stringify({ fid: 123 }));
    values.set('signer_123', JSON.stringify({ status: 'approved', private_key: 'test-private-key' }));
  });
  afterAll(() => {
    Reflect.deleteProperty(global, 'window');
    Reflect.deleteProperty(global, 'localStorage');
    Reflect.deleteProperty(global, 'sessionStorage');
  });
  function session(scopes: string[]) {
    const token = `header.${Buffer.from(JSON.stringify({ scopes })).toString('base64url')}.signature`;
    values.set('hh_session_v1', JSON.stringify({ token, fid: 123, expiresAt: Date.now() + 60000 }));
    return token;
  }
  it('uses the approved signer when a read-only login would mask it', () => {
    session(['read:all']);
    expect(getAuthHeaders('write:shop')).toEqual({ 'x-farcaster-fid': '123', 'x-signer-key': 'test-private-key' });
  });
  it('prefers a session that already has shop permission', () => {
    const token = session(['read:all', 'write:shop']);
    expect(getAuthHeaders('write:shop')).toEqual({ 'x-session-token': token });
  });
  it('continues to use read-only sessions for ordinary reads', () => {
    const token = session(['read:all']);
    expect(getAuthHeaders()).toEqual({ 'x-session-token': token });
  });
  it('does not claim shop access without a capable session or signer', () => {
    session(['read:all']);
    values.delete('signer_123');
    expect(getAuthHeaders('write:shop')).toBeNull();
  });
});
