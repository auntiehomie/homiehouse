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
  const signMessage = jest.fn();
  const identity = {
    address: '0x1234567890123456789012345678901234567890' as const,
    authMethod: 'custody' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    signMessage.mockResolvedValue('0xsignature');
  });

  it('wallet-signs a domain-bound SIWF message for the authenticated FID', async () => {
    const result = await signInToMiniApp({
      miniAppUrl: 'https://example.com/play',
      expectedFid: 123,
      options: { nonce: 'validnonce123' },
      ...identity,
      signMessage,
    });

    expect(result).toEqual({
      message: expect.stringContaining('Farcaster Auth'),
      signature: '0xsignature',
      authMethod: 'custody',
    });
    expect(result.message).toContain('example.com wants you to sign in with your Ethereum account:');
    expect(result.message).toContain(identity.address);
    expect(result.message).toContain('URI: https://example.com');
    expect(result.message).toContain('Chain ID: 10');
    expect(result.message).toContain('Nonce: validnonce123');
    expect(result.message).toContain('- farcaster://fids/123');
    expect(signMessage).toHaveBeenCalledWith(result.message);
  });

  it('includes the Mini App requested validity window', async () => {
    const result = await signInToMiniApp({
      miniAppUrl: 'https://example.com',
      expectedFid: 123,
      options: {
        nonce: 'miniapptime123',
        notBefore: '2026-10-18T12:00:00.000Z',
        expirationTime: '2026-10-18T12:15:00.000Z',
      },
      ...identity,
      signMessage,
    });

    expect(result.message).toContain('Expiration Time: 2026-10-18T12:15:00.000Z');
    expect(result.message).toContain('Not Before: 2026-10-18T12:00:00.000Z');
    expect(result.message.indexOf('Expiration Time')).toBeLessThan(result.message.indexOf('Not Before'));
  });

  it('rejects Auth Address signatures when the Mini App disallows them', async () => {
    await expect(signInToMiniApp({
      miniAppUrl: 'https://example.com',
      expectedFid: 123,
      options: { nonce: 'validnonce123', acceptAuthAddress: false },
      ...identity,
      authMethod: 'authAddress',
      signMessage,
    })).rejects.toThrow('does not accept an Auth Address signature');
    expect(signMessage).not.toHaveBeenCalled();
  });

  it('requires a valid Mini App nonce and signed-in FID', async () => {
    await expect(signInToMiniApp({
      miniAppUrl: 'https://example.com',
      expectedFid: 0,
      options: { nonce: 'validnonce123' },
      ...identity,
      signMessage,
    })).rejects.toThrow('Sign in to HomieHouse');

    await expect(signInToMiniApp({
      miniAppUrl: 'https://example.com',
      expectedFid: 123,
      options: { nonce: 'short' },
      ...identity,
      signMessage,
    })).rejects.toThrow('nonce of at least 8');
    expect(signMessage).not.toHaveBeenCalled();
  });
});
