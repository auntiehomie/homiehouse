"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Token {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  currentPrice?: number;
  priceChangePercentage24h?: number;
  marketCap?: number;
  totalVolume?: number;
}

function PriceChange({ pct }: { pct?: number }) {
  if (pct == null) return null;
  const positive = pct >= 0;
  return (
    <span style={{ fontSize: 12, color: positive ? '#4ade80' : '#f87171', fontWeight: 500 }}>
      {positive ? '+' : ''}{pct.toFixed(2)}%
    </span>
  );
}

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

export default function TokensPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/tokens/search?q=${encodeURIComponent(query.trim())}&limit=12`);
        const d = await r.json();
        setResults(d.tokens || []);
        setSearched(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', color: 'var(--text-on-dark)', paddingBottom: 100 }}>
      <header style={{ borderBottom: '1px solid var(--border)', padding: '16px 20px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h1 style={{ margin: '0 0 14px', fontSize: 20, fontWeight: 700 }}>$ Tokens</h1>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-on-dark)', fontSize: 15, fontWeight: 700, pointerEvents: 'none' }}>$</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search token symbol or name…"
              style={{
                width: '100%',
                padding: '11px 14px 11px 30px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-on-dark)',
                fontSize: 15,
                boxSizing: 'border-box',
              }}
            />
            {loading && (
              <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-on-dark)', fontSize: 12 }}>…</span>
            )}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px' }}>
        {results.length > 0 ? (
          <div>
            {results.map(token => (
              <button
                key={token.id}
                onClick={() => router.push(`/tokens/${encodeURIComponent(token.symbol.toUpperCase())}`)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 0',
                  borderBottom: '1px solid var(--border)',
                  background: 'none',
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: 'var(--text-on-dark)',
                }}
              >
                {token.image
                  ? <img src={token.image} alt={token.symbol} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--muted-on-dark)' }}>$</div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>${token.symbol}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted-on-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{token.name}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{fmtPrice(token.currentPrice)}</div>
                  <PriceChange pct={token.priceChangePercentage24h} />
                </div>
              </button>
            ))}
          </div>
        ) : searched && !loading ? (
          <p style={{ textAlign: 'center', color: 'var(--muted-on-dark)', marginTop: 48, fontSize: 15 }}>No tokens found for "{query}"</p>
        ) : !query ? (
          <p style={{ textAlign: 'center', color: 'var(--muted-on-dark)', marginTop: 48, fontSize: 14 }}>Search for any token — Farcaster-native or on-chain</p>
        ) : null}
      </main>
    </div>
  );
}
