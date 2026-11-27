import {
  createClient,
  HubError,
  InvalidTokenError,
  type CreateClientOptions,
} from "@farcasterorg/quick-auth";
import { AuthError } from "@/lib/errors";
import {
  fetchFromHypersnapNodes,
  getHypersnapNodes,
} from "@/lib/hypersnap-nodes";

const DEFAULT_HYPERSNAP_URL = "https://haatz.quilibrium.com";

/** Per-node timeout for auth lookups; a slow node fails over instead of stalling sign-in. */
const AUTH_NODE_TIMEOUT_MS = 6_000;

/**
 * fetch() for the quick-auth hub client that walks the same node list as the
 * rest of the server (personal → configured → haatz) with a short per-node
 * timeout. Without this, the library talks to a single node with a 30s
 * timeout per request, and one wallet lookup makes up to five sequential
 * requests — so a slow node left the sign-in modal spinning for minutes.
 */
const failoverFetch: typeof fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  // The library's own AbortSignal is a 30s cap; per-node timeouts replace it.
  const { signal: _librarySignal, ...rest } = init ?? {};
  const { response } = await fetchFromHypersnapNodes(
    `${url.pathname}${url.search}`,
    {
      ...rest,
      timeoutMs: AUTH_NODE_TIMEOUT_MS,
      label: "protocol-auth",
    },
  );
  return response;
};

function hostname(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).host;
  } catch {
    return null;
  }
}

/** Resolve the SIWE domain while allowing only configured deployment hosts. */
export function getHomieHouseAuthDomain(requestHost?: string): string {
  const explicitDomain = process.env.HOMIEHOUSE_AUTH_DOMAIN?.trim();
  const baseUrl =
    explicitDomain ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://homiehouse.app";
  const productionDomain = hostname(baseUrl);
  if (!productionDomain)
    throw new Error("NEXT_PUBLIC_BASE_URL must be a valid absolute URL");

  if (requestHost) {
    const allowedHosts = new Set(
      [
        productionDomain,
        hostname(process.env.VERCEL_URL),
        hostname(process.env.VERCEL_BRANCH_URL),
        hostname(process.env.VERCEL_PROJECT_PRODUCTION_URL),
      ].filter((host): host is string => Boolean(host)),
    );
    if (process.env.NODE_ENV !== "production") allowedHosts.add(requestHost);
    if (allowedHosts.has(requestHost)) return requestHost;
  }

  return productionDomain;
}

/**
 * Construct a verifier that accepts only wallet-signed protocol tokens.
 * Disabling classic JWTs here ensures this session flow does not fall back to
 * auth.farcaster.xyz; all FID/address checks are made against Hypersnap.
 */
export function createHypersnapProtocolAuthClient(
  overrides: Partial<CreateClientOptions> = {},
) {
  // hubUrl only seeds URL construction; failoverFetch picks the real node.
  const hubUrl = getHypersnapNodes()[0]?.url || DEFAULT_HYPERSNAP_URL;
  return createClient({
    hubUrl,
    fetch: failoverFetch,
    timeoutMs: 30_000,
    acceptQuickAuthJwt: false,
    linkCacheTtl: 30,
    ...overrides,
  });
}

const protocolAuthClient = createHypersnapProtocolAuthClient();

export async function verifyHypersnapProtocolToken(
  token: string,
  domain = getHomieHouseAuthDomain(),
): Promise<{
  fid: number;
  address: string;
  method: string;
  expiresAt: number;
}> {
  try {
    const payload = await protocolAuthClient.verifyToken({ token, domain });
    if (payload.method === "quickAuthServer") {
      throw new InvalidTokenError(
        "Classic Quick Auth JWTs are not accepted here",
      );
    }
    return {
      fid: payload.sub,
      address: payload.address,
      method: payload.method,
      expiresAt: payload.exp * 1000,
    };
  } catch (error) {
    if (error instanceof HubError) {
      throw new AuthError(
        "Hypersnap could not verify the account right now. Please retry.",
        503,
        "HYPERSNAP_AUTH_UNAVAILABLE",
      );
    }
    if (error instanceof InvalidTokenError) {
      throw new AuthError(
        "Invalid or expired Hypersnap login token",
        401,
        "INVALID_PROTOCOL_TOKEN",
      );
    }
    throw error;
  }
}
