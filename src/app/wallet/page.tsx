'use client';

import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useChainId, useReadContract, useWriteContract, useSwitchChain } from 'wagmi';
import { base } from 'wagmi/chains';
import { isAddress, parseUnits, formatUnits } from 'viem';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import HHLogo from '@/components/HHLogo';

const HH2_ADDRESS = '0x290bf43aa0406DFd0D878367814Dffa926e9Bb07' as const;
const HH2_CHAIN_ID = base.id;
const UNISWAP_LINK = `https://app.uniswap.org/swap?outputCurrency=${HH2_ADDRESS}&chain=base`;
const DEXSCREENER_PAIR = `https://dexscreener.com/base/${HH2_ADDRESS}`;
const BASESCAN_LINK = `https://basescan.org/token/${HH2_ADDRESS}`;

const HH2_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function WalletPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: switchPending } = useSwitchChain();
  const isOnBase = chainId === HH2_CHAIN_ID;

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');

  // Read HH2 balance on Base (always queries Base regardless of connected chain)
  const { data: hh2Raw, isLoading: hh2Loading } = useReadContract({
    address: HH2_ADDRESS,
    abi: HH2_ABI,
    functionName: 'balanceOf',
    args: [(address ?? '0x0000000000000000000000000000000000000000') as `0x${string}`],
    chainId: HH2_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Read HH2 decimals
  const { data: decimals } = useReadContract({
    address: HH2_ADDRESS,
    abi: HH2_ABI,
    functionName: 'decimals',
    chainId: HH2_CHAIN_ID,
  });

  // Write contract for transfers
  const {
    writeContract,
    isPending: sendPending,
    isSuccess: sendSuccess,
    isError: sendError,
    error: sendErr,
    data: sendData,
    reset: resetSend,
  } = useWriteContract();

  const dec = Number(decimals ?? 18);
  const formattedBalance = hh2Raw !== undefined ? formatUnits(hh2Raw, dec) : '0';
  const displayBalance = parseFloat(formattedBalance).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const isValidRecipient = recipient ? isAddress(recipient) : false;
  const canSend = !!address && !!recipient && !!amount && isValidRecipient && isOnBase && !sendPending;

  const handleSend = () => {
    if (!canSend) return;
    const value = parseUnits(amount, dec);
    writeContract({
      address: HH2_ADDRESS,
      abi: HH2_ABI,
      functionName: 'transfer',
      args: [recipient as `0x${string}`, value],
      chainId: HH2_CHAIN_ID,
    });
  };

  const handleReset = () => {
    resetSend();
    setRecipient('');
    setAmount('');
  };

  return (
    <div style={{ minHeight: '100svh', background: 'var(--bg-dark)' }}>
      <main style={{ overflowY: 'auto', minHeight: '100svh' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 80px' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => router.back()}
                style={{ background: 'none', border: 'none', color: 'var(--muted-on-dark)', cursor: 'pointer', padding: '4px 8px 4px 0', fontSize: 22, lineHeight: 1 }}
              >
                ←
              </button>
              <HHLogo size={28} />
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text-on-dark)' }}>HH2 Wallet</h1>
                <p style={{ fontSize: 12, color: 'var(--muted-on-dark)', margin: 0 }}>Send and trade HomieHouse on Base</p>
              </div>
            </div>
            <ConnectButton label="Connect" />
          </div>

          {/* Not connected */}
          {!isConnected && (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}> 👛</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 8px' }}>
                Connect your wallet
              </h2>
              <p style={{ fontSize: 14, color: 'var(--muted-on-dark)', margin: '0 0 24px', lineHeight: 1.6, maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
                Connect an EVM wallet to view your HH2 balance, send tokens, and trade on Uniswap. Rainbow, MetaMask, Coinbase, Trust, and WalletConnect are all supported.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <ConnectButton label="Connect Wallet" />
              </div>
            </div>
          )}

          {/* Connected */}
          {isConnected && (
            <>
              {/* Wrong network banner */}
              {!isOnBase && (
                <div style={{
                  background: 'rgba(251, 191, 36, 0.1)',
                  border: '1px solid rgba(251, 191, 36, 0.3)',
                  borderRadius: 12,
                  padding: '14px 18px',
                  marginBottom: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fbbf24' }}>Wrong network</div>
                    <div style={{ fontSize: 12, color: 'var(--muted-on-dark)', marginTop: 2 }}>
                      HH2 is on Base. Switch to view your balance and send.
                    </div>
                  </div>
                  <button
                    onClick={() => switchChain?.({ chainId: HH2_CHAIN_ID })}
                    disabled={switchPending}
                    style={{
                      padding: '8px 16px', borderRadius: 10, border: 'none',
                      background: '#fbbf24', color: '#000',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      opacity: switchPending ? 0.6 : 1,
                    }}
                  >
                    {switchPending ? 'Switching…' : 'Switch to Base'}
                  </button>
                </div>
              )}

              {/* Balance card */}
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '24px 20px',
                }}>
                  <div style={{ fontSize: 13, color: 'var(--muted-on-dark)', marginBottom: 6 }}>
                    Your HH2 Balance
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-on-dark)', marginBottom: 4 }}>
                    {hh2Loading ? 'Loading…' : `${displayBalance} HH2`}
                  </div>
                  {address && (
                    <div style={{ fontSize: 12, color: 'var(--muted-on-dark)', fontFamily: 'monospace' }}>
                      {truncate(address)}
                    </div>
                  )}
                </div>
              </div>

              {/* Send form */}
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 12px' }}>
                  Send HH2
                </h2>
                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '20px',
                }}>
                  {sendSuccess ? (
                    <div style={{ textAlign: 'center', padding: '12px 0' }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}> ✅</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-on-dark)', marginBottom: 4 }}>
                        Sent successfully!
                      </div>
                      {sendData && (
                        <a
                          href={`https://basescan.org/tx/${sendData}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 12, color: 'var(--muted-on-dark)', textDecoration: 'underline' }}
                        >
                          View on Basescan ↗
                        </a>
                      )}
                      <div style={{ marginTop: 16 }}>
                        <button
                          onClick={handleReset}
                          style={{
                            padding: '10px 24px', borderRadius: 10,
                            background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-color)',
                            border: '1px solid var(--border)',
                            fontSize: 14, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          Send more
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ marginBottom: 14 }}>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--muted-on-dark)', marginBottom: 6 }}>
                          Recipient address
                        </label>
                        <input
                          value={recipient}
                          onChange={(e) => setRecipient(e.target.value)}
                          placeholder="0x..."
                          style={{
                            width: '100%', padding: '12px 14px', borderRadius: 10,
                            background: 'var(--bg-dark)', color: 'var(--text-on-dark)',
                            border: `1px solid ${recipient && !isValidRecipient ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
                            fontSize: 14, fontFamily: 'monospace', outline: 'none',
                          }}
                        />
                        {recipient && !isValidRecipient && (
                          <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>
                            Invalid address
                          </div>
                        )}
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--muted-on-dark)', marginBottom: 6 }}>
                          Amount (HH2)
                        </label>
                        <input
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0.0"
                          type="number"
                          step="any"
                          style={{
                            width: '100%', padding: '12px 14px', borderRadius: 10,
                            background: 'var(--bg-dark)', color: 'var(--text-on-dark)',
                            border: '1px solid var(--border)', fontSize: 14, outline: 'none',
                          }}
                        />
                        <div style={{ fontSize: 11, color: 'var(--muted-on-dark)', marginTop: 6 }}>
                          Available: {displayBalance} HH2
                        </div>
                      </div>
                      {sendError && sendErr && (
                        <div style={{
                          fontSize: 12, color: '#ef4444',
                          marginBottom: 12, padding: '8px 12px',
                          background: 'rgba(239, 68, 68, 0.08)',
                          borderRadius: 8,
                        }}>
                          {sendErr.message ?? 'Transaction failed. Try again.'}
                        </div>
                      )}
                      <button
                        onClick={handleSend}
                        disabled={!canSend}
                        style={{
                          width: '100%', padding: '14px', borderRadius: 12,
                          background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-color)',
                          border: '1px solid var(--border)',
                          fontSize: 15, fontWeight: 700, cursor: 'pointer',
                          opacity: !canSend ? 0.5 : 1,
                        }}
                      >
                        {sendPending ? 'Sending…' : !isOnBase ? 'Switch to Base first' : 'Send HH2'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Trade section */}
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 12px' }}>
                  Trade HH2
                </h2>
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 14, padding: '18px 20px',
                }}>
                  <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: '0 0 16px', lineHeight: 1.6 }}>
                    HH2 trades on Uniswap V3 (Base). The liquidity pool is permanently locked — buy and sell freely at any time.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <a
                      href={UNISWAP_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '14px', borderRadius: 12,
                        background: '#ff007a', color: '#fff',
                        fontSize: 15, fontWeight: 700, textDecoration: 'none',
                      }}
                    >
                      🦄 Buy HH2 on Uniswap
                    </a>
                    <a
                      href={UNISWAP_LINK.replace('outputCurrency', 'inputCurrency') + `&outputCurrency=ETH`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '12px', borderRadius: 12, border: '1px solid rgba(255,0,122,0.4)',
                        background: 'transparent', color: '#ff007a',
                        fontSize: 14, fontWeight: 600, textDecoration: 'none',
                      }}
                    >
                      Sell HH2 on Uniswap ↗
                    </a>
                  </div>
                </div>
              </div>

              {/* Price chart */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-on-dark)', margin: 0 }}>Live Chart</h2>
                  <a
                    href={DEXSCREENER_PAIR}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, color: 'var(--muted-on-dark)', textDecoration: 'none' }}
                  >
                    Open on DexScreener ↗
                  </a>
                </div>
                <div style={{
                  borderRadius: 14, overflow: 'hidden',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                }}>
                  <iframe
                    src={`https://dexscreener.com/base/${HH2_ADDRESS}?embed=1&theme=dark&trades=0&info=0`}
                    title="HH2 Price Chart"
                    style={{ width: '100%', height: 360, border: 'none', display: 'block' }}
                    allow="clipboard-write"
                  />
                </div>
              </div>
            </>
          )}

          {/* Token info — always visible */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {[
                { label: 'Token', value: 'HH2 / HomieHouse' },
                { label: 'Network', value: 'Base (Ethereum L2)' },
                { label: 'Fee Tier', value: '1%' },
                { label: 'Total Supply', value: '100,000,000,000' },
              ].map((row, i, arr) => (
                <div key={row.label} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '11px 18px',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{ fontSize: 13, color: 'var(--muted-on-dark)' }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-on-dark)' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* External links — always visible */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a
              href={BASESCAN_LINK}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1, minWidth: 140,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--muted-on-dark)',
                fontSize: 13, fontWeight: 500, textDecoration: 'none',
              }}
            >
              🔍 Basescan ↗
            </a>
            <Link
              href="/hh2"
              style={{
                flex: 1, minWidth: 140,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(251,191,36,0.3)',
                background: 'transparent', color: '#fbbf24',
                fontSize: 13, fontWeight: 500, textDecoration: 'none',
              }}
            >
              🪙 Tokenomics
            </Link>
          </div>

        </div>
      </main>
    </div>
  );
}
