import { buildCastSearchQueries, formatLiveCastContext, liveCastSearchMetadata, requiresLiveCastEvidence, searchRelevantCasts, shouldSearchLiveCasts } from '@/lib/ai/cast-research';

var mockSearchCasts = jest.fn();
var mockGetCastsByUsername = jest.fn();

jest.mock('@/lib/hypersnap', () => ({
  searchCasts: (...args: unknown[]) => mockSearchCasts(...args),
  getCastsByUsername: (...args: unknown[]) => mockGetCastsByUsername(...args),
}));

describe('Ask Homie live cast research', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchCasts.mockResolvedValue({ casts: [] });
    mockGetCastsByUsername.mockResolvedValue({ casts: [] });
  });

  it('recognizes current Farcaster research in auto mode', () => {
    expect(shouldSearchLiveCasts('What are the recent Farcaster discussions?', 'auto')).toBe(true);
    expect(shouldSearchLiveCasts('Can you help me write a birthday cast?', 'compose')).toBe(false);
    expect(shouldSearchLiveCasts('Tell me about crypto', 'research')).toBe(true);
  });

  it('creates focused queries for Network School acquisition questions', () => {
    const queries = buildCastSearchQueries('Did Farcaster get sold to NetworkSchool?');

    expect(queries).toContain('Farcaster Network School');
    expect(queries).toContain('Farcaster acquisition');
  });

  it('falls back to a broad cast query when the question contains only generic wording', () => {
    expect(buildCastSearchQueries('Based on what I know, it looks like Ask Homie has not been able to read Farcaster casts.'))
      .toContain('Farcaster casts');
  });

  it('identifies current-event questions that require retrieved evidence', () => {
    expect(requiresLiveCastEvidence('Did Farcaster get sold recently?')).toBe(true);
    expect(requiresLiveCastEvidence('What is a cast?')).toBe(false);
  });

  it('retrieves a mentioned user’s casts instead of relying on model-emitted tool calls', async () => {
    mockGetCastsByUsername.mockResolvedValueOnce({
      casts: [{ hash: '0xabc', text: 'A recent post', author: { username: 'alice', fid: 1 } }],
    });

    const result = await searchRelevantCasts('What has @alice posted recently?');

    expect(mockGetCastsByUsername).toHaveBeenCalledWith('alice', 5);
    expect(result.casts).toEqual([expect.objectContaining({ username: 'alice', text: 'A recent post' })]);
  });

  it('warns that an empty result is not proof of absence', () => {
    const context = formatLiveCastContext({ queries: ['farcaster'], casts: [] });

    expect(context).toContain('No matching casts were returned');
    expect(context).toContain('not evidence that the topic or event is false or absent');
  });
});

it('searches ordinary topic questions in learn, analyze and auto modes', () => {
  for (const intent of ['auto', 'learn', 'analyze']) {
    expect(shouldSearchLiveCasts('Explain creator coins on Zora', intent)).toBe(true);
  }
  expect(shouldSearchLiveCasts('Hi', 'auto')).toBe(false);
});

it('removes explanation boilerplate and retries a shorter Network School query', () => {
  const queries = buildCastSearchQueries('Explain What is the point of the Network School Takeover of Farcaster? Can you find related casts? in plain English.');
  expect(queries).toContain('Network School');
  expect(queries.join(' ')).not.toMatch(/english|explain|related/);
});

it('links only valid cast hashes and normalizes hashes without a prefix', () => {
  const meta = liveCastSearchMetadata({ queries: ['zora'], casts: [
    { hash: 'a'.repeat(40), text: 'A post', username: 'alice' },
    { hash: 'javascript:bad', text: 'Another post', username: 'bob' },
  ] });
  expect(meta.citations).toHaveLength(1);
  expect(meta.citations[0].url).toBe('/cast/0x' + 'a'.repeat(40));
});
