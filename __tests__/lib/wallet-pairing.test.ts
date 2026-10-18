import { EventEmitter } from 'node:events';
import { subscribePairingUri } from '@/lib/wallet-pairing';

describe('WalletConnect pairing URI subscription', () => {
  it('captures the code before connection approval, updates it, and unsubscribes', () => {
    const provider = new EventEmitter();
    const display = jest.fn();
    const cleanup = subscribePairingUri(provider, display);
    provider.emit('display_uri', 'wc:first@2?relay-protocol=irn&symKey=example');
    provider.emit('display_uri', 'wc:replacement@2');
    expect(display.mock.calls.map(([uri]) => uri)).toEqual([
      'wc:first@2?relay-protocol=irn&symKey=example', 'wc:replacement@2',
    ]);
    cleanup();
    expect(provider.listenerCount('display_uri')).toBe(0);
    provider.emit('display_uri', 'wc:expired@2');
    expect(display).toHaveBeenCalledTimes(2);
  });

  it('rejects incompatible providers and ignores non-pairing values', () => {
    expect(() => subscribePairingUri(undefined, jest.fn())).toThrow('cannot display a pairing code');
    const provider = new EventEmitter();
    const display = jest.fn();
    const cleanup = subscribePairingUri(provider, display);
    provider.emit('display_uri', null);
    provider.emit('display_uri', 'https://example.com');
    expect(display).not.toHaveBeenCalled();
    cleanup();
  });
});
