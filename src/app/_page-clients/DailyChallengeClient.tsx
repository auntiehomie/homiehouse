'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import { getAuthHeaders, getStoredFid } from '@/lib/client-auth';

/**
 * Daily Challenge — a quick crypto/web3 trivia question for bonus HH2.
 *
 * Backed by /api/daily-challenge (GET today's question, POST the answer).
 * One attempt per day, resets at UTC midnight. Stakers earn a boosted reward.
 * Rendered inside the Learning Hub so it lives next to the daily streak.
 */

interface ChallengeQuestion {
  question: string;
  options: string[];
}

interface ChallengeResult {
  correct: boolean;
  reward_amount: number;
  completed_at: string;
}

interface ChallengeData {
  question: ChallengeQuestion;
  completedToday: boolean;
  result: ChallengeResult | null;
  reward: number;
}

interface AnswerResult {
  correct: boolean;
  reward: number;
  explanation: string;
  correctIndex: number;
}

export default function DailyChallengeClient() {
  const { fid: userFid } = useFarcasterAuth();
  const [data, setData] = useState<ChallengeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fid = userFid ?? getStoredFid();

  const fetchChallenge = useCallback(async () => {
    if (!fid) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/daily-challenge?fid=${fid}`, {
        headers: { ...(getAuthHeaders() ?? {}) },
      });
      const json = await res.json();
      if (json.ok) {
        setData(json as ChallengeData);
        if (json.completedToday && json.result) {
          setSelectedIndex(null);
        }
      } else if (json.error) {
        setError(json.error);
      }
    } catch {
      /* non-blocking — challenge is an optional extra */
    } finally {
      setLoading(false);
    }
  }, [fid]);

  useEffect(() => { fetchChallenge(); }, [fetchChallenge]);

  const handleAnswer = async (answerIndex: number) => {
    if (!fid || submitting || data?.completedToday) return;
    const authHeaders = getAuthHeaders();
    if (!authHeaders) {
      setError('Connect your social account to play the daily challenge.');
      return;
    }

    setSubmitting(true);
    setSelectedIndex(answerIndex);
    setError(null);
    try {
      const res = await fetch('/api/daily-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ fid, answer: answerIndex }),
      });
      const json = await res.json();
      if (json.ok) {
        setAnswerResult(json as AnswerResult);
        fetchChallenge();
      } else {
        setError(json.error || 'Failed to submit answer');
        setSelectedIndex(null);
      }
    } catch {
      setError('Network error — please try again');
      setSelectedIndex(null);
    } finally {
      setSubmitting(false);
    }
  };

  // Not authenticated — show a lightweight prompt.
  if (!fid) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 18px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-on-dark)' }}>🎯 Daily Challenge</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted-on-dark)', margin: 0 }}>
          Connect your social account to answer today&apos;s question and earn bonus HH2.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 18px', marginBottom: 20 }}>
        <span style={{ fontSize: 12, color: 'var(--muted-on-dark)' }}>Loading today&apos;s challenge…</span>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const showResult = data.completedToday && (data.result || answerResult);
  const resultCorrect = answerResult ? answerResult.correct : data.result?.correct ?? false;
  const resultReward = answerResult ? answerResult.reward : data.result?.reward_amount ?? 0;

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 18px', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-on-dark)' }}>🎯 Daily Challenge</span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}>
          +{data.reward} HH2
        </span>
      </div>

      {showResult ? (
        <div>
          <div style={{
            padding: '10px 12px', borderRadius: 10, marginBottom: 10,
            background: resultCorrect ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${resultCorrect ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: resultCorrect ? '#86efac' : '#fca5a5', marginBottom: 4 }}>
              {resultCorrect ? `✅ Correct — +${resultReward} HH2` : '❌ Not quite'}
            </div>
            {(answerResult?.explanation || data.result) && (
              <p style={{ fontSize: 12, color: 'var(--muted-on-dark)', margin: 0, lineHeight: 1.5 }}>
                {answerResult?.explanation || 'Come back tomorrow for a new question.'}
              </p>
            )}
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted-on-dark)', margin: 0 }}>
            Come back tomorrow for a new challenge. 🗓️
          </p>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-on-dark)', margin: '0 0 12px', lineHeight: 1.5, fontWeight: 600 }}>
            {data.question.question}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.question.options.map((option, i) => {
              const isSelected = selectedIndex === i;
              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={submitting}
                  style={{
                    textAlign: 'left', padding: '10px 14px', borderRadius: 10,
                    background: isSelected ? 'rgba(99,102,241,0.12)' : 'var(--bg)',
                    border: `1px solid ${isSelected ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                    color: 'var(--text-on-dark)', fontSize: 13, fontWeight: 550,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  {String.fromCharCode(65 + i)}. {option}
                </button>
              );
            })}
          </div>
          {submitting && (
            <p style={{ fontSize: 11, color: 'var(--muted-on-dark)', margin: '8px 0 0' }}>Checking answer…</p>
          )}
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 10, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          fontSize: 12, color: '#fca5a5',
        }}>{error}</div>
      )}
    </div>
  );
}
