'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import HHLogo from '@/components/HHLogo';
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import { SUGGESTED_QUESTIONS } from '@/lib/ai/knowledge';

interface LearningPlan {
  summary?: string;
  modules?: Array<{ id: string; title: string; estimatedMinutes?: number }>;
}

interface Progress {
  plan?: LearningPlan;
  completed_ids?: string[];
  hh2_points?: number;
  streak?: { currentStreak?: number; current?: number };
}

export default function AuthenticatedHome() {
  const { fid, displayName, username } = useFarcasterAuth();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [casts, setCasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fid) return;
    let active = true;
    Promise.allSettled([
      fetch(`/api/learning-progress?fid=${fid}`).then(r => r.json()),
      fetch(`/api/feed?feed_type=following&fid=${fid}&limit=4`).then(r => r.json()),
    ]).then(([progressResult, feedResult]) => {
      if (!active) return;
      if (progressResult.status === 'fulfilled') setProgress(progressResult.value);
      if (feedResult.status === 'fulfilled') setCasts((feedResult.value.data ?? []).slice(0, 3));
      setLoading(false);
    });
    return () => { active = false; };
  }, [fid]);

  const plan = progress?.plan;
  const completed = useMemo(() => progress?.completed_ids ?? [], [progress?.completed_ids]);
  const modules = useMemo(() => plan?.modules ?? [], [plan?.modules]);
  const percent = modules.length ? Math.round((completed.length / modules.length) * 100) : 0;
  const nextModule = useMemo(() => modules.find(module => !completed.includes(module.id)), [modules, completed]);
  const streak = progress?.streak?.currentStreak ?? progress?.streak?.current ?? 0;
  const firstName = (displayName || username || 'Homie').split(' ')[0];

  return (
    <AppShell>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <HHLogo size={34} />
        <div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-on-dark)' }}>Welcome home</p>
          <h1 style={{ margin: 0, fontSize: 22, color: 'var(--text-on-dark)' }}>Hey, {firstName} 👋</h1>
        </div>
      </header>

      <section style={{
        borderRadius: 18, padding: 22, marginBottom: 18,
        background: 'linear-gradient(135deg, rgba(52,211,153,.13), rgba(99,102,241,.09))',
        border: '1px solid rgba(52,211,153,.24)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px' }}>
            <p style={{ margin: '0 0 6px', color: '#6ee7b7', fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>Your learning layer for Farcaster</p>
            <h2 style={{ margin: '0 0 7px', fontSize: 20, color: 'var(--text-on-dark)' }}>
              {nextModule?.title ?? (modules.length ? 'Learning plan complete!' : 'Build your first learning plan')}
            </h2>
            <p style={{ margin: 0, color: 'var(--muted-on-dark)', fontSize: 13, lineHeight: 1.55 }}>
              {plan?.summary ?? 'Turn the topics in your feed into a personal path, ask questions in plain English, and share what clicks.'}
            </p>
            <p style={{ margin: '9px 0 0', color: '#a5b4fc', fontSize: 12, fontWeight: 650 }}>
              Learn it → spot it in your feed → explain it back
            </p>
          </div>
          <Link href={nextModule ? `/learn/module?id=${encodeURIComponent(nextModule.id)}` : '/learn'} style={{
            padding: '10px 16px', borderRadius: 10, background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-color)',
            border: '1px solid var(--border)', textDecoration: 'none', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
          }}>
            {nextModule ? 'Continue learning →' : 'Start learning →'}
          </Link>
        </div>
        <div style={{ marginTop: 18, height: 8, borderRadius: 99, overflow: 'hidden', background: 'rgba(255,255,255,.08)' }}>
          <div style={{ width: `${percent}%`, height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#34d399,#818cf8)', transition: 'width .3s ease' }} />
        </div>
        <div style={{ display: 'flex', gap: 18, marginTop: 10, color: 'var(--muted-on-dark)', fontSize: 12, flexWrap: 'wrap' }}>
          <span><strong style={{ color: 'var(--text-on-dark)' }}>{percent}%</strong> complete</span>
          <span>🔥 <strong style={{ color: 'var(--text-on-dark)' }}>{streak}</strong> day streak</span>
          <span>🪙 <strong style={{ color: 'var(--text-on-dark)' }}>{progress?.hh2_points ?? completed.length * 100}</strong> HH2 earned</span>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginBottom: 24 }}>
        <Link href="/compose" style={{ padding: 18, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', textDecoration: 'none' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>✍️</div>
          <strong style={{ color: 'var(--text-on-dark)', fontSize: 15 }}>Cast something</strong>
          <p style={{ color: 'var(--muted-on-dark)', fontSize: 12, lineHeight: 1.5, margin: '5px 0 0' }}>Share what you're learning or what's on your mind.</p>
        </Link>
        <Link href="/shop" style={{ padding: 18, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', textDecoration: 'none' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🛍️</div>
          <strong style={{ color: 'var(--text-on-dark)', fontSize: 15 }}>Spend your HH2</strong>
          <p style={{ color: 'var(--muted-on-dark)', fontSize: 12, lineHeight: 1.5, margin: '5px 0 0' }}>Turn your learning rewards into badges, themes, and perks.</p>
        </Link>
      </section>

      {/* ── Ask Homie ── */}
      <section style={{ marginBottom: 24 }}>
        <div style={{
          borderRadius: 18, padding: 22,
          background: 'linear-gradient(135deg, rgba(99,102,241,.10), rgba(168,85,247,.06))',
          border: '1px solid rgba(99,102,241,.20)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>🤖</span>
                <h2 style={{ margin: 0, fontSize: 18, color: 'var(--text-on-dark)' }}>Ask Homie</h2>
              </div>
              <p style={{ margin: '0 0 14px', color: 'var(--muted-on-dark)', fontSize: 13, lineHeight: 1.55 }}>
                Confused by something in your feed? Ask about Farcaster, crypto, DeFi, or anything Web3 — get a plain-English answer.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SUGGESTED_QUESTIONS.slice(0, 4).map(q => (
                  <Link
                    key={q.label}
                    href={`/ask-homie?q=${encodeURIComponent(q.label)}`}
                    style={{
                      padding: '8px 14px', borderRadius: 10,
                      background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
                      color: '#a5b4fc', fontSize: 13, fontWeight: 600, textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {q.label}
                  </Link>
                ))}
              </div>
            </div>
            <Link
              href="/ask-homie"
              style={{
                padding: '12px 20px', borderRadius: 12,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none',
                whiteSpace: 'nowrap', alignSelf: 'flex-start',
              }}
            >
              Ask anything →
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 17, color: 'var(--text-on-dark)' }}>From your feed</h2>
          <Link href="/feed" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>See all →</Link>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading && [0, 1, 2].map(i => <div key={i} style={{ height: 96, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', opacity: .55 }} />)}
          {!loading && casts.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted-on-dark)', fontSize: 13 }}>
              Your feed is quiet right now. Explore trending conversations in the full feed.
            </div>
          )}
          {casts.map(cast => (
            <Link key={cast.hash} href={`/cast/${cast.hash}`} style={{ display: 'block', padding: 15, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                {cast.author?.pfp_url ? <Image src={cast.author.pfp_url} alt="" width={32} height={32} style={{ borderRadius: '50%', objectFit: 'cover' }} /> : <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--border)' }} />}
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--text-on-dark)', fontSize: 13, fontWeight: 700 }}>{cast.author?.display_name || cast.author?.username || 'Farcaster user'}</div>
                  <div style={{ color: 'var(--muted-on-dark)', fontSize: 11 }}>@{cast.author?.username || 'unknown'}</div>
                </div>
              </div>
              <p style={{ margin: 0, color: 'var(--text-on-dark)', fontSize: 13, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{cast.text}</p>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
