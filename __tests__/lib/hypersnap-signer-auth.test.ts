import { checkHypersnapSigner, isActiveHypersnapSigner } from '@/lib/hypersnap-signer-auth';

const key = '02'.repeat(32);
const signer = { fid: 123, key, keyType: 1, source: 'SIGNER_SOURCE_OFFCHAIN' };

describe('Hypersnap signer proof', () => {
  beforeEach(() => { global.fetch = jest.fn(); });

  it('accepts an exact offchain key and FID using a live, public-key-only lookup', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ signer }) });
    await expect(isActiveHypersnapSigner(123, `0x${key}`)).resolves.toBe(true);
    const [rawUrl, options] = (fetch as jest.Mock).mock.calls[0];
    const url = new URL(rawUrl);
    expect(url.pathname).toBe('/v1/signer');
    expect(url.searchParams.get('fid')).toBe('123');
    expect(url.searchParams.get('signer')).toBe(key);
    expect(options.cache).toBe('no-store');
  });

  it.each([
    { fid: 456 }, { key: '03'.repeat(32) }, { keyType: 2 },
    { source: 'SIGNER_SOURCE_NONE' }, { expiresAt: 1 }, { expiresAt: 'invalid' },
  ])('rejects a mismatched or expired record: %j', async (change) => {
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ signer: { ...signer, ...change } }) });
    await expect(isActiveHypersnapSigner(123, key)).resolves.toBe(false);
  });

  it('accepts an unexpired key with a prefixed hex response', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ signer: { ...signer, key: `0x${key}`, expiresAt: Math.floor(Date.now() / 1000) + 600 } }) });
    await expect(isActiveHypersnapSigner(123, key)).resolves.toBe(true);
  });

  it('does not reuse an approval after the node removes it', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ signer }) })
      .mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(isActiveHypersnapSigner(123, key)).resolves.toBe(true);
    await expect(isActiveHypersnapSigner(123, key)).resolves.toBe(false);
  });

  it.each(['offline', 'malformed', 'missing'])('fails closed when %s', async (kind) => {
    (fetch as jest.Mock).mockImplementation(async () => {
      if (kind === 'offline') throw new Error('timeout');
      return { ok: true, json: async () => {
        if (kind === 'malformed') throw new Error('invalid JSON');
        return {};
      } };
    });
    await expect(isActiveHypersnapSigner(123, key)).resolves.toBe(false);
  });

  describe('with a personal node configured', () => {
    const env = process.env;
    beforeEach(() => {
      process.env = { ...env, MY_HYPERSNAP_NODE_URL: 'https://rpc.example.test/', HYPERSNAP_FALLBACK_URL: 'https://haatz.quilibrium.com' };
      delete process.env.NEXT_PUBLIC_HYPERSNAP_URL;
    });
    afterEach(() => { process.env = env; });

    it('asks the personal node first', async () => {
      (fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, json: async () => ({ signer }) });
      await expect(checkHypersnapSigner(123, key)).resolves.toBe('active');
      expect((fetch as jest.Mock).mock.calls).toHaveLength(1);
      expect((fetch as jest.Mock).mock.calls[0][0]).toMatch(/^https:\/\/rpc\.example\.test\/v1\/signer\?/);
    });

    it('falls back to haatz when the personal node times out', async () => {
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('The operation was aborted due to timeout'))
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ signer }) });
      await expect(checkHypersnapSigner(123, key)).resolves.toBe('active');
      expect((fetch as jest.Mock).mock.calls[1][0]).toMatch(/^https:\/\/haatz\.quilibrium\.com\/v1\/signer\?/);
    });

    it('falls back when the personal node proxy does not route the path', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false, status: 404, clone: () => ({ text: async () => '' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ signer }) });
      await expect(checkHypersnapSigner(123, key)).resolves.toBe('active');
    });

    it('reports unavailable, not inactive, when every node times out', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('The operation was aborted due to timeout'));
      await expect(checkHypersnapSigner(123, key)).resolves.toBe('unavailable');
      expect((fetch as jest.Mock).mock.calls).toHaveLength(2);
    });
  });
});
