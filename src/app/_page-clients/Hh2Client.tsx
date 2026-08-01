'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import HHLogo from '@/components/HHLogo';

const HH2_CONTRACT = '0x290bf43aa0406DFd0D878367814Dffa926e9Bb07';
const HH2_CHAIN = 'base';
const DEXSCREENER_LINK = `https://dexscreener.com/${HH2_CHAIN}/${HH2_CONTRACT}`;

const EARN_METHODS = [
  {
    icon: '📚',
    title: 'Complete Learning Modules',
    points: '10 HH2 per module',
    description: 'Work through your personalized Web3 learning path. Each module you finish earns 10 HH2 points.',
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

export default function Hh2Client() {
  const router = useRouter();
  const { user } = usePrivy();
  const farcasterAccount = (user?.linkedAccounts ?? []).find((a: any) => a.type === 'farcaster') as any;
  const userFid: number | null = farcasterAccount?.fid ? Number(farcasterAccount.fid) : null;

  // Auto-fill wallet from Privy embedded/linked wallet
  const privyWallet = (user?.linkedAccounts ?? []).find((a: any) => a.type === 'wallet') as any;
  const privyWalletAddress: string = privyWallet?.address ?? '';

  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [claimable, setClaimable] = useState(0);
  const [claimableModules, setClaimableModules] = useState(0);
  const [totalClaimed, setTotalClaimed] = useState(0);
  const [walletAddress, setWalletAddress] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<{ ok: boolean; txHash?: string; amount?: number; error?: string } | null>(null);

  // Pre-fill wallet address from Privy once available
  useEffect(() => {
    if (privyWalletAddress && !walletAddress) {
      setWalletAddress(privyWalletAddress);
    }
  }, [privyWalletAddress, walletAddress]);

  useEffect(() => {
    if (!userFid) return;
    fetch(`/api/learning-progress?fid=${userFid}`)
      .then(r => r.json())
      .then(d => {
        if (d.found && typeof d.hh2_points === 'number') setUserPoints(d.hh2_points);
        else setUserPoints(0);
      })
      .catch(() => setUserPoints(0));

    fetch(`/api/claim-hh2?fid=${userFid}`)
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
    if (!userFid || !walletAddress || claiming) return;
    setClaiming(true);
    setClaimResult(null);
    try {
      const res = await fetch('/api/claim-hh2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: userFid, walletAddress }),
      });
      const data = await res.json();
      setClaimResult(data);
      if (data.ok) {
        setClaimable(0);
        setClaimableModules(0);
        setTotalClaimed(prev => prev + (data.amount ?? 0));
      }
    } catch {
      setClaimResult({ ok: false, error: 'Network error — please try again' });
    } finally {
      setClaiming(false);
    }
  };

  const isValidAddress = walletAddress.startsWith('0x') && walletAddress.length === 42;

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
          </div>

          {/* Points + Claim section */}
          {userFid && (
            <div style={{
              borderRadius: 16, padding: '20px 24px', marginBottom: 24,
              background: 'linear-gradient(135deg, rgba(251,191,36,0.15) 0%, rgba(245,158,11,0.08) 100%)',
              border: '1px solid rgba(251,191,36,0.35)',
            }}>
              <p style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your HH2 Points Balance</p>
              <p style={{ fontSize: 36, fontWeight: 800, color: '#fbbf24', margin: '0 0 4px', letterSpacing: '-0.5px' }}>
                {userPoints === null ? '…' : userPoints.toLocaleString()}
              </p>
              <p style={{ fontSize: 13, color: 'rgba(251,191,36,0.7)', margin: 0 }}>
                Earned through completed learning modules
              </p>
              <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link href="/learn" style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: '#fbbf24', color: '#000', textDecoration: 'none',
                }}>
                  Earn More →
                </Link>
                <Link href="/wallet" style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: 'transparent', border: '1px solid rgba(251,191,36,0.5)',
                  color: '#fbbf24', textDecoration: 'none',
                }}>
                  Trade HH2
                </Link>
              </div>
            </div>
          )}

          {/* Claim HH2 rewards */}
          {userFid && (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 16, padding: '20px', marginBottom: 28,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 4px' }}>
                    Claim HH2 Rewards
                  </h2>
                  <p style={{ fontSize: 12, color: 'var(--muted-on-dark)', margin: 0 }}>
                    Send earned HH2 to your Base wallet
                  </p>
                </div>
                {totalClaimed > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--muted-on-dark)', background: 'var(--bg-dark)', padding: '3px 8px', borderRadius: 6 }}>
                    {totalClaimed} claimed
                  </span>
                )}
              </div>

              {claimable > 0 ? (
                <>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
                    padding: '12px 14px', borderRadius: 10,
                    background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)',
                  }}>
                    <span style={{ fontSize: 22 }}>🪙</span>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#fbbf24', margin: 0 }}>
                        {claimable} HH2 ready to claim
                      </p>
                      <p style={{ fontSize: 12, color: 'rgba(251,191,36,0.7)', margin: 0 }}>
                        From {claimableModules} completed module{claimableModules !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-on-dark)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Receiving Wallet (Base)
                    </label>
                    <input
                      type="text"
                      value={walletAddress}
                      onChange={e => { setWalletAddress(e.target.value); setClaimResult(null); }}
                      placeholder="0x..."
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 13,
                        fontFamily: 'monospace', boxSizing: 'border-box',
                        background: 'var(--bg-dark)', border: `1px solid ${isValidAddress ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
                        color: 'var(--text-on-dark)', outline: 'none',
                      }}
                    />
                    {privyWalletAddress && walletAddress !== privyWalletAddress && (
                      <button
                        onClick={() => setWalletAddress(privyWalletAddress)}
                        style={{ marginTop: 6, fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        Use my connected wallet ({privyWalletAddress.slice(0, 6)}…{privyWalletAddress.slice(-4)})
                      </button>
                    )}
                  </div>

                  {claimResult && !claimResult.ok && (
                    <p style={{ fontSize: 12, color: '#f87171', margin: '0 0 10px' }}>{claimResult.error}</p>
                  )}

                  <button
                    onClick={handleClaim}
                    disabled={!isValidAddress || claiming}
                    style={{
                      width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                      background: isValidAddress && !claiming ? '#fbbf24' : 'rgba(251,191,36,0.3)',
                      color: isValidAddress && !claiming ? '#000' : 'rgba(0,0,0,0.4)',
                      fontSize: 14, fontWeight: 700,
                      cursor: isValidAddress && !claiming ? 'pointer' : 'not-allowed',
                      transition: 'all 0.15s',
                    }}
                  >
                    {claiming ? 'Sending…' : `Claim ${claimable} HH2 →`}
                  </button>
                </>
              ) : claimResult?.ok ? (
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <p style={{ fontSize: 24, margin: '0 0 8px' }}>🎉</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#22c55e', margin: '0 0 6px' }}>
                    {claimResult.amount} HH2 sent!
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
                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                  <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: 0 }}>
                    {totalClaimed > 0
                      ? 'All earned HH2 has been claimed. Complete more modules to earn more.'
                      : 'Complete learning modules to earn HH2 rewards.'}
                  </p>
                  <Link href="/learn" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', display: 'inline-block', marginTop: 8 }}>
                    Go to Learning Hub →
                  </Link>
                </div>
              )}
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
            <Link href="/wallet" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '14px', borderRadius: 12,
              background: '#fbbf24', color: '#000',
              fontSize: 15, fontWeight: 700, textDecoration: 'none',
            }}>
              💰 Trade HH2 on Uniswap
            </Link>
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
