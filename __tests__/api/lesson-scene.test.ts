import { NextRequest } from 'next/server';
import { POST } from '@/app/api/lesson-scene/route';
import { llmChat } from '@/lib/llm';
import { storyboardForText } from '@/lib/lesson-storyboard';

jest.mock('@/lib/llm', () => ({ llmChat: jest.fn() }));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => ({ success: true })) }));

const text = 'The cost of attacking the chain exceeds the reward. This illustrates economic incentives.';
const request = () => new NextRequest('http://localhost/api/lesson-scene', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
const plan = { ...storyboardForText('The cost of attacking exceeds the reward.')!, source: text };

it('backfills a timed animation for the entire existing card', async () => {
  jest.mocked(llmChat).mockResolvedValueOnce({ message: { content: JSON.stringify(plan) } } as never);
  expect(await (await POST(request())).json()).toEqual({ plan });
  expect(jest.mocked(llmChat).mock.calls.at(-1)![0].messages[0].content).toContain(JSON.stringify(text));
});

it('can supply the exact source when the model omits it', async () => {
  const { source: _source, ...withoutSource } = plan;
  jest.mocked(llmChat).mockResolvedValueOnce({ message: { content: JSON.stringify(withoutSource) } } as never);
  expect(await (await POST(request())).json()).toEqual({ plan });
});

it('rejects another card source instead of relabeling it', async () => {
  jest.mocked(llmChat).mockResolvedValueOnce({ message: { content: JSON.stringify({ ...plan, source: 'Some unrelated lesson.' }) } } as never);
  expect(await (await POST(request())).json()).toEqual({ plan: null });
});

it('rejects the old comparison of static labels', async () => {
  jest.mocked(llmChat).mockResolvedValueOnce({ message: { content: JSON.stringify({ source: text, layout: 'comparison', labels: ['cost', 'reward'] }) } } as never);
  expect(await (await POST(request())).json()).toEqual({ plan: null });
});
