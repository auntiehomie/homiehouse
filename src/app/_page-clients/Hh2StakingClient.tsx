'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import { getAuthHeaders, getStoredFid } from '@/lib/client-auth';

interface StakingTier {
  id: string;
  name: string;
  lockDays: number;
  earningsMultiplier: number;
  minStake: number;
  maxStake: number;
  emoji: string;
  description: string;
}

interface ActiveStake {
  id: string;
  tier_id: string;
  amount: number;
  staked_at: string;
  unlocks_at: string;
  status: string;
  earnings_multiplier: number;
  bonus_earned: number;
}

export default function Hh2StakingClient() {
  const { fid: userFid } = useFarcasterAuth();
  const [tiers, setTiers] = useState<StakingTier[]>([]);
  const [activeStakes, setActiveStakes] = useState<ActiveStake[]>([]);
  const [totalStaked, setTotalStaked] = useState(0);
  const [totalBurned, setTotalBurned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [staking, setStaking] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const fid = userFid ?? getStoredFid();
    if (!fid) return;

    try {
      const res = await fetch(`/api/hh2-stake?fid=${fid}`, {
        headers: { ...(getAuthHeaders() ?? {}) },
      });
      const data = await res.json();
      if (data.ok) {
        setTiers(data.tiers || []);
        setActiveStakes(data.activeStakes || []);
        setTotalStaked(data.totalStaked || 0);
        setTotalBurned(data.totalBurned || 0);
      }
    } catch {
      /* non-blocking */
    } finally {
      setLoading(false);
    }
  }, [userFid]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStake = async (tierId: string, amount: number) => {
    const fid = userFid ?? getStoredFid();
    if (!fid) return;

    const authHeaders = getAuthHeaders();
    if (!authHeaders) {
      setError('Not authenticated — connect your Farcaster account first.');
      return;
    }

    setStaking(tierId);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/hh2-stake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ fid, tierId, amount }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(`Successfully staked ${amount} HH2 for ${data.stake.tierName}! Your learning rewards are now boosted ${data.stake.earningsMultiplier}×.`);
        fetchData();
      } else {
        setError(data.error || 'Failed to stake');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setStaking(null);
    }
  };

  const handleWithdraw = async (stakeId: string) => {
    const fid = userFid ?? getStoredFid();
    if (!fid) return;

    const authHeaders = getAuthHeaders();
    if (!authHeaders) {
      setError('Not authenticated — connect your Farcaster account first.');
      return;
    }

    setWithdrawing(stakeId);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/hh2-stake', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ fid, stakeId }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(`Withdrew ${data.withdrawnAmount} HH2 from stake${data.bonusEarned ? ` + ${data.bonusEarned} HH2 bonus earnings` : ''}!`);
        fetchData();
      } else {
        setError(data.error || 'Failed to withdraw');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setWithdrawing(null);
    }
  };

  if (loading) {
    return (
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 14px' }}>HH2 Staking</h2>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, textAlign: 'center' }}>
          <span style={{ color: 'var(--muted-on-dark)', fontSize: 14 }}>Loading staking options…</span>
        </div>
      </div>
    );
  }

  const now = Date.now();

  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 14px' }}>
        🔒 HH2 Staking — Lock & Earn More
      </h2>

      {/* Stats summary */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
          padding: '10px 14px', flex: '1 1 140px',
        }}>
          <div style={{ fontSize: 11, color: 'var(--muted-on-dark)', marginBottom: 4 }}>Total Staked</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#a78bfa' }}>{totalStaked} HH2</div>
        </div>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
          padding: '10px 14px', flex: '1 1 140px',
        }}>
          <div style={{ fontSize: 11, color: 'var(--muted-on-dark)', marginBottom: 4 }}>Burned (Deflationary)</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f87171' }}>{totalBurned} HH2</div>
        </div>
      </div>

      {/* Active stakes */}
      {activeStakes.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-on-dark)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Active Stakes
          </h3>
          {activeStakes.map((stake) => {
            const unlocked = new Date(stake.unlocks_at).getTime() <= now;
            const daysLeft = Math.ceil((new Date(stake.unlocks_at).getTime() - now) / (24 * 60 * 60 * 1000));
            return (
              <div key={stake.id} style={{
                background: 'var(--surface)', border: `1px solid ${unlocked ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
                borderRadius: 12, padding: '14px 18px', marginBottom: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-on-dark)' }}>
                    {stake.amount} HH2 · {stake.earnings_multiplier}× boost
                  </span>
                  {unlocked ? (
                    <button
                      onClick={() => handleWithdraw(stake.id)}
                      disabled={withdrawing === stake.id}
                      style={{
                        padding: '6px 14px', borderRadius: 8, border: 'none',
                        background: '#22c55e', color: '#fff', fontSize: 12, fontWeight: 600,
                        cursor: withdrawing === stake.id ? 'not-allowed' : 'pointer',
                        opacity: withdrawing === stake.id ? 0.6 : 1,
                      }}
                    >
                      {withdrawing === stake.id ? 'Withdrawing…' : 'Withdraw'}
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--muted-on-dark)' }}>
                      {daysLeft > 0 ? `${daysLeft}d remaining` : 'Unlocking…'}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted-on-dark)' }}>
                  Staked {new Date(stake.staked_at).toLocaleDateString()} · Unlocks {new Date(stake.unlocks_at).toLocaleDateString()}
                  {stake.bonus_earned > 0 && ` · Bonus earned: ${stake.bonus_earned} HH2`}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Staking tiers */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tiers.map((tier) => (
          <StakingTierCard key={tier.id} tier={tier} onStake={handleStake} staking={staking === tier.id} />
        ))}
      </div>

      {/* Burn info */}
      <div style={{
        marginTop: 14, padding: '12px 16px', borderRadius: 10,
        background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
      }}>
        <span style={{ fontSize: 12, color: '#fca5a5' }}>
          🔥 10% of every shop purchase is permanently burned, reducing HH2 supply over time. Stake HH2 to boost your learning rewards multiplier.
        </span>
      </div>

      {/* Error/Success messages */}
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

function StakingTierCard({
  tier, onStake, staking,
}: {
  tier: StakingTier;
  onStake: (tierId: string, amount: number) => void;
  staking: boolean;
}) {
  const [amount, setAmount] = useState(tier.minStake);

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 8 }}>
        <span style={{ fontSize: 24, lineHeight: 1 }}>{tier.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-on-dark)' }}>{tier.name}</span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
              background: 'rgba(167,139,250,0.15)', color: '#a78bfa',
              border: '1px solid rgba(167,139,250,0.3)',
            }}>{tier.earningsMultiplier}× rewards</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted-on-dark)', margin: '0 0 8px', lineHeight: 1.5 }}>{tier.description}</p>
          <div style={{ fontSize: 11, color: 'var(--muted-on-dark)', marginBottom: 8 }}>
            Min: {tier.minStake} HH2 · Max: {tier.maxStake} HH2 · Lock: {tier.lockDays} days
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number"
              value={amount}
              min={tier.minStake}
              max={tier.maxStake}
              onChange={(e) => setAmount(Math.max(tier.minStake, Math.min(tier.maxStake, Number(e.target.value) || tier.minStake)))}
              style={{
                width: 100, padding: '6px 10px', borderRadius: 8,
                background: 'var(--bg)', border: '1px solid var(--border)',
                color: 'var(--text-on-dark)', fontSize: 13, fontWeight: 600,
              }}
            />
            <button
              onClick={() => onStake(tier.id, amount)}
              disabled={staking}
              style={{
                padding: '7px 16px', borderRadius: 8, border: 'none',
                background: staking ? '#666' : '#a78bfa', color: '#fff',
                fontSize: 12, fontWeight: 600, cursor: staking ? 'not-allowed' : 'pointer',
                opacity: staking ? 0.6 : 1,
              }}
            >
              {staking ? 'Staking…' : 'Stake HH2'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
