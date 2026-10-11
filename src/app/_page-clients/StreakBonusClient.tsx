'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import { getAuthHeaders, getStoredFid } from '@/lib/client-auth';

/**
 * Streak Bonus — milestone HH2 rewards for keeping a daily learning streak.
 *
 * Backed by /api/streak-bonus (GET status, POST claim). Milestones are
 * 7/14/30/60/90 days (+200/+500/+1000/+2000/+5000 HH2), each claimable once.
 */

interface AvailableBonus {
  milestone: number;
  bonus: number;
}

interface UpcomingBonus {
  milestone: number;
  bonus: number;
  daysRemaining: number;
}

interface StreakStatus {
  currentStreak: number;
  longestStreak: number;
  available: AvailableBonus[];
  upcoming: UpcomingBonus[];
  totalClaimed: number;
}

const MILESTONE_EMOJI: Record<number, string> = {
  7: '🔥',
  14: '⚡',
  30: '💎',
  60: '🏆',
  90: '👑',
};

export default function StreakBonusClient() {
  const { fid: userFid } = useFarcasterAuth();
  const [status, setStatus] = useState<StreakStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fid = userFid ?? getStoredFid();

  const fetchStatus = useCallback(async () => {
    if (!fid) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/streak-bonus?fid=${fid}`, {
        headers: { ...(getAuthHeaders() ?? {}) },
      });
      const json = await res.json();
      if (json.ok) {
        setStatus(json as StreakStatus);
      }
    } catch {
      /* non-blocking */
    } finally {
      setLoading(false);
    }
  }, [fid]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleClaim = async (milestone: number) => {
    if (!fid || claiming) return;
    const authHeaders = getAuthHeaders();
    if (!authHeaders) {
      setError('Connect your Farcaster account to claim streak bonuses.');
      return;
    }

    setClaiming(milestone);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/streak-bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ fid, milestone }),
      });
      const json = await res.json();
      if (json.ok) {
        setSuccess(`🎉 Claimed ${json.bonus} HH2 for your ${milestone}-day streak!`);
        fetchStatus();
      } else {
        setError(json.error || 'Failed to claim bonus');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setClaiming(null);
    }
  };

  // Not authenticated.
  if (!fid) {
    return (
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 14px' }}>🔥 Streak Bonuses</h2>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
          <p style={{ fontSize: 12, color: 'var(--muted-on-dark)', margin: 0 }}>
            Connect your Farcaster account and build a daily learning streak to earn milestone bonuses.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 14px' }}>🔥 Streak Bonuses</h2>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
          <span style={{ fontSize: 12, color: 'var(--muted-on-dark)' }}>Loading streak bonuses…</span>
        </div>
      </div>
    );
  }

  if (!status) return null;

  const ALL_MILESTONES = [7, 14, 30, 60, 90];
  const availableSet = new Set(status.available.map((a) => a.milestone));
  const upcomingSet = new Set(status.upcoming.map((u) => u.milestone));
  // A milestone is "claimed" when it's neither available nor upcoming but the
  // user's best streak reached it (the API omits claimed milestones entirely).
  const claimedSet = new Set<number>();
  for (const m of ALL_MILESTONES) {
    if (!availableSet.has(m) && !upcomingSet.has(m) && status.longestStreak >= m) {
      claimedSet.add(m);
    }
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 14px' }}>🔥 Streak Bonuses</h2>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', flex: '1 1 140px' }}>
          <div style={{ fontSize: 11, color: 'var(--muted-on-dark)', marginBottom: 4 }}>Current Streak</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fb923c' }}>{status.currentStreak} days</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', flex: '1 1 140px' }}>
          <div style={{ fontSize: 11, color: 'var(--muted-on-dark)', marginBottom: 4 }}>Best Streak</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#a78bfa' }}>{status.longestStreak} days</div>
        </div>
        {status.totalClaimed > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', flex: '1 1 140px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted-on-dark)', marginBottom: 4 }}>Claimed Bonuses</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fbbf24' }}>+{status.totalClaimed} HH2</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ALL_MILESTONES.map((m) => {
          const bonus = ({ 7: 200, 14: 500, 30: 1000, 60: 2000, 90: 5000 } as Record<number, number>)[m];
          const isAvailable = availableSet.has(m);
          const upcoming = status.upcoming.find((u) => u.milestone === m);
          const isClaimed = claimedSet.has(m);
          const state = isAvailable ? 'available' : isClaimed ? 'claimed' : 'upcoming';
          const daysRemaining = upcoming?.daysRemaining ?? (state === 'upcoming' ? Math.max(1, m - status.currentStreak) : 0);

          return (
            <div key={m} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12,
              background: 'var(--surface)', border: '1px solid var(--border)',
              opacity: state === 'claimed' ? 0.6 : 1,
            }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>{MILESTONE_EMOJI[m] ?? '🔥'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-on-dark)' }}>
                  {m}-day streak
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted-on-dark)' }}>
                  {state === 'available' && 'Ready to claim!'}
                  {state === 'claimed' && 'Claimed'}
                  {state === 'upcoming' && `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} to go`}
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>+{bonus}</span>
              {state === 'available' ? (
                <button
                  onClick={() => handleClaim(m)}
                  disabled={claiming === m}
                  style={{
                    padding: '6px 14px', borderRadius: 8, border: 'none',
                    background: claiming === m ? '#666' : '#fbbf24', color: '#1a1a1a',
                    fontSize: 12, fontWeight: 700, cursor: claiming === m ? 'not-allowed' : 'pointer',
                    opacity: claiming === m ? 0.6 : 1,
                  }}
                >
                  {claiming === m ? 'Claiming…' : 'Claim'}
                </button>
              ) : state === 'claimed' ? (
                <span style={{ fontSize: 12, color: '#86efac', fontWeight: 600 }}>✓</span>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--muted-on-dark)' }}>🔒</span>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div style={{
          marginTop: 10, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          fontSize: 12, color: '#fca5a5',
        }}>{error}</div>
      )}
      {success && (
        <div style={{
          marginTop: 10, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
          fontSize: 12, color: '#86efac',
        }}>{success}</div>
      )}
    </div>
  );
}
