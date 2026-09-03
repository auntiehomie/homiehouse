'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useChainId, useSwitchChain } from 'wagmi';
import { base } from 'wagmi/chains';
import { formatUnits } from 'viem';
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import { getAuthHeaders, getStoredFid } from '@/lib/client-auth';
import HHLogo from '@/components/HHLogo';

const HH2_CONTRACT = '0x5C5F3618e82C4b32e26De858ca66331D9A722B07' as const;
const HH2_CHAIN = 'base';
const HH2_CHAIN_ID = base.id;
const DEXSCREENER_LINK = `https://dexscreener.com/${HH2_CHAIN}/${HH2_CONTRACT}`;
const BASESCAN_LINK = `https://basescan.org/token/${HH2_CONTRACT}`;
const UNISWAP_LINK = `https://app.uniswap.org/swap?outputCurrency=${HH2_CONTRACT}&chain=base`;

const HH2_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const EARN_METHODS = [
  {
    icon: '📚',
    title: 'Complete Learning Modules',
    points: '100 HH2 per module',
    description: 'Work through your personalized Web3 learning path. Each module you finish earns 100 HH2 points.',
    cta: 'Go to Learning Hub',
    href: '/learn',
    soon: false,
  },
  {
    icon: '🏠',
    title: 'Join the Community',
    points: 'Ongoing rewards',
    description: 'Participate in the HomieHouse Farcaster community. Cast, engage, and build reputation with fellow homies.',
    cta: 'Open Feed',
    href: '/feed',
    soon: false,
  },
  {
    icon: '✍️',
    title: 'Create & Share Content',
    points: 'Creator rewards',
    description: 'Compose and share casts about Web3, crypto, and community. Quality content gets noticed.',
    cta: 'Compose',
    href: '/compose',
    soon: false,
  },
  {
    icon: '🤝',
    title: 'Refer Friends',
    points: 'Coming soon',
    description: 'Bring your friends into the HomieHouse ecosystem. Referral rewards are coming soon.',
    cta: null,
    href: null,
    soon: true,
  },
];

