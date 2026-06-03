'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import HHLogo from '@/components/HHLogo';
import SidebarNav from '@/components/SidebarNav';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LearningModule {
  id: string;
  title: string;
  description: string;
  whyItMatters: string;
  objectives: string[];
  estimatedMinutes: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
}

interface LearningPlan {
  track: 'learner' | 'creator' | 'financial' | 'all';
  level: 'beginner' | 'intermediate' | 'advanced';
  summary: string;
  modules: LearningModule[];
}

type PageState = 'quiz' | 'generating' | 'plan';
type Track = 'learner' | 'creator' | 'financial' | 'all';
type Level = 'beginner' | 'intermediate' | 'advanced';

const LS_PLAN_KEY = 'hh_learning_plan';
const LS_PROGRESS_KEY = 'hh_learning_progress';

// ─── Graduation Cap Icon ──────────────────────────────────────────────────────

function GradCapIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    </svg>
  );
}

// ─── Difficulty Badge ─────────────────────────────────────────────────────────

function DifficultyBadge({ level }: { level: 'beginner' | 'intermediate' | 'advanced' }) {
  const labels: Record<string, string> = {
    beginner: '🌱 Beginner',
    intermediate: '🔥 Intermediate',
    advanced: '⚡ Advanced',
  };
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 600,
      padding: '2px 8px',
      borderRadius: 20,
      border: '1px solid var(--border)',
      color: 'var(--muted-on-dark)',
      whiteSpace: 'nowrap',
    }}>
      {labels[level] || level}
    </span>
  );
}

// ─── Module Card ──────────────────────────────────────────────────────────────

