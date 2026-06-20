"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNeynarContext } from "@/hooks/useNeynarCompat";
import NeynarSignIn from "../components/NeynarSignIn";
import HHLogo from "../components/HHLogo";

// ─── Static sample module (shows value before auth) ───────────────────────────

const SAMPLE_MODULE = {
  title: "What Is DeFi and Why Does It Matter?",
  difficulty: "beginner" as const,
  minutes: 12,
  objectives: [
    "Understand how DeFi removes banks from the equation",
    "Explore lending, swapping, and earning on-chain",
    "Learn why self-custody changes the rules of money",
  ],
  preview:
    "DeFi — short for decentralized finance — lets you lend, borrow, swap, and earn without a bank acting as the middleman. Instead of trusting an institution, you trust open-source code. Anyone with a wallet can access the same protocols as a hedge fund.",
};

const DIFF_COLOR: Record<string, string> = {
  beginner: '#22c55e',
  intermediate: '#f97316',
  advanced: '#a855f7',
};

// ─── Feature pillars ──────────────────────────────────────────────────────────

const PILLARS = [
  {
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 14l9-5-9-5-9 5 9 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
      </svg>
    ),
    title: 'AI Learning Plans',
    desc: 'A personalized roadmap through Web3, DeFi, and crypto — built for your level and goals.',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.08)',
    border: 'rgba(52,211,153,0.2)',
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h6m-6-4h2" />
      </svg>
    ),
    title: 'Farcaster Feed',
    desc: 'Browse your community, cast thoughts, and follow builders on the decentralized web.',
    color: '#818cf8',
    bg: 'rgba(99,102,241,0.08)',
    border: 'rgba(99,102,241,0.2)',
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: 'Ask Homie AI',
    desc: 'Get plain-English explanations of any Web3 concept. Paste any article URL for an instant summary.',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.2)',
  },
];

// ─── Cast preview card ────────────────────────────────────────────────────────

