import { generateConversationLearning } from '@/lib/ai/conversation-learning';
import { conversationLearningUrl } from '@/lib/conversation-learning';
import { llmChat } from '@/lib/llm';
import { fetchCast } from '@/lib/hypersnap';
import { getRelevantKBArticles } from '@/lib/kb-sync';

jest.mock('@/lib/llm', () => ({ llmChat: jest.fn() }));
jest.mock('@/lib/hypersnap', () => ({ fetchCast: jest.fn() }));
jest.mock('@/lib/kb-sync', () => ({ getRelevantKBArticles: jest.fn(), formatKBContext: jest.fn(() => 'Background about encryption') }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(llmChat).mockResolvedValue({ message: { content: '# Encryption lesson' }, provider: 'fixture' } as any);
  jest.mocked(getRelevantKBArticles).mockResolvedValue([]);
});

test('learns the chosen topic using canonical thread context and prior discussion', async () => {
  jest.mocked(fetchCast).mockResolvedValue({ cast: {
    text: 'Keys protect messages', author: { username: 'alice' },
    parent_chain: [{ text: 'What does private mean?' }],
    direct_replies: [{ text: 'What about recovery?' }],
  } } as any);
  const result = await generateConversationLearning({
    mode: 'lesson', topic: 'Key recovery', castContext: { hash: '0x' + 'a'.repeat(40), text: 'old excerpt' },
    messages: [{ role: 'assistant', content: 'Keys stay on devices.' }, { role: 'user', content: 'Teach me about recovery.' }],
  });
  const call = jest.mocked(llmChat).mock.calls[0][0];
  expect(call.messages[0].content).toContain('5–10 minute lesson');
  expect(call.messages[0].content).toContain('untrusted data');
  expect(call.messages[1].content).toContain('What about recovery?');
  expect(call.messages[1].content).toContain('Keys stay on devices.');
  expect(call.messages[1].content).toContain('Key recovery');
  expect(call.messages[1].content).not.toContain('old excerpt');
  expect(result.metadata).toMatchObject({ contextSource: 'Hypersnap', liveWebVerified: false });
});

test('keeps the visible excerpt on node failure and exposes only supporting HTTPS sources', async () => {
  jest.mocked(fetchCast).mockRejectedValue(new Error('node unavailable'));
  jest.mocked(getRelevantKBArticles).mockResolvedValue([
    { title: 'Encryption', url: 'https://example.com/encryption', summary: 'How it works' },
    { title: 'Unsafe', url: 'javascript:alert(1)', summary: 'bad link' },
    { title: 'Empty', url: 'https://example.com/empty', summary: null },
  ] as any);
  const result = await generateConversationLearning({ mode: 'explain', messages: [{ role: 'user', content: 'Explain this' }],
    castContext: { hash: 'b'.repeat(40), text: 'Visible excerpt' } });
  expect(result.metadata.contextSource).toBe('provided-excerpt');
  expect(result.metadata.sources).toEqual([{ title: 'Encryption', url: 'https://example.com/encryption' }]);
  expect(jest.mocked(llmChat).mock.calls[0][0].messages[1].content).toContain('Visible excerpt');
});

test('rejects empty generation instead of presenting a fabricated lesson', async () => {
  jest.mocked(llmChat).mockResolvedValue({ message: { content: '' } } as any);
  await expect(generateConversationLearning({ mode: 'lesson', messages: [{ role: 'user', content: 'Encryption' }] })).rejects.toThrow('empty response');
});

test('carries percent signs, Unicode and question marks through a learning link without double decoding', () => {
  const cast = { text: '100% private? 🔑', hash: 'abc', author: { username: 'alice' } };
  const url = new URL(conversationLearningUrl(cast, 'explain'), 'https://homiehouse.app');
  expect(JSON.parse(url.searchParams.get('cast')!)).toEqual(cast);
  expect(url.searchParams.get('learning')).toBe('explain');
});
