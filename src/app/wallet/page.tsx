'use client';

import { useNeynarContext } from '@neynar/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function WalletPage() {
  const { user, isAuthenticated } = useNeynarContext();
  const router = useRouter();
  const [balance, setBalance] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(true);

  const walletAddress = user?.verified_addresses?.eth_addresses?.[0];

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!walletAddress) {
        setIsLoading(false);
        return;
      }

      try {
        const provider = (window as any).ethereum;
        if (provider) {
          const balance = await provider.request({
            method: 'eth_getBalance',
            params: [walletAddress, 'latest']
          });
          const ethBalance = parseInt(balance, 16) / 1e18;
          setBalance(ethBalance.toFixed(4));
        }
      } catch (error) {
        console.error('Error fetching balance:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalance();
  }, [walletAddress]);

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
              onClick={() => router.push('/')}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
            <h1 className="text-2xl font-bold">💼 Wallet</h1>
            <div className="w-20" /> {/* Spacer for centering */}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Wallet Balance Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="text-center mb-6">
            <p className="text-gray-500 text-sm mb-2">Total Balance</p>
            {isLoading ? (
              <div className="animate-pulse h-12 bg-gray-200 rounded w-48 mx-auto"></div>
            ) : (
              <h2 className="text-5xl font-bold text-gray-900">{balance} ETH</h2>
            )}
          </div>

          {/* Wallet Address */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-xs text-gray-500 mb-1">Wallet Address</p>
            <div className="flex items-center justify-between">
              <code className="text-sm font-mono text-gray-700">
                {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Not connected'}
              </code>
              {walletAddress && (
                <button
                  onClick={() => navigator.clipboard.writeText(walletAddress)}
                  className="text-blue-500 hover:text-blue-600 text-sm"
                >
                  Copy
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-4">
            <button className="flex flex-col items-center justify-center p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors">
              <span className="text-2xl mb-2">💸</span>
              <span className="text-sm font-medium text-gray-700">Send</span>
            </button>
            <button className="flex flex-col items-center justify-center p-4 bg-green-50 hover:bg-green-100 rounded-xl transition-colors">
              <span className="text-2xl mb-2">📥</span>
              <span className="text-sm font-medium text-gray-700">Receive</span>
            </button>
            <button
              onClick={() => router.push('/swap')}
              className="flex flex-col items-center justify-center p-4 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors"
            >
              <span className="text-2xl mb-2">💱</span>
              <span className="text-sm font-medium text-gray-700">Swap</span>
            </button>
          </div>
        </div>

        {/* Send to Friends Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-xl font-bold mb-4">💫 Send to Friends</h3>
          <p className="text-gray-600 text-sm mb-4">
            Send tokens to your Farcaster friends using their FID or username
          </p>
          
          <button
            onClick={() => router.push('/friends')}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-xl transition-colors"
          >
            View Friends
          </button>
        </div>

        {/* Transaction History (Coming Soon) */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mt-6">
          <h3 className="text-xl font-bold mb-4">📜 Recent Transactions</h3>
          <div className="text-center py-8 text-gray-400">
            <p>Transaction history coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}
