'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

// Popular tokens on Base network
const TOKENS = [
  { symbol: 'ETH', name: 'Ethereum', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18, icon: '⟠' },
  { symbol: 'USDC', name: 'USD Coin', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, icon: '💵' },
  { symbol: 'USDT', name: 'Tether', address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', decimals: 6, icon: '💲' },
  { symbol: 'DAI', name: 'Dai Stablecoin', address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18, icon: '💰' },
];

export default function SwapPage() {
  const { user, authenticated, ready } = usePrivy();
  const router = useRouter();
  
  const [fromToken, setFromToken] = useState(TOKENS[0]);
  const [toToken, setToToken] = useState(TOKENS[1]);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [swapStatus, setSwapStatus] = useState<string | null>(null);
  const [quote, setQuote] = useState<any>(null);

  useEffect(() => {
    if (ready && !authenticated) {
      router.push('/');
    }
  }, [ready, authenticated, router]);

  // Fetch quote from 1inch API
  const fetchQuote = async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) return;

    setIsLoading(true);
    try {
      const amount = (parseFloat(fromAmount) * Math.pow(10, fromToken.decimals)).toString();
      
      // 1inch API v5 for Base network (chain ID: 8453)
      const response = await fetch(
        `https://api.1inch.dev/swap/v5.2/8453/quote?` +
        `src=${fromToken.address}&` +
        `dst=${toToken.address}&` +
        `amount=${amount}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_1INCH_API_KEY || ''}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const estimatedAmount = (parseInt(data.toAmount) / Math.pow(10, toToken.decimals)).toFixed(6);
        setToAmount(estimatedAmount);
        setQuote(data);
      } else {
        setSwapStatus('⚠️ Could not fetch quote. Add 1INCH_API_KEY to environment variables.');
      }
    } catch (error) {
      console.error('Quote error:', error);
      setSwapStatus('Failed to get quote');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (fromAmount) {
        fetchQuote();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [fromAmount, fromToken, toToken]);

  const handleSwap = async () => {
    if (!quote) return;

    setIsLoading(true);
    setSwapStatus('Preparing swap...');

    try {
      const walletAddress = user?.wallet?.address;
      if (!walletAddress) {
        setSwapStatus('Please connect wallet');
        return;
      }

      // Get swap transaction from 1inch
      const amount = (parseFloat(fromAmount) * Math.pow(10, fromToken.decimals)).toString();
      const response = await fetch(
        `https://api.1inch.dev/swap/v5.2/8453/swap?` +
        `src=${fromToken.address}&` +
        `dst=${toToken.address}&` +
        `amount=${amount}&` +
        `from=${walletAddress}&` +
        `slippage=1`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_1INCH_API_KEY || ''}`
          }
        }
      );

      if (response.ok) {
        const swapData = await response.json();
        
        // Execute swap via wallet
        const provider = (window as any).ethereum;
        if (provider) {
          const txHash = await provider.request({
            method: 'eth_sendTransaction',
            params: [swapData.tx]
          });
          
          setSwapStatus(`✅ Swap successful! TX: ${txHash.slice(0, 10)}...`);
          setFromAmount('');
          setToAmount('');
        }
      } else {
        setSwapStatus('⚠️ Swap failed. Make sure you have enough balance and add 1INCH_API_KEY.');
      }
    } catch (error) {
      console.error('Swap error:', error);
      setSwapStatus('Swap failed. Check console for details.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setSwapStatus(null), 5000);
    }
  };

  const switchTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount('');
  };

  if (!ready || !authenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-10">
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
            <h1 className="text-2xl font-bold">💱 Swap</h1>
            <div className="w-20" />
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-12">
        {/* Swap Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">💫 Swap Tokens</h2>
            <p className="text-gray-500">Best rates across Base DEXs</p>
          </div>

          {/* From Token */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <select
                  value={fromToken.symbol}
                  onChange={(e) => setFromToken(TOKENS.find(t => t.symbol === e.target.value)!)}
                  className="bg-white rounded-lg px-3 py-2 font-medium cursor-pointer border-2 border-gray-200 hover:border-gray-300 focus:outline-none focus:border-blue-500"
                >
                  {TOKENS.map(token => (
                    <option key={token.symbol} value={token.symbol}>
                      {token.icon} {token.symbol}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gray-500">Balance: 0.0</span>
              </div>
              <input
                type="number"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                placeholder="0.0"
                className="w-full bg-transparent text-3xl font-bold outline-none"
              />
            </div>
          </div>

          {/* Switch Button */}
          <div className="flex justify-center -my-2 relative z-10">
            <button
              onClick={switchTokens}
              className="bg-white border-4 border-gray-50 rounded-full p-3 hover:bg-gray-50 hover:rotate-180 transition-all duration-300"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>

          {/* To Token */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">To (estimated)</label>
            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <select
                  value={toToken.symbol}
                  onChange={(e) => setToToken(TOKENS.find(t => t.symbol === e.target.value)!)}
                  className="bg-white rounded-lg px-3 py-2 font-medium cursor-pointer border-2 border-gray-200 hover:border-gray-300 focus:outline-none focus:border-blue-500"
                >
                  {TOKENS.map(token => (
                    <option key={token.symbol} value={token.symbol}>
                      {token.icon} {token.symbol}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gray-500">Balance: 0.0</span>
              </div>
              <div className="text-3xl font-bold text-gray-400">
                {isLoading ? '...' : toAmount || '0.0'}
              </div>
            </div>
          </div>

          {/* Swap Info */}
          {quote && (
            <div className="bg-blue-50 rounded-xl p-4 mb-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Rate</span>
                <span className="font-medium">1 {fromToken.symbol} = {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(4)} {toToken.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Network</span>
                <span className="font-medium">Base</span>
              </div>
            </div>
          )}

          {/* Swap Button */}
          <button
            onClick={handleSwap}
            disabled={isLoading || !fromAmount || !toAmount || fromToken.symbol === toToken.symbol}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-bold py-4 rounded-2xl transition-all duration-200 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            {isLoading ? 'Swapping...' : fromToken.symbol === toToken.symbol ? 'Select different tokens' : 'Swap'}
          </button>

          {swapStatus && (
            <div className="mt-4 p-4 bg-gray-100 rounded-xl text-center text-sm">
              {swapStatus}
            </div>
          )}

          {/* Info Banner */}
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
            <p className="text-sm text-yellow-800">
              💡 <strong>Coming Soon:</strong> Full DEX integration with Uniswap, Aerodrome, and other Base DEXs via aggregators like 0x and 1inch.
            </p>
          </div>
        </div>

        {/* Back to Wallet */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/wallet')}
            className="text-gray-600 hover:text-gray-900 font-medium"
          >
            ← Back to Wallet
          </button>
        </div>
      </div>
    </div>
  );
}
