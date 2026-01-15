'use client';

import { useState, useEffect } from 'react';
import { useAccount, useBalance, useSendTransaction, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther, parseUnits, formatUnits } from 'viem';

interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
}

// Common tokens on Base (you can expand this list)
const COMMON_TOKENS: Token[] = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    decimals: 18,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base USDC
    decimals: 6,
  },
  {
    symbol: 'DEGEN',
    name: 'Degen',
    address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', // Base Degen
    decimals: 18,
  },
];

export default function SwapWidget() {
  const { address, isConnected, chain } = useAccount();
  const [fromToken, setFromToken] = useState<Token>(COMMON_TOKENS[0]);
  const [toToken, setToToken] = useState<Token>(COMMON_TOKENS[1]);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showFromTokens, setShowFromTokens] = useState(false);
  const [showToTokens, setShowToTokens] = useState(false);
  const [swapStatus, setSwapStatus] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const { data: balance } = useBalance({ 
    address,
    token: fromToken.symbol === 'ETH' ? undefined : fromToken.address as `0x${string}`,
  });

  // Get quote from DEX aggregator (we'll use 0x API or similar)
  const getQuote = async () => {
    if (!fromAmount || parseFloat(fromAmount) === 0) {
      setToAmount('');
      return;
    }

    setQuoteLoading(true);
    try {
      // For now, just do a simple estimation (in production, use 0x API, 1inch, or similar)
      // This is a placeholder - you'll need to integrate with a real DEX aggregator
      const mockRate = fromToken.symbol === 'ETH' && toToken.symbol === 'USDC' ? 2500 : 0.0004;
      const estimated = (parseFloat(fromAmount) * mockRate).toFixed(6);
      setToAmount(estimated);
    } catch (error) {
      console.error('Error getting quote:', error);
      setSwapStatus('Failed to get quote');
    } finally {
      setQuoteLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (fromAmount) {
        getQuote();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [fromAmount, fromToken, toToken]);

  const handleSwap = async () => {
    if (!address || !fromAmount || !toAmount) return;

    setIsLoading(true);
    setSwapStatus('Preparing swap...');

    try {
      // This is where you'd integrate with a DEX aggregator like:
      // - 0x API
      // - 1inch
      // - Uniswap SDK
      // - CoW Protocol
      
      // For now, show a message
      setSwapStatus('⚠️ Swap integration coming soon! You\'ll need to connect to a DEX aggregator API.');
      
    } catch (error) {
      console.error('Swap error:', error);
      setSwapStatus('Swap failed');
    } finally {
      setIsLoading(false);
      setTimeout(() => setSwapStatus(null), 5000);
    }
  };

  const switchTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setFromAmount(toAmount);
    setToAmount('');
  };

  if (!isConnected) {
    return (
      <div style={{ 
        padding: '24px', 
        textAlign: 'center',
        color: 'var(--muted-on-dark)'
      }}>
        Connect your wallet to start trading
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--card-bg)',
      borderRadius: '16px',
      padding: '20px',
      maxWidth: '480px',
      margin: '0 auto'
    }}>
      <h3 style={{ 
        fontSize: '18px', 
        fontWeight: 700, 
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        💱 Swap Tokens
      </h3>

      {/* From Token */}
      <div style={{
        background: 'var(--background)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '8px'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginBottom: '8px',
          fontSize: '14px',
          color: 'var(--muted-on-dark)'
        }}>
          <span>From</span>
          {balance && (
            <span>Balance: {parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(4)} {fromToken.symbol}</span>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            type="number"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            placeholder="0.0"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              fontWeight: 600,
              outline: 'none',
              color: 'var(--foreground)'
            }}
          />
          
          <button
            onClick={() => setShowFromTokens(!showFromTokens)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600
            }}
          >
            {fromToken.symbol}
            <span>▼</span>
          </button>
        </div>

        {balance && (
          <button
            onClick={() => setFromAmount(formatUnits(balance.value, balance.decimals))}
            style={{
              marginTop: '8px',
              padding: '4px 8px',
              background: 'rgba(232, 119, 34, 0.1)',
              border: '1px solid var(--accent)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              color: 'var(--accent)'
            }}
          >
            MAX
          </button>
        )}
      </div>

      {/* Token selector for From */}
      {showFromTokens && (
        <div style={{
          background: 'var(--background)',
          borderRadius: '8px',
          padding: '8px',
          marginBottom: '8px',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          {COMMON_TOKENS.map((token) => (
            <button
              key={token.address}
              onClick={() => {
                setFromToken(token);
                setShowFromTokens(false);
              }}
              style={{
                width: '100%',
                padding: '12px',
                background: fromToken.address === token.address ? 'var(--card-bg)' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <span style={{ fontSize: '20px' }}>●</span>
              <div>
                <div style={{ fontWeight: 600 }}>{token.symbol}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted-on-dark)' }}>{token.name}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Switch button */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        margin: '12px 0' 
      }}>
        <button
          onClick={switchTokens}
          style={{
            background: 'var(--card-bg)',
            border: '2px solid var(--border)',
            borderRadius: '12px',
            width: '40px',
            height: '40px',
            cursor: 'pointer',
            fontSize: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ↕️
        </button>
      </div>

      {/* To Token */}
      <div style={{
        background: 'var(--background)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <div style={{ 
          fontSize: '14px',
          color: 'var(--muted-on-dark)',
          marginBottom: '8px'
        }}>
          To (estimated)
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            type="number"
            value={toAmount}
            readOnly
            placeholder="0.0"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              fontWeight: 600,
              outline: 'none',
              color: 'var(--foreground)',
              opacity: quoteLoading ? 0.5 : 1
            }}
          />
          
          <button
            onClick={() => setShowToTokens(!showToTokens)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600
            }}
          >
            {toToken.symbol}
            <span>▼</span>
          </button>
        </div>

        {quoteLoading && (
          <div style={{ 
            marginTop: '8px', 
            fontSize: '12px', 
            color: 'var(--muted-on-dark)' 
          }}>
            Getting best price...
          </div>
        )}
      </div>

      {/* Token selector for To */}
      {showToTokens && (
        <div style={{
          background: 'var(--background)',
          borderRadius: '8px',
          padding: '8px',
          marginBottom: '20px',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          {COMMON_TOKENS.map((token) => (
            <button
              key={token.address}
              onClick={() => {
                setToToken(token);
                setShowToTokens(false);
              }}
              style={{
                width: '100%',
                padding: '12px',
                background: toToken.address === token.address ? 'var(--card-bg)' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <span style={{ fontSize: '20px' }}>●</span>
              <div>
                <div style={{ fontWeight: 600 }}>{token.symbol}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted-on-dark)' }}>{token.name}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Swap button */}
      <button
        onClick={handleSwap}
        disabled={isLoading || !fromAmount || !toAmount || parseFloat(fromAmount) === 0}
        style={{
          width: '100%',
          padding: '16px',
          background: 'var(--accent)',
          border: 'none',
          borderRadius: '12px',
          color: 'white',
          fontSize: '16px',
          fontWeight: 700,
          cursor: 'pointer',
          opacity: (isLoading || !fromAmount || !toAmount) ? 0.5 : 1
        }}
      >
        {isLoading ? 'Swapping...' : fromToken.symbol === toToken.symbol ? 'Select different tokens' : 'Swap'}
      </button>

      {/* Status message */}
      {swapStatus && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: swapStatus.includes('failed') || swapStatus.includes('⚠️') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
          color: swapStatus.includes('failed') || swapStatus.includes('⚠️') ? '#ef4444' : '#10b981',
          borderRadius: '8px',
          fontSize: '14px',
          textAlign: 'center'
        }}>
          {swapStatus}
        </div>
      )}

      {/* Info */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        background: 'rgba(59, 130, 246, 0.1)',
        borderRadius: '8px',
        fontSize: '12px',
        color: 'var(--muted-on-dark)'
      }}>
        <p style={{ margin: 0 }}>
          💡 <strong>Coming Soon:</strong> Full DEX integration with best price routing across Base, Ethereum, and other chains.
        </p>
        <p style={{ margin: '8px 0 0 0' }}>
          Will support: Uniswap, Aerodrome, and other major DEXs via aggregators like 0x or 1inch.
        </p>
      </div>
    </div>
  );
}