function CastCard({ cast }: { cast: any }) {
  const author = cast.author || {};
  const text = cast.text || '';
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 12,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        {author.pfp_url ? (
          <img
            src={author.pfp_url} alt=""
            style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
        )}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e4e4e7' }}>{author.display_name || author.username || 'anon'}</div>
          <div style={{ fontSize: 11, color: '#52525b' }}>@{author.username || '—'}</div>
        </div>
      </div>
      <p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.6, margin: 0 }}>
        {text.length > 180 ? text.slice(0, 180) + '…' : text}
      </p>
      {cast.reactions && (
        <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 12, color: '#52525b' }}>
          <span>❤️ {cast.reactions.likes_count ?? cast.reactions.likes ?? 0}</span>
          <span>🔁 {cast.reactions.recasts_count ?? cast.reactions.recasts ?? 0}</span>
          <span>💬 {cast.replies?.count ?? 0}</span>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated } = useNeynarContext();
  const router = useRouter();
  const [casts, setCasts] = useState<any[]>([]);
  const [learnerCount, setLearnerCount] = useState(0);
  const [castsLoading, setCastsLoading] = useState(true);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && isAuthenticated) router.replace('/learn');
  }, [mounted, isAuthenticated, router]);

  useEffect(() => {
    if (!mounted) return;
    fetch('/api/casts/search?q=DeFi web3&limit=6')
      .then(r => r.json())
      .then(d => setCasts((d.casts || []).filter((c: any) => c.text?.length > 40).slice(0, 4)))
      .catch(() => {})
      .finally(() => setCastsLoading(false));
    fetch('/api/learner-count')
      .then(r => r.json())
      .then(d => setLearnerCount(d.count || 0))
      .catch(() => {});
  }, [mounted]);

  if (!mounted || isAuthenticated) {
    return (
      <div style={{ minHeight: '100dvh', background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@keyframes hhSpin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#34d399', animation: 'hhSpin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#f4f4f5', display: 'flex', flexDirection: 'column' }}>

      {/* Nav */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, background: 'rgba(9,9,11,0.85)', backdropFilter: 'blur(12px)', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HHLogo size={30} />
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>HomieHouse</span>
        </div>
        <NeynarSignIn />
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>

        {/* ── Hero ── */}
        <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px 48px', maxWidth: 720, width: '100%', textAlign: 'center' }}>

          {/* Live badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 14px', borderRadius: 20, marginBottom: 24,
            background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)',
            fontSize: 13, fontWeight: 600, color: '#6ee7b7',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block', animation: 'hh-pulse 2s ease-in-out infinite' }} />
            {learnerCount > 0 ? `${learnerCount.toLocaleString()} people learning Web3` : 'Learn Web3 your way'}
            <style>{`@keyframes hh-pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
          </div>

          <h1 style={{
            fontSize: 'clamp(34px, 7vw, 60px)',
            fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.03em', margin: '0 0 18px',
            background: 'linear-gradient(135deg, #f4f4f5 0%, #a1a1aa 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Your cozy, decentralized<br />learning corner.
          </h1>

          <p style={{ fontSize: 'clamp(15px, 2.5vw, 18px)', color: '#71717a', maxWidth: 520, lineHeight: 1.7, margin: '0 0 36px' }}>
            AI-built learning plans, your Farcaster feed, an AI tutor, and a personal knowledge base — all in one place. Free, and built on the open social web.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ transform: 'scale(1.1)' }}>
              <NeynarSignIn />
            </div>
            <span style={{ fontSize: 12, color: '#3f3f46' }}>Sign in with Farcaster · Free · No wallet setup needed</span>
          </div>
        </section>

        {/* ── Sample learning module ── */}
        <section style={{ width: '100%', maxWidth: 720, padding: '0 20px 56px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', marginBottom: 14 }}>
            📚 Sample lesson — what you'll learn
          </p>

          <div style={{
            borderRadius: 16, border: '1px solid rgba(52,211,153,0.2)',
            background: 'linear-gradient(135deg, rgba(52,211,153,0.06) 0%, rgba(9,9,11,0) 100%)',
            overflow: 'hidden',
          }}>
            {/* Module header */}
            <div style={{ padding: '20px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                  background: `${DIFF_COLOR[SAMPLE_MODULE.difficulty]}22`,
                  color: DIFF_COLOR[SAMPLE_MODULE.difficulty],
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  {SAMPLE_MODULE.difficulty}
                </span>
                <span style={{ fontSize: 12, color: '#52525b' }}>⏱ {SAMPLE_MODULE.minutes} min</span>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f4f4f5', margin: '0 0 6px', lineHeight: 1.3 }}>
                {SAMPLE_MODULE.title}
              </h3>
            </div>

            {/* Objectives */}
            <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#52525b', margin: '0 0 10px' }}>
                What you'll learn
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {SAMPLE_MODULE.objectives.map((obj, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: '#34d399', fontSize: 14, flexShrink: 0, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.5 }}>{obj}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Lesson preview */}
            <div style={{ padding: '16px 22px' }}>
              <p style={{ fontSize: 13, color: '#71717a', lineHeight: 1.7, margin: '0 0 16px', fontStyle: 'italic' }}>
                "{SAMPLE_MODULE.preview}"
              </p>
              <button
                onClick={() => {/* trigger sign in */}}
                style={{
                  width: '100%', padding: '12px', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
                Sign in to start this lesson →
              </button>
            </div>
          </div>
        </section>

        {/* ── Live Farcaster community preview ── */}
        <section style={{ width: '100%', maxWidth: 720, padding: '0 20px 64px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', marginBottom: 14 }}>
            📡 Live from the Farcaster community
          </p>

          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {castsLoading && [0, 1, 2].map(i => (
                <div key={i} style={{
                  height: 90, borderRadius: 12,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  animation: 'hh-shimmer 1.5s ease-in-out infinite',
                }}>
                  <style>{`@keyframes hh-shimmer{0%,100%{opacity:0.4}50%{opacity:0.8}}`}</style>
                </div>
              ))}
              {!castsLoading && casts.length === 0 && (
                // Fallback static previews if API is slow / empty
                [{
                  text: "Learning about Hyperliquid today — the first perps DEX that did a community-only airdrop with no VC allocation. This is what decentralized finance is supposed to look like.",
                  author: { display_name: "web3learner", username: "web3learner" },
                  reactions: { likes_count: 47, recasts_count: 12 }, replies: { count: 8 },
                }, {
                  text: "If you don't understand DeFi yet, start with this: your bank earns ~4% on your deposits and gives you 0.5%. On-chain lending protocols pass most of that yield directly to you.",
                  author: { display_name: "defi.daily", username: "defi_daily" },
                  reactions: { likes_count: 134, recasts_count: 31 }, replies: { count: 22 },
                }, {
                  text: "Base chain has gone from 0 to millions of daily active addresses in under 2 years. Coinbase quietly building the onramp to decentralized apps for the next billion users.",
                  author: { display_name: "onchain builder", username: "builder" },
                  reactions: { likes_count: 89, recasts_count: 19 }, replies: { count: 15 },
                }].map((c, i) => <CastCard key={i} cast={c} />)
              )}
              {casts.map((cast, i) => <CastCard key={i} cast={cast} />)}
            </div>

            {/* Gradient fade + CTA */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 160,
              background: 'linear-gradient(to top, #09090b 0%, #09090b 30%, rgba(9,9,11,0) 100%)',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              paddingBottom: 16,
            }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: '#71717a', marginBottom: 12 }}>
                  Sign in to see your personalized Web3 feed
                </p>
                <NeynarSignIn />
              </div>
            </div>
          </div>
        </section>

        {/* ── Feature pillars ── */}
        <section style={{ width: '100%', maxWidth: 960, padding: '0 20px 80px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', marginBottom: 20, textAlign: 'center' }}>
            Everything in one place
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {PILLARS.map((p) => (
              <div key={p.title} style={{
                padding: '20px 18px', borderRadius: 14,
                background: p.bg, border: `1px solid ${p.border}`,
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ color: p.color }}>{p.icon}</div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#f4f4f5', margin: '0 0 6px' }}>{p.title}</h3>
                  <p style={{ fontSize: 13, color: '#71717a', margin: 0, lineHeight: 1.6 }}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer style={{ textAlign: 'center', padding: '24px 20px', fontSize: 12, color: '#3f3f46', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        HomieHouse · Learn Web3 · Built on Farcaster
      </footer>
    </div>
  );
}
