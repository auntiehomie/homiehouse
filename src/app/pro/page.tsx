'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import PricingCard from '@/components/PricingCard';

export default function ProPage() {
  const router = useRouter();
  const [userFid, setUserFid] = useState<number | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const storedProfile = localStorage.getItem('hh_profile');
        let fid: number | null = null;
        if (storedProfile) {
          try {
            const profile = JSON.parse(storedProfile);
            fid = profile?.fid ?? null;
          } catch {}
        }

        if (mounted && fid) {
          setUserFid(fid);
          const res = await fetch(`/api/pro-status?fid=${fid}`);
          const data = await res.json();
          if (mounted && data.ok) {
            setIsPro(data.is_pro);
          }
        }
      } catch (err) {
        console.error('Failed to load Pro status:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <AppShell>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: 'var(--muted-on-dark)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>HomieHouse Pro</h1>
        {isPro && (
          <span style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 6,
            background: 'rgba(232,119,34,0.15)', color: 'var(--accent)',
            fontWeight: 700,
          }}>
            ⚡ Active
          </span>
        )}
      </div>

      {/* Premium Tracks Preview */}
      {!isPro && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 6px' }}>
              🎓 Premium Learning Tracks
            </h2>
            <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: 0, lineHeight: 1.6 }}>
              12 expert-built modules across Advanced DeFi, Trading Safety Pro, and Creator Economy.
              Free users see teasers — Pro unlocks everything.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {[
              { emoji: '🏦', title: 'Advanced DeFi', desc: 'Yield strategies, leverage management, MEV protection, stablecoin deep dives', count: 4, mins: 80 },
              { emoji: '📊', title: 'Trading Safety Pro', desc: 'On-chain forensics, tax compliance, trading psychology, derivatives', count: 4, mins: 84 },
              { emoji: '🎨', title: 'Creator Economy', desc: 'Monetization, community building, content strategy, on-chain branding', count: 4, mins: 72 },
            ].map(track => (
              <div key={track.title} style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
                padding: '16px', display: 'flex', flexDirection: 'column', gap: 8,
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ fontSize: 28 }}>{track.emoji}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-on-dark)' }}>{track.title}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-on-dark)', lineHeight: 1.5 }}>{track.desc}</div>
                <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{track.count} modules · ~{track.mins} min</div>
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  fontSize: 10, padding: '2px 8px', borderRadius: 6,
                  background: 'rgba(232,119,34,0.2)', color: 'var(--accent)',
                  fontWeight: 700,
                }}>
                  🔒 PRO
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hero section */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: 'var(--muted-on-dark)', lineHeight: 1.7, marginBottom: 24, maxWidth: 560 }}>
          Supercharge your HomieHouse experience with Pro. Pay with card (Stripe) or USDC on Base — your choice. Cancel anytime.
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
          <PricingCard userFid={userFid} isPro={isPro} />
        </div>
      </div>

      {/* Pro users: Premium Tracks Access */}
      {isPro && (
        <div style={{ marginBottom: 32, maxWidth: 560, margin: '0 auto 32px' }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 6px' }}>
              🎓 Your Premium Learning Tracks
            </h2>
            <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: 0, lineHeight: 1.6 }}>
              You have full access to all premium modules. Head to the Learning Hub to start.
            </p>
          </div>
          <a
            href="/learn"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 20px', borderRadius: 10,
              background: 'var(--accent)', color: '#fff',
              textDecoration: 'none', fontSize: 14, fontWeight: 700,
            }}
          >
            📚 Go to Learning Hub →
          </a>
        </div>
      )}

      {/* FAQ */}
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-on-dark)', marginBottom: 16 }}>
          Frequently Asked Questions
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { q: 'How do I pay for Pro?', a: 'You have two options: pay $5 with a credit/debit card via Stripe (no crypto needed), or pay 5 USDC on the Base network with your wallet. Both give you the same Pro benefits.' },
            { q: 'What is USDC?', a: 'USDC is a stablecoin — a crypto token pegged 1:1 to the US dollar. 5 USDC = $5. You can get USDC on Base through any major exchange like Coinbase, then transfer it to your wallet.' },
            { q: 'What is Base?', a: 'Base is a fast, low-cost blockchain built by Coinbase. Transaction fees are typically less than a cent. It\'s the perfect network for small payments like Pro subscriptions.' },
            { q: 'Can I cancel anytime?', a: 'Yes. Card subscribers can manage or cancel from the Stripe Customer Portal (accessible from your Pro page). Crypto subscribers: Pro benefits last 30 days from payment with no auto-renew.' },
            { q: 'What is "deeper research mode"?', a: 'Pro users get access to an enhanced research pipeline that searches more sources, runs longer analysis, and produces more detailed responses.' },
            { q: 'What is priority LLM routing?', a: 'Pro queries are routed to higher-capacity models with lower latency, ensuring faster and more reliable AI responses.' },
          ].map((faq, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-on-dark)', marginBottom: 6 }}>
                {faq.q}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-on-dark)', lineHeight: 1.6 }}>
                {faq.a}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
