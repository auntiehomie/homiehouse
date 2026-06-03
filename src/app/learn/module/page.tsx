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

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface LessonContent {
  intro: string;
  concepts: Array<{ title: string; explanation: string; analogy?: string }>;
  practicalExample: string;
  quickActions: string[];
  summary: string;
  quiz: QuizQuestion[];
}

const DIFF_COLORS: Record<string, string> = {
  beginner: '#22c55e',
  intermediate: '#f97316',
  advanced: '#a855f7',
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} style={{
          height: 14,
          width: i % 3 === 0 ? '60%' : i % 3 === 1 ? '90%' : '75%',
          background: 'var(--surface)',
          borderRadius: 6,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: 'var(--muted-on-dark)',
      margin: '28px 0 10px',
    }}>
      {children}
    </p>
  );
}

// ─── Knowledge Check ──────────────────────────────────────────────────────────

function KnowledgeCheck({ questions }: { questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [submitted, setSubmitted] = useState(false);
  const [started, setStarted] = useState(false);

  const score = submitted
    ? answers.filter((a, i) => a === questions[i].correctIndex).length
    : 0;

  const allAnswered = answers.every(a => a !== null);

  if (!started) {
    return (
      <div style={{
        padding: '18px 16px', borderRadius: 14,
        background: 'var(--surface)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 3px' }}>
            Knowledge Check
          </p>
          <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: 0 }}>
            {questions.length} questions · ~2 min
          </p>
        </div>
        <button
          onClick={() => setStarted(true)}
          style={{
            padding: '9px 18px', borderRadius: 9, border: 'none',
            background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)',
            color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Start Quiz
        </button>
      </div>
    );
  }

  if (submitted) {
    const pct = Math.round((score / questions.length) * 100);
    const passed = pct >= 60;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Score banner */}
        <div style={{
          padding: '18px 16px', borderRadius: 14, textAlign: 'center',
          background: passed
            ? 'linear-gradient(135deg, #14532d 0%, #166534 100%)'
            : 'linear-gradient(135deg, #7c2d12 0%, #92400e 100%)',
          border: `1px solid ${passed ? '#16a34a' : '#b45309'}`,
        }}>
          <p style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>
            {score}/{questions.length}
          </p>
          <p style={{ fontSize: 14, color: passed ? '#bbf7d0' : '#fde68a', margin: '0 0 2px', fontWeight: 600 }}>
            {passed ? '🎉 Nice work!' : '📖 Review and retry'}
          </p>
          <p style={{ fontSize: 13, color: passed ? '#86efac' : '#fcd34d', margin: 0 }}>
            {pct}% correct
          </p>
        </div>

        {/* Per-question review */}
        {questions.map((q, qi) => {
          const chosen = answers[qi];
          const correct = chosen === q.correctIndex;
          return (
            <div key={qi} style={{
              padding: '14px 16px', borderRadius: 12,
              background: 'var(--surface)', border: `1px solid ${correct ? '#16a34a40' : '#dc262640'}`,
            }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-on-dark)', margin: '0 0 10px', lineHeight: 1.5 }}>
                {correct ? '✅' : '❌'} {q.question}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                {q.options.map((opt, oi) => {
                  const isCorrect = oi === q.correctIndex;
                  const isChosen = oi === chosen;
                  let bg = 'transparent';
                  let color = 'var(--muted-on-dark)';
                  if (isCorrect) { bg = 'rgba(22,163,74,0.12)'; color = '#86efac'; }
                  else if (isChosen && !isCorrect) { bg = 'rgba(220,38,38,0.1)'; color = '#fca5a5'; }
                  return (
                    <div key={oi} style={{
                      padding: '8px 12px', borderRadius: 8, fontSize: 13,
                      background: bg, color, lineHeight: 1.4,
                      border: `1px solid ${isCorrect ? '#16a34a40' : isChosen ? '#dc262640' : 'transparent'}`,
                    }}>
                      {isCorrect ? '✓ ' : isChosen ? '✗ ' : ''}{opt}
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted-on-dark)', margin: 0, lineHeight: 1.5, fontStyle: 'italic' }}>
                💡 {q.explanation}
              </p>
            </div>
          );
        })}

        {!passed && (
          <button
            onClick={() => { setAnswers(questions.map(() => null)); setSubmitted(false); }}
            style={{
              width: '100%', padding: '13px', borderRadius: 11, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--muted-on-dark)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Retry Quiz
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {questions.map((q, qi) => (
        <div key={qi} style={{
          padding: '16px', borderRadius: 14,
          background: 'var(--surface)', border: '1px solid var(--border)',
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-on-dark)', margin: '0 0 12px', lineHeight: 1.5 }}>
            <span style={{ color: 'var(--muted-on-dark)', marginRight: 6, fontSize: 12 }}>Q{qi + 1}</span>
            {q.question}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {q.options.map((opt, oi) => {
              const selected = answers[qi] === oi;
              return (
                <button
                  key={oi}
                  onClick={() => setAnswers(prev => prev.map((a, i) => i === qi ? oi : a))}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '11px 14px', borderRadius: 10,
                    border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                    background: selected ? 'rgba(99,102,241,0.1)' : 'var(--bg-dark)',
                    color: selected ? 'var(--accent)' : 'var(--text-on-dark)',
                    fontSize: 14, lineHeight: 1.4, cursor: 'pointer',
                    transition: 'all 0.12s',
                    fontWeight: selected ? 600 : 400,
                  }}
                >
                  <span style={{ fontWeight: 700, marginRight: 8, color: 'var(--muted-on-dark)', fontSize: 12 }}>
                    {['A', 'B', 'C', 'D'][oi]}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <button
        onClick={() => setSubmitted(true)}
        disabled={!allAnswered}
        style={{
          width: '100%', padding: '14px', borderRadius: 11, border: 'none',
          background: allAnswered
            ? 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)'
            : 'var(--surface)',
          color: allAnswered ? '#fff' : 'var(--muted-on-dark)',
          fontSize: 15, fontWeight: 700,
          cursor: allAnswered ? 'pointer' : 'not-allowed',
          opacity: allAnswered ? 1 : 0.6,
          transition: 'all 0.15s',
        }}
      >
        Submit Answers
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

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

    try {
      const raw = localStorage.getItem(LS_PLAN_KEY);
      if (!raw) { router.replace('/learn'); return; }
      const plan = JSON.parse(raw);
      const found = plan.modules?.find((m: LearningModule) => m.id === moduleId);
      if (!found) { router.replace('/learn'); return; }
      setMod(found);

      const progRaw = localStorage.getItem(LS_PROGRESS_KEY);
      const progress: string[] = progRaw ? JSON.parse(progRaw) : [];
      setCompleted(progress.includes(moduleId));

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

  if (!mod && loading) {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 16px' }}>
        <Skeleton lines={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 16px', textAlign: 'center' }}>
        <p style={{ color: 'var(--muted-on-dark)', marginBottom: 16 }}>{error}</p>
        <Link href="/learn" style={{ color: 'var(--accent)', textDecoration: 'none' }}>← Back to plan</Link>
      </div>
    );
  }

  if (!mod) return null;

  const diffColor = DIFF_COLORS[mod.difficulty] ?? '#94a3b8';

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px 80px' }}>

      {/* Back */}
      <Link href="/learn" style={{
        fontSize: 13, color: 'var(--muted-on-dark)', textDecoration: 'none',
        display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 20,
      }}>
        ← Back to plan
      </Link>

      {/* Module header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
            border: `1px solid ${diffColor}40`, color: diffColor,
          }}>
            {mod.difficulty}
          </span>
          <span style={{ fontSize: 12, color: 'var(--muted-on-dark)' }}>⏱ ~{mod.estimatedMinutes} min</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-on-dark)', margin: '0 0 8px', lineHeight: 1.25 }}>
          {mod.title}
        </h1>
        <p style={{ fontSize: 15, color: 'var(--muted-on-dark)', margin: 0, lineHeight: 1.65 }}>
          {mod.description}
        </p>
      </div>

      {loading ? (
        <Skeleton lines={10} />
      ) : lesson ? (
        <>
          {/* Intro */}
          <div style={{
            padding: '16px 18px', borderRadius: 14,
            background: 'linear-gradient(135deg, #1e1b4b 0%, #1a1a2e 100%)',
            border: '1px solid #3730a3', marginBottom: 4,
          }}>
            <p style={{ fontSize: 16, color: '#e0e7ff', margin: 0, lineHeight: 1.75 }}>
              {lesson.intro}
            </p>
          </div>

          {/* Why it matters */}
          <div style={{
            padding: '12px 16px', borderRadius: 10,
            background: 'var(--bg-dark)', borderLeft: '3px solid var(--accent)',
            margin: '12px 0',
          }}>
            <p style={{ fontSize: 14, color: 'var(--text-on-dark)', margin: 0, fontStyle: 'italic', lineHeight: 1.65 }}>
              💡 {mod.whyItMatters}
            </p>
          </div>

          {/* Key Concepts */}
          <SectionLabel>Key Concepts</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lesson.concepts.map((c, i) => (
              <div key={i} style={{
                padding: '14px 16px', borderRadius: 12,
                background: 'var(--surface)', border: '1px solid var(--border)',
              }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 5px' }}>
                  {c.title}
                </p>
                <p style={{ fontSize: 14, color: 'var(--muted-on-dark)', margin: 0, lineHeight: 1.65 }}>
                  {c.explanation}
                </p>
                {c.analogy && (
                  <p style={{
                    fontSize: 13, color: '#a5b4fc', margin: '8px 0 0',
                    padding: '7px 11px', borderRadius: 8,
                    background: 'rgba(99,102,241,0.08)',
                    fontStyle: 'italic', lineHeight: 1.55,
                  }}>
                    🔁 {c.analogy}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Real-World Example */}
          <SectionLabel>Real-World Example</SectionLabel>
          <div style={{
            padding: '14px 16px', borderRadius: 12,
            background: 'var(--surface)', border: '1px solid var(--border)',
          }}>
            <p style={{ fontSize: 15, color: 'var(--text-on-dark)', margin: 0, lineHeight: 1.75 }}>
              {lesson.practicalExample}
            </p>
          </div>

          {/* Do It Now */}
          <SectionLabel>Do It Now</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lesson.quickActions.map((action, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: '13px 14px', borderRadius: 11,
                background: 'var(--surface)', border: '1px solid var(--border)',
              }}>
                <span style={{
                  flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
                  background: 'var(--accent)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, marginTop: 1,
                }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: 15, color: 'var(--text-on-dark)', lineHeight: 1.65 }}>{action}</span>
              </div>
            ))}
          </div>

          {/* Key Takeaway */}
          <SectionLabel>Key Takeaway</SectionLabel>
          <div style={{
            padding: '14px 16px', borderRadius: 12,
            background: 'var(--surface)', border: '1px solid var(--border)',
          }}>
            <p style={{ fontSize: 15, color: 'var(--text-on-dark)', margin: 0, lineHeight: 1.7 }}>
              {lesson.summary}
            </p>
          </div>

          {/* Knowledge Check */}
          {lesson.quiz?.length > 0 && (
            <>
              <SectionLabel>Knowledge Check</SectionLabel>
              <KnowledgeCheck questions={lesson.quiz} />
            </>
          )}
        </>
      ) : null}

      {/* Completion */}
      <div style={{ marginTop: 28 }}>
        {justCompleted ? (
          <div style={{
            padding: '18px 20px', borderRadius: 14, textAlign: 'center',
            background: 'linear-gradient(135deg, #14532d 0%, #166534 100%)',
            border: '1px solid #16a34a', marginBottom: 12,
          }}>
            <p style={{ fontSize: 22, margin: '0 0 4px' }}>🎉</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#bbf7d0', margin: '0 0 4px' }}>Module complete!</p>
            <p style={{ fontSize: 13, color: '#86efac', margin: 0 }}>Progress saved.</p>
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
            {completed ? '✓ Completed — mark as incomplete' : '✓ Mark as Complete'}
          </button>
        )}

        <Link href="/learn" style={{
          display: 'block', textAlign: 'center',
          fontSize: 13, color: 'var(--muted-on-dark)', textDecoration: 'none', padding: 8,
        }}>
          ← Back to learning plan
        </Link>
      </div>
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
