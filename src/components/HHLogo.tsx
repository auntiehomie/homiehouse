'use client';

interface Props {
  size?: number;
}

export default function HHLogo({ size = 36 }: Props) {
  const radius = Math.round(size * 0.22);
  const fontSize = Math.round(size * 0.46);
  const supSize = Math.round(size * 0.28);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        border: '1px solid rgba(255,255,255,0.18)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize,
        color: '#ffffff',
        flexShrink: 0,
        letterSpacing: '-0.5px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        userSelect: 'none',
      }}
    >
      H<sup style={{ fontSize: supSize, lineHeight: 1, verticalAlign: 'super' }}>2</sup>
    </div>
  );
}
