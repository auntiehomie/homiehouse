import { ImageResponse } from 'next/og';
import { fetchCast } from '@/lib/hypersnap';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hash = searchParams.get('hash') || '';

  let authorName = 'Farcaster';
  let authorUsername = '';
  let pfpUrl = '';
  let castText = '';

  if (hash) {
    try {
      const data = await fetchCast(hash);
      const cast = data?.cast ?? data;
      if (cast) {
        const author = cast.author;
        authorName = author?.display_name || author?.username || 'Someone';
        authorUsername = author?.username || '';
        pfpUrl = author?.pfp_url || '';
        castText = (cast.text || '').slice(0, 280);
      }
    } catch {}
  }

  const truncated = castText.length === 280 ? castText + '…' : castText;

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
          padding: '56px 72px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle glow */}
        <div style={{
          position: 'absolute', top: -100, right: -80,
          width: 420, height: 420, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.14) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* Author row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          {pfpUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pfpUrl}
              width={64}
              height={64}
              style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              alt={authorName}
            />
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {authorName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{authorName}</span>
            {authorUsername && (
              <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)' }}>@{authorUsername}</span>
            )}
          </div>
        </div>

        {/* Cast text */}
        <div style={{
          flex: 1,
          fontSize: truncated.length > 140 ? 26 : 32,
          color: 'rgba(255,255,255,0.92)',
          lineHeight: 1.55,
          wordBreak: 'break-word',
          overflow: 'hidden',
        }}>
          {truncated || 'View this cast on HomieHouse'}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 32, paddingTop: 20,
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 17, fontWeight: 900, color: '#fff', lineHeight: 1 }}>H²</span>
            </div>
            <span style={{ fontSize: 17, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>HomieHouse</span>
          </div>
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>homiehouse.lol</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
