import { profileApiUrl, profileHref } from '@/lib/profile-links';

describe('profile links', () => {
  it('routes mini app profile actions by FID', () => {
    expect(profileHref({ fid: 3103 })).toBe('/profile?fid=3103');
  });

  it('keeps username profile links readable and encoded', () => {
    expect(profileHref({ username: '@alice.eth', fid: 3103 })).toBe('/profile?user=alice.eth');
    expect(profileHref({ username: 'alice smith' })).toBe('/profile?user=alice%20smith');
  });

  it('loads numeric legacy user links by FID instead of username', () => {
    expect(profileApiUrl({ fid: null, user: '3103' })).toBe('/api/profile?fid=3103&casts=true');
  });

  it('loads username links and gives an explicit FID precedence', () => {
    expect(profileApiUrl({ fid: null, user: 'alice.eth' })).toBe('/api/profile?username=alice.eth&casts=true');
    expect(profileApiUrl({ fid: '3103', user: 'alice.eth' })).toBe('/api/profile?fid=3103&casts=true');
  });

  it('rejects empty or invalid identifiers', () => {
    expect(profileHref({ fid: 0 })).toBe('/profile');
    expect(profileApiUrl({ fid: null, user: null })).toBeNull();
    expect(profileApiUrl({ fid: 'invalid', user: null })).toBe('/api/profile?fid=invalid&casts=true');
  });
});