function ModuleCard({
  module,
  index,
  completed,
  onToggle,
}: {
  module: LearningModule;
  index: number;
  completed: boolean;
  onToggle: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      overflow: 'hidden',
      opacity: completed ? 0.65 : 1,
      transition: 'opacity 0.2s',
    }}>
      {/* Header — always visible */}
      <div
        style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 18px', cursor: 'pointer' }}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(module.id); }}
          aria-label={completed ? 'Mark incomplete' : 'Mark complete'}
          style={{
            flexShrink: 0,
            marginTop: 2,
            width: 22,
            height: 22,
            borderRadius: 6,
            border: `2px solid ${completed ? 'var(--accent)' : 'var(--border)'}`,
            background: completed ? 'var(--accent)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {completed && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="var(--bg-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Title + description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted-on-dark)', fontVariantNumeric: 'tabular-nums' }}>
              {String(index + 1).padStart(2, '0')}
            </span>
            <span style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--text-on-dark)',
              textDecoration: completed ? 'line-through' : 'none',
            }}>
              {module.title}
            </span>
            <DifficultyBadge level={module.difficulty} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: 0, lineHeight: 1.5 }}>
            {module.description}
          </p>
        </div>

        {/* Expand chevron */}
        <span style={{
          flexShrink: 0,
          color: 'var(--muted-on-dark)',
          fontSize: 14,
          transition: 'transform 0.2s',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          marginTop: 2,
        }}>
          ▾
        </span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: '0 18px 18px 54px', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{
            padding: '10px 14px',
            background: 'var(--bg-dark)',
            borderRadius: 10,
            borderLeft: '3px solid var(--accent)',
            marginBottom: 12,
          }}>
            <p style={{ fontSize: 13, color: 'var(--text-on-dark)', margin: 0, fontStyle: 'italic', lineHeight: 1.5 }}>
              💡 {module.whyItMatters}
            </p>
          </div>

          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted-on-dark)', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            What you'll learn
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {module.objectives.map((obj, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text-on-dark)', lineHeight: 1.5 }}>
                <span style={{ flexShrink: 0, color: 'var(--accent)', marginTop: 1 }}>→</span>
                <span>{obj}</span>
              </li>
            ))}
          </ul>

          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--muted-on-dark)' }}>⏱ ~{module.estimatedMinutes} min</span>
            <span style={{ color: 'var(--border)', fontSize: 12 }}>·</span>
            {module.tags.map((tag) => (
              <span key={tag} style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 20,
                border: '1px solid var(--border)',
                color: 'var(--muted-on-dark)',
              }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LearnPage() {
  const [pageState, setPageState] = useState<PageState>('quiz');
  const [step, setStep] = useState(1);
  const [track, setTrack] = useState<Track | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  // Index into levelOptions so "Complete beginner" and "Some context" can both map to 'beginner' distinctly
  const [levelIdx, setLevelIdx] = useState<number | null>(null);
  const [goals, setGoals] = useState('');
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Load persisted data on mount
  useEffect(() => {
    try {
      const storedPlan = localStorage.getItem(LS_PLAN_KEY);
      const storedProgress = localStorage.getItem(LS_PROGRESS_KEY);
      if (storedPlan) {
        setPlan(JSON.parse(storedPlan) as LearningPlan);
        setPageState('plan');
      }
      if (storedProgress) {
        setCompletedIds(new Set(JSON.parse(storedProgress) as string[]));
      }
    } catch { /* ignore */ }
  }, []);

  // Persist plan
  useEffect(() => {
    if (plan) {
      try { localStorage.setItem(LS_PLAN_KEY, JSON.stringify(plan)); } catch { /* ignore */ }
    }
  }, [plan]);

  // Persist progress
  useEffect(() => {
    if (plan) {
      try { localStorage.setItem(LS_PROGRESS_KEY, JSON.stringify([...completedIds])); } catch { /* ignore */ }
    }
  }, [completedIds, plan]);

  const toggleModule = useCallback((id: string) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const generatePlan = async () => {
    if (!track || !level) return;
    setPageState('generating');
    setError(null);
    try {
      const res = await fetch('/api/learning-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track, level, specificGoals: goals }),
      });
      if (!res.ok) throw new Error('Failed to generate plan');
      const data = await res.json() as LearningPlan;
      setPlan(data);
      setCompletedIds(new Set());
      setPageState('plan');
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
      setPageState('quiz');
      setStep(3);
    }
  };

  const startOver = () => {
    setPlan(null);
    setCompletedIds(new Set());
    setTrack(null);
    setLevel(null);
    setLevelIdx(null);
    setGoals('');
    setStep(1);
    setPageState('quiz');
    try {
      localStorage.removeItem(LS_PLAN_KEY);
      localStorage.removeItem(LS_PROGRESS_KEY);
    } catch { /* ignore */ }
  };

  const shareProgress = () => {
    if (!plan) return;
    const total = plan.modules.length;
    const done = completedIds.size;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const progressLine =
      pct === 0 ? 'Just getting started 🌱'
      : pct < 50 ? 'Making progress 🔥'
      : pct < 100 ? 'Almost there 💪'
      : 'Plan complete! 🎉';
    const trackLabel = plan.track.charAt(0).toUpperCase() + plan.track.slice(1);
    const levelLabel = plan.level.charAt(0).toUpperCase() + plan.level.slice(1);
    const text = `📚 My Web3 Learning Journey on HomieHouse\n\nTrack: ${trackLabel} | Level: ${levelLabel}\nProgress: ${done}/${total} modules complete (${pct}%)\n\n${progressLine}\n\nBuilding my path to decentralization, one step at a time.`;
    window.dispatchEvent(new CustomEvent('openComposeModal', { detail: { text } }));
  };

  // ─── Data ────────────────────────────────────────────────────────────────

  const trackOptions: { id: Track; emoji: string; title: string; subtitle: string }[] = [
    { id: 'learner',   emoji: '🧠', title: 'Learner',          subtitle: 'I want to understand how this all works' },
    { id: 'creator',   emoji: '🛠️', title: 'Creator',          subtitle: 'I want to build and create things on-chain' },
    { id: 'financial', emoji: '💰', title: 'Financial',        subtitle: 'I want to grow and manage my assets' },
    { id: 'all',       emoji: '✨', title: 'All of the above', subtitle: 'I want the full picture' },
  ];

  const levelOptions: { label: string; description: string; level: Level }[] = [
    { label: 'Complete beginner', description: "I've heard the terms but don't really get it", level: 'beginner' },
    { label: 'Some context',      description: "I've used a crypto app or two",                level: 'beginner' },
    { label: 'Getting there',     description: "I've traded, used DeFi, or joined a DAO",     level: 'intermediate' },
    { label: 'Advanced',          description: "I'm already building but want structured knowledge", level: 'advanced' },
  ];

  const goalChips = [
    'Financial independence',
    'Build something',
    'Understand the ecosystem',
    'Connect with communities',
  ];

  // ─── Shared layout ────────────────────────────────────────────────────────

  const wrap = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-dark)', color: 'var(--text-on-dark)' }}>
      <header style={{ borderBottom: '1px solid var(--border)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
        <div>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            <HHLogo size={36} />
          </Link>
          <p style={{ fontSize: 12, color: 'var(--muted-on-dark)', marginTop: 2 }}>
            Decentralization Learning Hub
          </p>
        </div>
        <Link href="/" style={{ fontSize: 13, color: 'var(--muted-on-dark)', textDecoration: 'none' }}>
          ← Back
        </Link>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <aside
          className="hidden lg:block shrink-0"
          style={{ width: 220, borderRight: '1px solid var(--border)', overflowY: 'auto', scrollbarWidth: 'none', padding: '16px 0' }}
        >
          <SidebarNav />
        </aside>
        <main style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>
          {children}
        </main>
      </div>
    </div>
  );

  // ─── Generating ───────────────────────────────────────────────────────────

  if (pageState === 'generating') {
    return wrap(
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 24, padding: '40px 20px' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          border: '3px solid var(--border)',
          borderTopColor: 'var(--accent)',
          animation: 'hhSpin 0.8s linear infinite',
        }} />
        <style>{`@keyframes hhSpin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-on-dark)', margin: 0 }}>
            Building your personalized path...
          </p>
          <p style={{ fontSize: 14, color: 'var(--muted-on-dark)', marginTop: 8, margin: '8px 0 0' }}>
            Crafting a curriculum just for you
          </p>
        </div>
      </div>,
    );
  }

  // ─── Plan view ────────────────────────────────────────────────────────────

  if (pageState === 'plan' && plan) {
    const total = plan.modules.length;
    const done = completedIds.size;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const totalMinutes = plan.modules.reduce((s, m) => s + m.estimatedMinutes, 0);
    const trackLabel = plan.track.charAt(0).toUpperCase() + plan.track.slice(1);
    const levelLabel = plan.level.charAt(0).toUpperCase() + plan.level.slice(1);

    return wrap(
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <GradCapIcon size={22} />
            <span style={{ fontSize: 13, fontWeight: 700, padding: '4px 12px', border: '1px solid var(--accent)', borderRadius: 20, color: 'var(--accent)' }}>
              {trackLabel}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, padding: '4px 12px', border: '1px solid var(--border)', borderRadius: 20, color: 'var(--muted-on-dark)' }}>
              {levelLabel}
            </span>
            <span style={{ fontSize: 13, color: 'var(--muted-on-dark)', marginLeft: 4 }}>
              {total} modules · ~{totalMinutes} min total
            </span>
          </div>

          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-on-dark)', lineHeight: 1.3 }}>
            Your Learning Path
          </h1>
          <p style={{ fontSize: 14, color: 'var(--muted-on-dark)', margin: 0, lineHeight: 1.6 }}>
            {plan.summary}
          </p>
        </div>

        {/* Progress */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-on-dark)' }}>Progress</span>
            <span style={{ fontSize: 13, color: 'var(--muted-on-dark)' }}>{done}/{total} modules · {pct}%</span>
          </div>
          <div style={{ height: 8, background: 'var(--bg-dark)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 4, transition: 'width 0.4s ease' }} />
          </div>
          {pct === 100 && (
            <p style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, marginTop: 8, marginBottom: 0 }}>
              🎉 Plan complete! You're a decentralization expert.
            </p>
          )}
        </div>

        {/* Modules */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
          {plan.modules.map((mod, i) => (
            <ModuleCard
              key={mod.id}
              module={mod}
              index={i}
              completed={completedIds.has(mod.id)}
              onToggle={toggleModule}
            />
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={shareProgress}
            style={{
              width: '100%', padding: '14px', borderRadius: 12,
              border: '1px solid var(--accent)', background: 'transparent',
              color: 'var(--accent)', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.15s',
            }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share Progress
          </button>
          <button
            onClick={startOver}
            style={{
              width: '100%', padding: '12px', borderRadius: 12,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--muted-on-dark)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            Start Over
          </button>
        </div>
      </div>,
    );
  }

  // ─── Quiz ─────────────────────────────────────────────────────────────────

  return wrap(
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 16px' }}>
      {/* Page title */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <GradCapIcon size={36} />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-on-dark)' }}>
          Decentralization Learning Hub
        </h1>
        <p style={{ fontSize: 15, color: 'var(--muted-on-dark)', margin: 0, lineHeight: 1.6 }}>
          Get a personalized path into Web3 — tailored to your goals and level.
        </p>
      </div>

      {/* Step dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            style={{
              width: s === step ? 24 : 8,
              height: 8,
              borderRadius: 4,
              background: s === step ? 'var(--accent)' : s < step ? 'var(--accent-soft)' : 'var(--border)',
              transition: 'all 0.25s',
            }}
          />
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* ── Step 1: Track ────────────────────────────────────────────────── */}
      {step === 1 && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px', color: 'var(--text-on-dark)' }}>
            What's your focus?
          </h2>
          <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: '0 0 20px' }}>
            Pick the area you want to explore.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {trackOptions.map((opt) => {
              const sel = track === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setTrack(opt.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '0 20px', minHeight: 80, borderRadius: 14,
                    border: `2px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                    background: sel ? 'rgba(255,255,255,0.04)' : 'var(--surface)',
                    boxShadow: sel ? '0 0 0 3px rgba(255,255,255,0.06)' : 'none',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 26, flexShrink: 0 }}>{opt.emoji}</span>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: sel ? 'var(--accent)' : 'var(--text-on-dark)', margin: 0 }}>
                      {opt.title}
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: 0 }}>
                      {opt.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            disabled={!track}
            onClick={() => setStep(2)}
            style={{
              width: '100%', padding: '14px', borderRadius: 12, border: 'none',
              background: track ? 'var(--btn-primary-bg)' : 'var(--surface)',
              color: track ? 'var(--btn-primary-color)' : 'var(--muted-on-dark)',
              fontSize: 15, fontWeight: 600,
              cursor: track ? 'pointer' : 'not-allowed',
              opacity: track ? 1 : 0.5, transition: 'all 0.15s',
            }}
          >
            Next →
          </button>
        </div>
      )}

      {/* ── Step 2: Level ────────────────────────────────────────────────── */}
      {step === 2 && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px', color: 'var(--text-on-dark)' }}>
            Where are you starting?
          </h2>
          <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: '0 0 20px' }}>
            Be honest — there's no wrong answer.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {levelOptions.map((opt, i) => {
              const sel = levelIdx === i;
              return (
                <button
                  key={opt.label}
                  onClick={() => { setLevelIdx(i); setLevel(opt.level); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '0 20px', minHeight: 72, borderRadius: 14,
                    border: `2px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                    background: sel ? 'rgba(255,255,255,0.04)' : 'var(--surface)',
                    boxShadow: sel ? '0 0 0 3px rgba(255,255,255,0.06)' : 'none',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                    background: sel ? 'var(--accent)' : 'transparent',
                    transition: 'all 0.15s',
                  }} />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: sel ? 'var(--accent)' : 'var(--text-on-dark)', margin: 0 }}>
                      {opt.label}
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: 0 }}>
                      {opt.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setStep(1)}
              style={{ flex: '0 0 auto', padding: '14px 20px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-on-dark)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
            >
              ← Back
            </button>
            <button
              disabled={levelIdx === null}
              onClick={() => setStep(3)}
              style={{
                flex: 1, padding: '14px', borderRadius: 12, border: 'none',
                background: levelIdx !== null ? 'var(--btn-primary-bg)' : 'var(--surface)',
                color: levelIdx !== null ? 'var(--btn-primary-color)' : 'var(--muted-on-dark)',
                fontSize: 15, fontWeight: 600,
                cursor: levelIdx !== null ? 'pointer' : 'not-allowed',
                opacity: levelIdx !== null ? 1 : 0.5, transition: 'all 0.15s',
              }}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Goals ────────────────────────────────────────────────── */}
      {step === 3 && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px', color: 'var(--text-on-dark)' }}>
            What's your main goal right now?
          </h2>
          <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: '0 0 16px' }}>
            Tell us what you're working toward — or pick a quick option below.
          </p>

          {/* Quick-select chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {goalChips.map((chip) => {
              const active = goals === chip;
              return (
                <button
                  key={chip}
                  onClick={() => setGoals(active ? '' : chip)}
                  style={{
                    padding: '6px 14px', borderRadius: 20,
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--muted-on-dark)',
                    fontSize: 13, fontWeight: active ? 600 : 400,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {chip}
                </button>
              );
            })}
          </div>

          <textarea
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder="e.g. I want to understand how to not rely on banks, or I want to launch my own token..."
            rows={4}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 12,
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--text-on-dark)', fontSize: 14, lineHeight: 1.6,
              resize: 'vertical', outline: 'none', boxSizing: 'border-box',
              fontFamily: 'inherit', marginBottom: 20,
            }}
            onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = 'var(--accent)'; }}
            onBlur={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = 'var(--border)'; }}
          />

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setStep(2)}
              style={{ flex: '0 0 auto', padding: '14px 20px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-on-dark)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
            >
              ← Back
            </button>
            <button
              onClick={generatePlan}
              style={{
                flex: 1, padding: '14px', borderRadius: 12, border: 'none',
                background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-color)',
                fontSize: 15, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'opacity 0.15s',
              }}
            >
              <GradCapIcon size={16} />
              Generate My Plan
            </button>
          </div>
        </div>
      )}
    </div>,
  );
}
