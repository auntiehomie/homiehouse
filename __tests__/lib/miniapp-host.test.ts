import { exposeToIframe } from '@farcaster/miniapp-host';
import { createMiniAppHost, type MiniAppHostConfig } from '@/lib/miniapp';

jest.mock('@farcaster/miniapp-host', () => ({
  exposeToIframe: jest.fn(() => ({
    endpoint: { emit: jest.fn() },
    cleanup: jest.fn(),
  })),
}));

describe('embedded Mini App host sign-in lifecycle', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads the authenticated FID after session restoration without remounting', async () => {
    const authorizeSignIn = jest.fn(async () => ({
      message: 'Signed in',
      signature: '0x123' as const,
      authMethod: 'custody' as const,
    }));
    let config: MiniAppHostConfig = {
      context: { user: { fid: 0 } },
      authorizeSignIn,
    };
    const host = createMiniAppHost(() => config);
    host.mountMiniApp({} as HTMLIFrameElement, 'https://framedl.com/play');

    const sdk = (exposeToIframe as jest.Mock).mock.calls[0][0].sdk;
    expect(sdk.context.user.fid).toBe(0);
    config = { context: { user: { fid: 1234 } }, authorizeSignIn };

    expect(sdk.context.user.fid).toBe(1234);
    const result = await sdk.signIn({ nonce: 'validnonce123' });
    expect(result.signature).toBe('0x123');
    expect(authorizeSignIn).toHaveBeenCalledWith({
      miniAppUrl: 'https://framedl.com',
      expectedFid: 1234,
      options: { nonce: 'validnonce123' },
    });
    expect(exposeToIframe).toHaveBeenCalledTimes(1);
  });

  it('uses the refreshed signing callback after the wallet reconnects', async () => {
    const previous = jest.fn();
    const next = jest.fn(async () => ({
      message: 'Updated wallet signature',
      signature: '0xabc' as const,
      authMethod: 'authAddress' as const,
    }));
    let config: MiniAppHostConfig = {
      context: { user: { fid: 42 } },
      authorizeSignIn: previous,
    };
    const host = createMiniAppHost(() => config);
    host.mountMiniApp({} as HTMLIFrameElement, 'https://example.com/mini');
    const sdk = (exposeToIframe as jest.Mock).mock.calls[0][0].sdk;

    config = { context: { user: { fid: 42 } }, authorizeSignIn: next };
    const result = await sdk.signIn({ nonce: 'freshnonce123' });
    expect(result.authMethod).toBe('authAddress');
    expect(previous).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
