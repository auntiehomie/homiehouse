const originalEnv = { ...process.env };
const originalFetch = global.fetch;
const message = Uint8Array.of(1, 2, 3).buffer;
let submit: typeof import('@/lib/hypersnap-submit').submitHypersnapMessage;
let fetchMock: jest.Mock;

beforeEach(async () => {
  jest.resetModules();
  process.env.MY_HYPERSNAP_NODE_URL = 'https://rpc.homiehouse.xyz/';
  process.env.HYPERSNAP_FALLBACK_URL = 'https://fallback.example';
  fetchMock = jest.fn();
  global.fetch = fetchMock;
  submit = (await import('@/lib/hypersnap-submit')).submitHypersnapMessage;
});
afterEach(() => { process.env = { ...originalEnv }; global.fetch = originalFetch; });

it('uses the configured personal node for signed messages', async () => {
  fetchMock.mockResolvedValue(Response.json({ hash: 'confirmed' }));
  await submit(message);
  expect(fetchMock).toHaveBeenCalledWith('https://rpc.homiehouse.xyz/v1/submitMessage', expect.objectContaining({
    method: 'POST', body: message, signal: expect.any(AbortSignal),
  }));
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it.each([new Error('offline'), new DOMException('timeout', 'TimeoutError'), new Response('', { status: 503 })])('falls back with identical signed bytes on node failure: %s', async failure => {
  if (failure instanceof Response) fetchMock.mockResolvedValueOnce(failure);
  else fetchMock.mockRejectedValueOnce(failure);
  const response = Response.json({ hash: 'confirmed' });
  fetchMock.mockResolvedValueOnce(response);
  await expect(submit(message)).resolves.toBe(response);
  expect(fetchMock.mock.calls[1][0]).toBe('https://fallback.example/v1/submitMessage');
  expect(fetchMock.mock.calls[0][1].body).toEqual(fetchMock.mock.calls[1][1].body);
});

it('returns validation rejections without resubmitting to another node', async () => {
  const response = Response.json({ error_detail: 'invalid signer' }, { status: 400 });
  fetchMock.mockResolvedValue(response);
  await expect(submit(message)).resolves.toBe(response);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
