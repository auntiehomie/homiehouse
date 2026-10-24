import { fetchUserByUsername, fetchUserByFid } from '@/lib/hypersnap';

describe('Hypersnap user response normalization', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it.each([
    { result: { users: [{ fid: 42, username: 'alice' }] } },
    { data: { users: [{ fid: 42, username: 'alice' }] } },
    { result: [{ fid: 42, username: 'alice' }] },
    { user: { fid: 42, username: 'alice' } },
  ])('resolves a username from wrapped Hypersnap payloads', async (payload) => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));

    await expect(fetchUserByUsername('alice')).resolves.toMatchObject({
      user: { fid: 42, username: 'alice' },
    });
  });

  it('resolves a FID from data-wrapped bulk responses', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { users: [{ fid: 42, username: 'alice' }] },
    }), { status: 200 }));

    await expect(fetchUserByFid(42)).resolves.toMatchObject({
      user: { fid: 42, username: 'alice' },
    });
  });
});
