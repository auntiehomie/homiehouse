import { LocalPreviewDirectMessageTransport } from '@/lib/direct-message-prototype';

describe('LocalPreviewDirectMessageTransport', () => {
  it('makes sent messages visible from both demo accounts', () => {
    const transport = new LocalPreviewDirectMessageTransport(() => 100);
    const sent = transport.sendMessage({
      senderId: 'demo-account-a',
      recipientId: 'demo-account-b',
      text: 'Hello from the preview',
    });

    expect(sent.text).toBe('Hello from the preview');
    expect(transport.listMessages('demo-account-a', 'demo-account-b')).toEqual([sent]);
    expect(transport.listMessages('demo-account-b', 'demo-account-a')).toEqual([sent]);
  });

  it('trims input and rejects blank, oversized, or self-directed messages', () => {
    const transport = new LocalPreviewDirectMessageTransport();

    expect(transport.sendMessage({ senderId: 'demo-account-a', recipientId: 'demo-account-b', text: '  hello  ' }).text).toBe('hello');
    expect(() => transport.sendMessage({ senderId: 'demo-account-a', recipientId: 'demo-account-b', text: '  ' })).toThrow('Message cannot be empty.');
    expect(() => transport.sendMessage({ senderId: 'demo-account-a', recipientId: 'demo-account-b', text: 'x'.repeat(501) })).toThrow('500 characters');
    expect(() => transport.sendMessage({ senderId: 'demo-account-a', recipientId: 'demo-account-a', text: 'hello' })).toThrow('other demo account');
  });

  it('keeps messages in memory only and returns defensive copies', () => {
    const transport = new LocalPreviewDirectMessageTransport(() => 100);
    const sent = transport.sendMessage({ senderId: 'demo-account-a', recipientId: 'demo-account-b', text: 'hello' });
    sent.text = 'changed by caller';

    expect(transport.listMessages('demo-account-a', 'demo-account-b')[0].text).toBe('hello');
    expect(new LocalPreviewDirectMessageTransport().listMessages('demo-account-a', 'demo-account-b')).toEqual([]);
  });
});
