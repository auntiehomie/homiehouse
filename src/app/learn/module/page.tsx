'use client';

import { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const LS_PLAN_KEY = 'hh_learning_plan';
const LS_PROGRESS_KEY = 'hh_learning_progress';
const LS_COMPLETIONS_KEY = 'hh_learning_completions';

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

// ─── Card types ───────────────────────────────────────────────────────────────

type CardDef =
  | { type: 'intro'; label: string; content: string }
  | { type: 'why'; label: string; content: string }
  | { type: 'concept'; label: string; title: string; explanation: string; analogy?: string; part: number; isAnalogy?: boolean }
  | { type: 'example'; label: string; content: string }
  | { type: 'actions'; label: string; items: string[] }
  | { type: 'summary'; label: string; content: string }
  | { type: 'quiz'; label: string; question: QuizQuestion; qIndex: number; total: number }
  | { type: 'complete'; label: string };

function splitIntoSentences(text: string): string[] {
  return text.replace(/([.!?])\s+/g, '$1|||').split('|||').map(s => s.trim()).filter(Boolean);
}

function buildCards(lesson: LessonContent, mod: LearningModule): CardDef[] {
  const cards: CardDef[] = [];
  cards.push({ type: 'intro', label: 'Introduction', content: lesson.intro });
  cards.push({ type: 'why', label: 'Why It Matters', content: mod.whyItMatters });
  lesson.concepts.forEach((c, i) => {
    const base = `Concept ${i + 1} of ${lesson.concepts.length}`;
    const sentences = splitIntoSentences(c.explanation);

    // Distribute sentences into up to 4 text chunks
    const numChunks = Math.min(4, Math.max(1, sentences.length));
    const chunkSize = Math.ceil(sentences.length / numChunks);
    const textChunks: string[] = [];
    for (let s = 0; s < sentences.length; s += chunkSize) {
      textChunks.push(sentences.slice(s, s + chunkSize).join(' '));
    }

    const total = textChunks.length + 1; // +1 for analogy card
    textChunks.forEach((text, idx) => {
      cards.push({ type: 'concept', label: `${base} · ${idx + 1}/${total}`, title: c.title, explanation: text, part: idx + 1, isAnalogy: false });
    });
    cards.push({ type: 'concept', label: `${base} · ${total}/${total}`, title: c.title, explanation: '', analogy: c.analogy, part: total, isAnalogy: true });
  });
  cards.push({ type: 'example', label: 'Real-World Example', content: lesson.practicalExample });
  cards.push({ type: 'actions', label: 'Try It Now', items: lesson.quickActions });
  cards.push({ type: 'summary', label: 'Key Takeaway', content: lesson.summary });
  lesson.quiz.forEach((q, i) =>
    cards.push({ type: 'quiz', label: `Question ${i + 1} of ${lesson.quiz.length}`, question: q, qIndex: i, total: lesson.quiz.length })
  );
  cards.push({ type: 'complete', label: 'Complete' });
  return cards;
}

// ─── Card bodies ──────────────────────────────────────────────────────────────

function CardBody({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' as any,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        margin: 'auto 0',
        padding: '20px 20px 24px',
        display: 'flex', flexDirection: 'column', gap: 18,
        maxWidth: 560, width: '100%', alignSelf: 'center',
        boxSizing: 'border-box' as any,
      }}>
        {children}
      </div>
    </div>
  );
}

function IntroCard({ content }: { content: string }) {
  return (
    <CardBody>
      <div style={{
        padding: '20px', borderRadius: 16,
        background: 'linear-gradient(135deg, #1e1b4b 0%, #1a1a2e 100%)',
        border: '1px solid #3730a3',
      }}>
        <p style={{ fontSize: 15, color: '#e0e7ff', margin: 0, lineHeight: 1.6 }}>{content}</p>
      </div>
    </CardBody>
  );
}

