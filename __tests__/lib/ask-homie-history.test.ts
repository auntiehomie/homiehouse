import { chatHistoryKey, loadChatSnapshot, saveChatSnapshot } from '@/lib/ask-homie-history';

describe('Ask Homie conversation restoration', () => {
  beforeAll(() => {
    Object.defineProperty(global, 'window', { value: {}, configurable: true });
    Object.defineProperty(global, 'localStorage', { value: { getItem: () => null, setItem: () => { throw new Error('quota'); } }, configurable: true });
  });
  afterAll(() => { Reflect.deleteProperty(global, 'window'); Reflect.deleteProperty(global, 'localStorage'); });
  it('preserves question, answer, draft and mode when storage writes fail', () => {
    const key = chatHistoryKey('fid_321', 'cast-a');
    const snapshot = { messages: [{ role: 'user' as const, content: 'my search' }, { role: 'assistant' as const, content: 'my results' }], input: 'follow-up', mode: 'research', timestamp: Date.now() };
    saveChatSnapshot(key, snapshot);
    expect(loadChatSnapshot(key)).toEqual(snapshot);
    expect(loadChatSnapshot(chatHistoryKey('fid_456', 'cast-a'))).toBeNull();
    expect(loadChatSnapshot(chatHistoryKey('fid_321', 'cast-b'))).toBeNull();
  });
  it('does not restore expired conversations', () => {
    const key = chatHistoryKey('expired');
    saveChatSnapshot(key, { messages: [], input: '', mode: 'auto', timestamp: Date.now() - 25 * 3600000 });
    expect(loadChatSnapshot(key)).toBeNull();
  });
});
