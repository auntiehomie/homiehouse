'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { formatEther, isAddress, parseEther } from 'viem';
import {
  useAccount,
  useBalance,
  useDisconnect,
  useSendTransaction,
  useWaitForTransactionReceipt,
  WagmiProvider,
} from 'wagmi';
import { useLoginPasskey, useRegisterPasskey } from '@zerodev/wallet-react';
import { baseSepolia } from 'wagmi/chains';
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import { zeroDevProjectConfigured, zeroDevTestnetConfig } from '@/config/zeroDevTestnet';
import SignInButton from '@/components/SignInButton';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 15_000 },
  },
});

function formatError(error: Error | null): string | null {
  return error?.message || null;
}

function parseTestEthAmount(value: string): bigint | null {
  const normalized = value.trim();
  if (!/^\d+(\.\d{1,18})?$/.test(normalized)) return null;
  try {
    const parsed = parseEther(normalized);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

function EmbeddedWalletPanel() {
  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const registerPasskey = useRegisterPasskey();
  const loginPasskey = useLoginPasskey();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');

  const balance = useBalance({
    address,
    chainId: baseSepolia.id,
    query: { enabled: Boolean(address) },
  });
  const send = useSendTransaction();
  const receipt = useWaitForTransactionReceipt({
    chainId: baseSepolia.id,
    hash: send.data,
    query: { enabled: Boolean(send.data) },
  });

  const isBusy = registerPasskey.isPending || loginPasskey.isPending;
  const canSend = Boolean(
    address &&
      chainId === baseSepolia.id &&
      isAddress(recipient) &&
      parseTestEthAmount(amount) !== null &&
      !send.isPending &&
      !receipt.isLoading,
  );

  function sendTestnetEth() {
    if (!canSend) return;
    const value = parseTestEthAmount(amount);
    if (value === null) return;
    send.sendTransaction({
      to: recipient as `0x${string}`,
      value,
      chainId: baseSepolia.id,
    });
  }

  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
      {!isConnected ? (
        <>
          <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>Create or open your passkey wallet</h2>
          <p style={{ color: 'var(--muted-on-dark)', lineHeight: 1.55, margin: '0 0 18px' }}>
            Create a new ZeroDev wallet with your device passkey, or sign in with a passkey you registered earlier.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => registerPasskey.mutate()}
              style={buttonStyle}
            >
              {registerPasskey.isPending ? 'Creating passkey…' : 'Create passkey wallet'}
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => loginPasskey.mutate()}
              style={secondaryButtonStyle}
            >
              {loginPasskey.isPending ? 'Opening passkey…' : 'Sign in with passkey'}
            </button>
          </div>
          {(formatError(registerPasskey.error) || formatError(loginPasskey.error)) && (
            <p role="alert" style={errorStyle}>
              {formatError(registerPasskey.error) || formatError(loginPasskey.error)}
            </p>
          )}
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ color: 'var(--muted-on-dark)', fontSize: 13, marginBottom: 6 }}>Base Sepolia wallet</div>
              <div style={{ fontFamily: 'monospace', fontSize: 15, wordBreak: 'break-all' }}>{address}</div>
            </div>
            <button type="button" onClick={() => disconnect()} style={secondaryButtonStyle}>Disconnect</button>
          </div>

          <div style={{ margin: '20px 0', padding: 16, borderRadius: 12, background: 'var(--bg-dark)' }}>
            <div style={{ color: 'var(--muted-on-dark)', fontSize: 13, marginBottom: 6 }}>Test ETH balance</div>
            <strong style={{ fontSize: 24 }}>
              {balance.isLoading ? 'Loading…' : `${Number(formatEther(balance.data?.value ?? 0n)).toFixed(5)} ETH`}
            </strong>
            {balance.error && <p role="alert" style={errorStyle}>{balance.error.message}</p>}
            <p style={{ color: 'var(--muted-on-dark)', fontSize: 12, margin: '8px 0 0' }}>
              This wallet is on Base Sepolia testnet. Test ETH has no real-world value.
            </p>
          </div>

          {chainId !== baseSepolia.id ? (
            <p role="alert" style={errorStyle}>Switch this embedded wallet to Base Sepolia before sending.</p>
          ) : (
            <div>
              <h3 style={{ fontSize: 15, margin: '0 0 12px' }}>Send a test transaction</h3>
              <label style={labelStyle}>
                Recipient address
                <input value={recipient} onChange={(event) => setRecipient(event.target.value)} autoComplete="off" style={inputStyle} />
              </label>
              <label style={{ ...labelStyle, marginTop: 12 }}>
                Amount in ETH
                <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" type="number" min="0" step="any" style={inputStyle} />
              </label>
              <button type="button" disabled={!canSend} onClick={sendTestnetEth} style={{ ...buttonStyle, marginTop: 14, opacity: canSend ? 1 : 0.55 }}>
                {send.isPending || receipt.isLoading ? 'Transaction pending…' : 'Review and send test ETH'}
              </button>
              {send.data && (
                <p style={{ color: 'var(--muted-on-dark)', fontSize: 13, overflowWrap: 'anywhere' }}>
                  Transaction: <a href={`https://sepolia.basescan.org/tx/${send.data}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>{send.data}</a>
                </p>
              )}
              {receipt.isSuccess && <p role="status" style={{ color: '#86efac' }}>Transaction confirmed on Base Sepolia.</p>}
              {(send.error || receipt.error) && <p role="alert" style={errorStyle}>{send.error?.message || receipt.error?.message}</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function EmbeddedWalletPage() {
  const { isAuthenticated } = useFarcasterAuth();
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => setAuthReady(true), []);

  return (
    <main style={{ minHeight: '100svh', background: 'var(--bg-dark)', color: 'var(--text-on-dark)', padding: '24px 16px 100px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <Link href="/wallet" style={{ color: 'var(--muted-on-dark)', fontSize: 14 }}>← Back to HH2 Wallet</Link>
        <header style={{ margin: '24px 0 18px' }}>
          <p style={{ color: 'var(--muted-on-dark)', fontSize: 12, fontWeight: 700, letterSpacing: 1, margin: '0 0 6px', textTransform: 'uppercase' }}>
            Preview wallet experiment
          </p>
          <h1 style={{ fontSize: 26, margin: 0 }}>HomieHouse Embedded Wallet</h1>
          <p style={{ color: 'var(--muted-on-dark)', lineHeight: 1.55, margin: '10px 0 0' }}>
            A ZeroDev passkey wallet for Base Sepolia. It is separate from your external wallet and from Hypersnap posting authorization.
          </p>
        </header>

        <div style={{ border: '1px solid rgba(251, 191, 36, .35)', background: 'rgba(251, 191, 36, .08)', borderRadius: 12, padding: 14, marginBottom: 18, color: 'var(--muted-on-dark)', fontSize: 13, lineHeight: 1.5 }}>
          Testnet only: do not send real assets or use this address for HH2 on Base mainnet. This prototype does not yet link the wallet address to your HomieHouse account.
        </div>

        {!zeroDevProjectConfigured ? (
          <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
            <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>ZeroDev Preview configuration is missing</h2>
            <p style={{ color: 'var(--muted-on-dark)', lineHeight: 1.55, margin: 0 }}>
              Set <code>NEXT_PUBLIC_ZERODEV_PROJECT_ID</code> in the Vercel Preview environment, then redeploy this branch.
            </p>
          </section>
        ) : !authReady ? (
          <p style={{ color: 'var(--muted-on-dark)' }}>Checking HomieHouse sign-in…</p>
        ) : !isAuthenticated ? (
          <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
            <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>Sign in to HomieHouse first</h2>
            <p style={{ color: 'var(--muted-on-dark)', lineHeight: 1.55, margin: '0 0 14px' }}>
              The preview wallet is available to signed-in HomieHouse users. Your ZeroDev passkey is a separate wallet sign-in.
            </p>
            <SignInButton />
          </section>
        ) : (
          <WagmiProvider config={zeroDevTestnetConfig}>
            <QueryClientProvider client={queryClient}>
              <EmbeddedWalletPanel />
            </QueryClientProvider>
          </WagmiProvider>
        )}
      </div>
    </main>
  );
}

const buttonStyle: React.CSSProperties = {
  background: 'var(--btn-primary-bg)',
  color: 'var(--btn-primary-color)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '11px 16px',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: 'transparent',
  color: 'var(--text-on-dark)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'var(--muted-on-dark)',
  fontSize: 13,
};

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--bg-dark)',
  color: 'var(--text-on-dark)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '11px 12px',
  marginTop: 6,
  fontSize: 14,
};

const errorStyle: React.CSSProperties = {
  color: '#fca5a5',
  fontSize: 13,
  overflowWrap: 'anywhere',
};
