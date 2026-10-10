'use client';

import { useState, useCallback } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { base } from 'wagmi/chains';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseAbi, createWalletClient, custom } from 'viem';
import { getAuthHeaders } from '@/lib/client-auth';

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

type PaymentMethod = 'card' | 'crypto';

interface PricingCardProps {
  userFid?: number | null;
  isPro?: boolean;
}

export default function PricingCard({ userFid, isPro = false }: PricingCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [step, setStep] = useState<'idle' | 'sending' | 'verifying' | 'done'>('idle');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  const isOnBase = chainId === base.id;

  const features = [
    { icon: '🎓', label: '12 premium learning tracks', highlight: true },
    { icon: '🏦', label: 'Advanced DeFi: yield, leverage, MEV' },
    { icon: '📊', label: 'Trading Safety Pro: forensics, taxes, psychology' },
    { icon: '🎨', label: 'Creator Economy: monetization, community, branding' },
    { icon: '💬', label: 'Unlimited Ask Homie queries' },
    { icon: '🔬', label: 'Deeper research mode' },
    { icon: '⚡', label: 'Priority LLM routing' },
    { icon: '🎨', label: 'All premium cast themes' },
    { icon: '📋', label: 'Extra list creation slots' },
  ];

  // ── Card payment (Stripe Checkout) ──────────────────────────────────────────
  const handleCardSubscribe = useCallback(async () => {
    if (!userFid) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const authHeaders = getAuthHeaders();

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...authHeaders,
        },
      });

      const data = await res.json();

      if (!data.ok || !data.url) {
        setError(data.error || 'Failed to create checkout session. Stripe may not be configured yet.');
        setLoading(false);
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err: any) {
      setError(err?.message || 'Failed to start checkout');
      setLoading(false);
    }
  }, [userFid]);

  // ── Crypto payment (USDC on Base) ──────────────────────────────────────────
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

      const authHeaders = getAuthHeaders();

      const verifyRes = await fetch('/api/pro/subscribe-crypto', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...authHeaders,
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

  // ── Manage subscription (Stripe Customer Portal) ───────────────────────────
  const handleManageSubscription = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const authHeaders = getAuthHeaders();

      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...authHeaders,
        },
      });

      const data = await res.json();

      if (!data.ok || !data.url) {
        setError(data.error || 'Failed to open subscription management');
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch (err: any) {
      setError(err?.message || 'Failed to open portal');
      setLoading(false);
    }
  }, []);

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
          $5<span style={{ fontSize: 16, fontWeight: 500, color: 'var(--muted-on-dark)' }}>/mo</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted-on-dark)' }}>
          Pay with card or crypto · Cancel anytime
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
              <span style={{ fontSize: 13, color: (f as any).highlight ? 'var(--accent)' : 'var(--muted-on-dark)', lineHeight: 1.5, fontWeight: (f as any).highlight ? 700 : 400 }}>{f.label}{(f as any).highlight && ' ✨'}</span>
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
            <button
              onClick={handleManageSubscription}
              disabled={loading}
              style={{
                width: '100%', padding: '10px', borderRadius: 10, textAlign: 'center',
                background: 'var(--surface)', color: 'var(--muted-on-dark)',
                border: '1px solid var(--border)', fontSize: 13, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Loading…' : 'Manage subscription'}
            </button>
            <div style={{ fontSize: 12, color: 'var(--muted-on-dark)', textAlign: 'center', marginTop: 6 }}>
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
        ) : (
          <>
            {/* ── Payment method tabs ──────────────────────────────────────── */}
            <div style={{
              display: 'flex', gap: 6, marginBottom: 14,
              background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 3,
            }}>
              <button
                onClick={() => setPaymentMethod('card')}
                style={{
                  flex: 1, padding: '8px', borderRadius: 6, border: 'none',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: paymentMethod === 'card' ? 'var(--accent)' : 'transparent',
                  color: paymentMethod === 'card' ? '#09090b' : 'var(--muted-on-dark)',
                  transition: 'all 0.15s',
                }}
              >
                💳 Card
              </button>
              <button
                onClick={() => setPaymentMethod('crypto')}
                style={{
                  flex: 1, padding: '8px', borderRadius: 6, border: 'none',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: paymentMethod === 'crypto' ? 'var(--accent)' : 'transparent',
                  color: paymentMethod === 'crypto' ? '#09090b' : 'var(--muted-on-dark)',
                  transition: 'all 0.15s',
                }}
              >
                ₿ Crypto
              </button>
            </div>

            {/* ── Card payment (Stripe) ────────────────────────────────────── */}
            {paymentMethod === 'card' && (
              <>
                <button
                  onClick={handleCardSubscribe}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 10,
                    background: loading ? 'var(--surface)' : '#635bff',
                    color: loading ? 'var(--muted-on-dark)' : '#ffffff',
                    border: 'none', fontWeight: 700, fontSize: 14,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    transition: 'background 0.2s',
                  }}
                >
                  {loading ? 'Redirecting to Stripe…' : 'Pay $5 with Card'}
                </button>
                <div style={{ fontSize: 11, color: 'var(--muted-on-dark)', textAlign: 'center', marginTop: 6 }}>
                  Secure card payment via Stripe · No crypto needed
                </div>
              </>
            )}

            {/* ── Crypto payment (USDC on Base) ────────────────────────────── */}
            {paymentMethod === 'crypto' && (
              <>
                {!isConnected ? (
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
                <div style={{ fontSize: 11, color: 'var(--muted-on-dark)', textAlign: 'center', marginTop: 6 }}>
                  USDC on Base · No KYC · Decentralized
                </div>
              </>
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
      </div>
    </div>
  );
}