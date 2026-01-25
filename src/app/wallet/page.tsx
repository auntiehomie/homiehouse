'use client';

import { useNeynarContext } from '@neynar/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function WalletPage() {
  const { user, isAuthenticated } = useNeynarContext();
  const router = useRouter();
  const [balance, setBalance] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(true);
  const { address: wagmiAddress, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  const walletAddress = wagmiAddress || user?.verified_addresses?.eth_addresses?.[0];

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
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/')}
              className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">💼 Wallet</h1>
            <div className="w-20" /> {/* Spacer for centering */}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Connect Wallet Section - Show when no wallet connected */}
        {!isConnected && (
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-lg p-8 mb-6">
            <div className="text-center">
              <div className="text-6xl mb-4">💼</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Connect Your Wallet</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Connect your wallet to view balance, send tokens, and swap
              </p>
              <div className="flex justify-center">
                <ConnectButton />
              </div>
            </div>
          </div>
        )}

        {/* Wallet Balance Card - Show when connected */}
        {isConnected && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-lg p-8 mb-6">
          <div className="text-center mb-6">
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">Total Balance</p>
            {isLoading ? (
              <div className="animate-pulse h-12 bg-gray-200 dark:bg-zinc-800 rounded w-48 mx-auto"></div>
            ) : (
              <h2 className="text-5xl font-bold text-gray-900 dark:text-white">{balance} ETH</h2>
            )}
          </div>

          {/* Wallet Address */}
          <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 mb-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Wallet Address</p>
            <div className="flex items-center justify-between">
              <code className="text-sm font-mono text-gray-700 dark:text-gray-300">
                {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Not connected'}
              </code>
              {walletAddress && (
                <button
                  onClick={() => navigator.clipboard.writeText(walletAddress)}
                  className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 text-sm transition-colors"
                >
                  Copy
                </button>
              )}
            </div>
          </div>

          {/* Disconnect Button */}
          <div className="mb-6">
            <button
              onClick={() => disconnect()}
              className="w-full py-2 px-4 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Disconnect Wallet
            </button>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-4">
            <button className="flex flex-col items-center justify-center p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-xl transition-colors">
              <span className="text-2xl mb-2">💸</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Send</span>
            </button>
            <button className="flex flex-col items-center justify-center p-4 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-xl transition-colors">
              <span className="text-2xl mb-2">📥</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Receive</span>
            </button>
            <button
              onClick={() => router.push('/swap')}
              className="flex flex-col items-center justify-center p-4 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-xl transition-colors"
            >
              <span className="text-2xl mb-2">💱</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Swap</span>
            </button>
          </div>
        </div>
        )}

        {/* Send to Friends Section - Only show when connected */}
        {isConnected && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">💫 Send to Friends</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            Send tokens to your Farcaster friends using their FID or username
          </p>
          
          <button
            onClick={() => router.push('/friends')}
            className="w-full bg-orange-600 hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-700 text-white font-medium py-3 rounded-xl transition-colors"
          >
            View Friends
          </button>
        </div>
        )}

        {/* Transaction History - Only show when connected */}
        {isConnected && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-lg p-6 mt-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">📜 Recent Transactions</h3>
          <div className="text-center py-8 text-gray-400 dark:text-gray-500">
            <p>Transaction history coming soon</p>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
