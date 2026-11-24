import { requestInlineCastAction } from '@/lib/inline-ask-homie';

const cast = { hash: `0x${'a'.repeat(40)}`, text: 'Root opinion', author: { fid: 12, username: 'alice' } };
describe('inline Ask Homie', () => {
  it('loads thread evidence and calls the existing backend with auth and a bounded prompt', async () => {
    const fetcher = jest.fn()
      .mockResolvedValueOnce(Response.json({ ok: true, cast: { ...cast, direct_replies: [{ text: 'A disagreement', author: { username: 'bob' } }], replies: { count: 20 }, replies_next: { cursor: 'more' } } }))
      .mockResolvedValueOnce(Response.json({ response: 'A summary' }));
    await expect(requestInlineCastAction(cast, 'summarize', { 'x-session-token': 'token' }, fetcher)).resolves.toBe('A summary');
    expect(fetcher.mock.calls[0][0]).toBe(`/api/cast?hash=${cast.hash}`);
    const request = fetcher.mock.calls[1];
    expect(request[0]).toBe('/api/ask-homie');
    expect(request[1].headers).toMatchObject({ 'x-session-token': 'token' });
    const body = JSON.parse(request[1].body);
    expect(body.messages[0].content).toContain('A disagreement');
    expect(body.messages[0].content).toContain('partial');
    expect(body.messages[0].content).toContain('untrusted');
    expect(body.castContext.text).toBe('Root opinion');
  });
  it('keeps a draft as a compose request and never calls a publishing endpoint', async () => {
    const fetcher = jest.fn().mockResolvedValueOnce(Response.json({ ok: true, cast }))
      .mockResolvedValueOnce(Response.json({ response: 'Reasoning about the draft', suggestions: ['Thoughtful draft'] }));
    await expect(requestInlineCastAction(cast, 'reply', {}, fetcher)).resolves.toBe('Thoughtful draft');
    expect(JSON.parse(fetcher.mock.calls[1][1].body).intent).toBe('compose');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('surfaces rate limits without hiding the backend message', async () => {
    const fetcher = jest.fn().mockResolvedValueOnce(Response.json({ ok: true, cast }))
      .mockResolvedValueOnce(Response.json({ error: 'Hourly limit reached' }, { status: 429 }));
    await expect(requestInlineCastAction(cast, 'summarize', {}, fetcher)).rejects.toThrow('Hourly limit reached');
  });
  it('does not invent a thread when the thread read fails', async () => {
    const fetcher = jest.fn().mockResolvedValueOnce(Response.json({}, { status: 503 }));
    await expect(requestInlineCastAction(cast, 'summarize', {}, fetcher)).rejects.toThrow('Could not load the thread');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('bounds long evidence below the backend message limit', async () => {
    const fetcher = jest.fn().mockResolvedValueOnce(Response.json({ ok: true, cast: { ...cast, text: 'x'.repeat(30000), direct_replies: Array.from({ length: 100 }, () => ({ text: 'y'.repeat(30000) })) } }))
      .mockResolvedValueOnce(Response.json({ response: 'Summary' }));
    await requestInlineCastAction(cast, 'summarize', {}, fetcher);
    expect(JSON.parse(fetcher.mock.calls[1][1].body).messages[0].content.length).toBeLessThan(20000);
  });
});
