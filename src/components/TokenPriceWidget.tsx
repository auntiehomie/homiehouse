'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface TokenInfo {
  id: string;
  symbol: string;
  name: string;
  address?: string;
  chainId?: string;
  image?: string;
  currentPrice?: number;
  marketCap?: number;
  totalVolume?: number;
  priceChangePercentage24h?: number;
  circulatingSupply?: number;
  liquidity?: {
    usd?: number;
  };
  links?: {
    homepage?: string[];
    twitter?: string;
    telegram?: string;
  };
}

interface TokenPriceWidgetProps {
  tokenIdentifier: string;
  compact?: boolean;
  showChart?: boolean;
}

export default function TokenPriceWidget({ 
  tokenIdentifier, 
  compact = false,
  showChart = false 
}: TokenPriceWidgetProps) {
  const [tokenData, setTokenData] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTokenData() {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/tokens/${encodeURIComponent(tokenIdentifier)}`);
        
        if (!response.ok) {
          throw new Error('Token not found');
        }
        
        const data = await response.json();
        setTokenData(data.token);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load token data');
      } finally {
        setLoading(false);
      }
    }

    fetchTokenData();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchTokenData, 30000);
    return () => clearInterval(interval);
  }, [tokenIdentifier]);

  if (loading) {
    return (
      <div className="animate-pulse bg-zinc-100 rounded-lg p-4">
        <div className="h-4 bg-zinc-200 rounded w-3/4 mb-2"></div>
        <div className="h-8 bg-zinc-200 rounded w-1/2"></div>
      </div>
    );
  }

  if (error || !tokenData) {
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
        <p className="text-zinc-500 text-sm">⚠️ {error || 'Token not found'}</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="bg-white rounded-lg border border-zinc-800 p-3 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {tokenData.image && (
              <Image src={tokenData.image} alt={tokenData.symbol} width={24} height={24} className="rounded-full" style={{ objectFit: 'cover' }} />
            )}
            <div>
              <div className="font-semibold text-sm">{tokenData.symbol}</div>
              <div className="text-xs text-zinc-500">{tokenData.name}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold">
              ${tokenData.currentPrice ? formatPrice(tokenData.currentPrice) : 'N/A'}
            </div>
            {tokenData.priceChangePercentage24h !== undefined && (
              <div className={`text-xs ${tokenData.priceChangePercentage24h >= 0 ? 'text-zinc-300' : 'text-zinc-500'}`}>
                {tokenData.priceChangePercentage24h >= 0 ? '↗' : '↘'} {Math.abs(tokenData.priceChangePercentage24h).toFixed(2)}%
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-zinc-800 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {tokenData.image && (
            <Image src={tokenData.image} alt={tokenData.symbol} width={48} height={48} className="rounded-full" style={{ objectFit: 'cover' }} />
          )}
          <div>
            <h3 className="text-xl font-bold">{tokenData.name}</h3>
            <p className="text-zinc-500">{tokenData.symbol}</p>
          </div>
        </div>
        {tokenData.links?.homepage?.[0] && (
          <a 
            href={tokenData.links.homepage[0]} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-zinc-200 text-sm"
          >
            🌐 Website
          </a>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <div className="text-3xl font-bold">
            ${tokenData.currentPrice ? formatPrice(tokenData.currentPrice) : 'N/A'}
          </div>
          {tokenData.priceChangePercentage24h !== undefined && (
            <div className={`text-lg font-semibold flex items-center gap-1 ${
              tokenData.priceChangePercentage24h >= 0 ? 'text-zinc-300' : 'text-zinc-500'
            }`}>
              {tokenData.priceChangePercentage24h >= 0 ? '📈' : '📉'}
              {tokenData.priceChangePercentage24h >= 0 ? '+' : ''}
              {tokenData.priceChangePercentage24h.toFixed(2)}%
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800">
          {tokenData.marketCap && (
            <div>
              <div className="text-xs text-zinc-500 mb-1">Market Cap</div>
              <div className="font-semibold">${formatLargeNumber(tokenData.marketCap)}</div>
            </div>
          )}
          {tokenData.totalVolume && (
            <div>
              <div className="text-xs text-zinc-500 mb-1">24h Volume</div>
              <div className="font-semibold">${formatLargeNumber(tokenData.totalVolume)}</div>
            </div>
          )}
          {tokenData.liquidity?.usd && (
            <div>
              <div className="text-xs text-zinc-500 mb-1">Liquidity</div>
              <div className="font-semibold">${formatLargeNumber(tokenData.liquidity.usd)}</div>
            </div>
          )}
          {tokenData.circulatingSupply && (
            <div>
              <div className="text-xs text-zinc-500 mb-1">Circulating Supply</div>
              <div className="font-semibold">{formatLargeNumber(tokenData.circulatingSupply)} {tokenData.symbol}</div>
            </div>
          )}
        </div>

        {tokenData.address && (
          <div className="pt-3 border-t border-zinc-800">
            <div className="text-xs text-zinc-500 mb-1">Contract Address</div>
            <div className="font-mono text-xs bg-zinc-900 p-2 rounded break-all">
              {tokenData.address}
            </div>
          </div>
        )}

        {(tokenData.links?.twitter || tokenData.links?.telegram) && (
          <div className="flex gap-3 pt-3 border-t border-zinc-800">
            {tokenData.links.twitter && (
              <a
                href={`https://twitter.com/${tokenData.links.twitter}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-zinc-200 text-sm"
              >
                🐦 Twitter
              </a>
            )}
            {tokenData.links.telegram && (
              <a
                href={`https://t.me/${tokenData.links.telegram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-zinc-200 text-sm"
              >
                ✈️ Telegram
              </a>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-zinc-500">
        Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
}

function formatPrice(price: number): string {
  if (price < 0.000001) {
    return price.toExponential(4);
  } else if (price < 0.01) {
    return price.toFixed(6);
  } else if (price < 1) {
    return price.toFixed(4);
  } else {
    return price.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  }
}

function formatLargeNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(2) + 'B';
  } else if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(2) + 'M';
  } else if (num >= 1_000) {
    return (num / 1_000).toFixed(2) + 'K';
  }
  return num.toFixed(2);
}
