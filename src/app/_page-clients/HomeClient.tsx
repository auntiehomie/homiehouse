"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useFarcasterUser } from "@/hooks/useFarcasterUser";
import SignInButton from "@/components/SignInButton";
import HHLogo from "@/components/HHLogo";
import AuthenticatedHome from "@/components/AuthenticatedHome";

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

// ─── Feature pillars (plain-English, no jargon) ──────────────────────────────

const PILLARS = [
  {
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 14l9-5-9-5-9 5 9 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
      </svg>
    ),
    title: 'Learn at your pace',
    desc: 'Bite-sized lessons that explain crypto in plain English. Start as a total beginner — no prior knowledge needed.',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.08)',
    border: 'rgba(52,211,153,0.2)',
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    title: 'Join real conversations',
    desc: 'See what people are actually talking about in crypto and social media — and finally understand the jargon.',
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
    title: 'Ask anything, get real answers',
    desc: 'Confused by a term you saw? Paste a link or ask a question — get a clear, jargon-free explanation instantly.',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.2)',
  },
];

// ─── "What is this?" explainer for non-crypto visitors ─────────────────────────

const EXPLAINER_STEPS = [
  {
    q: 'What is Farcaster?',
    a: 'It\'s a social network — like Twitter, but nobody owns it. Your posts and followers are yours, not a company\'s. HomieHouse is a client for Farcaster, meaning it\'s one way to use it.',
  },
  {
    q: 'Do I need to know crypto?',
    a: 'No. That\'s the whole point. HomieHouse teaches you what you need to know, one short lesson at a time. Start with zero knowledge.',
  },
  {
    q: 'What does it cost?',
    a: 'Free. You earn points (called HH2) for completing lessons, which unlock themes and perks. No credit card, no wallet setup required to start.',
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

export default function HomeClient() {
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated } = useFarcasterUser();
  const [casts, setCasts] = useState<any[]>([]);
  const [learnerCount, setLearnerCount] = useState(0);
  const [castsLoading, setCastsLoading] = useState(true);
  const [showExplainer, setShowExplainer] = useState(false);

  useEffect(() => { setMounted(true); }, []);

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

  if (!mounted) {
    return (
      <div style={{ minHeight: '100dvh', background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@keyframes hhSpin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#34d399', animation: 'hhSpin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (isAuthenticated) return <AuthenticatedHome />;

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#f4f4f5', display: 'flex', flexDirection: 'column' }}>

      {/* Nav */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, background: 'rgba(9,9,11,0.85)', backdropFilter: 'blur(12px)', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HHLogo size={30} />
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>HomieHouse</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/learn/library" style={{ fontSize: 14, color: '#a1a1aa', textDecoration: 'none' }}>
            Browse free lessons
          </Link>
          <SignInButton />
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>

        {/* ── Hero ── */}
        <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 20px 40px', maxWidth: 720, width: '100%', textAlign: 'center' }}>

          {/* Live badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 14px', borderRadius: 20, marginBottom: 24,
            background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)',
            fontSize: 13, fontWeight: 600, color: '#6ee7b7',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block', animation: 'hh-pulse 2s ease-in-out infinite' }} />
            {learnerCount > 0 ? `${learnerCount.toLocaleString()} people learning here` : 'Free crypto lessons, no experience needed'}
            <style>{`@keyframes hh-pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
          </div>

          <h1 style={{
            fontSize: 'clamp(32px, 7vw, 56px)',
            fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.03em', margin: '0 0 18px',
            background: 'linear-gradient(135deg, #f4f4f5 0%, #a1a1aa 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Learn crypto.<br />Actually understand it.
          </h1>

          <p style={{ fontSize: 'clamp(15px, 2.5vw, 18px)', color: '#71717a', maxWidth: 540, lineHeight: 1.7, margin: '0 0 28px' }}>
            Short, plain-English lessons that take you from &ldquo;what is crypto?&rdquo; to confidently joining the conversation. No jargon, no pressure, no wallet required to start.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link href="/learn?track=survival" style={{
                padding: '12px 24px', borderRadius: 12, background: '#34d399', color: '#09090b',
                fontWeight: 700, fontSize: 15, textDecoration: 'none', whiteSpace: 'nowrap',
              }}>
                Start your first lesson →
              </Link>
              <div style={{ transform: 'scale(1)' }}>
                <SignInButton />
              </div>
            </div>
            <span style={{ fontSize: 12, color: '#3f3f46', marginTop: 4 }}>
              Free · Sign in with Farcaster · No wallet setup needed
            </span>
          </div>
        </section>

        {/* ── "What is this?" explainer for newcomers ── */}
        <section style={{ width: '100%', maxWidth: 720, padding: '0 20px 48px' }}>
          <button
            onClick={() => setShowExplainer(!showExplainer)}
            style={{
              width: '100%', padding: '16px 20px', borderRadius: 14,
              background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)',
              color: '#a5b4fc', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <span>Wait — what is Farcaster? Do I need to know crypto?</span>
            <span style={{ fontSize: 18 }}>{showExplainer ? '−' : '+'}</span>
          </button>
          {showExplainer && (
            <div style={{
              marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10,
              animation: 'hh-fade-in 0.2s ease',
            }}>
              <style>{`@keyframes hh-fade-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}`}</style>
              {EXPLAINER_STEPS.map((item) => (
                <div key={item.q} style={{
                  padding: '16px 18px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#e4e4e7', margin: '0 0 6px' }}>{item.q}</p>
                  <p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.6, margin: 0 }}>{item.a}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Sample learning module ── */}
        <section style={{ width: '100%', maxWidth: 720, padding: '0 20px 56px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', marginBottom: 14 }}>
            📚 Try a free lesson — see what you&apos;ll learn
          </p>

          <Link href="/learn/library/wallet-basics" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
          <div style={{
            borderRadius: 16, border: '1px solid rgba(52,211,153,0.2)',
            background: 'linear-gradient(135deg, rgba(52,211,153,0.06) 0%, rgba(9,9,11,0) 100%)',
            overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.2s',
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
                <span style={{ fontSize: 11, color: '#34d399', fontWeight: 600, marginLeft: 'auto' }}>Start free →</span>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f4f4f5', margin: '0 0 6px', lineHeight: 1.3 }}>
                {SAMPLE_MODULE.title}
              </h3>
            </div>

            {/* Objectives */}
            <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#52525b', margin: '0 0 10px' }}>
                What you&apos;ll learn
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

            {/* Preview text */}
            <div style={{ padding: '16px 22px' }}>
              <p style={{ fontSize: 13, color: '#71717a', lineHeight: 1.7, margin: 0 }}>
                {SAMPLE_MODULE.preview}
              </p>
            </div>
          </div>
          </Link>
        </section>

        {/* ── Real conversations preview ── */}
        <section style={{ width: '100%', maxWidth: 720, padding: '0 20px 56px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', marginBottom: 14, textAlign: 'center' }}>
            Real conversations happening now
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
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
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <p style={{ fontSize: 13, color: '#71717a', marginBottom: 12 }}>
              Sign in to join the conversation and see your personalized feed
            </p>
            <SignInButton />
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

        {/* ── How it works (3 steps) ── */}
        <section style={{ width: '100%', maxWidth: 720, padding: '0 20px 80px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', marginBottom: 20, textAlign: 'center' }}>
            How it works
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { n: '01', title: 'Take a 10-minute lesson', desc: 'Pick a topic — wallet safety, DeFi basics, scam defense. Each lesson is short and written in plain English.' },
              { n: '02', title: 'Understand what people are saying', desc: 'Now the crypto posts in your feed make sense. Ask Homie AI to explain anything you\'re still curious about.' },
              { n: '03', title: 'Share what you learned', desc: 'Post your take with #HomieHouseLearning. Earn HH2 points for each lesson and climb the weekly leaderboard.' },
            ].map((step) => (
              <div key={step.n} style={{
                display: 'flex', gap: 16, padding: '18px 20px', borderRadius: 14,
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: '#34d399', flexShrink: 0 }}>{step.n}</span>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#f4f4f5', margin: '0 0 4px' }}>{step.title}</h3>
                  <p style={{ fontSize: 13, color: '#71717a', margin: 0, lineHeight: 1.6 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section style={{ width: '100%', maxWidth: 720, padding: '0 20px 80px', textAlign: 'center' }}>
          <div style={{
            padding: '32px 24px', borderRadius: 20,
            background: 'linear-gradient(135deg, rgba(52,211,153,0.1) 0%, rgba(99,102,241,0.08) 100%)',
            border: '1px solid rgba(52,211,153,0.18)',
          }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#f4f4f5', margin: '0 0 8px' }}>
              Ready to actually understand crypto?
            </h2>
            <p style={{ fontSize: 14, color: '#71717a', margin: '0 0 20px' }}>
              Start with one free lesson. No wallet, no jargon, no pressure.
            </p>
            <Link href="/learn?track=survival" style={{
              display: 'inline-block', padding: '14px 32px', borderRadius: 12,
              background: '#34d399', color: '#09090b', fontWeight: 700, fontSize: 16, textDecoration: 'none',
            }}>
              Start your first lesson →
            </Link>
          </div>
        </section>
      </main>

      <footer style={{ textAlign: 'center', padding: '24px 20px', fontSize: 12, color: '#3f3f46', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        HomieHouse · Learn crypto in plain English · <Link href="/community" style={{ color: '#52525b', textDecoration: 'none' }}>Community</Link> · <Link href="/learn/library" style={{ color: '#52525b', textDecoration: 'none' }}>Free lessons</Link>
      </footer>
    </div>
  );
}
