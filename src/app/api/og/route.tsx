import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #09090b 0%, #0f0f14 60%, #12101a 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow blobs */}
        <div style={{
          position: 'absolute', top: -120, left: -80,
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: -100, right: -60,
          width: 450, height: 450, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(52,211,153,0.12) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* Content */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          padding: '64px 80px', flex: 1, justifyContent: 'space-between',
        }}>

          {/* Top row: logo + domain */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* Logo box */}
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: '#fff', lineHeight: 1 }}>H²</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 26, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>HomieHouse</span>
              <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)' }}>homiehouse.lol</span>
            </div>
          </div>

          {/* Hero text */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)',
              borderRadius: 20, padding: '6px 16px', width: 'fit-content',
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#34d399', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Your home on Farcaster
              </span>
            </div>
            <div style={{ fontSize: 56, fontWeight: 800, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.03em' }}>
              Learn Web3.{'\n'}Connect with{'\n'}your community.
            </div>
            <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, maxWidth: 640 }}>
              Personalized learning plans, Farcaster feeds, mini-apps, and AI insights — all in one place.
            </div>
          </div>

          {/* Feature pills */}
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { emoji: '📚', label: 'Learning Hub', color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)' },
              { emoji: '📡', label: 'Farcaster Feed', color: '#818cf8', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.25)' },
              { emoji: '🤖', label: 'Ask Homie AI', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
              { emoji: '📝', label: 'Notes', color: '#fb923c', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.25)' },
            ].map(({ emoji, label, color, bg, border }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 18px', borderRadius: 12,
                background: bg, border: `1px solid ${border}`,
              }}>
                <span style={{ fontSize: 18 }}>{emoji}</span>
                <span style={{ fontSize: 15, fontWeight: 600, color }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
