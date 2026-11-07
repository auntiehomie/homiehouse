import { ensureAuthHeaders, getAuthHeaders, requirePostingAuthHeaders } from '@/lib/client-auth';

describe('checkout credential selection', () => {
  const values = new Map<string, string>();
  beforeEach(() => {
    values.clear();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
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
  it('never falls back to a private signer key for a write', () => {
    session(['read:all']);
    expect(getAuthHeaders('write:shop')).toBeNull();
  });
  it('prefers a session that already has shop permission', () => {
    const token = session(['read:all', 'write:shop']);
    expect(getAuthHeaders('write:shop')).toEqual({ 'x-session-token': token });
  });
  it('continues to use read-only sessions for ordinary reads', () => {
    const token = session(['read:all']);
    expect(getAuthHeaders()).toEqual({ 'x-session-token': token });
  });
  it('does not claim shop access without a capable session', () => {
    session(['read:all']);
    values.delete('signer_123');
    expect(getAuthHeaders('write:shop')).toBeNull();
  });

  it('creates a write-capable session from an approved signer when the current session is read-only', async () => {
    session(['read:all']);
    const dispatchEvent = jest.fn();
    Object.defineProperty(global, 'window', { value: { dispatchEvent }, configurable: true });
    const token = `header.${Buffer.from(JSON.stringify({ scopes: ['read:all', 'write:casts'] })).toString('base64url')}.signature`;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, token, fid: 123, expiresAt: Date.now() + 60000 }),
    }) as jest.Mock;

    await expect(ensureAuthHeaders('write:casts')).resolves.toEqual({ 'x-session-token': token });
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/session', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'x-farcaster-fid': '123', 'x-signer-key': 'test-private-key' }),
    }));
    expect(JSON.parse(values.get('hh_session_v1')!).token).toBe(token);
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it('force refresh discards an expired cached session and mints a fresh write session', async () => {
    session(['read:all', 'write:casts']);
    const dispatchEvent = jest.fn();
    Object.defineProperty(global, 'window', { value: { dispatchEvent }, configurable: true });
    const token = `header.${Buffer.from(JSON.stringify({ scopes: ['read:all', 'write:casts'] })).toString('base64url')}.signature`;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, token, fid: 123, expiresAt: Date.now() + 60000 }),
    }) as jest.Mock;

    await expect(ensureAuthHeaders('write:casts', { forceRefresh: true })).resolves.toEqual({ 'x-session-token': token });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(values.get('hh_session_v1')!).token).toBe(token);
  });

  it('opens the wallet sign-in flow when posting access cannot be restored', async () => {
    values.delete('hh_profile');
    values.delete('hh_session_v1');
    values.delete('signer_123');
    const dispatchEvent = jest.fn();
    Object.defineProperty(global, 'window', { value: { dispatchEvent }, configurable: true });

    await expect(requirePostingAuthHeaders()).rejects.toMatchObject({ code: 'POSTING_AUTHORIZATION_REQUIRED' });
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'hh:auth:required' }));
  });

  it('does not make an unauthenticated schedule request when no approved signer is stored', async () => {
    values.delete('hh_session_v1');
    values.delete('signer_123');
    global.fetch = jest.fn() as jest.Mock;
    await expect(ensureAuthHeaders('write:casts')).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
