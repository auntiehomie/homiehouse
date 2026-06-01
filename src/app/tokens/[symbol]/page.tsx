"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

function fmtPrice(p?: number) {
  if (p == null) return '—';
  if (p < 0.000001) return `$${p.toExponential(2)}`;
  if (p < 0.01) return `$${p.toFixed(6)}`;
  if (p < 1) return `$${p.toFixed(4)}`;
  return `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function fmtLarge(n?: number) {
  if (n == null) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
      <div style={{ fontSize: 12, color: 'var(--muted-on-dark)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

export default function TokenDetailPage() {
  const router = useRouter();
  const { symbol } = useParams<{ symbol: string }>();
  const [token, setToken] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!symbol) return;
    fetch(`/api/tokens/${encodeURIComponent(symbol)}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setToken(d.token);
        else setError(d.error || 'Token not found');
      })
      .catch(() => setError('Failed to load token'))
      .finally(() => setLoading(false));
  }, [symbol]);

  const pct = token?.priceChangePercentage24h;
  const positive = pct != null && pct >= 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', color: 'var(--text-on-dark)', paddingBottom: 100 }}>
      <header style={{ borderBottom: '1px solid var(--border)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--muted-on-dark)', cursor: 'pointer', padding: 4, display: 'flex' }}>
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>${symbol.toUpperCase()}</h1>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px' }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--muted-on-dark)', marginTop: 60 }}>Loading…</p>
        ) : error ? (
          <p style={{ textAlign: 'center', color: '#f87171', marginTop: 60 }}>{error}</p>
        ) : token ? (
          <>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              {token.image
                ? <img src={token.image} alt={token.symbol} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
                : <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>$</div>
              }
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>${token.symbol}</div>
                <div style={{ fontSize: 14, color: 'var(--muted-on-dark)' }}>{token.name}</div>
              </div>
            </div>

            {/* Price */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.1 }}>{fmtPrice(token.currentPrice)}</div>
              {pct != null && (
                <div style={{ fontSize: 15, marginTop: 4, color: positive ? '#4ade80' : '#f87171', fontWeight: 500 }}>
                  {positive ? '+' : ''}{pct.toFixed(2)}% (24h)
                </div>
              )}
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
              <StatBox label="Market Cap" value={fmtLarge(token.marketCap)} />
              <StatBox label="24h Volume" value={fmtLarge(token.totalVolume)} />
              {token.circulatingSupply != null && (
                <StatBox label="Circulating Supply" value={token.circulatingSupply.toLocaleString(undefined, { maximumFractionDigits: 0 })} />
              )}
              {token.fullyDilutedValuation != null && (
                <StatBox label="Fully Diluted Val." value={fmtLarge(token.fullyDilutedValuation)} />
              )}
              {token.ath != null && (
                <StatBox label="All-Time High" value={fmtPrice(token.ath)} />
              )}
              {token.atl != null && (
                <StatBox label="All-Time Low" value={fmtPrice(token.atl)} />
              )}
            </div>

            {/* Description */}
            {token.description && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: 'var(--muted-on-dark)', lineHeight: 1.6 }}>
                  {token.description.length > 400 ? token.description.slice(0, 400) + '…' : token.description}
                </div>
              </div>
            )}

            {/* Contract address */}
            {token.address && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: 12, color: 'var(--muted-on-dark)', marginBottom: 4 }}>Contract Address</div>
                <div style={{ fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all', color: 'var(--text-on-dark)' }}>{token.address}</div>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
