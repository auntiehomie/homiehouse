'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

const LS_PLAN_KEY = 'hh_learning_plan';
const LS_PROGRESS_KEY = 'hh_learning_progress';

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

interface LessonContent {
  intro: string;
  concepts: Array<{ title: string; explanation: string; analogy?: string }>;
  practicalExample: string;
  quickActions: string[];
  summary: string;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: '#22c55e',
  intermediate: '#f97316',
  advanced: '#a855f7',
};

function LessonSkeleton() {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 16px' }}>
      {[120, 80, 200, 80, 200, 80, 150].map((w, i) => (
        <div key={i} style={{
          height: i % 2 === 0 ? 16 : 12,
          width: `${w}px`,
          maxWidth: '100%',
          background: 'var(--surface)',
          borderRadius: 6,
          marginBottom: 14,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

function ModuleLessonContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const moduleId = searchParams.get('id');

  const [mod, setMod] = useState<LearningModule | null>(null);
  const [lesson, setLesson] = useState<LessonContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    if (!moduleId) { router.replace('/learn'); return; }

    // Find module in stored plan
    try {
      const raw = localStorage.getItem(LS_PLAN_KEY);
      if (!raw) { router.replace('/learn'); return; }
      const plan = JSON.parse(raw);
      const found = plan.modules?.find((m: LearningModule) => m.id === moduleId);
      if (!found) { router.replace('/learn'); return; }
      setMod(found);

      // Check completion state
      const progRaw = localStorage.getItem(LS_PROGRESS_KEY);
      const progress: string[] = progRaw ? JSON.parse(progRaw) : [];
      setCompleted(progress.includes(moduleId));

      // Fetch lesson content
      fetch('/api/lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(found),
      })
        .then(r => r.json())
        .then(data => {
          if (data.error) throw new Error(data.error);
          setLesson(data as LessonContent);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setError('Failed to load lesson content.');
          setLoading(false);
        });
    } catch {
      setError('Could not load module.');
      setLoading(false);
    }
  }, [moduleId, router]);

  const toggleComplete = () => {
    if (!moduleId) return;
    try {
      const raw = localStorage.getItem(LS_PROGRESS_KEY);
      const progress: string[] = raw ? JSON.parse(raw) : [];
      const next = completed
        ? progress.filter(id => id !== moduleId)
        : [...new Set([...progress, moduleId])];
      localStorage.setItem(LS_PROGRESS_KEY, JSON.stringify(next));
      setCompleted(!completed);
      if (!completed) setJustCompleted(true);
    } catch {}
  };

  if (!mod && loading) return <LessonSkeleton />;
  if (error) return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 16px', textAlign: 'center' }}>
      <p style={{ color: 'var(--muted-on-dark)', marginBottom: 16 }}>{error}</p>
      <Link href="/learn" style={{ color: 'var(--accent)', textDecoration: 'none' }}>← Back to plan</Link>
    </div>
  );
  if (!mod) return null;

  const diffColor = DIFFICULTY_COLORS[mod.difficulty] ?? '#94a3b8';

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px 80px' }}>
      {/* Back link */}
      <Link href="/learn" style={{ fontSize: 13, color: 'var(--muted-on-dark)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 24 }}>
        ← Back to learning plan
      </Link>

      {/* Module header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted-on-dark)' }}>MODULE</span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20,
            border: `1px solid ${diffColor}40`, color: diffColor,
          }}>
            {mod.difficulty}
          </span>
          <span style={{ fontSize: 12, color: 'var(--muted-on-dark)' }}>⏱ ~{mod.estimatedMinutes} min</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-on-dark)', margin: '0 0 10px', lineHeight: 1.25 }}>
          {mod.title}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--muted-on-dark)', margin: 0, lineHeight: 1.6 }}>
          {mod.description}
        </p>
      </div>

      {loading ? (
        <LessonSkeleton />
      ) : lesson ? (
        <>
          {/* Intro */}
          <div style={{
            padding: '16px 18px', borderRadius: 12,
            background: 'linear-gradient(135deg, #1e1b4b 0%, #1a1a2e 100%)',
            border: '1px solid #3730a3', marginBottom: 24,
          }}>
            <p style={{ fontSize: 15, color: '#e0e7ff', margin: 0, lineHeight: 1.7 }}>
              {lesson.intro}
            </p>
          </div>

          {/* Why it matters */}
          <div style={{
            padding: '12px 16px', borderRadius: 10,
            background: 'var(--bg-dark)', borderLeft: '3px solid var(--accent)',
            marginBottom: 28,
          }}>
            <p style={{ fontSize: 13, color: 'var(--text-on-dark)', margin: 0, fontStyle: 'italic', lineHeight: 1.5 }}>
              💡 {mod.whyItMatters}
            </p>
          </div>

          {/* Concepts */}
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted-on-dark)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
            Key Concepts
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
            {lesson.concepts.map((c, i) => (
              <div key={i} style={{
                padding: '14px 16px', borderRadius: 12,
                background: 'var(--surface)', border: '1px solid var(--border)',
              }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 6px' }}>
                  {c.title}
                </p>
                <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: 0, lineHeight: 1.6 }}>
                  {c.explanation}
                </p>
                {c.analogy && (
                  <p style={{
                    fontSize: 12, color: 'var(--accent)', margin: '8px 0 0',
                    padding: '6px 10px', borderRadius: 8,
                    background: 'rgba(var(--accent-rgb, 99,102,241), 0.08)',
                    fontStyle: 'italic', lineHeight: 1.5,
                  }}>
                    🔁 {c.analogy}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Practical example */}
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted-on-dark)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
            Real-World Example
          </h2>
          <div style={{
            padding: '14px 16px', borderRadius: 12,
            background: 'var(--surface)', border: '1px solid var(--border)',
            marginBottom: 28,
          }}>
            <p style={{ fontSize: 13, color: 'var(--text-on-dark)', margin: 0, lineHeight: 1.7 }}>
              {lesson.practicalExample}
            </p>
          </div>

          {/* Quick actions */}
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted-on-dark)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
            Do It Now
          </h2>
          <ul style={{ margin: '0 0 28px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lesson.quickActions.map((action, i) => (
              <li key={i} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '12px 14px', borderRadius: 10,
                background: 'var(--surface)', border: '1px solid var(--border)',
              }}>
                <span style={{
                  flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                  background: 'var(--accent)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, marginTop: 1,
                }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-on-dark)', lineHeight: 1.6 }}>{action}</span>
              </li>
            ))}
          </ul>

          {/* Summary */}
          <div style={{
            padding: '14px 16px', borderRadius: 12,
            background: 'var(--surface)', border: '1px solid var(--border)',
            marginBottom: 32,
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted-on-dark)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
              Key Takeaway
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-on-dark)', margin: 0, lineHeight: 1.6 }}>
              {lesson.summary}
            </p>
          </div>
        </>
      ) : null}

      {/* Completion button */}
      {justCompleted ? (
        <div style={{
          padding: '18px 20px', borderRadius: 14, textAlign: 'center',
          background: 'linear-gradient(135deg, #14532d 0%, #166534 100%)',
          border: '1px solid #16a34a', marginBottom: 16,
        }}>
          <p style={{ fontSize: 20, margin: '0 0 4px' }}>🎉</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#bbf7d0', margin: '0 0 4px' }}>Module complete!</p>
          <p style={{ fontSize: 13, color: '#86efac', margin: 0 }}>Your progress has been saved.</p>
        </div>
      ) : (
        <button
          onClick={toggleComplete}
          style={{
            width: '100%', padding: '16px', borderRadius: 12,
            background: completed
              ? 'var(--surface)'
              : 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)',
            color: completed ? 'var(--muted-on-dark)' : '#fff',
            fontSize: 15, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            border: completed ? '1px solid var(--border)' : 'none',
            marginBottom: 12,
            transition: 'all 0.15s',
          }}
        >
          {completed ? (
            <><span>✓</span> Completed — mark as incomplete</>
          ) : (
            <><span>✓</span> Mark as Complete</>
          )}
        </button>
      )}

      <Link href="/learn" style={{
        display: 'block', textAlign: 'center',
        fontSize: 13, color: 'var(--muted-on-dark)', textDecoration: 'none', padding: 8,
      }}>
        ← Back to learning plan
      </Link>
    </div>
  );
}

export default function ModuleLessonPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', color: 'var(--text-on-dark)' }}>
      <Suspense fallback={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)', color: 'var(--muted-on-dark)' }}>
          Loading…
        </div>
      }>
        <ModuleLessonContent />
      </Suspense>
    </div>
  );
}
