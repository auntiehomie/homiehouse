'use client';

import { useNeynarContext } from '@neynar/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

interface Friend {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  verifiedAddresses?: string[];
  custodyAddress?: string;
}

export default function FriendsPage() {
  const { user, isAuthenticated } = useNeynarContext();
  const router = useRouter();
  
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [sendAmount, setSendAmount] = useState('');
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    const fetchFriends = async () => {
      if (!user?.fid) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/friends?fid=${user.fid}`);
        if (response.ok) {
          const data = await response.json();
          setFriends(data.users || []);
        }
      } catch (error) {
        console.error('Error fetching friends:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFriends();
  }, [user]);

  const handleSendToFID = async (friend: Friend) => {
    if (!sendAmount || parseFloat(sendAmount) <= 0) {
      setSendStatus('Please enter a valid amount');
      return;
    }

    setIsSending(true);
    setSendStatus('Preparing transaction...');

    try {
      const provider = (window as any).ethereum;
      if (!provider) {
        setSendStatus('No wallet provider found');
        return;
      }

      // Determine recipient address
      let recipientAddress = '';
      
      // Priority: Verified ETH address > Custody address > FID-based transfer
      if (friend.verifiedAddresses && friend.verifiedAddresses.length > 0) {
        recipientAddress = friend.verifiedAddresses[0];
        setSendStatus(`Sending to verified address...`);
      } else if (friend.custodyAddress) {
        recipientAddress = friend.custodyAddress;
        setSendStatus(`Sending to custody address...`);
      } else {
        setSendStatus(`⚠️ @${friend.username} doesn't have a verified address yet. FID-direct transfers coming soon!`);
        setIsSending(false);
        setTimeout(() => setSendStatus(null), 5000);
        return;
      }

      // Convert amount to wei
      const amountWei = (parseFloat(sendAmount) * 1e18).toString(16);

      // Send transaction
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: user?.verified_addresses?.eth_addresses?.[0],
          to: recipientAddress,
          value: '0x' + amountWei,
        }]
      });

      setSendStatus(`✅ Sent ${sendAmount} ETH to @${friend.username}! TX: ${txHash.slice(0, 10)}...`);
      setSendAmount('');
      setSelectedFriend(null);
    } catch (error: any) {
      console.error('Send error:', error);
      setSendStatus(`❌ ${error.message || 'Transaction failed'}`);
    } finally {
      setIsSending(false);
      setTimeout(() => setSendStatus(null), 5000);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/wallet')}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
            <h1 className="text-2xl font-bold">💫 Send to Friends</h1>
            <div className="w-20" />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Status Banner */}
        {sendStatus && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-blue-800">{sendStatus}</p>
          </div>
        )}

        {/* Send Modal */}
        {selectedFriend && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Send to @{selectedFriend.username}</h3>
                <button
                  onClick={() => {
                    setSelectedFriend(null);
                    setSendAmount('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="flex items-center mb-4">
                <img
                  src={selectedFriend.pfpUrl || '/default-avatar.png'}
                  alt={selectedFriend.username}
                  className="w-12 h-12 rounded-full mr-3"
                />
                <div>
                  <p className="font-semibold">{selectedFriend.displayName}</p>
                  <p className="text-sm text-gray-500">FID: {selectedFriend.fid}</p>
                </div>
              </div>

              {selectedFriend.verifiedAddresses && selectedFriend.verifiedAddresses.length > 0 ? (
                <div className="bg-green-50 rounded-lg p-3 mb-4 text-sm">
                  <p className="text-green-800">✅ Verified address available</p>
                  <code className="text-xs text-green-600">
                    {selectedFriend.verifiedAddresses[0].slice(0, 6)}...{selectedFriend.verifiedAddresses[0].slice(-4)}
                  </code>
                </div>
              ) : (
                <div className="bg-yellow-50 rounded-lg p-3 mb-4 text-sm">
                  <p className="text-yellow-800">⚠️ No verified address. Will use custody address or FID transfer.</p>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount (ETH)</label>
                <input
                  type="number"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  placeholder="0.0"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                onClick={() => handleSendToFID(selectedFriend)}
                disabled={isSending || !sendAmount}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-colors disabled:cursor-not-allowed"
              >
                {isSending ? 'Sending...' : `Send ${sendAmount || '0.0'} ETH`}
              </button>
            </div>
          </div>
        )}

        {/* Friends List */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold">Your Friends</h2>
            <p className="text-gray-600 text-sm mt-1">
              Send tokens directly to your Farcaster friends
            </p>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          ) : friends.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="mb-4">No friends found.</p>
              <p className="text-sm">
                Make sure you're following people on Farcaster. Friends will appear here, whether or not they have verified addresses.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {friends.map((friend) => (
                <div
                  key={friend.fid}
                  className="p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1">
                      <img
                        src={friend.pfpUrl || '/default-avatar.png'}
                        alt={friend.username}
                        className="w-12 h-12 rounded-full mr-4"
                      />
                      <div className="flex-1">
                        <p className="font-semibold">{friend.displayName}</p>
                        <p className="text-sm text-gray-500">@{friend.username}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-400">FID: {friend.fid}</span>
                          {friend.verifiedAddresses && friend.verifiedAddresses.length > 0 && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                              ✓ Verified
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedFriend(friend)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      Send
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-bold mb-2">💡 How it works</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>• Friends with verified addresses: Direct transfer to their ETH address</li>
            <li>• Friends without verified addresses: Transfer to custody address or FID-based transfer (coming soon)</li>
            <li>• All transactions are on Base network for low fees</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
