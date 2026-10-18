import type { MiniAppHost, SignInOptions } from '@farcaster/miniapp-core';

type SignInResult = Awaited<ReturnType<MiniAppHost['signIn']>>;

export type MiniAppAuthMethod = 'custody' | 'authAddress';

export interface MiniAppWalletAuthorization {
  address: `0x${string}`;
  authMethod: MiniAppAuthMethod;
  signMessage: (message: string) => Promise<`0x${string}`>;
}

export function getMiniAppIdentity(url: string): {
  domain: string;
  siweUri: string;
} {
  const parsed = new URL(url);
  const isLocalDevelopment =
    parsed.protocol === 'http:' &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');

  if (parsed.protocol !== 'https:' && !isLocalDevelopment) {
    throw new Error('Mini Apps must use HTTPS');
  }

  return {
    domain: parsed.host,
    siweUri: parsed.origin,
  };
}

export async function signInToMiniApp({
  miniAppUrl,
  expectedFid,
  options,
  address,
  authMethod,
  signMessage,
}: {
  miniAppUrl: string;
  expectedFid: number;
  options: SignInOptions;
} & MiniAppWalletAuthorization): Promise<SignInResult> {
  if (!expectedFid) {
    throw new Error('Sign in to HomieHouse before signing in to a Mini App');
  }

  if (authMethod === 'authAddress' && options.acceptAuthAddress === false) {
    throw new Error('This Mini App does not accept an Auth Address signature');
  }

  if (!/^[a-zA-Z0-9]{8,}$/.test(options.nonce)) {
    throw new Error('Mini App sign-in requires a nonce of at least 8 letters or numbers');
  }

  const { domain, siweUri } = getMiniAppIdentity(miniAppUrl);
  const issuedAt = new Date();
  const fields = [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    '',
    'Farcaster Auth',
    '',
    `URI: ${siweUri}`,
    'Version: 1',
    'Chain ID: 10',
    `Nonce: ${options.nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
  ];
  if (options.expirationTime) fields.push(`Expiration Time: ${options.expirationTime}`);
  if (options.notBefore) fields.push(`Not Before: ${options.notBefore}`);
  fields.push('', 'Resources:', `- farcaster://fids/${expectedFid}`);

  const message = fields.join('\n');
  const signature = await signMessage(message);

  return { message, signature, authMethod };
}
