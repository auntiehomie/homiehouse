import { NextRequest, NextResponse } from "next/server";

interface TokenTransfer {
  hash: string;
  from: string;
  to: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  value: string;
  timeStamp: string;
  contractAddress: string;
}

interface TradeItem {
  hash: string;
  type: "buy" | "sell" | "transfer";
  tokenSymbol: string;
  tokenName: string;
  amount: string;
  from: string;
  to: string;
  timestamp: number;
  contractAddress: string;
}

function formatAmount(value: string, decimals: string): string {
  const dec = parseInt(decimals) || 18;
  const n = BigInt(value);
  const divisor = BigInt(10 ** Math.min(dec, 18));
  const whole = n / divisor;
  const frac = n % divisor;
  const fracStr = frac.toString().padStart(dec, "0").slice(0, 4);
  const trimmed = fracStr.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

async function fetchTransfers(address: string): Promise<TokenTransfer[]> {
  const url = `https://base.blockscout.com/api?module=account&action=tokentx&address=${address}&sort=desc&page=1&offset=30`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  const data = await res.json();
  if (data.status !== "1" || !Array.isArray(data.result)) return [];
  return data.result;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const addressesParam = searchParams.get("addresses");

  if (!addressesParam) {
    return NextResponse.json({ error: "addresses parameter required" }, { status: 400 });
  }

  const addresses = addressesParam
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter((a) => /^0x[0-9a-f]{40}$/.test(a))
    .slice(0, 3); // cap at 3 addresses

  if (addresses.length === 0) {
    return NextResponse.json({ trades: [] });
  }

  try {
    const allTransfers = await Promise.all(addresses.map(fetchTransfers));
    const addrSet = new Set(addresses);

    const seen = new Set<string>();
    const trades: TradeItem[] = [];

    for (const transfers of allTransfers) {
      for (const tx of transfers) {
        if (seen.has(tx.hash + tx.contractAddress)) continue;
        seen.add(tx.hash + tx.contractAddress);

        const fromMe = addrSet.has(tx.from.toLowerCase());
        const toMe = addrSet.has(tx.to.toLowerCase());

        let type: "buy" | "sell" | "transfer" = "transfer";
        if (fromMe && !toMe) type = "sell";
        else if (!fromMe && toMe) type = "buy";

        trades.push({
          hash: tx.hash,
          type,
          tokenSymbol: tx.tokenSymbol,
          tokenName: tx.tokenName,
          amount: formatAmount(tx.value, tx.tokenDecimal),
          from: tx.from,
          to: tx.to,
          timestamp: parseInt(tx.timeStamp) * 1000,
          contractAddress: tx.contractAddress,
        });
      }
    }

    // Sort by timestamp desc
    trades.sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json({ trades: trades.slice(0, 50) });
  } catch (err) {
    console.error("[/api/trades]", err);
    return NextResponse.json({ trades: [] });
  }
}
