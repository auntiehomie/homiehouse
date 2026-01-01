"use client";

import { useState, useEffect } from "react";
import { useAccount, useBalance, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";

export default function WalletDashboard() {
  const { address, isConnected, chain } = useAccount();
  const { data: balance } = useBalance({ address });
  const [showSendModal, setShowSendModal] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [sendStatus, setSendStatus] = useState<string | null>(null);

  const { data: hash, sendTransaction, isPending: isSending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) {
      setSendStatus("✓ Transaction confirmed!");
      setTimeout(() => {
        setShowSendModal(false);
        setSendStatus(null);
        setRecipient("");
        setAmount("");
      }, 2000);
    }
  }, [isSuccess]);

  if (!isConnected) {
    return null;
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !amount) {
      setSendStatus("Please fill in all fields");
      return;
    }

    try {
      setSendStatus("Sending...");
      sendTransaction({
        to: recipient as `0x${string}`,
        value: parseEther(amount),
      });
    } catch (error: any) {
      setSendStatus(`Error: ${error.message}`);
    }
  };

  return (
    <>
      <div className="wallet-dashboard">
        <div className="wallet-info">
          <div className="balance-card">
            <div className="balance-label">Balance</div>
            <div className="balance-amount">
              {balance ? `${parseFloat(formatEther(balance.value)).toFixed(4)} ${balance.symbol}` : "0 ETH"}
            </div>
            <div className="balance-chain">{chain?.name || "Unknown Network"}</div>
          </div>
          
          <div className="wallet-actions">
            <button 
              className="btn primary" 
              onClick={() => setShowSendModal(true)}
              style={{ width: '100%' }}
            >
              Send Crypto
            </button>
          </div>

          <div className="wallet-address">
            <div style={{ fontSize: '10px', color: 'var(--muted-on-dark)', marginBottom: '4px' }}>
              Address
            </div>
            <div style={{ fontSize: '11px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </div>
          </div>
        </div>
      </div>

      {showSendModal && (
        <div className="modal-overlay" onClick={() => setShowSendModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3>Send Crypto</h3>
              <button className="btn" onClick={() => setShowSendModal(false)}>Close</button>
            </div>

            <form onSubmit={handleSend}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  Recipient Address
                </label>
                <input
                  type="text"
                  className="wallet-input"
                  placeholder="0x..."
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  disabled={isSending || isConfirming}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  Amount ({balance?.symbol || 'ETH'})
                </label>
                <input
                  type="text"
                  className="wallet-input"
                  placeholder="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={isSending || isConfirming}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  type="button" 
                  className="btn" 
                  onClick={() => setShowSendModal(false)}
                  disabled={isSending || isConfirming}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn primary" 
                  disabled={isSending || isConfirming}
                  style={{ flex: 1 }}
                >
                  {isSending || isConfirming ? "Sending..." : "Send"}
                </button>
              </div>

              {sendStatus && (
                <div style={{ marginTop: '12px', padding: '8px', borderRadius: '8px', background: 'var(--surface)' }}>
                  {sendStatus}
                </div>
              )}

              {hash && (
                <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--muted-on-dark)' }}>
                  Transaction hash: <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{hash}</span>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
