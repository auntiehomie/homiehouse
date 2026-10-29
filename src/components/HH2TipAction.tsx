'use client';

import { useState } from 'react';
import { useAccount, useChainId, useSwitchChain, useWriteContract } from 'wagmi';
import { base } from 'wagmi/chains';
import { isAddress, parseUnits } from 'viem';
import { HH2_TOKEN_ABI, HH2_TOKEN_ADDRESS } from '@/lib/hh2-contracts';

type Props = { recipientFid?: number | null; recipientUsername?: string | null };

/** User initiated HH2 transfer to a profile's verified Ethereum address. */
export default function HH2TipAction({ recipientFid, recipientUsername }: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { writeContract, data: txHash, isPending: sending, isError, error, reset } = useWriteContract();
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState<string | null>(null);
  const [loadingRecipient, setLoadingRecipient] = useState(false);
  const [amount, setAmount] = useState('5');
  const [customAmount, setCustomAmount] = useState('');
  const [lookupError, setLookupError] = useState('');

  const openTip = async () => {
    setOpen(true);
    setLookupError('');
    setRecipient(null);
    reset();
    if (!recipientFid) {
      setLookupError('This cast does not include a profile ID, so the recipient wallet cannot be verified.');
      return;
    }
    setLoadingRecipient(true);
    try {
      const response = await fetch(`/api/profile?fid=${encodeURIComponent(String(recipientFid))}`);
      const profile = await response.json();
      const verified = profile?.verified_addresses?.eth_addresses?.find((entry: unknown): entry is string => typeof entry === 'string' && isAddress(entry));
      if (!response.ok || !verified) throw new Error('This user has no verified Ethereum address linked to their profile.');
      if (address && verified.toLowerCase() === address.toLowerCase()) throw new Error('You cannot tip your connected wallet.');
      setRecipient(verified);
    } catch (caught) {
      setLookupError(caught instanceof Error ? caught.message : 'Could not look up the verified recipient wallet.');
    } finally {
      setLoadingRecipient(false);
    }
  };

  const sendTip = (tipAmount = amount) => {
    if (!recipient || !isAddress(recipient) || !/^\d+(\.\d{1,18})?$/.test(tipAmount) || Number(tipAmount) <= 0) return;
    writeContract({
      address: HH2_TOKEN_ADDRESS,
      abi: HH2_TOKEN_ABI,
      functionName: 'transfer',
      args: [recipient as `0x${string}`, parseUnits(tipAmount, 18)],
      chainId: base.id,
    });
  };

  return <>
    <button
      type="button"
      aria-label={`Tip ${recipientUsername ? `@${recipientUsername}` : 'this cast author'} with HH2`}
      title="Send HH2 tip"
      onClick={openTip}
      style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', color: 'var(--muted-on-dark)', cursor: 'pointer', fontSize: 13, padding: '5px 9px', borderRadius: 8, flexShrink: 0, whiteSpace: 'nowrap' }}
    >
      <span aria-hidden="true">🪙</span>
    </button>

    {open && (
      <div role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(0,0,0,.72)' }}>
        <section role="dialog" aria-modal="true" aria-labelledby="hh2-tip-title" style={{ width: 'min(100%, 340px)', borderRadius: 14, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-on-dark)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <h2 id="hh2-tip-title" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>💲 Tip with HH2</h2>
            <button type="button" aria-label="Close tip" onClick={() => setOpen(false)} style={{ background: 'transparent', border: 0, color: 'var(--muted-on-dark)', fontSize: 24, cursor: 'pointer' }}>×</button>
          </div>
          <p style={{ margin: '10px 0 16px', fontSize: 13, lineHeight: 1.5, color: 'var(--muted-on-dark)' }}>
            {recipientUsername ? `Send HH2 directly to @${recipientUsername}` : 'Send HH2 directly to this cast author'} on Base. Your wallet will ask you to confirm the transfer.
          </p>

          {!isConnected ? <p style={{ color: '#fbbf24', fontSize: 13 }}>Connect an EVM wallet from the app header to send a tip.</p> : null}
          {loadingRecipient ? <p role="status" style={{ fontSize: 13, color: 'var(--muted-on-dark)' }}>Checking the profile’s verified wallet…</p> : null}
          {lookupError ? <p role="alert" style={{ fontSize: 13, color: '#fca5a5' }}>{lookupError}</p> : null}
          {recipient && <p style={{ margin: '0 0 12px', fontSize: 11, color: 'var(--muted-on-dark)', overflowWrap: 'anywhere' }}>Verified recipient: {recipient}</p>}

          {isConnected && recipient && !txHash && (
            <>
              <label htmlFor="hh2-tip-amount" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Choose tip amount</label>
              <select id="hh2-tip-amount" value={amount} onChange={event => setAmount(event.target.value)} aria-describedby="hh2-tip-notice" style={{ boxSizing: 'border-box', width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-dark)', color: 'var(--text-on-dark)', fontSize: 15 }}>
                <option value="1">1 HH2</option><option value="5">5 HH2</option><option value="10">10 HH2</option><option value="25">25 HH2</option><option value="50">50 HH2</option><option value="custom">Custom amount…</option>
              </select>
              {amount === 'custom' && <input aria-label="Custom HH2 tip amount" inputMode="decimal" value={customAmount} onChange={event => setCustomAmount(event.target.value)} placeholder="Enter HH2 amount" style={{ boxSizing: 'border-box', width: '100%', marginTop: 8, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-dark)', color: 'var(--text-on-dark)', fontSize: 15 }} />}
              <p id="hh2-tip-notice" style={{ margin: '8px 0 14px', fontSize: 11, lineHeight: 1.5, color: 'var(--muted-on-dark)' }}>Token transfers are on-chain and generally cannot be reversed. Confirm the amount and wallet in your connected wallet.</p>
            </>
          )}

          {chainId !== base.id && isConnected && <button type="button" onClick={() => switchChain({ chainId: base.id })} disabled={switching} style={{ width: '100%', padding: 11, border: 0, borderRadius: 9, background: '#fbbf24', color: '#111', fontWeight: 700, cursor: 'pointer' }}>{switching ? 'Switching…' : 'Switch to Base'}</button>}
          {chainId === base.id && isConnected && recipient && !txHash && <button type="button" onClick={() => sendTip(amount === 'custom' ? customAmount : amount)} disabled={sending || !/^\d+(\.\d{1,18})?$/.test(amount === 'custom' ? customAmount : amount) || Number(amount === 'custom' ? customAmount : amount) <= 0} style={{ width: '100%', padding: 10, border: 0, borderRadius: 9, background: '#fbbf24', color: '#111', fontWeight: 700, cursor: sending ? 'wait' : 'pointer', opacity: sending ? .6 : 1 }}>{sending ? 'Confirm in your wallet…' : `Send ${amount === 'custom' ? customAmount || '0' : amount} HH2`}</button>}
          {isError && <p role="alert" style={{ margin: '10px 0 0', fontSize: 12, color: '#fca5a5' }}>{error?.message?.slice(0, 220) || 'The transfer failed.'}</p>}
          {txHash && <p role="status" style={{ margin: '12px 0 0', fontSize: 13, color: '#86efac' }}>Tip transaction submitted. <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noreferrer" style={{ color: '#86efac' }}>View on Basescan ↗</a></p>}
        </section>
      </div>
    )}
  </>;
}
