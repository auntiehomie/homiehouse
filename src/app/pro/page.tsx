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

      {/* Hero section */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: 'var(--muted-on-dark)', lineHeight: 1.7, marginBottom: 24, maxWidth: 560 }}>
          Supercharge your HomieHouse experience with Pro. Get unlimited AI queries, deeper research,
          priority routing, and premium features.
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
          <PricingCard userFid={userFid} isPro={isPro} />
        </div>
      </div>

      {/* FAQ */}
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-on-dark)', marginBottom: 16 }}>
          Frequently Asked Questions
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { q: 'What payment methods do you accept?', a: 'We use Stripe for secure payment processing. All major credit and debit cards are accepted.' },
            { q: 'Can I cancel anytime?', a: 'Yes! You can cancel your Pro subscription at any time. Your Pro benefits remain active until the end of your billing period.' },
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