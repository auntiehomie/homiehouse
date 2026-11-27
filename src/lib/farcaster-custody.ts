import { createPublicClient, http, parseAbi, type Address } from "viem";
import { optimism } from "viem/chains";

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

/**
 * FID whose custody wallet is `address`, read straight from the IdRegistry.
 *
 * Hub address search (`/v2/farcaster/user/bulk-by-address`) only answers fast
 * for verified addresses; a custody-only wallet falls through to a scan of
 * every IdRegister event, which times out on public nodes. This is one
 * contract read. Returns null when the wallet owns no FID.
 */
export async function custodyFidOf(address: Address): Promise<number | null> {
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
