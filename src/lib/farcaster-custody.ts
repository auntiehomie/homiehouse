import { createPublicClient, http, parseAbi, type Address } from "viem";
import { optimism } from "viem/chains";
import { getNativeAccountByCustody, getNativeCustodyOf, isNativeFid } from "@/lib/hypersnap-native";

/** Farcaster IdRegistry on Optimism mainnet — the source of truth for FID custody. */
export const ID_REGISTRY =
  "0x00000000fc6c5f01fc30151999387bb99a9f489b" as const;

const idRegistryAbi = parseAbi([
  "function idOf(address owner) view returns (uint256)",
  "function custodyOf(uint256 fid) view returns (address)",
]);

const OP_RPC = process.env.OP_RPC_URL || "https://mainnet.optimism.io";

const publicClient = createPublicClient({
  chain: optimism,
  transport: http(OP_RPC, { timeout: 5_000, retryCount: 1 }),
});

/** Legacy FID whose custody wallet is `address`, read from the IdRegistry on Optimism. */
async function legacyCustodyFidOf(address: Address): Promise<number | null> {
  const fid = await publicClient.readContract({
    address: ID_REGISTRY,
    abi: idRegistryAbi,
    functionName: "idOf",
    args: [address],
  });
  return fid > BigInt(0) && fid <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(fid)
    : null;
}

/**
 * FID whose custody wallet is `address`.
 *
 * Hub address search (`/v2/farcaster/user/bulk-by-address`) only answers fast
 * for verified addresses; a custody-only wallet falls through to a scan of
 * every IdRegister event, which times out on public nodes. So this asks the
 * two registries directly: the legacy IdRegistry on Optimism (one contract
 * read) and Hypersnap's native registry (accounts created since the Nov 2026
 * fork). A legacy FID wins when a wallet has both. Returns null when the
 * wallet owns no FID; throws only when neither registry could be read.
 */
export async function custodyFidOf(address: Address): Promise<number | null> {
  const [legacy, native] = await Promise.allSettled([
    legacyCustodyFidOf(address),
    getNativeAccountByCustody(address),
  ]);
  if (legacy.status === "fulfilled" && legacy.value) return legacy.value;
  if (native.status === "fulfilled" && native.value) return native.value.fid;
  if (legacy.status === "rejected" && native.status === "rejected") throw legacy.reason;
  return null;
}

/**
 * Custody address of `fid`: Hypersnap's native registry for native FIDs
 * (>= 2^32), otherwise the IdRegistry on Optimism. Null when unknown.
 */
export async function custodyAddressOf(fid: number): Promise<Address | null> {
  if (isNativeFid(fid)) return getNativeCustodyOf(fid);
  const custody = await publicClient.readContract({
    address: ID_REGISTRY,
    abi: idRegistryAbi,
    functionName: "custodyOf",
    args: [BigInt(fid)],
  });
  return /^0x0{40}$/i.test(custody) ? null : custody;
}
