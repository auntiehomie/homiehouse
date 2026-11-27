/** @jest-environment node */
const originalEnv = { ...process.env };
const originalFetch = global.fetch;
let fetchMock: jest.Mock;

beforeEach(() => {
  jest.resetModules();
  process.env.MY_HYPERSNAP_NODE_URL = 'https://rpc.homiehouse.xyz';
  process.env.HYPERSNAP_FALLBACK_URL = 'https://haatz.example';
  fetchMock = jest.fn();
  global.fetch = fetchMock;
});
afterEach(() => { process.env = { ...originalEnv }; global.fetch = originalFetch; });

const vercel404 = () => new Response('The page could not be found', { status: 404, headers: { 'x-vercel-error': 'NOT_FOUND' } });

it('retries reads on the fallback node when the personal proxy has no route (user search)', async () => {
  fetchMock.mockResolvedValueOnce(vercel404());
  fetchMock.mockResolvedValueOnce(Response.json({ result: { users: [{ fid: 3, username: 'balajis' }] } }));
  const { searchUsers } = await import('@/lib/hypersnap');
  const data = await searchUsers('bala', 5);
  expect(fetchMock.mock.calls[0][0]).toMatch(/^https:\/\/rpc\.homiehouse\.xyz\/v2\/farcaster\/user\/search/);
  expect(fetchMock.mock.calls[1][0]).toMatch(/^https:\/\/haatz\.example\/v2\/farcaster\/user\/search/);
  expect(JSON.stringify(data)).toContain('balajis');
});

it('does not retry writes on the fallback node', async () => {
  fetchMock.mockResolvedValueOnce(new Response('nope', { status: 500 }));
  const { hypersnapFetch } = await import('@/lib/hypersnap');
  await expect(hypersnapFetch('/v1/thing', { method: 'POST' })).rejects.toThrow(/500/);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('treats a proxy routing 404 as unknown, not "not following"', async () => {
  fetchMock.mockResolvedValueOnce(vercel404());
  fetchMock.mockResolvedValueOnce(Response.json({ data: {} }));
  const { fetchFollowStatus } = await import('@/lib/hypersnap');
  await expect(fetchFollowStatus(1, 2)).resolves.toBe(true);
  expect(fetchMock.mock.calls[1][0]).toMatch(/^https:\/\/haatz\.example\/v1\/linkById/);
});

it('still reports not following when the node itself returns 404', async () => {
  fetchMock.mockResolvedValueOnce(new Response('', { status: 404 }));
  const { fetchFollowStatus } = await import('@/lib/hypersnap');
  await expect(fetchFollowStatus(1, 2)).resolves.toBe(false);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
