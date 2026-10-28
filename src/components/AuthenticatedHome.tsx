'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import { useFarcasterAuth } from '@/lib/farcaster-auth';

interface LearningPlan {
  summary?: string;
  modules?: Array<{ id: string; title: string; estimatedMinutes?: number }>;
}

interface Progress {
  plan?: LearningPlan;
  completed_ids?: string[];
}

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: 190,
  padding: 22,
  borderRadius: 18,
  background: 'var(--surface)',
  textDecoration: 'none',
  color: 'inherit',
};

export default function AuthenticatedHome() {
  const { fid, displayName, username } = useFarcasterAuth();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fid) {
      setProgress(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    let active = true;
    fetch(`/api/learning-progress?fid=${fid}`)
      .then(response => response.ok ? response.json() : null)
      .then(value => {
        if (active) setProgress(value);
      })
      .catch(() => {
        if (active) setProgress(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [fid]);

  const plan = progress?.plan;
  const modules = useMemo(() => plan?.modules ?? [], [plan?.modules]);
  const completed = progress?.completed_ids ?? [];
  const completedSet = useMemo(() => new Set(completed), [completed]);
  const nextModule = modules.find(module => !completedSet.has(module.id));
  const percent = modules.length ? Math.min(100, Math.round((completed.length / modules.length) * 100)) : 0;
  const firstName = (displayName || username || '').split(' ')[0];
  const pathHref = modules.length ? '/learn?tab=plan' : '/learn?tab=catalog';

  return (
    <AppShell>
      <main style={{ maxWidth: 1040, margin: '0 auto', padding: '12px 16px 44px' }}>
        <header style={{ margin: '10px 0 28px' }}>
          <p style={{ margin: '0 0 5px', color: 'var(--muted-on-dark)', fontSize: 13, fontWeight: 650, letterSpacing: '.08em', textTransform: 'uppercase' }}>HomieHouse</p>
          <h1 style={{ margin: 0, color: 'var(--text-on-dark)', fontSize: 30, lineHeight: 1.2 }}>Home{firstName ? ` · ${firstName}` : ''}</h1>
          <p style={{ margin: '9px 0 0', maxWidth: 560, color: 'var(--muted-on-dark)', fontSize: 15, lineHeight: 1.6 }}>Choose where you want to go next.</p>
        </header>

        <section aria-label="Your HomieHouse destinations" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 270px), 1fr))', gap: 16 }}>
          <Link href={pathHref} style={{ ...cardStyle, background: 'linear-gradient(145deg, rgba(190,44,48,.22), var(--surface) 75%)' }}>
            <span aria-hidden="true" style={{ fontSize: 28 }}>📚</span>
            <h2 style={{ margin: '16px 0 6px', color: 'var(--text-on-dark)', fontSize: 20 }}>Your learning path</h2>
            {loading ? (
              <p style={{ margin: 0, color: 'var(--muted-on-dark)', lineHeight: 1.6 }}>Loading your progress…</p>
            ) : modules.length ? (
              <>
                <p style={{ margin: 0, color: 'var(--muted-on-dark)', lineHeight: 1.6 }}>
                  {nextModule ? `Continue with ${nextModule.title}.` : 'You completed your current path. Choose what to learn next.'}
                </p>
                <div aria-label={`${percent}% complete`} style={{ height: 6, marginTop: 16, overflow: 'hidden', borderRadius: 99, background: 'rgba(255,255,255,.1)' }}>
                  <div style={{ height: '100%', width: `${percent}%`, borderRadius: 99, background: 'var(--accent)' }} />
                </div>
                <span style={{ marginTop: 7, color: 'var(--muted-on-dark)', fontSize: 12 }}>{percent}% complete</span>
              </>
            ) : (
              <p style={{ margin: 0, color: 'var(--muted-on-dark)', lineHeight: 1.6 }}>Browse courses and choose an interactive path that fits you.</p>
            )}
            <span style={{ marginTop: 'auto', paddingTop: 20, color: 'var(--accent)', fontWeight: 700 }}>{modules.length ? 'Open current path →' : 'Browse the course catalog →'}</span>
          </Link>

          <Link href="/feed" style={{ ...cardStyle, background: 'linear-gradient(145deg, rgba(251,191,36,.14), var(--surface) 75%)' }}>
            <span aria-hidden="true" style={{ fontSize: 28 }}>📰</span>
            <h2 style={{ margin: '16px 0 6px', color: 'var(--text-on-dark)', fontSize: 20 }}>Feed</h2>
            <p style={{ margin: 0, color: 'var(--muted-on-dark)', lineHeight: 1.6 }}>Catch up on conversations and ideas from your community.</p>
            <span style={{ marginTop: 'auto', paddingTop: 20, color: 'var(--accent)', fontWeight: 700 }}>Go to your feed →</span>
          </Link>

          <Link href="/ask-homie" style={{ ...cardStyle, background: 'linear-gradient(145deg, rgba(99,102,241,.18), var(--surface) 75%)' }}>
            <span aria-hidden="true" style={{ fontSize: 28 }}>🤖</span>
            <h2 style={{ margin: '16px 0 6px', color: 'var(--text-on-dark)', fontSize: 20 }}>Ask Homie</h2>
            <p style={{ margin: 0, color: 'var(--muted-on-dark)', lineHeight: 1.6 }}>Ask a question and get a clear explanation in plain English.</p>
            <span style={{ marginTop: 'auto', paddingTop: 20, color: 'var(--accent)', fontWeight: 700 }}>Ask a question →</span>
          </Link>
        </section>
      </main>
    </AppShell>
  );
}
