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
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize,
        color: '#ffffff',
        flexShrink: 0,
        letterSpacing: '-0.5px',
        userSelect: 'none',
      }}
    >
      H<sup style={{ fontSize: supSize, lineHeight: 1, verticalAlign: 'super' }}>2</sup>
    </div>
  );
}
