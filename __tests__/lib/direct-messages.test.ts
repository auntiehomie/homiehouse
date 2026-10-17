import { directMessageUrl, FARCASTER_INBOX_URL } from '@/lib/direct-messages';
test('opens the existing Farcaster composer for an exact FID without sending', () => {
  expect(directMessageUrl(3103)).toBe('https://farcaster.xyz/~/inbox/create/3103');
  expect(directMessageUrl('003103')).toBe(`${FARCASTER_INBOX_URL}/create/3103`);
});
test.each(['https://evil.example', '//evil', '3/../../other', '1?text=send', -1, 0, 1.5, '1e3', Number.MAX_SAFE_INTEGER + 1, null, {}, ''])('rejects invalid or injectable recipient %p', value => {
  expect(directMessageUrl(value)).toBeNull();
});
