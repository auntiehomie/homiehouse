'use client';

interface PricingCardProps {
  userFid?: number | null;
  isPro?: boolean;
}

export default function PricingCard({ userFid, isPro = false }: PricingCardProps) {

  const features = [
    { icon: '💬', label: 'Unlimited Ask Homie queries' },
    { icon: '🔬', label: 'Deeper research mode' },
    { icon: '⚡', label: 'Priority LLM routing' },
    { icon: '🎨', label: 'All premium cast themes' },
    { icon: '📋', label: 'Extra list creation slots' },
  ];

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: isPro ? '2px solid var(--accent)' : '1px solid var(--border)',
        borderRadius: 14,
        overflow: 'hidden',
        maxWidth: 380,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '20px 20px 16px',
          background: isPro
            ? 'linear-gradient(135deg, rgba(232,119,34,0.15), rgba(232,119,34,0.05))'
            : 'linear-gradient(135deg, rgba(255,255,255,0.05), transparent)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: 6 }}>
          HomieHouse Pro
        </div>
        <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-on-dark)', marginBottom: 2 }}>
          $5<span style={{ fontSize: 16, fontWeight: 500, color: 'var(--muted-on-dark)' }}>/mo</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted-on-dark)' }}>
          Cancel anytime
        </div>
      </div>

      {/* Features */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-on-dark)', marginBottom: 12 }}>
          Everything in Free, plus:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {features.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.3 }}>{f.icon}</span>
              <span style={{ fontSize: 13, color: 'var(--muted-on-dark)', lineHeight: 1.5 }}>{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '0 20px 20px' }}>
        {isPro ? (
          <div
            style={{
              width: '100%', padding: '12px', borderRadius: 10, textAlign: 'center',
              background: 'rgba(34,197,94,0.1)', color: '#22c55e',
              fontSize: 14, fontWeight: 700,
            }}
          >
            ⚡ You&apos;re a Pro member
          </div>
        ) : (
          <button
            disabled
            style={{
              width: '100%', padding: '12px', borderRadius: 10,
              background: 'var(--surface)', color: 'var(--muted-on-dark)',
              border: '1px solid var(--border)', fontWeight: 700, fontSize: 14,
              cursor: 'not-allowed', opacity: 0.6,
            }}
          >
            Coming Soon
          </button>
        )}
        <div style={{ fontSize: 11, color: 'var(--muted-on-dark)', textAlign: 'center', marginTop: 8 }}>
          Billing via Stripe · Coming soon
        </div>
      </div>
    </div>
  );
}