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

const mempoolError = 'status: Unavailable, message: "unavailable/Error adding to mempool", details: [], metadata: MetadataMap { headers: {"x-err-code": "unavailable"} }';

it.each([
  Response.json({ errCode: 'unavailable', errMsg: mempoolError }, { status: 400 }),
  new Response(mempoolError, { status: 400 }),
  new Response('', { status: 429 }),
])('falls back when the primary node is busy even with a 4xx status', async busy => {
  fetchMock.mockResolvedValueOnce(busy);
  const response = Response.json({ hash: 'confirmed' });
  fetchMock.mockResolvedValueOnce(response);
  await expect(submit(message)).resolves.toBe(response);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][0]).toBe('https://fallback.example/v1/submitMessage');
});

it('returns the readable busy response when every node is busy', async () => {
  fetchMock.mockResolvedValueOnce(new Response(mempoolError, { status: 400 }));
  fetchMock.mockResolvedValueOnce(new Response(mempoolError, { status: 400 }));
  const response = await submit(message);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await expect(response.text()).resolves.toContain('mempool');
});

describe('write key for the personal node', () => {
  beforeEach(async () => {
    jest.resetModules();
    process.env.HYPERSNAP_WRITE_KEY = 'test-secret';
    submit = (await import('@/lib/hypersnap-submit')).submitHypersnapMessage;
  });

  it('sends the key to the personal node but never to the fallback', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));
    fetchMock.mockResolvedValueOnce(Response.json({ hash: 'confirmed' }));
    await submit(message);
    expect(fetchMock.mock.calls[0][1].headers['x-homiehouse-key']).toBe('test-secret');
    expect(fetchMock.mock.calls[1][1].headers['x-homiehouse-key']).toBeUndefined();
  });
});
