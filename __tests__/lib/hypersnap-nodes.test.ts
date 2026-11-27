import { fetchFromHypersnapNodes, getHypersnapNodes, HypersnapUnavailableError, resetNodeHealth } from '@/lib/hypersnap-nodes';

const env = process.env;
const ok = (body: unknown = {}) => ({ ok: true, status: 200, json: async () => body, clone: () => ({ text: async () => JSON.stringify(body) }) });
const fail = (status: number, text = '') => ({ ok: false, status, clone: () => ({ text: async () => text }) });

describe('Hypersnap node failover', () => {
  beforeEach(() => {
    process.env = {
      ...env,
      MY_HYPERSNAP_NODE_URL: 'https://rpc.example.test/',
      NEXT_PUBLIC_HYPERSNAP_URL: 'https://haatz.quilibrium.com',
      HYPERSNAP_FALLBACK_URL: 'https://haatz.quilibrium.com',
      HYPERSNAP_WRITE_KEY: 'secret',
    };
    global.fetch = jest.fn();
    resetNodeHealth();
  });
  afterEach(() => { process.env = env; });

  it('orders the personal node first and de-duplicates haatz', () => {
    expect(getHypersnapNodes()).toEqual([
      { url: 'https://rpc.example.test', personal: true },
      { url: 'https://haatz.quilibrium.com', personal: false },
    ]);
  });

  it('defaults to haatz when nothing is configured', () => {
    process.env = { ...env };
    for (const name of ['MY_HYPERSNAP_NODE_URL', 'HYPERSNAP_NODE_URL', 'SNAPCHAIN_NODE_URL', 'NEXT_PUBLIC_HYPERSNAP_URL', 'HYPERSNAP_FALLBACK_URL', 'SNAPCHAIN_FALLBACK_URL']) {
      delete process.env[name];
    }
    expect(getHypersnapNodes()).toEqual([{ url: 'https://haatz.quilibrium.com', personal: false }]);
  });

  it('sends KEY_ADD submissions to the personal node with its write key', async () => {
    (fetch as jest.Mock).mockResolvedValue(ok({ hash: '0xabc' }));
    const { node } = await fetchFromHypersnapNodes('/v1/submitMessage', { method: 'POST', body: Buffer.from([1]) });
    expect(node.personal).toBe(true);
    const [url, init] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://rpc.example.test/v1/submitMessage');
    expect((init.headers as Headers).get('x-homiehouse-key')).toBe('secret');
  });

  it('never sends the write key to haatz', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(ok());
    await fetchFromHypersnapNodes('/v1/submitMessage', { method: 'POST', body: Buffer.from([1]) });
    const [url, init] = (fetch as jest.Mock).mock.calls[1];
    expect(url).toBe('https://haatz.quilibrium.com/v1/submitMessage');
    expect((init.headers as Headers).has('x-homiehouse-key')).toBe(false);
  });

  it.each([
    ['a 5xx', fail(502)],
    ['a 429', fail(429)],
    ['a busy rejection', fail(400, '{"errCode":"unavailable","message":"mempool full"}')],
    ['a proxy 404', fail(404)],
  ])('moves on after %s from the personal node', async (_name, first) => {
    (fetch as jest.Mock).mockResolvedValueOnce(first).mockResolvedValueOnce(ok());
    const { node } = await fetchFromHypersnapNodes('/v1/signersByFid?fid=1');
    expect(node.personal).toBe(false);
  });

  it('returns a real rejection without retrying elsewhere', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce(fail(400, '{"message":"invalid signature"}'));
    const { response } = await fetchFromHypersnapNodes('/v1/submitMessage', { method: 'POST' });
    expect(response.status).toBe(400);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('throws a readable error when every node times out', async () => {
    (fetch as jest.Mock).mockRejectedValue(new Error('The operation was aborted due to timeout'));
    await expect(fetchFromHypersnapNodes('/v1/signersByFid?fid=1')).rejects.toBeInstanceOf(HypersnapUnavailableError);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  describe('extra fallbacks (HYPERSNAP_FALLBACK_URLS)', () => {
    beforeEach(() => {
      process.env.HYPERSNAP_FALLBACK_URLS = 'https://node-a.example/, https://node-b.example  not-a-url';
    });

    it('adds them after haatz, ignoring invalid entries', () => {
      expect(getHypersnapNodes().map((n) => n.url)).toEqual([
        'https://rpc.example.test',
        'https://haatz.quilibrium.com',
        'https://node-a.example',
        'https://node-b.example',
      ]);
    });

    it('keeps going until a node answers', async () => {
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce(ok({ hash: '0x1' }));
      const { node } = await fetchFromHypersnapNodes('/v1/submitMessage', { method: 'POST' });
      expect(node.url).toBe('https://node-a.example');
    });

    it('tries a node that just failed last on the next request', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(ok());
      await fetchFromHypersnapNodes('/v1/info');
      (fetch as jest.Mock).mockClear().mockResolvedValue(ok());
      await fetchFromHypersnapNodes('/v1/info');
      expect((fetch as jest.Mock).mock.calls[0][0]).toBe('https://haatz.quilibrium.com/v1/info');
    });

    it('never sends the write key to other operators', async () => {
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce(ok());
      await fetchFromHypersnapNodes('/v1/submitMessage', { method: 'POST' });
      const [, init] = (fetch as jest.Mock).mock.calls[2];
      expect((init.headers as Headers).has('x-homiehouse-key')).toBe(false);
    });

    it('stops at the overall time budget', async () => {
      (fetch as jest.Mock).mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        throw new Error('timeout');
      });
      await expect(fetchFromHypersnapNodes('/v1/info', { totalTimeoutMs: 1_050 })).rejects.toBeInstanceOf(HypersnapUnavailableError);
      expect((fetch as jest.Mock).mock.calls.length).toBeLessThan(4);
    });
  });
});

