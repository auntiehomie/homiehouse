const query = jest.fn();
jest.mock('@/lib/db', () => ({ getDb: () => ({ query }) }));

import { recordReplyBatch } from '@/lib/bot-reply-storage';

describe('bot reply storage', () => {
  beforeEach(() => {
    query.mockReset();
    query.mockResolvedValue({ rows: [] });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('relaxes NOT NULL on legacy columns, including whitespace-named ones', async () => {
    await recordReplyBatch({ trackingKeys: ['0xabc'], replyHash: 'pending' });
    const repair = query.mock.calls.map(([sql]) => String(sql)).find((sql) => sql.includes('information_schema.columns'));
    expect(repair).toBeDefined();
    expect(repair).toContain("is_nullable = 'NO'");
    expect(repair).toContain("NOT IN ('id', 'created_at')");
    // %I quotes identifiers, so a column named "    parent_hash" is altered correctly.
    expect(repair).toContain('ALTER COLUMN %I DROP NOT NULL');
  });

  it('returns true when every tracking key is stored', async () => {
    await expect(recordReplyBatch({ trackingKeys: ['a', 'b'], replyHash: 'pending' })).resolves.toBe(true);
  });

  it('returns false when an insert fails, so the pending lock is not assumed', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('INSERT')) {
        throw Object.assign(new Error('null value in column "    parent_hash"'), { code: '23502' });
      }
      return { rows: [] };
    });
    await expect(recordReplyBatch({ trackingKeys: ['a', 'b'], replyHash: 'pending' })).resolves.toBe(false);
  });

  it('returns false when there are no usable tracking keys', async () => {
    await expect(recordReplyBatch({ trackingKeys: ['', '  '], replyHash: 'pending' })).resolves.toBe(false);
  });
});
