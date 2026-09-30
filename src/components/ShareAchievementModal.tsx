'use client';

import { useState, useCallback } from 'react';
import { getAuthHeaders, getStoredFid } from '@/lib/client-auth';

type ShareState = 'idle' | 'posting' | 'posted' | 'error';

interface ShareAchievementProps {
  lessonTitle: string;
  trackName?: string;
  streakCount?: number;
  moduleId?: string;
  referralCode?: string;
  onClose: () => void;
  onBackToPlan: () => void;
}

const TRACK_LABELS: Record<string, string> = {
  learner: 'Crypto Learner',
  creator: 'Creator Economy',
  financial: 'Financial Freedom',
  survival: 'Crypto Safety',
};

export function buildShareText(lessonTitle: string, trackName?: string, streakCount?: number): string {
  const parts: string[] = [];
  parts.push(`🎓 Just completed "${lessonTitle}" on HomieHouse!`);

  if (trackName && TRACK_LABELS[trackName]) {
    parts.push(`📚 Track: ${TRACK_LABELS[trackName]}`);
  }

  if (streakCount && streakCount > 1) {
    parts.push(`🔥 ${streakCount}-day learning streak!`);
  }

  parts.push(`🏡 Building my Web3 knowledge one module at a time.`);
  parts.push(`\nTry it free: homiehouse.lol/learn`);
  parts.push(`\n#HomieHouseLearning #HomieHouse`);

  // Keep under Farcaster's 320 char limit
  let text = parts.join('\n');
  if (text.length > 320) {
    text = text.slice(0, 317) + '…';
  }
  return text;
}

export default function ShareAchievementModal({
  lessonTitle,
  trackName,
  streakCount,
  moduleId,
  referralCode,
  onClose,
  onBackToPlan,
}: ShareAchievementProps) {
  const [state, setState] = useState<ShareState>('idle');
  const [castHash, setCastHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shareText = buildShareText(lessonTitle, trackName, streakCount);
  const referralUrl = referralCode ? `https://homiehouse.lol/?ref=${referralCode}` : 'https://homiehouse.lol';

  const handleCast = useCallback(async () => {
    setState('posting');
    setError(null);

    try {
      const fid = getStoredFid();
      const authHeaders = getAuthHeaders();

      if (!fid || !authHeaders) {
        setState('error');
        setError('Sign in with Farcaster to share.');
        return;
      }

      const res = await fetch('/api/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ text: shareText, fid: Number(fid) }),
      });

      const data = await res.json();
      if (data.ok) {
        setCastHash(data.cast?.hash || null);
        setState('posted');
      } else {
        setState('error');
        setError(data.error || 'Failed to post cast');
      }
    } catch (e: any) {
      setState('error');
      setError(e?.message || 'Network error');
    }
  }, [shareText]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText('https://homiehouse.lol/learn');
      // Brief visual feedback — handled by button state
    } catch {}
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
      animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{
        width: '100%', maxWidth: 420, maxHeight: '90vh',
        background: 'var(--bg-dark)', borderRadius: '20px 20px 0 0',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.3s ease',
      }}>
        {/* Handle */}
        <div style={{
          display: 'flex', justifyContent: 'center', padding: '12px 0 4px',
        }}>
          <div style={{
            width: 40, height: 4, borderRadius: 2,
            background: 'var(--border)',
          }} />
        </div>

        {/* Header */}
        <div style={{ padding: '8px 20px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
          <h2 style={{
            fontSize: 20, fontWeight: 800, color: 'var(--text-on-dark)',
            margin: '0 0 4px',
          }}>
            Share your achievement!
          </h2>
          <p style={{
            fontSize: 14, color: 'var(--muted-on-dark)', margin: 0, lineHeight: 1.5,
          }}>
            Let the Farcaster community know what you learned today.
            {streakCount && streakCount > 1 && (
              <span style={{ display: 'block', marginTop: 4, fontWeight: 600, color: '#fbbf24' }}>
                🔥 You're on a {streakCount}-day learning streak!
              </span>
            )}
          </p>
        </div>

        {/* Share preview card */}
        <div style={{
          margin: '0 20px', padding: '14px 16px', borderRadius: 14,
          background: 'var(--surface)', border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 12,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0,
            }}>
              🏡
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-on-dark)', margin: 0 }}>
                HomieHouse Learning
              </p>
              <p style={{ fontSize: 11, color: 'var(--muted-on-dark)', margin: 0 }}>
                @homiehouse
              </p>
            </div>
          </div>
          <p style={{
            fontSize: 14, color: 'var(--text-on-dark)', margin: 0, lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
          }}>
            {shareText}
          </p>
          <div style={{
            display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap',
          }}>
            <span style={{
              fontSize: 11, padding: '3px 8px', borderRadius: 6,
              background: 'rgba(99,102,241,0.15)', color: '#a5b4fc',
            }}>
              #HomieHouseLearning
            </span>
            <span style={{
              fontSize: 11, padding: '3px 8px', borderRadius: 6,
              background: 'rgba(99,102,241,0.15)', color: '#a5b4fc',
            }}>
              #HomieHouse
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {state === 'idle' && (
            <button
              onClick={handleCast}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Share on Farcaster
            </button>
          )}

          {state === 'posting' && (
            <div style={{
              padding: '14px', borderRadius: 12,
              background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                border: '2px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1',
                animation: 'hhSpin 0.8s linear infinite',
              }} />
              <span style={{ fontSize: 14, color: '#a5b4fc', fontWeight: 600 }}>
                Posting to Farcaster…
              </span>
            </div>
          )}

          {state === 'posted' && (
            <div style={{
              padding: '14px', borderRadius: 12,
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: 15, color: '#22c55e', fontWeight: 700, margin: '0 0 8px' }}>
                ✅ Shared on Farcaster!
              </p>
              {castHash && (
                <a
                  href={`https://warpcast.com/~/conversations/${castHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 13, color: '#a5b4fc', textDecoration: 'none' }}
                >
                  View your cast on Warpcast ↗
                </a>
              )}
            </div>
          )}

          {state === 'error' && (
            <div style={{
              padding: '14px', borderRadius: 12,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: 14, color: '#fca5a5', margin: '0 0 8px' }}>
                {error || 'Something went wrong'}
              </p>
              <button
                onClick={handleCast}
                style={{
                  padding: '8px 18px', borderRadius: 8,
                  background: 'var(--accent)', color: '#fff',
                  border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Try Again
              </button>
            </div>
          )}

          {state !== 'posting' && (
            <>
              <button
                onClick={handleCopyLink}
                style={{
                  width: '100%', padding: '12px', borderRadius: 12,
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--text-on-dark)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copy learning link
              </button>

              {referralCode && (
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(referralUrl);
                    } catch {}
                  }}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 12,
                    background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)',
                    color: '#fbbf24', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  🪙 Copy referral link — earn 50 HH2 per friend
                </button>
              )}
            </>
          )}

          <button
            onClick={onBackToPlan}
            style={{
              width: '100%', padding: '14px', borderRadius: 12,
              background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)',
              border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Back to Learning Plan →
          </button>

          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '10px', borderRadius: 12,
              background: 'transparent', border: 'none',
              color: 'var(--muted-on-dark)', fontSize: 13, cursor: 'pointer',
            }}
          >
            Maybe later
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes hhSpin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
}