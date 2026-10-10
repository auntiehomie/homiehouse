'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getAuthHeaders, getStoredFid } from '@/lib/client-auth';

interface PremiumModuleDetail {
  id: string;
  title: string;
  description: string;
  whyItMatters: string;
  objectives: string[];
  estimatedMinutes: number;
  difficulty: 'intermediate' | 'advanced';
  tags: string[];
  track: string;
  trackTitle?: string;
  trackEmoji?: string;
  // Phase 2: full lesson content
  concepts?: Array<{ title: string; explanation: string; analogy?: string }>;
  practicalExample?: string;
  quickActions?: string[];
  summary?: string;
  quiz?: Array<{
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }>;
}

const TRACK_NAMES: Record<string, { emoji: string; title: string }> = {
  defi: { emoji: '🏦', title: 'Advanced DeFi' },
  trading: { emoji: '📊', title: 'Trading Safety Pro' },
  creator: { emoji: '🎨', title: 'Creator Economy' },
};

const DIFF_COLORS: Record<string, string> = {
  intermediate: '#f97316',
  advanced: '#a855f7',
};

function ModuleSkeleton() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ width: '60%', height: 28, background: 'var(--surface)', borderRadius: 8, marginBottom: 12, opacity: 0.5 }} />
      <div style={{ width: '90%', height: 16, background: 'var(--surface)', borderRadius: 8, marginBottom: 24, opacity: 0.3 }} />
      <div style={{ height: 300, background: 'var(--surface)', borderRadius: 14, opacity: 0.2 }} />
    </div>
  );
}

