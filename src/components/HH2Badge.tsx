'use client';

import React from 'react';

type BadgeVariant = {
  metal: [string, string, string];
  face: [string, string, string];
  jewel: string;
};

const VARIANTS: Record<string, BadgeVariant> = {
  'silver-badge': { metal: ['#f8fafc', '#64748b', '#e2e8f0'], face: ['#471b83', '#1b0b32', '#7136b9'], jewel: '#a855f7' },
  'gold-badge': { metal: ['#fff1a8', '#a45c09', '#ffd76a'], face: ['#521f91', '#1b0b32', '#762dc7'], jewel: '#c084fc' },
  'platinum-badge': { metal: ['#f8fafc', '#64748b', '#dbeafe'], face: ['#51218f', '#160b2b', '#8546cf'], jewel: '#c4b5fd' },
  'diamond-badge': { metal: ['#f0fdff', '#7dd3fc', '#d8b4fe'], face: ['#552092', '#170a32', '#8b5cf6'], jewel: '#67e8f9' },
  'ruby-badge': { metal: ['#ffdf8e', '#9a3412', '#ffc857'], face: ['#9f1239', '#3b0614', '#e11d48'], jewel: '#fb7185' },
  'emerald-badge': { metal: ['#bbf7d0', '#047857', '#facc15'], face: ['#047857', '#052e2b', '#10b981'], jewel: '#34d399' },
  'cosmic-badge': { metal: ['#67e8f9', '#6d28d9', '#f0abfc'], face: ['#312e81', '#100b2d', '#7c3aed'], jewel: '#22d3ee' },
  'og-badge': { metal: ['#fde68a', '#713f12', '#f59e0b'], face: ['#171717', '#050505', '#292524'], jewel: '#fbbf24' },
};

export default function HH2Badge({
  id,
  name,
  size = 96,
  style,
}: {
  id: string;
  name?: string;
  size?: number;
  style?: React.CSSProperties;
}) {
  const variant = VARIANTS[id] ?? VARIANTS['silver-badge'];
  const slug = id.replace(/[^a-z0-9-]/gi, '');
  const metal = `hh2-${slug}-metal`;
  const face = `hh2-${slug}-face`;
  const jewel = `hh2-${slug}-jewel`;
  const label = name ?? id.replace(/-badge$/, '').replace(/-/g, ' ');

  return (
    <svg
      width={size}
      height={size * 1.12}
      viewBox="0 0 100 112"
      role="img"
      aria-label={label}
      style={{ display: 'block', flexShrink: 0, filter: 'drop-shadow(0 5px 8px rgba(0,0,0,.42))', ...style }}
    >
      <defs>
        <linearGradient id={metal} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={variant.metal[0]} />
          <stop offset=".48" stopColor={variant.metal[1]} />
          <stop offset="1" stopColor={variant.metal[2]} />
        </linearGradient>
        <linearGradient id={face} x1="0" y1="0" x2=".85" y2="1">
          <stop offset="0" stopColor={variant.face[0]} />
          <stop offset=".56" stopColor={variant.face[1]} />
          <stop offset="1" stopColor={variant.face[2]} />
        </linearGradient>
        <linearGradient id={jewel} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset=".45" stopColor={variant.jewel} />
          <stop offset="1" stopColor="#4c1d95" />
        </linearGradient>
      </defs>

      {/* Faceted shield body and inset enamel field */}
      <path d="M50 4 81 13 96 31 91 76 50 108 9 76 4 31 19 13Z" fill={`url(#${metal})`} stroke="#fff" strokeOpacity=".72" strokeWidth="1.4" />
      <path d="M50 10 77 18 89 33 85 72 50 99 15 72 11 33 23 18Z" fill="#090611" stroke={`url(#${metal})`} strokeWidth="2.2" />
      <path d="M50 17 72 24 81 36 78 68 50 90 22 68 19 36 28 24Z" fill={`url(#${face})`} stroke="rgba(255,255,255,.48)" strokeWidth="1" />

      {/* Tier facets */}
      <path d="M19 36 28 24 36 28 25 46Z" fill="#fff" fillOpacity=".14" />
      <path d="m81 36-9-12-8 4 11 18Z" fill="#fff" fillOpacity=".18" />
      <path d="m22 68 12-6-7 18-12-8Z" fill="#fff" fillOpacity=".12" />
      <path d="m78 68-12-6 7 18 12-8Z" fill="#fff" fillOpacity=".12" />

      {/* Signature Homiehouse crystal */}
      <path d="m50 5 11 13-11 16-11-16Z" fill={`url(#${jewel})`} stroke="#fff" strokeOpacity=".9" strokeWidth="1.3" />
      <path d="m50 5 1 29 10-16Z" fill="#fff" fillOpacity=".25" />
      <path d="m50 91 10 8-10 12-10-12Z" fill={`url(#${jewel})`} stroke="#fff" strokeOpacity=".8" strokeWidth="1.2" />

      {/* House mark */}
      <path d="m26 54 24-20 24 20-4 5-5-4v23H35V55l-5 4Z" fill="#09080e" stroke="#e9d5ff" strokeWidth="2" strokeLinejoin="round" />
      <path d="m32 52 18-15 18 15-3 4-15-12-15 12Z" fill="#a855f7" stroke="#e9d5ff" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M45 78V66a5 5 0 0 1 10 0v12Z" fill="#39ff75" stroke="#b7ffc8" strokeWidth="1.3" />
      <path d="M68 53V45h5v12Z" fill="#0b0910" stroke="#d8b4fe" strokeWidth="1" />
      {id === 'cosmic-badge' && (
        <g fill="#fff">
          <circle cx="29" cy="35" r="1.1" /><circle cx="71" cy="34" r="1" />
          <circle cx="23" cy="64" r=".8" /><circle cx="77" cy="63" r=".8" />
        </g>
      )}
    </svg>
  );
}
