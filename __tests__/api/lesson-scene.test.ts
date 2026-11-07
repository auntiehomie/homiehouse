import { NextRequest } from 'next/server';
import { POST } from '@/app/api/lesson-scene/route';
import { llmChat } from '@/lib/llm';

jest.mock('@/lib/llm', () => ({ llmChat: jest.fn() }));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => ({ success: true })) }));

const sentence = 'Independent nodes share control.';
const request = (text: string) => new NextRequest('http://localhost/api/lesson-scene', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });

describe('animation-only backfill', () => {
  it('returns a validated plan for the original text', async () => {
    const plan = { source: sentence, layout: 'network', labels: ['Independent nodes', 'control'] };
    (llmChat as jest.Mock).mockResolvedValueOnce({ message: { content: JSON.stringify(plan) } });
    const result = await POST(request(sentence));
    expect(await result.json()).toEqual({ plan });
  });
  it('rejects labels that are not in the lesson text', async () => {
    (llmChat as jest.Mock).mockResolvedValueOnce({ message: { content: JSON.stringify({ source: sentence, layout: 'network', labels: ['Independent nodes', 'central owner'] }) } });
    expect(await (await POST(request(sentence))).json()).toEqual({ plan: null });
  });
});
