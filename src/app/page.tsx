"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNeynarContext } from "@/hooks/useNeynarCompat";
import NeynarSignIn from "../components/NeynarSignIn";
import HHLogo from "../components/HHLogo";

const PILLARS = [
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 14l9-5-9-5-9 5 9 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
      </svg>
    ),
    badge: 'Learn',
    title: 'Learning Hub',
    desc: 'Build a personalized roadmap through Web3, DeFi, and decentralization. Work through AI-curated modules, track your progress, and share milestones with your community.',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.08)',
    border: 'rgba(52,211,153,0.25)',
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    badge: 'Capture',
    title: 'Knowledge Hub',
    desc: 'Capture the ideas that matter. Save insights from casts, modules, and your own thinking. Build a personal knowledge base that grows with you on your journey.',
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.08)',
    border: 'rgba(251,191,36,0.25)',
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h6m-6-4h2" />
      </svg>
    ),
    badge: 'Social',
    title: 'Farcaster Feed',
    desc: 'Stay connected to the people and communities building the decentralized future. Browse feeds, cast your thoughts, and engage — from your own social home base.',
    color: '#818cf8',
    bg: 'rgba(99,102,241,0.08)',
    border: 'rgba(99,102,241,0.25)',
  },
];

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated } = useNeynarContext();
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && isAuthenticated) {
      router.replace('/learn');
    }
  }, [mounted, isAuthenticated, router]);

  if (!mounted) return null;
  if (isAuthenticated) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#f4f4f5', display: 'flex', flexDirection: 'column' }}>

      {/* Nav bar */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HHLogo size={32} />
          <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em' }}>HomieHouse</span>
        </div>
        <NeynarSignIn />
      </header>

      {/* Hero */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 20px 80px', maxWidth: 960, margin: '0 auto', width: '100%' }}>

        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 14px', borderRadius: 20, marginBottom: 28,
          background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)',
          fontSize: 13, fontWeight: 600, color: '#6ee7b7',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
          Learn Web3 your way
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 'clamp(36px, 7vw, 64px)',
          fontWeight: 800,
          textAlign: 'center',
          lineHeight: 1.15,
          letterSpacing: '-0.03em',
          margin: '0 0 20px',
          background: 'linear-gradient(135deg, #f4f4f5 0%, #a1a1aa 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Learn Web3.<br />Build in Public.
        </h1>

        <p style={{
          fontSize: 'clamp(16px, 2.5vw, 20px)',
          color: '#71717a',
          textAlign: 'center',
          maxWidth: 560,
          lineHeight: 1.65,
          margin: '0 0 40px',
        }}>
          A personalized learning platform for Web3 and DeFi — with an AI tutor, knowledge notes, and a Farcaster community to learn alongside.
        </p>

        {/* CTA */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 72 }}>
          <div style={{ transform: 'scale(1.1)' }}>
            <NeynarSignIn />
          </div>
          <span style={{ fontSize: 13, color: '#52525b' }}>Sign in with your Farcaster account · Free</span>
        </div>

        {/* Three pillars */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
          width: '100%',
        }}>
          {PILLARS.map((p) => (
            <div
              key={p.title}
              style={{
                padding: '24px 22px',
                borderRadius: 16,
                background: p.bg,
                border: `1px solid ${p.border}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ color: p.color }}>{p.icon}</div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                  background: `${p.color}18`, color: p.color, letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}>
                  {p.badge}
                </span>
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f4f4f5', margin: '0 0 8px' }}>{p.title}</h3>
                <p style={{ fontSize: 14, color: '#71717a', margin: 0, lineHeight: 1.65 }}>{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer style={{ textAlign: 'center', padding: '24px', fontSize: 12, color: '#3f3f46', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        HomieHouse · Learn Web3 · Built on Farcaster
      </footer>
    </div>
  );
}
