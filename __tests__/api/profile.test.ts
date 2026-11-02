import { NextRequest } from 'next/server';
import { GET } from '@/app/api/profile/route';

const fetchUserByUsername = jest.fn();
const fetchUserByFid = jest.fn();
const fetchUserCastsPage = jest.fn();

jest.mock('@/lib/hypersnap', () => ({
  fetchUserByUsername: (...args: unknown[]) => fetchUserByUsername(...args),
  fetchUserByFid: (...args: unknown[]) => fetchUserByFid(...args),
  fetchUserCastsPage: (...args: unknown[]) => fetchUserCastsPage(...args),
  getHypersnapReadDiagnostics: jest.fn(() => null),
}));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => ({ success: true })) }));
jest.mock('@/lib/logger', () => ({
  createApiLogger: () => ({ start: jest.fn(), end: jest.fn(), info: jest.fn(), success: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));
jest.mock('@/lib/errors', () => ({
  handleApiError: jest.fn(() => Response.json({ error: 'Internal error' }, { status: 500 })),
}));

describe('/api/profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchUserByUsername.mockResolvedValue({ user: { fid: 123, username: 'balajis.eth', display_name: 'Balaji' } });
    fetchUserByFid.mockResolvedValue({ user: { fid: 456, username: 'parent-user', display_name: 'Parent User' } });
    fetchUserCastsPage.mockResolvedValue({ casts: [{ hash: '0xabc', text: 'A cast' }], next: null });
  });

  it('keeps the profile available when its cast feed is unavailable', async () => {
    fetchUserCastsPage.mockRejectedValueOnce(new Error('author feed unavailable'));

    const response = await GET(new NextRequest('http://localhost/api/profile?username=balajis.eth&casts=true'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      fid: 123,
      username: 'balajis.eth',
      casts: [],
      castsUnavailable: true,
    });
  });

  it('URL-decodes ENS-style usernames from profile search links', async () => {
    await GET(new NextRequest('http://localhost/api/profile?username=balajis.eth&casts=true'));

    expect(fetchUserByUsername).toHaveBeenCalledWith('balajis.eth');
    expect(fetchUserCastsPage).toHaveBeenCalledWith(123, 25, undefined);
  });

  it('loads a requested profile by FID instead of requiring a username lookup', async () => {
    fetchUserByFid.mockResolvedValue({
      user: { fid: 456, username: 'target-user', display_name: 'Target User' },
    });

    const response = await GET(new NextRequest('http://localhost/api/profile?fid=456&casts=true'));

    expect(response.status).toBe(200);
    expect(fetchUserByFid).toHaveBeenCalledWith(456);
    expect(fetchUserByUsername).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      fid: 456,
      username: 'target-user',
    });
  });

  it('resolves reply parent usernames when author casts contain only the parent FID', async () => {
    fetchUserCastsPage.mockResolvedValueOnce({
      casts: [{ hash: '0xreply', text: 'A reply', parent_author: { fid: 456 } }],
      next: null,
    });

    const response = await GET(new NextRequest('http://localhost/api/profile?fid=123&casts=true'));

    expect(fetchUserByFid).toHaveBeenCalledWith(456);
    await expect(response.json()).resolves.toMatchObject({
      casts: [{ parent_author: { fid: 456, username: 'parent-user', display_name: 'Parent User' } }],
    });
  });
});
