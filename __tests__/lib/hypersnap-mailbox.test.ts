import { getMailboxNodeUrl, saveMailboxNodeUrl, probeHypersnapMailbox, HYPERSNAP_MAILBOX_PROTOCOL } from '@/lib/hypersnap-mailbox';

const originalFetch = globalThis.fetch;
const values = new Map<string, string>();

beforeEach(() => {
  values.clear();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } } });
  globalThis.fetch = jest.fn();
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  Reflect.deleteProperty(globalThis, 'window');
});

test('stores a normalized browser-selected node and probes only that node', async () => {
  expect(saveMailboxNodeUrl('https://mail.example/custom/')).toBe(true);
  expect(getMailboxNodeUrl()).toBe('https://mail.example/custom');
  jest.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ protocol: HYPERSNAP_MAILBOX_PROTOCOL, enabled: true })));
  await expect(probeHypersnapMailbox()).resolves.toMatchObject({ available: true });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith('https://mail.example/custom/v1/hypersnap/mailbox/capabilities', expect.objectContaining({ credentials: 'omit', method: 'GET' }));
});
test.each(['http://remote.example', 'https://user:pass@mail.example', 'https://mail.example?q=1', 'https://mail.example#fragment', 'javascript:alert(1)', ''])('rejects unsafe node URL %s', value => {
  expect(saveMailboxNodeUrl(value)).toBe(false);
  expect(values.size).toBe(0);
});
test('permits local HTTP nodes for development', () => {
  expect(saveMailboxNodeUrl('http://localhost:3001/')).toBe(true);
  expect(getMailboxNodeUrl()).toBe('http://localhost:3001');
});
test.each([404, 501])('does not fall back when mailbox support returns %s', async status => {
  jest.mocked(fetch).mockResolvedValue(new Response('', { status }));
  await expect(probeHypersnapMailbox()).resolves.toEqual({ available: false, reason: 'unsupported' });
  expect(fetch).toHaveBeenCalledTimes(1);
});
test('rejects an unrelated protocol', async () => {
  jest.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ protocol: 'other', enabled: true })));
  await expect(probeHypersnapMailbox()).resolves.toEqual({ available: false, reason: 'invalid-response' });
});
test('fails closed on a network error without changing nodes', async () => {
  jest.mocked(fetch).mockRejectedValue(new Error('offline'));
  await expect(probeHypersnapMailbox()).resolves.toEqual({ available: false, reason: 'unreachable' });
  expect(fetch).toHaveBeenCalledTimes(1);
});