export default function PremiumModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const router = useRouter();
  const [module, setModule] = useState<PremiumModuleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const headers = getAuthHeaders() as Record<string, string>;
        const res = await fetch(`/api/premium-track?module=${encodeURIComponent(moduleId)}`, { headers });
        const data = await res.json();
        if (mounted) {
          if (data.pro_required) {
            setIsPro(false);
            setModule(data.module);
          } else {
            setIsPro(data.unlocked === true);
            // Merge lesson content into module for rendering
            const enriched = data.module
              ? { ...data.module, ...data.lesson }
              : null;
            setModule(enriched);
          }
          if (!data.ok && data.error) setError(data.error);
        }
      } catch (err: any) {
        if (mounted) setError(err?.message ?? 'Failed to load module');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [moduleId]);

  const trackMeta = module?.track ? TRACK_NAMES[module.track] : null;
  const concepts = module?.concepts;

  if (loading) return <ModuleSkeleton />;

  if (error || !module) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 8px' }}>
          Module Not Found
        </h2>
        <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: '0 0 16px' }}>
          {error || "We couldn't find this premium module."}
        </p>
        <button
          onClick={() => router.push('/learn')}
          style={{
            padding: '10px 20px', borderRadius: 8, border: 'none',
            background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          ← Back to Learning Hub
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 48px' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, fontSize: 12, color: 'var(--muted-on-dark)' }}>
        <button
          onClick={() => router.push('/learn')}
          style={{
            background: 'none', border: 'none', color: 'var(--muted-on-dark)',
            cursor: 'pointer', fontSize: 12, padding: 0,
          }}
        >
          Learning Hub
        </button>
        <span>›</span>
        <span style={{ color: 'var(--text-on-dark)' }}>
          {trackMeta ? `${trackMeta.emoji} ${trackMeta.title}` : 'Premium'}
        </span>
        <span>›</span>
        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{module.title}</span>
      </div>

      {/* Module Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 8px', lineHeight: 1.3 }}>
          {module.title}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--muted-on-dark)', margin: '0 0 12px', lineHeight: 1.6 }}>
          {module.description}
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 700,
            background: 'rgba(255,255,255,0.05)', color: DIFF_COLORS[module.difficulty] ?? 'var(--accent)',
            textTransform: 'capitalize',
          }}>
            {module.difficulty}
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted-on-dark)' }}>
            ⏱ {module.estimatedMinutes} min
          </span>
          {module.tags.map(tag => (
            <span key={tag} style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 4,
              background: 'rgba(255,255,255,0.04)', color: 'var(--muted-on-dark)',
            }}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Pro Gate Warning */}
      {!isPro && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(232,119,34,0.15), rgba(232,119,34,0.05))',
          border: '1px solid rgba(232,119,34,0.4)', borderRadius: 14,
          padding: '20px 24px', marginBottom: 24,
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>
            🔒 This is Premium Content
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: '0 0 16px', lineHeight: 1.6 }}>
            Upgrade to HomieHouse Pro to access this module and 11 more expert-built lessons on DeFi, trading safety, and the creator economy.
          </p>
          <button
            onClick={() => router.push('/pro')}
            style={{
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Upgrade to Pro →
          </button>
        </div>
      )}

      {/* Why It Matters — always visible as teaser */}
      <Section title="💡 Why It Matters" icon={null}>
        <p style={{ fontSize: 14, color: 'var(--text-on-dark)', lineHeight: 1.7, margin: 0 }}>
          {module.whyItMatters}
        </p>
      </Section>

      {/* Learning Objectives — always visible */}
      <Section title="🎯 What You'll Learn" icon={null}>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {module.objectives.map((obj, i) => (
            <li key={i} style={{
              fontSize: 14, color: 'var(--text-on-dark)', lineHeight: 1.7,
              marginBottom: i < module.objectives.length - 1 ? 8 : 0,
            }}>
              {obj}
            </li>
          ))}
        </ul>
      </Section>

      {/* Lesson Content — Pro only */}
      {isPro && concepts?.length && (
        <Section title="📖 Core Concepts" icon={null}>
          {concepts!.map((concept, i) => (
            <div key={i} style={{ marginBottom: i < concepts!.length - 1 ? 20 : 0 }}>
              <h3 style={{
                fontSize: 15, fontWeight: 700, color: 'var(--text-on-dark)',
                margin: '0 0 8px',
              }}>
                {concept.title}
              </h3>
              <p style={{
                fontSize: 14, color: 'var(--muted-on-dark)', lineHeight: 1.7, margin: '0 0 12px',
              }}>
                {concept.explanation}
              </p>
              {concept.analogy && (
                <div style={{
                  background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                  borderRadius: 10, padding: '14px 16px',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#818cf8' }}>
                    💭 Analogy
                  </span>
                  <p style={{ fontSize: 13, color: 'var(--text-on-dark)', lineHeight: 1.6, margin: '6px 0 0' }}>
                    {concept.analogy}
                  </p>
                </div>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* Practical Example — Pro only */}
      {isPro && module.practicalExample && (
        <Section title="🔬 Real-World Example" icon={null}>
          <div style={{
            background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 10, padding: '16px',
          }}>
            <p style={{ fontSize: 14, color: 'var(--text-on-dark)', lineHeight: 1.7, margin: 0 }}>
              {module.practicalExample}
            </p>
          </div>
        </Section>
      )}

      {/* Quick Actions — Pro only */}
      {isPro && module.quickActions && module.quickActions.length > 0 && (
        <Section title="⚡ Try It Now" icon={null}>
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
            {module.quickActions.map((action, i) => (
              <li key={i} style={{
                fontSize: 14, color: 'var(--text-on-dark)', lineHeight: 1.7,
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                marginBottom: i < module.quickActions!.length - 1 ? 8 : 0,
              }}>
                {action}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Summary — Pro only */}
      {isPro && module.summary && (
        <Section title="📝 Key Takeaway" icon={null}>
          <div style={{
            background: 'rgba(232,119,34,0.08)', border: '1px solid rgba(232,119,34,0.2)',
            borderRadius: 10, padding: '16px',
          }}>
            <p style={{ fontSize: 14, color: 'var(--text-on-dark)', lineHeight: 1.7, margin: 0 }}>
              {module.summary}
            </p>
          </div>
        </Section>
      )}

      {/* Quiz — Pro only */}
      {isPro && module.quiz && module.quiz.length > 0 && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '20px', marginTop: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showQuiz ? 16 : 0 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 4px' }}>
                🧠 Test Your Knowledge
              </h3>
              <p style={{ fontSize: 12, color: 'var(--muted-on-dark)', margin: 0 }}>
                {module.quiz.length} question{module.quiz.length > 1 ? 's' : ''} · Prove you understand the material
              </p>
            </div>
            {!showQuiz && (
              <button
                onClick={() => setShowQuiz(true)}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Start Quiz
              </button>
            )}
          </div>

          {showQuiz && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {module.quiz.map((q, qi) => {
                const selected = quizAnswers[qi];
                const isCorrect = quizSubmitted ? selected === q.correctIndex : null;
                return (
                  <div key={qi} style={{
                    padding: '16px', borderRadius: 10,
                    background: 'var(--bg-dark)', border: '1px solid var(--border)',
                  }}>
                    <div style={{
                      fontSize: 13, fontWeight: 700, color: 'var(--text-on-dark)',
                      marginBottom: 12,
                    }}>
                      {qi + 1}. {q.question}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {q.options.map((opt, oi) => {
                        let bg = 'var(--surface)';
                        let border = '1px solid var(--border)';
                        if (quizSubmitted) {
                          if (oi === q.correctIndex) {
                            bg = 'rgba(34,197,94,0.1)';
                            border = '1px solid rgba(34,197,94,0.4)';
                          } else if (oi === selected) {
                            bg = 'rgba(239,68,68,0.1)';
                            border = '1px solid rgba(239,68,68,0.4)';
                          }
                        } else if (oi === selected) {
                          bg = 'rgba(99,102,241,0.1)';
                          border = '1px solid rgba(99,102,241,0.4)';
                        }
                        return (
                          <button
                            key={oi}
                            disabled={quizSubmitted}
                            onClick={() => setQuizAnswers(prev => ({ ...prev, [qi]: oi }))}
                            style={{
                              textAlign: 'left', padding: '10px 14px', borderRadius: 8,
                              background: bg, border, fontSize: 13,
                              color: 'var(--text-on-dark)', cursor: quizSubmitted ? 'default' : 'pointer',
                              lineHeight: 1.5,
                            }}
                          >
                            {String.fromCharCode(65 + oi)}. {opt}
                            {quizSubmitted && oi === q.correctIndex && ' ✅'}
                            {quizSubmitted && isCorrect === false && oi === selected && ' ❌'}
                          </button>
                        );
                      })}
                    </div>
                    {quizSubmitted && (
                      <div style={{
                        marginTop: 10, fontSize: 12, color: isCorrect ? '#4ade80' : '#f87171',
                        lineHeight: 1.5,
                      }}>
                        {isCorrect ? '✅ Correct! ' : '❌ Not quite. '}
                        {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}

              {!quizSubmitted && (
                <button
                  onClick={() => setQuizSubmitted(true)}
                  disabled={Object.keys(quizAnswers).length !== module.quiz.length}
                  style={{
                    padding: '10px 20px', borderRadius: 8, border: 'none',
                    background: Object.keys(quizAnswers).length === module.quiz.length
                      ? 'var(--accent)' : 'var(--border)',
                    color: '#fff', fontSize: 14, fontWeight: 700, cursor: Object.keys(quizAnswers).length === module.quiz.length ? 'pointer' : 'default',
                    opacity: Object.keys(quizAnswers).length === module.quiz.length ? 1 : 0.5,
                  }}
                >
                  Submit Answers
                </button>
              )}

              {quizSubmitted && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => {
                      setQuizAnswers({});
                      setQuizSubmitted(false);
                    }}
                    style={{
                      padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'transparent', color: 'var(--text-on-dark)', fontSize: 13,
                      fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Retake Quiz
                  </button>
                  <button
                    onClick={() => router.push('/learn')}
                    style={{
                      padding: '8px 18px', borderRadius: 8, border: 'none',
                      background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Back to Hub →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bottom nav */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--border)',
      }}>
        <button
          onClick={() => router.push('/learn')}
          style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-on-dark)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          ← All Tracks
        </button>
        {!isPro && (
          <button
            onClick={() => router.push('/pro')}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Unlock with Pro →
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string | null;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '20px', marginBottom: 16,
    }}>
      <h2 style={{
        fontSize: 16, fontWeight: 700, color: 'var(--text-on-dark)',
        margin: '0 0 14px',
      }}>
        {title}
      </h2>
      {children}
    </div>
  );
}