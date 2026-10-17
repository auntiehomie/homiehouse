import { AUTOMATED_SPAM_FILTERING, DEFAULT_MEMBER_FEED, unseenCastCount } from '@/lib/feed-policy';
import { getOpenRankScores, isSpamAccount } from '@/lib/openrank';

it('temporarily skips all reputation lookups and filtering, including zero-follower accounts', async () => {
  global.fetch = jest.fn();
  expect(AUTOMATED_SPAM_FILTERING).toBe(false);
  expect(isSpamAccount(123, new Map([[123, 0]]), { follower_count: 0 })).toBe(false);
  expect(await getOpenRankScores([123, 456])).toEqual(new Map([[123, 1], [456, 1]]));
  expect(fetch).not.toHaveBeenCalled();
});
it('defaults members to Following and counts unseen cast hashes once', () => {
  expect(DEFAULT_MEMBER_FEED).toBe('following');
  expect(unseenCastCount([{ hash: 'old' }], [{ hash: 'old' }, { hash: 'new' }, { hash: 'new' }, {}])).toBe(1);
});
