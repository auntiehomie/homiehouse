const isOpaque = (value: string) =>
  /[:/]/.test(value) || /^0x[0-9a-f]{20,}$/i.test(value);

/** Return a readable registry label without substituting a channel's identity. */
export function channelDisplayName(channel: {
  id?: unknown;
  name?: unknown;
}): string | null {
  const id = typeof channel.id === "string" ? channel.id.trim() : "";
  if (!id) return null;
  const name = typeof channel.name === "string" ? channel.name.trim() : "";
  if (name && !isOpaque(name)) return name;
  return isOpaque(id) ? null : id.replace(/^\//, "");
}

const CHAIN_NAMES: Record<string, string> = {
  "eip155:1": "Ethereum",
  "eip155:10": "Optimism",
  "eip155:56": "BNB Chain",
  "eip155:137": "Polygon",
  "eip155:8453": "Base",
  "eip155:42161": "Arbitrum",
  "eip155:7777777": "Zora",
  "eip155:666666666": "Degen",
  "solana:101": "Solana",
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "Solana",
};

const ASSET_KINDS: Record<string, string> = {
  erc20: "token",
  erc721: "NFT",
  erc1155: "NFT",
  address: "token",
  token: "token",
  slip44: "coin",
};

function shortenAddress(value: string): string {
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

/**
 * Describe an unnamed onchain channel (a CAIP-19 parent such as
 * `chain://eip155:8453/erc20:0xabc…`) in words, e.g. "Base token · 0xccd5…1234".
 * Returns null when the value is not a recognisable onchain identifier.
 */
export function onchainChannelLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value
    .trim()
    .replace(/^chain:\/\//i, "")
    .replace(/^\//, "");
  const match = raw.match(/^([a-z0-9-]+):([^/]*)\/([a-z0-9-]+):([^/?#]+)/i);
  if (!match) return null;
  const [, namespace, reference, assetNamespace, assetRef] = match;
  const chain = reference
    ? CHAIN_NAMES[`${namespace.toLowerCase()}:${reference}`]
    : undefined;
  const chainLabel =
    chain ??
    (namespace.toLowerCase() === "eip155"
      ? reference
        ? `Chain ${reference}`
        : "Ethereum"
      : namespace.charAt(0).toUpperCase() + namespace.slice(1));
  const kind = ASSET_KINDS[assetNamespace.toLowerCase()] ?? "asset";
  return `${chainLabel} ${kind} · ${shortenAddress(assetRef)}`;
}

/** A label that is always safe to show: the readable name, a described onchain asset, or the ID. */
export function channelLabel(channel: {
  id?: unknown;
  name?: unknown;
}): string {
  const readable = channelDisplayName(channel);
  if (readable) return readable;
  const described =
    onchainChannelLabel(channel.id) ?? onchainChannelLabel(channel.name);
  if (described) return described;
  const id =
    typeof channel.id === "string" ? channel.id.trim().replace(/^\//, "") : "";
  return id ? shortenAddress(id) : "channel";
}