const TOKENOMICS = [
  { label: 'Token Name', value: 'HomieHouse' },
  { label: 'Ticker', value: 'HH2' },
  { label: 'Chain', value: 'Base' },
  { label: 'Total Supply', value: '100,000,000,000 (100B)' },
  { label: 'Launch Platform', value: 'Clanker.world' },
  { label: 'Pool', value: 'Uniswap V3 (1% fee)' },
  { label: 'Liquidity', value: 'Locked permanently' },
  { label: 'Creator LP Fees', value: '40% of LP fees' },
];

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function Hh2Client() {
  const router = useRouter();
  const { fid: userFid } = useFarcasterAuth();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: switchPending } = useSwitchChain();
  const isOnBase = chainId === HH2_CHAIN_ID;

  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [claimable, setClaimable] = useState(0);
  const [claimableModules, setClaimableModules] = useState(0);
  const [totalClaimed, setTotalClaimed] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<{ ok: boolean; txHash?: string; amount?: number; error?: string } | null>(null);

  // Read HH2 balance from the connected wallet (always queries Base)
  const { data: hh2Raw, refetch: refetchBalance } = useReadContract({
    address: HH2_CONTRACT,
    abi: HH2_ABI,
    functionName: 'balanceOf',
    args: [(address ?? '0x0000000000000000000000000000000000000000') as `0x${string}`],
    chainId: HH2_CHAIN_ID,
    query: { enabled: !!address },
  });

  const { data: decimals } = useReadContract({
    address: HH2_CONTRACT,
    abi: HH2_ABI,
    functionName: 'decimals',
    chainId: HH2_CHAIN_ID,
  });

  const onChainBalance = hh2Raw && decimals ? Number(formatUnits(hh2Raw, decimals)) : 0;

  // Fetch claimable + points from the server
  useEffect(() => {
    const fid = userFid ?? getStoredFid();
    if (!fid) return;

    fetch(`/api/learning-progress?fid=${fid}`)
      .then(r => r.json())
      .then(d => {
        if (d.found && typeof d.hh2_points === 'number') setUserPoints(d.hh2_points);
        else setUserPoints(0);
      })
      .catch(() => setUserPoints(0));

    fetch(`/api/claim-hh2?fid=${fid}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setClaimable(d.claimable ?? 0);
          setClaimableModules(d.claimableModules ?? 0);
          setTotalClaimed(d.totalClaimed ?? 0);
        }
      })
      .catch(() => {});
  }, [userFid]);

  const handleClaim = async () => {
    const fid = userFid ?? getStoredFid();
    if (!fid || !address || claiming) return;

    const authHeaders = getAuthHeaders();
    if (!authHeaders) {
      setClaimResult({ ok: false, error: 'Not authenticated — connect your Farcaster account first.' });
      return;
    }

    setClaiming(true);
    setClaimResult(null);
    try {
      const res = await fetch('/api/claim-hh2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ fid, walletAddress: address }),
      });
      const data = await res.json();
      setClaimResult(data);
      if (data.ok) {
        setClaimable(0);
        setClaimableModules(0);
        setTotalClaimed(prev => prev + (data.amount ?? 0));
        // Refetch on-chain balance after a short delay for the tx to settle
        setTimeout(() => refetchBalance(), 5000);
      }
    } catch {
      setClaimResult({ ok: false, error: 'Network error — please try again' });
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div style={{ minHeight: '100svh', background: 'var(--bg-dark)' }}>
      <main style={{ overflowY: 'auto', minHeight: '100svh' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 80px' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <button
              onClick={() => router.back()}
              style={{ background: 'none', border: 'none', color: 'var(--muted-on-dark)', cursor: 'pointer', padding: '4px 8px 4px 0', fontSize: 22, lineHeight: 1 }}
            >
              ←
            </button>
            <HHLogo size={28} />
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text-on-dark)' }}>HH2 Token</h1>
              <p style={{ fontSize: 12, color: 'var(--muted-on-dark)', margin: 0 }}>HomieHouse on Base</p>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <ConnectButton />
            </div>
          </div>

          {/* Wallet balance + claim section */}
          {isConnected ? (
            <div style={{
              borderRadius: 16, padding: '20px 24px', marginBottom: 24,
              background: 'linear-gradient(135deg, rgba(251,191,36,0.15) 0%, rgba(245,158,11,0.08) 100%)',
              border: '1px solid rgba(251,191,36,0.35)',
            }}>
              {/* On-chain balance */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>On-Chain HH2 Balance</p>
                <p style={{ fontSize: 36, fontWeight: 800, color: '#fbbf24', margin: '0 0 4px', letterSpacing: '-0.5px' }}>
                  {Number(onChainBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
                <p style={{ fontSize: 12, color: 'rgba(251,191,36,0.6)', margin: 0, fontFamily: 'monospace' }}>
                  {truncate(address ?? '')} on {isOnBase ? 'Base' : `Chain ${chainId}`}
                </p>
                {!isOnBase && (
                  <button
                    onClick={() => switchChain({ chainId: HH2_CHAIN_ID })}
                    disabled={switchPending}
                    style={{
                      marginTop: 8, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.4)',
                      color: '#fbbf24', cursor: 'pointer',
                    }}
                  >
                    {switchPending ? 'Switching…' : 'Switch to Base'}
                  </button>
                )}
              </div>

              {/* Off-chain earned points */}
              {userFid && (
                <div style={{
                  padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  marginBottom: 12,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--muted-on-dark)' }}>Earned (off-chain)</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-on-dark)' }}>
                      {userPoints === null ? '…' : userPoints.toLocaleString()} HH2
                    </span>
                  </div>
                  {claimable > 0 && (
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8,
                      paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)',
                    }}>
                      <span style={{ fontSize: 13, color: '#fbbf24' }}>Ready to claim</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#fbbf24' }}>{claimable} HH2</span>
                    </div>
                  )}
                </div>
              )}

              {/* Claim button */}
              {claimable > 0 && isOnBase && (
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                    background: claiming ? 'rgba(251,191,36,0.3)' : '#fbbf24',
                    color: claiming ? 'rgba(0,0,0,0.4)' : '#000',
                    fontSize: 15, fontWeight: 700,
                    cursor: claiming ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {claiming ? 'Sending…' : `Claim ${claimable} HH2 to ${truncate(address ?? '')} →`}
                </button>
              )}
              {claimable > 0 && !isOnBase && (
                <p style={{ fontSize: 12, color: '#fca5a5', textAlign: 'center', margin: '8px 0 0' }}>
                  Switch to Base network to claim
                </p>
              )}

              {/* Claim result */}
              {claimResult && (
                <div style={{ marginTop: 12 }}>
                  {claimResult.ok ? (
                    <div style={{
                      textAlign: 'center', padding: '14px', borderRadius: 12,
                      background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                    }}>
                      <p style={{ fontSize: 16, fontWeight: 700, color: '#22c55e', margin: '0 0 6px' }}>
                        ✅ {claimResult.amount} HH2 sent to {truncate(address ?? '')}!
                      </p>
                      <a
                        href={`https://basescan.org/tx/${claimResult.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12, color: 'var(--muted-on-dark)', wordBreak: 'break-all' }}
                      >
                        View on Basescan ↗
                      </a>
                    </div>
                  ) : (
                    <div style={{
                      padding: '12px 14px', borderRadius: 10,
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    }}>
                      <p style={{ fontSize: 13, color: '#f87171', margin: 0 }}>
                        ⚠️ {claimResult.error || 'Claim failed — please try again'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link href="/learn" style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: '#fbbf24', color: '#000', textDecoration: 'none',
                }}>
                  Earn More →
                </Link>
                <a
                  href={UNISWAP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: 'transparent', border: '1px solid rgba(251,191,36,0.5)',
                    color: '#fbbf24', textDecoration: 'none',
                  }}
                >
                  Trade on Uniswap
                </a>
                <a
                  href={BASESCAN_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: 'transparent', border: '1px solid var(--border)',
                    color: 'var(--muted-on-dark)', textDecoration: 'none',
                  }}
                >
                  Basescan ↗
                </a>
              </div>
            </div>
          ) : (
            /* Not connected — prompt to connect wallet */
            <div style={{
              borderRadius: 16, padding: '28px 24px', marginBottom: 24,
              background: 'var(--surface)', border: '1px solid var(--border)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🪙</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 8px' }}>
                Connect Your Wallet
              </h2>
              <p style={{ fontSize: 14, color: 'var(--muted-on-dark)', margin: '0 0 20px', lineHeight: 1.6 }}>
                Connect your EVM wallet to view your HH2 balance, claim earned rewards, and trade on Uniswap.
                Rainbow, MetaMask, Coinbase, Trust, and WalletConnect are all supported.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <ConnectButton />
              </div>
              {userFid && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: '0 0 4px' }}>
                    Off-chain earned: <strong style={{ color: '#fbbf24' }}>
                      {userPoints === null ? '…' : userPoints.toLocaleString()} HH2
                    </strong>
                  </p>
                  {claimable > 0 && (
                    <p style={{ fontSize: 13, color: '#fbbf24', margin: '4px 0 0' }}>
                      {claimable} HH2 ready to claim — connect your wallet to withdraw!
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Total claimed badge */}
          {totalClaimed > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24,
              padding: '12px 16px', borderRadius: 12,
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
            }}>
              <span style={{ fontSize: 18 }}>✅</span>
              <span style={{ fontSize: 13, color: '#86efac' }}>
                {totalClaimed} HH2 previously claimed to your wallet
              </span>
            </div>
          )}

          {/* How to earn */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 14px' }}>How to Earn HH2</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {EARN_METHODS.map((m) => (
                <div key={m.title} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '16px 18px',
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                }}>
                  <span style={{ fontSize: 26, flexShrink: 0, lineHeight: 1 }}>{m.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-on-dark)' }}>{m.title}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        background: m.soon ? 'rgba(100,100,100,0.2)' : 'rgba(251,191,36,0.15)',
                        color: m.soon ? 'var(--muted-on-dark)' : '#fbbf24',
                        border: m.soon ? '1px solid var(--border)' : '1px solid rgba(251,191,36,0.3)',
                      }}>{m.points}</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: '0 0 10px', lineHeight: 1.5 }}>{m.description}</p>
                    {m.cta && m.href && (
                      <Link href={m.href} style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>
                        {m.cta} →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Token details */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 14px' }}>Token Details</h2>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {TOKENOMICS.map((row, i) => (
                <div key={row.label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 18px',
                  borderBottom: i < TOKENOMICS.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{ fontSize: 13, color: 'var(--muted-on-dark)' }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-on-dark)', textAlign: 'right', maxWidth: '60%' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Contract address */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 14px' }}>Contract Address</h2>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
              <p style={{ fontSize: 11, color: 'var(--muted-on-dark)', margin: '0 0 4px' }}>Base Mainnet</p>
              <p style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-on-dark)', margin: 0, wordBreak: 'break-all' }}>
                {HH2_CONTRACT}
              </p>
            </div>
          </div>

          {/* CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <a
              href={UNISWAP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '14px', borderRadius: 12,
                background: '#fbbf24', color: '#000',
                fontSize: 15, fontWeight: 700, textDecoration: 'none',
              }}
            >
              💰 Trade HH2 on Uniswap
            </a>
            <a
              href={DEXSCREENER_LINK}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--muted-on-dark)', fontSize: 14, fontWeight: 500, textDecoration: 'none',
              }}
            >
              📈 View Chart on DexScreener ↗
            </a>
          </div>

        </div>
      </main>
    </div>
  );
}
