import type { MiniAppHost, SignInOptions } from '@farcaster/miniapp-core';

type SignInResult = Awaited<ReturnType<MiniAppHost['signIn']>>;

const AUTH_TIMEOUT_MS = 5 * 60 * 1000;
const AUTH_POLL_INTERVAL_MS = 1_000;
const AUTH_RELAY_URL = 'https://relay.farcaster.xyz/v1';

interface AuthChannel {
  channelToken: string;
  url: string;
}

interface AuthStatus {
  state: 'pending' | 'completed';
  fid?: number;
  message?: string;
  signature?: string;
  authMethod?: 'custody' | 'authAddress';
}

async function parseRelayResponse<T>(response: Response): Promise<T> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error('Farcaster sign-in returned an invalid response');
  }

  if (!response.ok) {
    const relayMessage =
      typeof body === 'object' && body && 'error' in body
        ? String((body as { error: unknown }).error)
        : `Farcaster sign-in failed (${response.status})`;
    throw new Error(relayMessage);
  }

  return body as T;
}

async function waitForRelayStatus(channelToken: string): Promise<AuthStatus> {
  const deadline = Date.now() + AUTH_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const response = await fetch(`${AUTH_RELAY_URL}/channel/status`, {
      headers: {
        Authorization: `Bearer ${channelToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 200) {
      return parseRelayResponse<AuthStatus>(response);
    }

    if (response.status !== 202) {
      await parseRelayResponse<AuthStatus>(response);
    }

    await new Promise(resolve => setTimeout(resolve, AUTH_POLL_INTERVAL_MS));
  }

  throw new Error('Farcaster sign-in timed out');
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
  requestApproval,
}: {
  miniAppUrl: string;
  expectedFid: number;
  options: SignInOptions;
  requestApproval: (url: string, domain: string) => Promise<void>;
}): Promise<SignInResult> {
  if (!expectedFid) {
    throw new Error('Sign in to HomieHouse before signing in to a Mini App');
  }

  const { domain, siweUri } = getMiniAppIdentity(miniAppUrl);
  const channelResponse = await fetch(`${AUTH_RELAY_URL}/channel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domain,
      siweUri,
      nonce: options.nonce,
      notBefore: options.notBefore,
      expirationTime: options.expirationTime,
      acceptAuthAddress: options.acceptAuthAddress ?? true,
    }),
  });
  const channel = await parseRelayResponse<AuthChannel>(channelResponse);
  if (!channel.channelToken || !channel.url) {
    throw new Error('Farcaster sign-in did not return an approval channel');
  }

  await requestApproval(channel.url, domain);
  const result = await waitForRelayStatus(channel.channelToken);
  if (
    result.state !== 'completed' ||
    !result.message ||
    !result.signature ||
    !result.authMethod ||
    !result.fid
  ) {
    throw new Error('Farcaster sign-in did not return a valid signature');
  }

  if (result.fid !== expectedFid) {
    throw new Error(
      `Approve with the same Farcaster account used in HomieHouse (FID ${expectedFid})`,
    );
  }

  return {
    message: result.message,
    signature: result.signature,
    authMethod: result.authMethod,
  };
}
