'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChannelSidebar } from '@/components/ChannelStrip';
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

export default function HH2Page() {
  const router = useRouter();
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [hasFid, setHasFid] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('hh_fid');
    if (stored) {
      const parsedFid = parseInt(stored, 10);
      if (!isNaN(parsedFid)) {
        setHasFid(true);
        fetch(`/api/learning-progress?fid=${parsedFid}`)
          .then((r) => r.json())
          .then((d) => {
            if (d.found && typeof d.hh2_points === 'number') {
              setUserPoints(d.hh2_points);
            } else {
              setUserPoints(0);
            }
          })
          .catch(() => setUserPoints(0));
      }
    }
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100svh', background: 'var(--bg-dark)' }}>
      <ChannelSidebar />
      <main style={{ flex: 1, overflowY: 'auto', minHeight: '100svh' }}>
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

          {/* User balance card */}
          {hasFid && (
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
