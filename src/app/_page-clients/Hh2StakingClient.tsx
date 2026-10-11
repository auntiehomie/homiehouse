'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi';
import { base } from 'wagmi/chains';
import { formatUnits, parseUnits, type Hex } from 'viem';
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import { getAuthHeaders, getStoredFid } from '@/lib/client-auth';
import { HH2_STAKING_ABI, HH2_STAKING_ADDRESS, HH2_TOKEN_ABI, HH2_TOKEN_ADDRESS } from '@/lib/hh2-contracts';

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
  contract_stake_id: string;
  tier_id: string;
  amount: number;
  staked_at: string;
  unlocks_at: string;
  status: string;
  earnings_multiplier: number;
  bonus_earned: number;
}

const styles = {
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' } as const,
  button: { padding: '8px 14px', borderRadius: 8, border: 0, background: '#a78bfa', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' } as const,
  muted: { fontSize: 12, color: 'var(--muted-on-dark)' } as const,
};

export default function Hh2StakingClient() {
  const { fid: userFid } = useFarcasterAuth();
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: base.id });
  const { switchChain, isPending: switching } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [tiers, setTiers] = useState<StakingTier[]>([]);
  const [activeStakes, setActiveStakes] = useState<ActiveStake[]>([]);
  const [totalStaked, setTotalStaked] = useState(0);
  const [walletBurned, setWalletBurned] = useState(0);
  const [perkBurned, setPerkBurned] = useState(0);
  const [legacyStakeCount, setLegacyStakeCount] = useState(0);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [decimals, setDecimals] = useState(18);
  const [loading, setLoading] = useState(true);
  const [staking, setStaking] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const fid = userFid ?? getStoredFid();
    if (!fid) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/hh2-stake?fid=${fid}`, { headers: { ...(getAuthHeaders() ?? {}) } });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not load your stakes.');
      setTiers(data.tiers || []);
      setActiveStakes(data.activeStakes || []);
      setTotalStaked(data.totalStaked || 0);
      setWalletBurned(data.walletBurned || 0);
      setPerkBurned(data.perkBurned || 0);
      setLegacyStakeCount(data.legacyStakeCount || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your stakes.');
    } finally {
      setLoading(false);
    }
  }, [userFid]);

  useEffect(() => {
    void fetchData();
    const refresh = () => { void fetchData(); };
    window.addEventListener('hh2-updated', refresh);
    return () => window.removeEventListener('hh2-updated', refresh);
  }, [fetchData]);

  const fetchWalletBalance = useCallback(async () => {
    if (!address || !publicClient) { setBalance(null); return; }
    try {
      const [raw, tokenDecimals] = await Promise.all([
        publicClient.readContract({ address: HH2_TOKEN_ADDRESS, abi: HH2_TOKEN_ABI, functionName: 'balanceOf', args: [address] }),
        publicClient.readContract({ address: HH2_TOKEN_ADDRESS, abi: HH2_TOKEN_ABI, functionName: 'decimals' }),
      ]);
      setBalance(raw);
      setDecimals(Number(tokenDecimals));
    } catch {
      setBalance(null);
    }
  }, [address, publicClient]);

  useEffect(() => { void fetchWalletBalance(); }, [fetchWalletBalance]);

  const syncStake = async (fid: number, walletAddress: `0x${string}`, txHash: Hex, tierId: string, amount: number) => {
    const authHeaders = getAuthHeaders();
    if (!authHeaders) throw new Error('Reconnect your Farcaster account and try again.');
    const response = await fetch('/api/hh2-stake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ action: 'stake', fid, walletAddress, txHash, tierId, amount }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'The chain transaction succeeded, but the app could not sync it. Retry from the stake list.');
  };

  const handleStake = async (tier: StakingTier, amount: number) => {
    const fid = Number(userFid ?? getStoredFid());
    if (!fid || !address) { setError('Connect Farcaster and your wallet before staking.'); return; }
    if (!HH2_STAKING_ADDRESS) { setError('On-chain staking is not enabled until the verified Base staking contract is configured.'); return; }
    if (chainId !== base.id) { setError('Switch your wallet to Base before staking.'); return; }
    if (!Number.isInteger(amount) || amount < tier.minStake || amount > tier.maxStake) { setError(`Enter a whole HH2 amount between ${tier.minStake} and ${tier.maxStake}.`); return; }
    if (balance === null || parseUnits(String(amount), decimals) > balance) { setError('Your connected wallet does not have enough HH2 for this stake.'); return; }
    const authHeaders = getAuthHeaders();
    if (!authHeaders) { setError('Reconnect your Farcaster account and try again.'); return; }

    setStaking(tier.id); setError(null); setSuccess(null);
    try {
      const amountWei = parseUnits(String(amount), decimals);
      const approvalHash = await writeContractAsync({
        address: HH2_TOKEN_ADDRESS, abi: HH2_TOKEN_ABI, functionName: 'approve',
        args: [HH2_STAKING_ADDRESS, amountWei], chainId: base.id,
      });
      await publicClient!.waitForTransactionReceipt({ hash: approvalHash });

      const stakeHash = await writeContractAsync({
        address: HH2_STAKING_ADDRESS, abi: HH2_STAKING_ABI, functionName: 'stake',
        args: [tiers.findIndex((item) => item.id === tier.id), amountWei, BigInt(fid)], chainId: base.id,
      });
      const receipt = await publicClient!.waitForTransactionReceipt({ hash: stakeHash });
      if (receipt.status !== 'success') throw new Error('The staking transaction failed on Base.');
      await syncStake(fid, address, stakeHash, tier.id, amount);
      setSuccess(`Locked ${amount.toLocaleString()} HH2 for ${tier.lockDays} days. Your learning rewards are boosted ${tier.earningsMultiplier}× while it is locked.`);
      await Promise.all([fetchData(), fetchWalletBalance()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Staking failed. Please try again.');
    } finally { setStaking(null); }
  };

  const handleWithdraw = async (stake: ActiveStake) => {
    const fid = Number(userFid ?? getStoredFid());
    if (!fid || !address || !HH2_STAKING_ADDRESS) return;
    if (chainId !== base.id) { setError('Switch your wallet to Base before withdrawing.'); return; }
    setWithdrawing(stake.id); setError(null); setSuccess(null);
    try {
      const hash = await writeContractAsync({
        address: HH2_STAKING_ADDRESS, abi: HH2_STAKING_ABI, functionName: 'withdraw',
        args: [BigInt(stake.contract_stake_id), BigInt(fid)], chainId: base.id,
      });
      const receipt = await publicClient!.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('The withdrawal transaction failed on Base.');
      const authHeaders = getAuthHeaders();
      if (!authHeaders) throw new Error('The withdrawal succeeded. Reconnect Farcaster to sync the learning reward boost.');
      const response = await fetch('/api/hh2-stake', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ fid, walletAddress: address, contractStakeId: stake.contract_stake_id, txHash: hash }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Withdrawal succeeded, but the app could not sync it. Refresh to retry sync.');
      setSuccess(`Withdrew ${Number(formatUnits(BigInt(result.withdrawnAmountWei), decimals)).toLocaleString()} HH2 to your wallet.`);
      await Promise.all([fetchData(), fetchWalletBalance()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Withdrawal failed. Please try again.');
    } finally { setWithdrawing(null); }
  };

  if (loading) return <section style={{ marginBottom: 28 }}><h2 style={{ fontSize: 16, color: 'var(--text-on-dark)' }}>HH2 Staking</h2><div style={{ ...styles.card, textAlign: 'center' as const, ...styles.muted }}>Loading staking options…</div></section>;

  const onBase = chainId === base.id;
  const available = balance === null ? null : Number(formatUnits(balance, decimals));
  const now = Date.now();
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 14px' }}>🔒 HH2 Staking — Lock & Earn More</h2>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ ...styles.card, flex: '1 1 140px' }}><div style={styles.muted}>Wallet balance on Base</div><strong style={{ color: '#fbbf24', fontSize: 18 }}>{available === null ? 'Connect wallet' : `${available.toLocaleString(undefined, { maximumFractionDigits: 4 })} HH2`}</strong></div>
        <div style={{ ...styles.card, flex: '1 1 140px' }}><div style={styles.muted}>Currently locked</div><strong style={{ color: '#a78bfa', fontSize: 18 }}>{totalStaked.toLocaleString()} HH2</strong></div>
        <div style={{ ...styles.card, flex: '1 1 140px' }}><div style={styles.muted}>Wallet HH2 burned</div><strong style={{ color: '#f87171', fontSize: 18 }}>{walletBurned.toLocaleString(undefined, { maximumFractionDigits: 4 })} HH2</strong></div>
        <div style={{ ...styles.card, flex: '1 1 140px' }}><div style={styles.muted}>Burned through Homiehouse perks</div><strong style={{ color: '#f87171', fontSize: 18 }}>{perkBurned.toLocaleString()} HH2</strong></div>
      </div>

      {!HH2_STAKING_ADDRESS && <div style={{ ...styles.card, marginBottom: 12, borderColor: 'rgba(251,191,36,0.4)' }}><strong style={{ color: '#fbbf24' }}>Staking contract deployment is required</strong><p style={{ ...styles.muted, marginBottom: 0 }}>The old staking entries did not lock wallet tokens. New stakes will be enabled after the verified Base staking contract is deployed and configured.</p></div>}
      {HH2_STAKING_ADDRESS && !address && <div style={{ ...styles.card, ...styles.muted, marginBottom: 12 }}>Connect your wallet to read your Base HH2 balance and stake tokens.</div>}
      {HH2_STAKING_ADDRESS && address && !onBase && <button onClick={() => switchChain({ chainId: base.id })} disabled={switching} style={{ ...styles.button, marginBottom: 12 }}>{switching ? 'Switching…' : 'Switch wallet to Base'}</button>}

      {activeStakes.length > 0 && <div style={{ marginBottom: 14 }}><h3 style={{ fontSize: 13, color: 'var(--muted-on-dark)' }}>Active on-chain stakes</h3>{activeStakes.map((stake) => {
        const unlocked = new Date(stake.unlocks_at).getTime() <= now;
        return <div key={stake.id} style={{ ...styles.card, marginBottom: 8 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}><strong style={{ color: 'var(--text-on-dark)' }}>{stake.amount.toLocaleString()} HH2 · {stake.earnings_multiplier}× boost</strong>{unlocked ? <button onClick={() => void handleWithdraw(stake)} disabled={!!withdrawing} style={styles.button}>{withdrawing === stake.id ? 'Withdrawing…' : 'Withdraw'}</button> : <span style={styles.muted}>{Math.ceil((new Date(stake.unlocks_at).getTime() - now) / 86400000)}d remaining</span>}</div><div style={{ ...styles.muted, marginTop: 6 }}>Unlocks {new Date(stake.unlocks_at).toLocaleDateString()} · contract stake #{stake.contract_stake_id}</div></div>;
      })}</div>}

      {legacyStakeCount > 0 && <div style={{ ...styles.card, marginBottom: 12, borderColor: 'rgba(251,191,36,0.35)' }}><strong style={{ color: '#fbbf24' }}>Earlier virtual stakes updated</strong><p style={{ ...styles.muted, marginBottom: 0 }}>{legacyStakeCount} earlier stake record{legacyStakeCount === 1 ? ' was' : 's were'} app-only and did not lock wallet HH2. They no longer reduce your claimable app rewards. New stakes will lock tokens on Base.</p></div>}

      {HH2_STAKING_ADDRESS && <div style={{ display: 'grid', gap: 10 }}>{tiers.map((tier) => <StakingTierCard key={tier.id} tier={tier} busy={staking === tier.id} onStake={(amount) => void handleStake(tier, amount)} available={available} />)}</div>}
      <div style={{ ...styles.card, marginTop: 14, background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.15)' }}><span style={{ fontSize: 12, color: '#fca5a5' }}>10% of Homiehouse shop purchases are burned. You can also burn wallet-held HH2 separately below. Staked HH2 is held by the staking contract until its lock ends.</span></div>
      {error && <div role="alert" style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(239,68,68,0.08)', color: '#fca5a5', fontSize: 12 }}>{error}</div>}
      {success && <div role="status" style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(34,197,94,0.08)', color: '#86efac', fontSize: 12 }}>{success}</div>}
    </section>
  );
}

function StakingTierCard({ tier, busy, available, onStake }: { tier: StakingTier; busy: boolean; available: number | null; onStake: (amount: number) => void }) {
  const [amount, setAmount] = useState(tier.minStake);
  const enough = available !== null && amount <= available;
  return <div style={styles.card}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}><div><strong style={{ color: 'var(--text-on-dark)' }}>{tier.emoji} {tier.name}</strong><p style={{ ...styles.muted, margin: '6px 0' }}>{tier.description}</p><span style={styles.muted}>Min {tier.minStake} · Max {tier.maxStake} · {tier.earningsMultiplier}× learning rewards</span></div></div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}><input aria-label={`HH2 amount for ${tier.name}`} type="number" step="1" min={tier.minStake} max={tier.maxStake} value={amount} onChange={(event) => setAmount(Math.max(tier.minStake, Math.min(tier.maxStake, Number(event.target.value) || tier.minStake)))} style={{ width: 120, padding: '7px 10px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-on-dark)' }} /><button onClick={() => onStake(amount)} disabled={busy || !enough} style={{ ...styles.button, opacity: busy || !enough ? 0.55 : 1 }}>{busy ? 'Confirm in wallet…' : 'Approve & stake HH2'}</button>{available !== null && !enough && <span style={{ ...styles.muted, color: '#fca5a5' }}>Wallet balance is below this amount.</span>}</div>
  </div>;
}
