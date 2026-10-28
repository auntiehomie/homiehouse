'use client';

import { useEffect, useState } from 'react';
import { useAccount, useChainId, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from 'wagmi';
import { base } from 'wagmi/chains';
import { formatUnits, parseUnits, type Hex } from 'viem';
import { getAuthHeaders, getStoredFid } from '@/lib/client-auth';
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import { HH2_BURN_ADDRESS, HH2_TOKEN_ABI, HH2_TOKEN_ADDRESS } from '@/lib/hh2-contracts';

export default function Hh2BurnClient() {
  const { fid } = useFarcasterAuth();
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: base.id });
  const { switchChain, isPending: switching } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [amount, setAmount] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string; txHash?: string } | null>(null);

  const { data: rawBalance, refetch: refetchBalance } = useReadContract({
    address: HH2_TOKEN_ADDRESS,
    abi: HH2_TOKEN_ABI,
    functionName: 'balanceOf',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
    chainId: base.id,
    query: { enabled: !!address },
  });
  const { data: rawDecimals } = useReadContract({ address: HH2_TOKEN_ADDRESS, abi: HH2_TOKEN_ABI, functionName: 'decimals', chainId: base.id });
  const decimals = Number(rawDecimals ?? 18);
  const balance = rawBalance === undefined ? null : formatUnits(rawBalance, decimals);
  const onBase = chainId === base.id;

  useEffect(() => { setConfirming(false); setMessage(null); }, [address]);

  const burn = async () => {
    const userFid = Number(fid ?? getStoredFid());
    if (!address || !userFid || !publicClient) { setMessage({ ok: false, text: 'Connect your wallet and social account first.' }); return; }
    if (!onBase) { setMessage({ ok: false, text: 'Switch your wallet to Base before burning HH2.' }); return; }
    const authHeaders = getAuthHeaders();
    if (!authHeaders) { setMessage({ ok: false, text: 'Reconnect your social account before burning HH2.' }); return; }
    let value: bigint;
    try { value = parseUnits(amount, decimals); } catch { setMessage({ ok: false, text: 'Enter a valid HH2 amount.' }); return; }
    if (value <= 0n || rawBalance === undefined || value > rawBalance) { setMessage({ ok: false, text: 'Enter an amount greater than zero and no higher than your wallet balance.' }); return; }

    setBusy(true); setMessage(null);
    let txHash: Hex | undefined;
    try {
      txHash = await writeContractAsync({
        address: HH2_TOKEN_ADDRESS,
        abi: HH2_TOKEN_ABI,
        functionName: 'transfer',
        args: [HH2_BURN_ADDRESS, value],
        chainId: base.id,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== 'success') throw new Error('The burn transaction failed on Base.');
      setConfirming(false);
      try {
        const response = await fetch('/api/hh2-stake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ action: 'burn', fid: userFid, walletAddress: address, txHash }),
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || 'Burn history sync is pending.');
        setMessage({ ok: true, text: `Burned ${result.amount} HH2. The transfer to the burn address is irreversible.`, txHash });
      } catch {
        setMessage({ ok: true, text: 'The burn completed on Base. Homiehouse could not sync the activity yet; your tokens are already irrecoverable.', txHash });
      }
      setAmount('');
      window.dispatchEvent(new Event('hh2-updated'));
      await refetchBalance();
    } catch (error) {
      setConfirming(false);
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Burn failed. Please try again.', txHash });
    } finally { setBusy(false); }
  };

  return <section style={{ marginBottom: 24, borderRadius: 14, padding: 18, background: 'var(--surface)', border: '1px solid rgba(248,113,113,0.25)' }}>
    <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 6px' }}>🔥 Burn HH2</h2>
    <p style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--muted-on-dark)', margin: '0 0 12px' }}>Send wallet-held HH2 to the Base burn address. This transfer cannot be undone and the tokens cannot be recovered.</p>
    {!address ? <p style={{ fontSize: 12, color: 'var(--muted-on-dark)', margin: 0 }}>Connect your wallet to burn tokens.</p> : <>
      <div style={{ fontSize: 12, color: 'var(--muted-on-dark)', marginBottom: 10 }}>Available on Base: {balance === null ? 'Reading balance…' : `${Number(balance).toLocaleString(undefined, { maximumFractionDigits: 6 })} HH2`}</div>
      {!onBase ? <button onClick={() => switchChain({ chainId: base.id })} disabled={switching} style={buttonStyle}>{switching ? 'Switching…' : 'Switch wallet to Base'}</button> : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <input aria-label="HH2 amount to burn" type="number" min="0" step="any" inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); setConfirming(false); setMessage(null); }} placeholder="Amount to burn" style={{ flex: '1 1 140px', minWidth: 0, padding: '9px 10px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-on-dark)' }} />
        <button type="button" onClick={() => { setAmount(balance ?? ''); setConfirming(false); setMessage(null); }} disabled={balance === null || Number(balance) <= 0} style={secondaryButtonStyle}>Max</button>
        {!confirming ? <button type="button" onClick={() => { if (!amount || Number(amount) <= 0) { setMessage({ ok: false, text: 'Enter how many HH2 to burn.' }); return; } setMessage(null); setConfirming(true); }} disabled={busy} style={buttonStyle}>Review burn</button> : <button type="button" onClick={() => void burn()} disabled={busy} style={{ ...buttonStyle, background: '#b91c1c' }}>{busy ? 'Confirm in wallet…' : `Confirm irreversible burn of ${amount} HH2`}</button>}
      </div>}
    </>}
    {confirming && <p role="alert" style={{ fontSize: 12, color: '#fca5a5', margin: '10px 0 0' }}>This sends tokens to {HH2_BURN_ADDRESS}. Only confirm if you want them permanently removed from your wallet.</p>}
    {message && <div role={message.ok ? 'status' : 'alert'} style={{ marginTop: 10, fontSize: 12, color: message.ok ? '#86efac' : '#fca5a5' }}>{message.text}{message.txHash && <> {' '}<a href={`https://basescan.org/tx/${message.txHash}`} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>View transaction ↗</a></>}</div>}
  </section>;
}

const buttonStyle = { padding: '9px 14px', border: 0, borderRadius: 8, background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' } as const;
const secondaryButtonStyle = { padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'transparent', color: 'var(--text-on-dark)', fontWeight: 600, fontSize: 12, cursor: 'pointer' } as const;
