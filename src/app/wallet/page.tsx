'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import HHLogo from '@/components/HHLogo';

const HH2_CONTRACT = '0x290bf43aa0406DFd0D878367814Dffa926e9Bb07';
const HH2_CHAIN = 'base';

const UNISWAP_LINK = `https://app.uniswap.org/swap?outputCurrency=${HH2_CONTRACT}&chain=${HH2_CHAIN}`;
const DEXSCREENER_PAIR = `https://dexscreener.com/${HH2_CHAIN}/${HH2_CONTRACT}`;
const BASESCAN_LINK = `https://basescan.org/token/${HH2_CONTRACT}`;

export default function WalletPage() {
  const router = useRouter();

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
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text-on-dark)' }}>HH2 Wallet</h1>
              <p style={{ fontSize: 12, color: 'var(--muted-on-dark)', margin: 0 }}>Trade HomieHouse on Base</p>
            </div>
          </div>

          {/* Price chart embed */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-on-dark)', margin: 0 }}>Live Chart</h2>
              <a
                href={DEXSCREENER_PAIR}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: 'var(--muted-on-dark)', textDecoration: 'none' }}
              >
                Open on DexScreener ↗
              </a>
            </div>
            <div style={{
              borderRadius: 14, overflow: 'hidden',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
            }}>
              <iframe
                src={`https://dexscreener.com/${HH2_CHAIN}/${HH2_CONTRACT}?embed=1&theme=dark&trades=0&info=0`}
                title="HH2 Price Chart"
                style={{ width: '100%', height: 360, border: 'none', display: 'block' }}
                allow="clipboard-write"
              />
            </div>
          </div>

          {/* Trade section */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 12px' }}>Trade HH2</h2>
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '18px 20px',
            }}>
              <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: '0 0 16px', lineHeight: 1.6 }}>
                HH2 trades on Uniswap V3 (Base). The liquidity pool is permanently locked — you can buy and sell freely at any time.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <a
                  href={UNISWAP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '14px', borderRadius: 12,
                    background: '#ff007a', color: '#fff',
                    fontSize: 15, fontWeight: 700, textDecoration: 'none',
                  }}
                >
                  🦄 Buy HH2 on Uniswap
                </a>
                <a
                  href={UNISWAP_LINK.replace('outputCurrency', 'inputCurrency') + `&outputCurrency=ETH`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '12px', borderRadius: 12, border: '1px solid rgba(255,0,122,0.4)',
                    background: 'transparent', color: '#ff007a',
                    fontSize: 14, fontWeight: 600, textDecoration: 'none',
                  }}
                >
                  Sell HH2 on Uniswap ↗
                </a>
              </div>
            </div>
          </div>

          {/* Token info quick reference */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {[
                { label: 'Token', value: 'HH2 / HomieHouse' },
                { label: 'Network', value: 'Base (Ethereum L2)' },
                { label: 'Fee Tier', value: '1%' },
                { label: 'Total Supply', value: '100,000,000,000' },
              ].map((row, i, arr) => (
                <div key={row.label} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '11px 18px',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{ fontSize: 13, color: 'var(--muted-on-dark)' }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-on-dark)' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* External links */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a
              href={BASESCAN_LINK}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1, minWidth: 140,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--muted-on-dark)',
                fontSize: 13, fontWeight: 500, textDecoration: 'none',
              }}
            >
              🔍 Basescan ↗
            </a>
            <Link
              href="/hh2"
              style={{
                flex: 1, minWidth: 140,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(251,191,36,0.3)',
                background: 'transparent', color: '#fbbf24',
                fontSize: 13, fontWeight: 500, textDecoration: 'none',
              }}
            >
              🪙 Tokenomics
            </Link>
          </div>

        </div>
      </main>
    </div>
  );
}
