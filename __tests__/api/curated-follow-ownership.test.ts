import { NextRequest } from 'next/server';
import { GET as getFollowed } from '@/app/api/curated-lists/followed/route';
import { GET as getFollowedFeed } from '@/app/api/curated-lists/feed/route';

jest.mock('@/lib/auth', () => ({ verifyFarcasterSignerAuth: jest.fn(async () => 123) }));
jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));

const request = (path: string) => new NextRequest(`http://localhost${path}`);

describe('curated-list follower ownership', () => {
  it('rejects reading another FID\'s followed lists', async () => {
    const response = await getFollowed(request('/api/curated-lists/followed?fid=456'));
    expect(response.status).toBe(403);
  });

  it('rejects reading another FID\'s followed-list feed', async () => {
    const response = await getFollowedFeed(request('/api/curated-lists/feed?fid=456'));
    expect(response.status).toBe(403);
  });
});
