"use client";

import { useState, useEffect } from "react";
import { useAccount, useBalance, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";
import SwapWidget from "./SwapWidget";

interface FarcasterFriend {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  ethAddresses: string[];
}

export default function WalletDashboard() {
  const { address, isConnected, chain } = useAccount();
  const { data: balance } = useBalance({ address });
  const [showSendModal, setShowSendModal] = useState(false);
  const [showSwapWidget, setShowSwapWidget] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [friends, setFriends] = useState<FarcasterFriend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FarcasterFriend | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFriendsList, setShowFriendsList] = useState(false);

  const { data: hash, sendTransaction, isPending: isSending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Load Farcaster friends when modal opens
  useEffect(() => {
    if (showSendModal && friends.length === 0) {
      loadFriends();
    }
  }, [showSendModal]);

  const loadFriends = async () => {
    setLoadingFriends(true);
    try {
      const storedProfile = localStorage.getItem("hh_profile");
      if (!storedProfile) return;
      
      const profile = JSON.parse(storedProfile);
      const response = await fetch(`/api/friends?fid=${profile.fid}`);
      const data = await response.json();
      
      if (data.friends) {
        setFriends(data.friends);
      }
    } catch (error) {
      console.error("Error loading friends:", error);
    } finally {
      setLoadingFriends(false);
    }
  };

  const selectFriend = (friend: FarcasterFriend) => {
    setSelectedFriend(friend);
    setRecipient(friend.ethAddresses[0]); // Use first verified address
    setSearchQuery(`@${friend.username}`);
    setShowFriendsList(false);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // Always show friends list when there's input or friends available
    setShowFriendsList(true);
  };

  // Filter friends based on search query
  const filteredFriends = friends.filter((friend) => {
    if (!searchQuery || searchQuery === '@') {
      return true; // Show all friends if no query or just @
    }
    const query = searchQuery.replace('@', '').toLowerCase();
    return (
      friend.username.toLowerCase().includes(query) ||
      friend.displayName.toLowerCase().includes(query)
    );
  });

  useEffect(() => {
    if (isSuccess) {
      setSendStatus("✓ Transaction confirmed!");
      setTimeout(() => {
        setShowSendModal(false);
        setSendStatus(null);
        setRecipient("");
        setAmount("");
        setSelectedFriend(null);
        setSearchQuery("");
        setShowFriendsList(false);
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
              style={{ width: '100%', marginBottom: '8px' }}
            >
              Send Crypto
            </button>
            
            <button 
              className="btn" 
              onClick={() => setShowSwapWidget(!showSwapWidget)}
              style={{ width: '100%' }}
            >
              {showSwapWidget ? 'Hide Swap' : '💱 Swap Tokens'}
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

      {/* Swap Widget */}
      {showSwapWidget && (
        <div style={{ marginTop: '20px' }}>
          <SwapWidget />
        </div>
      )}

      {showSendModal && (
        <div className="modal-overlay" onClick={() => setShowSendModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3>Send Crypto</h3>
              <button className="btn" onClick={() => setShowSendModal(false)}>Close</button>
            </div>

            <form onSubmit={handleSend}>
              {/* Mention/Tag Friend Input */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  Tag Farcaster Friend
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="wallet-input"
                    placeholder={loadingFriends ? "Loading friends..." : "Type @ to search friends..."}
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    disabled={isSending || isConfirming || loadingFriends}
                    onFocus={() => {
                      if (!loadingFriends) setShowFriendsList(true);
                      if (friends.length === 0) loadFriends();
                    }}
                  />
                  
                  {/* Debug info */}
                  {searchQuery && (
                    <div style={{ fontSize: '11px', color: 'var(--muted-on-dark)', marginTop: '4px' }}>
                      Found {filteredFriends.length} friends
                    </div>
                  )}
                  
                  {/* Friends Dropdown */}
                  {showFriendsList && !loadingFriends && filteredFriends.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      maxHeight: '200px',
                      overflowY: 'auto',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      background: 'var(--bg-dark)',
                      marginTop: '4px',
                      zIndex: 10,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}>
                      {filteredFriends.map((friend) => (
                        <div
                          key={friend.fid}
                          onClick={() => selectFriend(friend)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            cursor: 'pointer',
                            background: selectedFriend?.fid === friend.fid ? 'var(--accent)' : 'transparent',
                            color: selectedFriend?.fid === friend.fid ? 'white' : 'inherit',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (selectedFriend?.fid !== friend.fid) {
                              e.currentTarget.style.background = 'var(--surface)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (selectedFriend?.fid !== friend.fid) {
                              e.currentTarget.style.background = 'transparent';
                            }
                          }}
                        >
                          <img 
                            src={friend.pfpUrl} 
                            alt={friend.displayName}
                            style={{ 
                              width: '32px', 
                              height: '32px', 
                              borderRadius: '50%',
                              objectFit: 'cover'
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: 600 }}>
                              {friend.displayName}
                            </div>
                            <div style={{ fontSize: '12px', opacity: 0.7 }}>
                              @{friend.username}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedFriend && (
                  <div style={{ 
                    marginTop: '8px', 
                    padding: '8px 12px', 
                    background: 'var(--surface)', 
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <img 
                      src={selectedFriend.pfpUrl} 
                      alt={selectedFriend.displayName}
                      style={{ 
                        width: '24px', 
                        height: '24px', 
                        borderRadius: '50%',
                        objectFit: 'cover'
                      }}
                    />
                    <span style={{ fontSize: '14px' }}>
                      Sending to <strong>{selectedFriend.displayName}</strong>
                    </span>
                  </div>
                )}
              </div>

              {loadingFriends && (
                <div style={{ marginBottom: '16px', textAlign: 'center', padding: '16px', color: 'var(--muted-on-dark)' }}>
                  Loading friends...
                </div>
              )}
              
              {!loadingFriends && friends.length === 0 && (
                <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(232, 119, 34, 0.1)', borderRadius: '8px', fontSize: '14px' }}>
                  No friends with verified addresses found. Make sure you're following people on Farcaster who have verified Ethereum addresses.
                </div>
              )}

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
