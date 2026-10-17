import { isActiveHypersnapSigner } from '@/lib/hypersnap-signer-auth';

const key = '02'.repeat(32);
const signer = { fid: 123, key, keyType: 1, source: 'SIGNER_SOURCE_OFFCHAIN' };

describe('Hypersnap signer proof', () => {
  beforeEach(() => { global.fetch = jest.fn(); });

  it('accepts an exact offchain key and FID using a live, public-key-only lookup', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ signer }) });
    await expect(isActiveHypersnapSigner(123, `0x${key}`)).resolves.toBe(true);
    const [url, options] = (fetch as jest.Mock).mock.calls[0];
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
});
