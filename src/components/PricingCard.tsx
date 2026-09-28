'use client';

import { useState, useCallback } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { base } from 'wagmi/chains';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseAbi, createWalletClient, custom } from 'viem';
import { ReadContractParameters } from 'viem';

// Base USDC contract address
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// USDC ABI (just transfer + balanceOf)
const USDC_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
]);

// 5 USDC (6 decimals)
const PRO_PRICE = 5_000_000n;

interface PricingCardProps {
  userFid?: number | null;
  isPro?: boolean;
}

export default function PricingCard({ userFid, isPro = false }: PricingCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [step, setStep] = useState<'idle' | 'sending' | 'verifying' | 'done'>('idle');

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  const isOnBase = chainId === base.id;

  const features = [
    { icon: '💬', label: 'Unlimited Ask Homie queries' },
    { icon: '🔬', label: 'Deeper research mode' },
    { icon: '⚡', label: 'Priority LLM routing' },
    { icon: '🎨', label: 'All premium cast themes' },
    { icon: '📋', label: 'Extra list creation slots' },
  ];

  const handleCryptoSubscribe = useCallback(async () => {
    if (!userFid || !address) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Step 1: Switch to Base if not already
      if (!isOnBase) {
        setStep('sending');
        try {
          await switchChainAsync?.({ chainId: base.id });
        } catch {
          setError('Please switch to the Base network in your wallet');
          setLoading(false);
          return;
        }
      }

      // Step 2: Send USDC transfer via wallet
      setStep('sending');

      const walletClient = createWalletClient({
        account: address,
        chain: base,
        transport: custom((window as any).ethereum),
      });

      const treasury = process.env.NEXT_PUBLIC_PRO_TREASURY_ADDRESS;
      if (!treasury) {
        setError('Pro payments not yet configured. Check back soon!');
        setLoading(false);
        return;
      }

      // Send the USDC transfer
      const txHash = await walletClient.writeContract({
        address: BASE_USDC,
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [treasury as `0x${string}`, PRO_PRICE],
        account: address,
        chain: base,
      });

      // Step 3: Verify the payment on the backend
      setStep('verifying');

      // Read auth from local storage
      const profile = localStorage.getItem('hh_profile');
      const p = profile ? JSON.parse(profile) : null;
      const fid = String(p?.fid || userFid);
      const signerRaw = fid ? localStorage.getItem(`signer_${fid}`) : null;
      const signerKey = signerRaw ? JSON.parse(signerRaw)?.private_key : null;

      const verifyRes = await fetch('/api/pro/subscribe-crypto', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(fid ? { 'x-farcaster-fid': fid } : {}),
          ...(signerKey ? { 'x-signer-key': signerKey } : {}),
        },
        body: JSON.stringify({
          txHash,
          walletAddress: address,
        }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyData.ok) {
        setError(verifyData.error || 'Payment verification failed. If you sent USDC, contact support.');
        setLoading(false);
        setStep('idle');
        return;
      }

      setStep('done');
      setSuccess('Pro activated! Enjoy unlimited Ask Homie, deeper research, and premium features.');

      // Refresh the page after a moment
      setTimeout(() => window.location.reload(), 2500);
    } catch (err: any) {
      // User rejected the transaction
      if (err?.code === 4001 || err?.message?.includes('reject')) {
        setError('Transaction rejected');
      } else {
        setError(err?.message || 'Something went wrong with the payment');
      }
      setLoading(false);
      setStep('idle');
    }
  }, [userFid, address, isOnBase, switchChainAsync]);

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: isPro ? '2px solid var(--accent)' : '1px solid var(--border)',
        borderRadius: 14,
        overflow: 'hidden',
        maxWidth: 380,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '20px 20px 16px',
          background: isPro
            ? 'linear-gradient(135deg, rgba(232,119,34,0.15), rgba(232,119,34,0.05))'
            : 'linear-gradient(135deg, rgba(52,211,153,0.08), transparent)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: 6 }}>
          HomieHouse Pro
        </div>
        <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-on-dark)', marginBottom: 2 }}>
          5 USDC<span style={{ fontSize: 16, fontWeight: 500, color: 'var(--muted-on-dark)' }}>/mo</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted-on-dark)' }}>
          Pay with crypto on Base · No KYC · Cancel anytime
        </div>
      </div>

      {/* Features */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-on-dark)', marginBottom: 12 }}>
          Everything in Free, plus:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {features.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.3 }}>{f.icon}</span>
              <span style={{ fontSize: 13, color: 'var(--muted-on-dark)', lineHeight: 1.5 }}>{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '0 20px 20px' }}>
        {isPro ? (
          <>
            <div
              style={{
                width: '100%', padding: '12px', borderRadius: 10, textAlign: 'center',
                background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                fontSize: 14, fontWeight: 700, marginBottom: 8,
              }}
            >
              ⚡ You&apos;re a Pro member
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted-on-dark)', textAlign: 'center' }}>
              Your subscription is active. Pay again to extend your Pro benefits.
            </div>
          </>
        ) : !userFid ? (
          <div
            style={{
              width: '100%', padding: '12px', borderRadius: 10, textAlign: 'center',
              background: 'var(--surface)', color: 'var(--muted-on-dark)',
              border: '1px solid var(--border)',
              fontSize: 14, fontWeight: 700,
            }}
          >
            Sign in to get Pro
          </div>
        ) : !isConnected ? (
          <>
            <p style={{ fontSize: 12, color: 'var(--muted-on-dark)', textAlign: 'center', marginBottom: 12, lineHeight: 1.5 }}>
              Connect your wallet to pay with USDC on Base
            </p>
            <ConnectButton />
          </>
        ) : (
          <>
            {!isOnBase && (
              <div style={{ fontSize: 12, color: '#f59e0b', textAlign: 'center', marginBottom: 8 }}>
                ⚠️ Switch to Base network to pay
              </div>
            )}
            <button
              onClick={handleCryptoSubscribe}
              disabled={loading}
              style={{
                width: '100%', padding: '12px', borderRadius: 10,
                background: loading ? 'var(--surface)' : '#34d399',
                color: loading ? 'var(--muted-on-dark)' : '#09090b',
                border: 'none', fontWeight: 700, fontSize: 14,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'background 0.2s',
              }}
            >
              {step === 'idle' && 'Pay 5 USDC on Base'}
              {step === 'sending' && 'Confirm in wallet…'}
              {step === 'verifying' && 'Verifying payment…'}
              {step === 'done' && '✓ Pro Activated!'}
            </button>
            {address && (
              <div style={{ fontSize: 11, color: 'var(--muted-on-dark)', textAlign: 'center', marginTop: 8 }}>
                Wallet: {address.slice(0, 6)}…{address.slice(-4)}
              </div>
            )}
          </>
        )}

        {error && (
          <div style={{ fontSize: 12, color: '#ef4444', textAlign: 'center', marginTop: 8 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ fontSize: 12, color: '#22c55e', textAlign: 'center', marginTop: 8 }}>
            {success}
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--muted-on-dark)', textAlign: 'center', marginTop: 8 }}>
          USDC on Base · Decentralized · No credit card
        </div>
      </div>
    </div>
  );
}
