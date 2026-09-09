import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = (searchParams.get('title') || 'HomieHouse').slice(0, 100);
  const description = (searchParams.get('description') || 'Learn Web3. Connect with your community.').slice(0, 180);
  const kind = (searchParams.get('kind') || 'article').slice(0, 30);

  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 80px', color: '#fff', background: 'linear-gradient(135deg, #09090b, #171329)', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#242038', border: '1px solid #51488a', fontSize: 28, fontWeight: 800 }}>H²</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 25, fontWeight: 700 }}>HomieHouse</span><span style={{ fontSize: 15, color: '#a1a1aa' }}>homiehouse.lol</span></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 930 }}>
        <span style={{ color: '#6ee7b7', fontSize: 16, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{kind}</span>
        <div style={{ fontSize: 58, lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.03em' }}>{title}</div>
        <div style={{ fontSize: 24, lineHeight: 1.45, color: '#c4c4ce' }}>{description}</div>
      </div>
      <div style={{ display: 'flex', fontSize: 16, color: '#8f8fa0' }}>Learn in public · build a more human open web</div>
    </div>,
    { width: 1200, height: 630 },
  );
}
