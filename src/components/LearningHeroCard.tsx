'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const LS_PLAN_KEY = 'hh_learning_plan';
const LS_PROGRESS_KEY = 'hh_learning_progress';
const LS_DISMISSED_KEY = 'hh_learn_card_dismissed';

interface LearningPlan {
  track: 'learner' | 'creator' | 'financial' | 'all';
  level: 'beginner' | 'intermediate' | 'advanced';
  summary: string;
  modules: { id: string }[];
}

const TRACK_LABELS: Record<string, string> = {
  learner: 'Learner',
  creator: 'Creator',
  financial: 'Financial',
  all: 'All Tracks',
};

const TRACK_ICONS: Record<string, string> = {
  learner: '🧠',
  creator: '✍️',
  financial: '📈',
  all: '🌐',
};

function readPlan(): LearningPlan | null {
  try {
    const raw = localStorage.getItem(LS_PLAN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function readProgress(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_PROGRESS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function isDismissed(): boolean {
  try { return localStorage.getItem(LS_DISMISSED_KEY) === '1'; } catch { return false; }
}

export default function LearningHeroCard() {
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const p = readPlan();
    const progress = readProgress();
    const completedIds = p ? p.modules.filter(m => progress.has(m.id)).length : 0;
    setPlan(p);
    setCompletedCount(completedIds);
    setDismissed(isDismissed());
    setMounted(true);
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(LS_DISMISSED_KEY, '1'); } catch {}
    setDismissed(true);
  };

  if (!mounted || dismissed) return null;

  // ── Progress card (has a plan) ────────────────────────────────────────────
  if (plan) {
    const total = plan.modules.length;
    const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
    const icon = TRACK_ICONS[plan.track] ?? '🎓';
    const label = TRACK_LABELS[plan.track] ?? plan.track;

    return (
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '14px 16px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-on-dark)' }}>
              {label} Track
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted-on-dark)' }}>
              {completedCount} / {total} modules
            </span>
          </div>
          {/* Progress bar */}
          <div style={{ height: 6, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)',
              borderRadius: 4,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>

        <Link
          href="/learn"
          style={{
            flexShrink: 0,
            padding: '7px 14px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)',
            color: '#fff',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Continue →
        </Link>

        <button
          onClick={dismiss}
          aria-label="Dismiss"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-on-dark)', fontSize: 16, padding: 4, flexShrink: 0 }}
        >
          ✕
        </button>
      </div>
    );
  }

  // ── Hero card (no plan yet) ───────────────────────────────────────────────
  const tracks: Array<{ key: string; label: string; icon: string; desc: string }> = [
    { key: 'learner', label: 'Learner', icon: '🧠', desc: 'Understand the ecosystem' },
    { key: 'creator', label: 'Creator', icon: '✍️', desc: 'Build your audience' },
    { key: 'financial', label: 'Financial', icon: '📈', desc: 'Grow your wealth' },
  ];

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e1b4b 0%, #1a1a2e 60%, #0f172a 100%)',
      border: '1px solid #3730a3',
      borderRadius: 14,
      padding: '20px 20px 18px',
      marginBottom: 16,
      position: 'relative',
    }}>
      {/* Dismiss */}
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          position: 'absolute', top: 12, right: 12,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.4)', fontSize: 16, padding: 4,
        }}
      >
        ✕
      </button>

      {/* Headline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <svg width="22" height="22" fill="none" stroke="#a5b4fc" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        </svg>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#e0e7ff' }}>
          Your decentralization journey starts here
        </span>
      </div>

      <p style={{ fontSize: 13, color: 'rgba(224,231,255,0.7)', margin: '0 0 16px', lineHeight: 1.5 }}>
        Build a personalized learning plan — pick your path and we'll guide you step by step.
      </p>

      {/* Track pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {tracks.map(t => (
          <Link
            key={t.key}
            href={`/learn?track=${t.key}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 13px',
              borderRadius: 20,
              border: '1px solid rgba(99,102,241,0.5)',
              background: 'rgba(99,102,241,0.12)',
              textDecoration: 'none',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.25)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.12)')}
          >
            <span style={{ fontSize: 14 }}>{t.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#c7d2fe' }}>{t.label}</span>
            <span style={{ fontSize: 11, color: 'rgba(199,210,254,0.6)' }}>{t.desc}</span>
          </Link>
        ))}
      </div>

      {/* Main CTA */}
      <Link
        href="/learn"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '9px 18px',
          borderRadius: 9,
          fontSize: 14,
          fontWeight: 700,
          background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)',
          color: '#fff',
          textDecoration: 'none',
          boxShadow: '0 2px 12px rgba(99,102,241,0.35)',
        }}
      >
        Build My Learning Plan
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
