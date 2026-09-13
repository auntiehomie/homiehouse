import { getMiniAppIdentity, signInToMiniApp } from '@/lib/miniapp-auth';

describe('getMiniAppIdentity', () => {
  it('uses the Mini App host and origin for SIWF', () => {
    expect(
      getMiniAppIdentity('https://pro.framedl.xyz/daily?ref=homiehouse'),
    ).toEqual({
      domain: 'pro.framedl.xyz',
      siweUri: 'https://pro.framedl.xyz',
    });
  });

  it('preserves a non-default port in the SIWF domain', () => {
    expect(getMiniAppIdentity('https://example.com:8443/app')).toEqual({
      domain: 'example.com:8443',
      siweUri: 'https://example.com:8443',
    });
  });

  it('rejects insecure remote Mini Apps', () => {
    expect(() => getMiniAppIdentity('http://example.com/app')).toThrow(
      'Mini Apps must use HTTPS',
    );
  });

  it('allows localhost for development', () => {
    expect(getMiniAppIdentity('http://localhost:3001/app')).toEqual({
      domain: 'localhost:3001',
      siweUri: 'http://localhost:3001',
    });
  });
});

describe('signInToMiniApp', () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
        channelToken: 'channel-token',
        url: 'https://farcaster.xyz/auth/example',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          state: 'completed',
          fid: 123,
          message: 'example.com wants you to sign in',
          signature: '0xabc',
          authMethod: 'custody',
        }),
      });
  });

  it('returns a SIWF signature only for the HomieHouse user', async () => {
    const requestApproval = jest.fn().mockResolvedValue(undefined);

    await expect(
      signInToMiniApp({
        miniAppUrl: 'https://example.com/play',
        expectedFid: 123,
        options: { nonce: 'valid-nonce' },
        requestApproval,
      }),
    ).resolves.toEqual({
      message: 'example.com wants you to sign in',
      signature: '0xabc',
      authMethod: 'custody',
    });

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://relay.farcaster.xyz/v1/channel',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"domain":"example.com"'),
      }),
    );
    expect(requestApproval).toHaveBeenCalledWith(
      'https://farcaster.xyz/auth/example',
      'example.com',
    );
  });

  it('rejects approval from a different Farcaster account', async () => {
    mockFetch.mockReset();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          channelToken: 'channel-token',
          url: 'https://farcaster.xyz/auth/example',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
        state: 'completed',
        fid: 999,
        message: 'message',
        signature: '0xabc',
        authMethod: 'authAddress',
        }),
      });

    await expect(
      signInToMiniApp({
        miniAppUrl: 'https://example.com',
        expectedFid: 123,
        options: { nonce: 'valid-nonce' },
        requestApproval: async () => undefined,
      }),
    ).rejects.toThrow('same Farcaster account used in HomieHouse');
  });
});
