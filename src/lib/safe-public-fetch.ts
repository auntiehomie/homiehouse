import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';

type ResolvedAddress = { address: string; family: 4 | 6 };

export interface SafeFetchOptions {
  method?: 'GET' | 'POST';
  headers?: HeadersInit;
  body?: string | Uint8Array;
  maxBytes?: number;
  maxRedirects?: number;
  timeoutMs?: number;
}

const IPV4_DENY_CIDRS = [
  '0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8',
  '169.254.0.0/16', '172.16.0.0/12', '192.0.0.0/24', '192.0.2.0/24',
  '192.88.99.0/24', '192.168.0.0/16', '198.18.0.0/15', '198.51.100.0/24',
  '203.0.113.0/24', '224.0.0.0/4', '240.0.0.0/4',
].map(parseCidr);

function parseCidr(value: string): { network: bigint; bits: number; family: number } {
  const [address, prefix] = value.split('/');
  const family = isIP(address);
  const bits = Number(prefix);
  const width = family === 4 ? 32 : 128;
  const numeric = family === 4 ? ipv4ToBigInt(address) : ipv6ToBigInt(address);
  return { network: numeric >> BigInt(width - bits), bits, family };
}

function ipv4ToBigInt(address: string): bigint {
  return address.split('.').reduce((result, part) => (result << 8n) | BigInt(Number(part)), 0n);
}

function ipv6ToBigInt(address: string): bigint {
  let input = address.toLowerCase().split('%')[0];
  if (input.includes('.')) {
    const lastColon = input.lastIndexOf(':');
    const ipv4 = input.slice(lastColon + 1);
    const octets = ipv4.split('.').map(Number);
    if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      throw new Error('Invalid IPv6 address');
    }
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    input = `${input.slice(0, lastColon)}:${high}:${low}`;
  }

  const halves = input.split('::');
  if (halves.length > 2) throw new Error('Invalid IPv6 address');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) {
    throw new Error('Invalid IPv6 address');
  }
  const groups = [...left, ...Array(missing).fill('0'), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) {
    throw new Error('Invalid IPv6 address');
  }
  return groups.reduce((result, group) => (result << 16n) | BigInt(`0x${group}`), 0n);
}

function inCidr(value: bigint, network: bigint, bits: number, family: number): boolean {
  const width = family === 4 ? 32 : 128;
  return (value >> BigInt(width - bits)) === network;
}

export function isPublicIpAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const value = ipv4ToBigInt(address);
    return !IPV4_DENY_CIDRS.some((range) => range.family === 4 && inCidr(value, range.network, range.bits, 4));
  }
  if (family !== 6) return false;

  const value = ipv6ToBigInt(address);
  // Permit only global-unicast IPv6 (2000::/3); exclude special-use 2001::/23,
  // documentation (2001:db8::/32), and 6to4 (2002::/16).
  if ((value >> 125n) !== 1n) return false;
  const first = Number((value >> 112n) & 0xffffn);
  const second = Number((value >> 96n) & 0xffffn);
  if (first === 0x2001 && (second <= 0x01ff || second === 0x0db8)) return false;
  if (first === 0x2002) return false;
  return true;
}

function normalizeUrl(input: string | URL): URL {
  const url = input instanceof URL ? new URL(input) : new URL(input);
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!['http:', 'https:'].includes(url.protocol) || !hostname || url.username || url.password) {
    throw new Error('URL is not allowed');
  }
  if (url.port && !((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443'))) {
    throw new Error('Non-standard URL ports are not allowed');
  }
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Local hostnames are not allowed');
  }
  url.hash = '';
  return url;
}

async function resolvePublicAddresses(url: URL): Promise<ResolvedAddress[]> {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const literalFamily = isIP(hostname);
  const addresses: ResolvedAddress[] = literalFamily
    ? [{ address: hostname, family: literalFamily as 4 | 6 }]
    : (await dns.lookup(hostname, { all: true, verbatim: true })).map(({ address, family }) => ({ address, family: family as 4 | 6 }));

  if (!addresses.length || addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw new Error('URL resolves to a non-public address');
  }
  return addresses;
}

function requestPinned(
  url: URL,
  address: ResolvedAddress,
  options: SafeFetchOptions,
): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const headers = new Headers(options.headers);
    const request = transport.request(url, {
      method: options.method ?? 'GET',
      headers: Object.fromEntries(headers.entries()),
      lookup: (_hostname, lookupOptions: any, callback: any) => {
        if (lookupOptions?.all) callback(null, [address]);
        else callback(null, address.address, address.family);
      },
    }, resolve);

    request.setTimeout(options.timeoutMs ?? 8000, () => request.destroy(new Error('Request timed out')));
    request.on('error', reject);
    if (options.body !== undefined) request.write(options.body);
    request.end();
  });
}

async function responseFromMessage(response: http.IncomingMessage, maxBytes: number): Promise<Response> {
  const length = Number(response.headers['content-length']);
  if (Number.isFinite(length) && length > maxBytes) {
    response.destroy();
    throw new Error('Remote response is too large');
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const value of response) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    total += chunk.length;
    if (total > maxBytes) {
      response.destroy();
      throw new Error('Remote response is too large');
    }
    chunks.push(chunk);
  }

  const headers = new Headers();
  for (const name of ['content-type', 'cache-control', 'etag', 'last-modified']) {
    const value = response.headers[name];
    if (typeof value === 'string') headers.set(name, value);
  }
  const status = response.statusCode ?? 502;
  if (status < 200 || status > 599) throw new Error('Unexpected remote response status');
  return new Response(Buffer.concat(chunks), { status, statusText: response.statusMessage, headers });
}

/**
 * Fetches public HTTP(S) URLs only, pins each connection to a vetted DNS
 * answer, validates every redirect target, and caps the response size.
 */
export async function safeFetchPublicUrl(input: string | URL, options: SafeFetchOptions = {}): Promise<Response> {
  let url = normalizeUrl(input);
  let method = options.method ?? 'GET';
  let body = options.body;
  const maxRedirects = options.maxRedirects ?? 3;

  for (let redirects = 0; ; redirects += 1) {
    const addresses = await resolvePublicAddresses(url);
    const response = await requestPinned(url, addresses[0], { ...options, method, body });
    const status = response.statusCode ?? 0;
    const location = response.headers.location;
    if ([301, 302, 303, 307, 308].includes(status) && location) {
      response.resume();
      if (redirects >= maxRedirects) throw new Error('Too many redirects');
      url = normalizeUrl(new URL(location, url));
      if (status === 303 || ((status === 301 || status === 302) && method === 'POST')) {
        method = 'GET';
        body = undefined;
      }
      continue;
    }
    return responseFromMessage(response, options.maxBytes ?? 1024 * 1024);
  }
}