function WhyCard({ content }: { content: string }) {
  return (
    <CardBody>
      <div style={{
        padding: '20px 18px', borderRadius: 16,
        background: 'var(--bg-dark)', borderLeft: '4px solid var(--accent)',
      }}>
        <p style={{ fontSize: 15, color: 'var(--text-on-dark)', margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
          💡 {content}
        </p>
      </div>
    </CardBody>
  );
}

function ConceptCard({ title, explanation, analogy, part, isAnalogy }: { title: string; explanation: string; analogy?: string; part: number; isAnalogy?: boolean }) {
  if (isAnalogy) {
    return (
      <CardBody>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {title}
        </p>
        <div style={{ padding: '20px', borderRadius: 16, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)' }}>
          <p style={{ fontSize: 14, color: 'var(--muted-on-dark)', margin: '0 0 10px', fontWeight: 600 }}>Think of it this way…</p>
          <p style={{ fontSize: 15, color: '#c7d2fe', margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
            🔁 {analogy ?? 'No analogy provided.'}
          </p>
        </div>
      </CardBody>
    );
  }

  if (part === 1) {
    return (
      <CardBody>
        <h2 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-on-dark)', margin: 0, lineHeight: 1.3 }}>
          {title}
        </h2>
        <p style={{ fontSize: 15, color: 'var(--text-on-dark)', margin: 0, lineHeight: 1.6 }}>
          {explanation}
        </p>
      </CardBody>
    );
  }

  return (
    <CardBody>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {title} — continued
      </p>
      <p style={{ fontSize: 15, color: 'var(--text-on-dark)', margin: 0, lineHeight: 1.6 }}>
        {explanation}
      </p>
    </CardBody>
  );
}

function ExampleCard({ content }: { content: string }) {
  return (
    <CardBody>
      <div style={{
        padding: '20px', borderRadius: 16,
        background: 'var(--surface)', border: '1px solid var(--border)',
      }}>
        <p style={{ fontSize: 15, color: 'var(--text-on-dark)', margin: 0, lineHeight: 1.6 }}>{content}</p>
      </div>
    </CardBody>
  );
}

function ActionsCard({ items }: { items: string[] }) {
  return (
    <CardBody>
      <p style={{ fontSize: 14, color: 'var(--muted-on-dark)', margin: 0 }}>
        Put this knowledge to work right now:
      </p>
      {items.map((action, i) => (
        <div key={i} style={{
          display: 'flex', gap: 14, alignItems: 'flex-start',
          padding: '16px', borderRadius: 14,
          background: 'var(--surface)', border: '1px solid var(--border)',
        }}>
          <span style={{
            flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
            background: 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800, marginTop: 1,
          }}>
            {i + 1}
          </span>
          <span style={{ fontSize: 15, color: 'var(--text-on-dark)', lineHeight: 1.7 }}>{action}</span>
        </div>
      ))}
    </CardBody>
  );
}

function SummaryCard({ content }: { content: string }) {
  return (
    <CardBody>
      <div style={{
        padding: '20px', borderRadius: 16,
        background: 'var(--surface)', border: '1px solid var(--border)',
      }}>
        <p style={{ fontSize: 15, color: 'var(--text-on-dark)', margin: 0, lineHeight: 1.6 }}>
          {content}
        </p>
      </div>
      <div style={{
        padding: '12px 14px', borderRadius: 12,
        background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)',
      }}>
        <p style={{ fontSize: 12, color: 'var(--muted-on-dark)', margin: 0, lineHeight: 1.6 }}>
          🤖 AI-generated content by Claude (Anthropic). Cross-reference with ethereum.org,
          uniswap docs, or the /defi and /web3 channels on Farcaster. Not financial advice.
        </p>
      </div>
    </CardBody>
  );
}

function QuizCard({
  question, qIndex, total,
  selected, checked, onSelect, onCheck,
}: {
  question: QuizQuestion;
  qIndex: number;
  total: number;
  selected: number | null;
  checked: boolean;
  onSelect: (i: number) => void;
  onCheck: () => void;
}) {
  const correct = question.correctIndex;
  const isRight = selected === correct;

  return (
    <CardBody>
      <p style={{ fontSize: 12, color: 'var(--muted-on-dark)', margin: 0, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Question {qIndex + 1} of {total}
      </p>
      <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-on-dark)', margin: 0, lineHeight: 1.5 }}>
        {question.question}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {question.options.map((opt, oi) => {
          let border = '2px solid var(--border)';
          let bg = 'var(--bg-dark)';
          let color = 'var(--text-on-dark)';
          if (checked) {
            if (oi === correct) { border = '2px solid #22c55e'; bg = 'rgba(34,197,94,0.1)'; color = '#86efac'; }
            else if (oi === selected) { border = '2px solid #ef4444'; bg = 'rgba(239,68,68,0.08)'; color = '#fca5a5'; }
            else { border = '2px solid transparent'; color = 'var(--muted-on-dark)'; }
          } else if (selected === oi) {
            border = '2px solid var(--accent)';
            bg = 'rgba(99,102,241,0.1)';
            color = 'var(--accent)';
          }

          return (
            <button
              key={oi}
              onClick={() => !checked && onSelect(oi)}
              style={{
                width: '100%', textAlign: 'left', padding: '14px 16px', borderRadius: 12,
                border, background: bg, color,
                fontSize: 15, lineHeight: 1.5, cursor: checked ? 'default' : 'pointer',
                transition: 'all 0.12s', fontWeight: selected === oi ? 600 : 400,
              }}
            >
              <span style={{ fontWeight: 700, marginRight: 10, fontSize: 13, opacity: 0.6 }}>
                {['A', 'B', 'C', 'D'][oi]}
              </span>
              {opt}
            </button>
          );
        })}
      </div>

      {checked && (
        <div style={{
          padding: '14px 16px', borderRadius: 12,
          background: isRight ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${isRight ? '#22c55e40' : '#ef444440'}`,
        }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: isRight ? '#86efac' : '#fca5a5', margin: '0 0 6px' }}>
            {isRight ? '✅ Correct!' : '❌ Not quite'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: 0, lineHeight: 1.6 }}>
            {question.explanation}
          </p>
        </div>
      )}

      {!checked && selected !== null && (
        <button
          onClick={onCheck}
          style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)',
            color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Check Answer
        </button>
      )}
    </CardBody>
  );
}

function CompleteCard({ mod, onShare, onBack }: { mod: LearningModule; onShare: () => void; onBack: () => void }) {
  return (
    <CardBody>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 64 }}>🎉</div>
        <div>
          <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-on-dark)', margin: '0 0 8px' }}>
            Give yourself a pat on the back!
          </p>
          <p style={{ fontSize: 15, color: 'var(--muted-on-dark)', margin: '0 0 6px', lineHeight: 1.6 }}>
            You've completed <strong style={{ color: 'var(--text-on-dark)' }}>{mod.title}</strong>.
          </p>
          <p style={{ fontSize: 15, color: 'var(--accent)', fontWeight: 600, margin: 0 }}>
            Ready to go deeper?
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320 }}>
          <button
            onClick={onShare}
            style={{
              width: '100%', padding: '14px', borderRadius: 12,
              background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
              color: '#a5b4fc', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Share Progress on Farcaster
          </button>
          <button
            onClick={onBack}
            style={{
              width: '100%', padding: '14px', borderRadius: 12,
              background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)',
              border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Back to Learning Plan →
          </button>
        </div>
      </div>
    </CardBody>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, padding: '20px' }}>
      {[80, 95, 70, 90, 65, 85].map((w, i) => (
        <div key={i} style={{
          height: 14, width: `${w}%`, borderRadius: 6,
          background: 'var(--surface)', animation: 'pulse 1.5s ease-in-out infinite',
          animationDelay: `${i * 0.1}s`,
        }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const DIFF_BADGE: Record<string, { color: string }> = {
  beginner: { color: '#22c55e' },
  intermediate: { color: '#f97316' },
  advanced: { color: '#a855f7' },
};

function ModuleLessonContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const moduleId = searchParams.get('id');

  const [mod, setMod] = useState<LearningModule | null>(null);
  const [cards, setCards] = useState<CardDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Card navigation state
  const [cardIndex, setCardIndex] = useState(0);
  const [dir, setDir] = useState<'forward' | 'back'>('forward');
  const [animating, setAnimating] = useState(false);

  // Swipe tracking
  const swipeTouchX = useRef<number | null>(null);
  const swipeTouchY = useRef<number | null>(null);

  // Quiz state: per question index → selected answer
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizChecked, setQuizChecked] = useState<Record<number, boolean>>({});
  const [quizFailed, setQuizFailed] = useState(false);
  // Transient pop-up shown the instant a quiz answer is checked, so the learner
  // sees the result without scrolling down to the inline explanation.
  const [quizToast, setQuizToast] = useState<null | boolean>(null);
  const quizToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showQuizToast = useCallback((correct: boolean) => {
    setQuizToast(correct);
    if (quizToastTimer.current) clearTimeout(quizToastTimer.current);
    quizToastTimer.current = setTimeout(() => setQuizToast(null), 2800);
  }, []);

  // Completion
  const [alreadyDone, setAlreadyDone] = useState(false);

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
      setAlreadyDone(progress.includes(moduleId));

      fetch('/api/lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(found),
      })
        .then(r => r.json())
        .then(data => {
          if (data.error) throw new Error(data.error);
          setCards(buildCards(data as LessonContent, found));
          setLoading(false);
        })
        .catch(err => { setError('Failed to load lesson.'); setLoading(false); });
    } catch { setError('Could not load module.'); setLoading(false); }
  }, [moduleId, router]);

  const currentCard = cards[cardIndex];
  const totalCards = cards.length;
  const progress = totalCards > 0 ? (cardIndex / (totalCards - 1)) : 0;

  const navigate = useCallback((direction: 'forward' | 'back') => {
    if (animating) return;
    const next = direction === 'forward' ? cardIndex + 1 : cardIndex - 1;
    if (next < 0 || next >= totalCards) return;
    setQuizToast(null);
    setDir(direction);
    setCardIndex(next);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 260);
  }, [animating, cardIndex, totalCards]);

  const canContinue = (): boolean => {
    if (!currentCard) return false;
    if (currentCard.type === 'quiz') {
      // Must have checked (seen result) before continuing
      return quizChecked[currentCard.qIndex] === true;
    }
    if (currentCard.type === 'complete') return false;
    return true;
  };

  const handleContinue = () => {
    if (currentCard?.type === 'complete') return;
    navigate('forward');
  };

  const handleComplete = useCallback(() => {
    if (!moduleId) return;
    try {
      const raw = localStorage.getItem(LS_PROGRESS_KEY);
      const progress: string[] = raw ? JSON.parse(raw) : [];
      const updatedProgress = progress.includes(moduleId) ? progress : [...progress, moduleId];
      if (!progress.includes(moduleId)) {
        localStorage.setItem(LS_PROGRESS_KEY, JSON.stringify(updatedProgress));
      }
      if (mod) {
        const compRaw = localStorage.getItem(LS_COMPLETIONS_KEY);
        const completions: Record<string, { completedAt: string; title: string; description: string; difficulty: string; estimatedMinutes: number }> =
          compRaw ? JSON.parse(compRaw) : {};
        if (!completions[moduleId]) {
          completions[moduleId] = {
            completedAt: new Date().toISOString(),
            title: mod.title,
            description: mod.description,
            difficulty: mod.difficulty,
            estimatedMinutes: mod.estimatedMinutes,
          };
          localStorage.setItem(LS_COMPLETIONS_KEY, JSON.stringify(completions));
        }
        // Sync to Neon for cross-device persistence
        try {
          const fid = (() => {
            const p = JSON.parse(localStorage.getItem('hh_profile') || '{}');
            return p?.fid ? Number(p.fid) : null;
          })();
          if (fid) {
            const plan = (() => {
              try { return JSON.parse(localStorage.getItem('hh_learning_plan') ?? 'null'); } catch { return null; }
            })();
            fetch('/api/learning-progress', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fid, plan, completed_ids: updatedProgress, completions }),
            }).catch(() => {});
          }
        } catch {}
      }
      if (mod) {
        const compRaw = localStorage.getItem(LS_COMPLETIONS_KEY);
        const completions: Record<string, { completedAt: string; title: string; description: string; difficulty: string; estimatedMinutes: number }> =
          compRaw ? JSON.parse(compRaw) : {};
        if (!completions[moduleId]) {
          completions[moduleId] = {
            completedAt: new Date().toISOString(),
            title: mod.title,
            description: mod.description,
            difficulty: mod.difficulty,
            estimatedMinutes: mod.estimatedMinutes,
          };
          localStorage.setItem(LS_COMPLETIONS_KEY, JSON.stringify(completions));
        }
      }
    } catch {}
  }, [moduleId, mod]);

  // Mark complete when reaching the complete card
  useEffect(() => {
    if (currentCard?.type === 'complete' && !alreadyDone) {
      handleComplete();
      setAlreadyDone(true);
    }
  }, [currentCard, alreadyDone, handleComplete]);

  const quizCards = cards.filter((c): c is Extract<CardDef, { type: 'quiz' }> => c.type === 'quiz');
  const totalQuestions = quizCards.length;
  const correctAnswers = quizCards.filter(
    c => quizChecked[c.qIndex] && quizAnswers[c.qIndex] === c.question.correctIndex
  ).length;
  const scorePercent = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  const quizPassed = scorePercent >= 75;

  const handleRetryQuiz = useCallback(() => {
    setQuizAnswers({});
    setQuizChecked({});
    setQuizFailed(false);
    const firstQuizIndex = cards.findIndex(c => c.type === 'quiz');
    if (firstQuizIndex >= 0) {
      setDir('back');
      setCardIndex(firstQuizIndex);
      setAnimating(true);
      setTimeout(() => setAnimating(false), 260);
    }
  }, [cards]);

  const handleShare = () => {
    if (!mod) return;
    const text = `Just completed "${mod.title}" on HomieHouse! 🎓\n\nBuilding my Web3 knowledge one module at a time. 🏡\n\nhomiehouse.lol`;
    router.push(`/compose?text=${encodeURIComponent(text)}`);
  };

  const handleBack = () => {
    if (cardIndex > 0) navigate('back');
    else router.push('/learn');
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    swipeTouchX.current = e.touches[0].clientX;
    swipeTouchY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (swipeTouchX.current === null || swipeTouchY.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeTouchX.current;
    const dy = e.changedTouches[0].clientY - swipeTouchY.current;
    swipeTouchX.current = null;
    swipeTouchY.current = null;
    // Ignore predominantly-vertical gestures (user scrolling card content)
    if (Math.abs(dy) > Math.abs(dx)) return;
    if (Math.abs(dx) < 50) return;
    if (dx < 0 && canContinue()) navigate('forward');
    else if (dx > 0 && cardIndex > 0) navigate('back');
  }, [canContinue, navigate, cardIndex]);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
        <p style={{ color: 'var(--muted-on-dark)' }}>{error}</p>
        <button onClick={() => router.push('/learn')} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15 }}>
          ← Back to plan
        </button>
      </div>
    );
  }

  return (
    <div style={{
      height: '100dvh',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-dark)', color: 'var(--text-on-dark)',
      overscrollBehavior: 'none',
    }}>
      {/* Progress bar */}
      <div style={{ height: 3, background: 'var(--surface)', flexShrink: 0 }}>
        <div style={{
          height: '100%', background: 'var(--accent)',
          width: `${progress * 100}%`,
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px 10px', flexShrink: 0,
      }}>
        <button
          onClick={handleBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-on-dark)', fontSize: 14, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {cardIndex === 0 ? 'Back' : 'Previous'}
        </button>

        <div style={{ textAlign: 'center' }}>
          {currentCard && (
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', margin: 0 }}>
              {currentCard.label}
            </p>
          )}
          {mod && (
            <p style={{ fontSize: 10, color: 'var(--muted-on-dark)', margin: '2px 0 0', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {mod.title}
            </p>
          )}
        </div>

        <div style={{ fontSize: 12, color: 'var(--muted-on-dark)', minWidth: 40, textAlign: 'right' }}>
          {loading ? '' : `${cardIndex + 1}/${totalCards}`}
        </div>
      </div>

      {/* Card content */}
      <style>{`
        @keyframes cardSlideInRight { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes cardSlideInLeft  { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes quizToastIn { from { opacity: 0; transform: translate(-50%, -14px); } to { opacity: 1; transform: translate(-50%, 0); } }
      `}</style>
      <div
        style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          key={cardIndex}
          style={{
            height: '100%',
            display: 'flex', flexDirection: 'column',
            animation: `${dir === 'forward' ? 'cardSlideInRight' : 'cardSlideInLeft'} 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
          }}
        >
          {loading ? (
            <Skeleton />
          ) : currentCard ? (
            <>
              {currentCard.type === 'intro' && <IntroCard content={currentCard.content} />}
              {currentCard.type === 'why' && <WhyCard content={currentCard.content} />}
              {currentCard.type === 'concept' && (
                <ConceptCard title={currentCard.title} explanation={currentCard.explanation} analogy={currentCard.analogy} part={currentCard.part} isAnalogy={currentCard.isAnalogy} />
              )}
              {currentCard.type === 'example' && <ExampleCard content={currentCard.content} />}
              {currentCard.type === 'actions' && <ActionsCard items={currentCard.items} />}
              {currentCard.type === 'summary' && <SummaryCard content={currentCard.content} />}
              {currentCard.type === 'quiz' && (
                <QuizCard
                  question={currentCard.question}
                  qIndex={currentCard.qIndex}
                  total={currentCard.total}
                  selected={quizAnswers[currentCard.qIndex] ?? null}
                  checked={quizChecked[currentCard.qIndex] ?? false}
                  onSelect={(i) => setQuizAnswers(prev => ({ ...prev, [currentCard.qIndex]: i }))}
                  onCheck={() => {
                    setQuizChecked(prev => ({ ...prev, [currentCard.qIndex]: true }));
                    showQuizToast((quizAnswers[currentCard.qIndex] ?? -1) === currentCard.question.correctIndex);
                  }}
                />
              )}
              {currentCard.type === 'complete' && mod && (
                <CompleteCard mod={mod} onShare={handleShare} onBack={() => router.push('/learn')} />
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Continue button (hidden on complete card and quiz before checked) */}
      {currentCard?.type !== 'complete' && currentCard?.type !== 'quiz' && (
        <div style={{ padding: '12px 20px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', flexShrink: 0 }}>
          <button
            onClick={handleContinue}
            disabled={!canContinue() || animating}
            style={{
              width: '100%', padding: '16px', borderRadius: 14, border: 'none',
              background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)',
              color: '#fff', fontSize: 16, fontWeight: 700,
              cursor: canContinue() ? 'pointer' : 'not-allowed',
              opacity: animating ? 0.7 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            Continue →
          </button>
        </div>
      )}

      {/* Quiz continue (only after checked) */}
      {currentCard?.type === 'quiz' && quizChecked[currentCard.qIndex] && (
        <div style={{ padding: '12px 20px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', flexShrink: 0 }}>
          {cardIndex < totalCards - 2 ? (
            <button
              onClick={handleContinue}
              disabled={animating}
              style={{
                width: '100%', padding: '16px', borderRadius: 14, border: 'none',
                background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)',
                color: '#fff', fontSize: 16, fontWeight: 700,
                cursor: 'pointer', opacity: animating ? 0.7 : 1, transition: 'opacity 0.15s',
              }}
            >
              Next →
            </button>
          ) : quizPassed ? (
            <button
              onClick={handleContinue}
              disabled={animating}
              style={{
                width: '100%', padding: '16px', borderRadius: 14, border: 'none',
                background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)',
                color: '#fff', fontSize: 16, fontWeight: 700,
                cursor: 'pointer', opacity: animating ? 0.7 : 1, transition: 'opacity 0.15s',
              }}
            >
              Finish →
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{
                textAlign: 'center', padding: '14px', borderRadius: 12,
                background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#f87171' }}>{scorePercent}%</div>
                <div style={{ fontSize: 14, color: '#fca5a5', marginTop: 2 }}>Need 75% to pass — give it another shot!</div>
              </div>
              <button
                onClick={handleRetryQuiz}
                disabled={animating}
                style={{
                  width: '100%', padding: '16px', borderRadius: 14, border: 'none',
                  background: 'linear-gradient(180deg, #dc2626 0%, #b91c1c 100%)',
                  color: '#fff', fontSize: 16, fontWeight: 700,
                  cursor: 'pointer', opacity: animating ? 0.7 : 1, transition: 'opacity 0.15s',
                }}
              >
                Retry Quiz ↺
              </button>
            </div>
          )}
        </div>
      )}

      {/* Instant quiz result pop-up — visible without scrolling to the explanation */}
      {quizToast !== null && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: 'calc(env(safe-area-inset-top, 0px) + 56px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 200,
            pointerEvents: 'none',
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 20px', borderRadius: 999,
            maxWidth: 'calc(100vw - 32px)',
            background: quizToast ? 'rgba(22,163,74,0.97)' : 'rgba(220,38,38,0.97)',
            color: '#fff', fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap',
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
            animation: 'quizToastIn 0.28s cubic-bezier(0.18,0.89,0.32,1.28)',
          }}
        >
          <span>{quizToast ? '✅' : '❌'}</span>
          <span>{quizToast ? 'Correct!' : 'Not quite — see why below'}</span>
        </div>
      )}
    </div>
  );
}

export default function ModuleLessonPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-on-dark)' }}>
        Loading…
      </div>
    }>
      <ModuleLessonContent />
    </Suspense>
  );
}
