import { createMessage, encodeToken } from '@farcasterorg/quick-auth/token';
import { privateKeyToAccount } from 'viem/accounts';
import {
  createHypersnapProtocolAuthClient,
  getHomieHouseAuthDomain,
} from '@/lib/hypersnap-protocol-auth';

describe('Hypersnap protocol auth', () => {
  const account = privateKeyToAccount(`0x${'11'.repeat(32)}`);

  afterEach(() => {
    delete process.env.HOMIEHOUSE_AUTH_DOMAIN;
    delete process.env.NEXT_PUBLIC_BASE_URL;
    delete process.env.NEXT_PUBLIC_HYPERSNAP_URL;
  });

  async function makeToken(domain = 'homiehouse.app') {
    const message = createMessage({
      domain,
      address: account.address,
      chainId: 1,
      fid: 42,
      nonce: 'testnonce123',
    });
    const signature = await account.signMessage({ message });
    return encodeToken({ message, signature });
  }

  it('uses the configured canonical app host for token audience checks', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://homiehouse.app/path';
    expect(getHomieHouseAuthDomain()).toBe('homiehouse.app');

    process.env.HOMIEHOUSE_AUTH_DOMAIN = 'preview-homiehouse.vercel.app';
    expect(getHomieHouseAuthDomain()).toBe('preview-homiehouse.vercel.app');
  });

  it('verifies a signed token against the configured Hypersnap Hub API', async () => {
    const fetcher = jest.fn(async (input: RequestInfo | URL) => {
      expect(new URL(String(input)).origin).toBe('https://snap.example');
      expect(new URL(String(input)).pathname).toBe('/v1/fidAddressType');
      return new Response(
        JSON.stringify({ is_custody: true, is_verified: false }),
        { status: 200 },
      );
    });
    const client = createHypersnapProtocolAuthClient({
      hubUrl: 'https://snap.example',
      fetch: fetcher as typeof fetch,
    });

    const payload = await client.verifyToken({
      token: await makeToken(),
      domain: 'homiehouse.app',
    });
    expect(payload).toMatchObject({
      sub: 42,
      address: account.address,
      method: 'custody',
      aud: 'homiehouse.app',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects the same signed token for a different domain before querying the Hub', async () => {
    const fetcher = jest.fn();
    const client = createHypersnapProtocolAuthClient({
      hubUrl: 'https://snap.example',
      fetch: fetcher as typeof fetch,
    });

    await expect(
      client.verifyToken({
        token: await makeToken(),
        domain: 'attacker.example',
      }),
    ).rejects.toThrow('token is for homiehouse.app, not attacker.example');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not accept classic Quick Auth JWTs in this Hypersnap-only path', async () => {
    const client = createHypersnapProtocolAuthClient({
      hubUrl: 'https://snap.example',
      fetch: jest.fn() as typeof fetch,
    });

    await expect(
      client.verifyToken({
        token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MiJ9.signature',
        domain: 'homiehouse.app',
      }),
    ).rejects.toThrow('not a protocol Quick Auth token');
  });
});
