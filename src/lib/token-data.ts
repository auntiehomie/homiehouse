/**
 * Token Data Service
 * Aggregates token information from multiple sources:
 * - CoinGecko (price, market data, market cap)
 * - DexScreener (DEX trading data, liquidity)
 * - Base blockchain data
 */

export interface TokenPrice {
  usd: number;
  usd_24h_change: number;
  usd_market_cap?: number;
  usd_24h_vol?: number;
  last_updated: string;
}

export interface TokenInfo {
  id: string;
  symbol: string;
  name: string;
  address?: string;
  chainId?: string;
  image?: string;
  currentPrice?: number;
  marketCap?: number;
  totalVolume?: number;
  priceChange24h?: number;
  priceChangePercentage24h?: number;
  circulatingSupply?: number;
  totalSupply?: number;
  fullyDilutedValuation?: number;
  ath?: number;
  athDate?: string;
  atl?: number;
  atlDate?: string;
  description?: string;
  links?: {
    homepage?: string[];
    twitter?: string;
    telegram?: string;
    discord?: string;
  };
  liquidity?: {
    usd?: number;
  };
  priceChange?: {
    h1?: number;
    h6?: number;
    h24?: number;
  };
  volume?: {
    h24?: number;
  };
  txns?: {
    h24?: {
      buys?: number;
      sells?: number;
    };
  };
}

export interface DexPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd?: string;
  liquidity?: {
    usd?: number;
    base?: number;
    quote?: number;
  };
  fdv?: number;
  marketCap?: number;
  volume?: {
    h24: number;
    h6: number;
    h1: number;
  };
  priceChange?: {
    h24: number;
    h6: number;
    h1: number;
  };
}

/**
 * Get token data from CoinGecko by symbol or contract address
 */
export async function getCoinGeckoToken(identifier: string): Promise<TokenInfo | null> {
  try {
    const API_KEY = process.env.COINGECKO_API_KEY;
    const baseUrl = API_KEY 
      ? 'https://pro-api.coingecko.com/api/v3'
      : 'https://api.coingecko.com/api/v3';
    
    // If identifier is a contract address (starts with 0x)
    if (identifier.startsWith('0x')) {
      const url = `${baseUrl}/coins/base/contract/${identifier.toLowerCase()}`;
      const headers: HeadersInit = {
        'accept': 'application/json',
      };
      if (API_KEY) {
        headers['x-cg-pro-api-key'] = API_KEY;
      }

      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        console.error('CoinGecko API error:', response.status);
        return null;
      }

      const data = await response.json();
      return formatCoinGeckoData(data);
    } else {
      // Search by symbol or name
      const searchUrl = `${baseUrl}/search?query=${encodeURIComponent(identifier)}`;
      const headers: HeadersInit = {
        'accept': 'application/json',
      };
      if (API_KEY) {
        headers['x-cg-pro-api-key'] = API_KEY;
      }

      const searchResponse = await fetch(searchUrl, { headers });
      
      if (!searchResponse.ok) {
        console.error('CoinGecko search error:', searchResponse.status);
        return null;
      }

      const searchData = await searchResponse.json();
      const coin = searchData.coins?.[0];
      
      if (!coin) {
        return null;
      }

      // Get detailed coin data
      const coinUrl = `${baseUrl}/coins/${coin.id}?localization=false&tickers=false&community_data=false&developer_data=false`;
      const coinResponse = await fetch(coinUrl, { headers });
      
      if (!coinResponse.ok) {
        return null;
      }

      const coinData = await coinResponse.json();
      return formatCoinGeckoData(coinData);
    }
  } catch (error) {
    console.error('Error fetching CoinGecko data:', error);
    return null;
  }
}

/**
 * Get token data from DexScreener
 */
export async function getDexScreenerToken(addressOrSymbol: string): Promise<TokenInfo | null> {
  try {
    let url: string;
    
    // If it's a contract address
    if (addressOrSymbol.startsWith('0x')) {
      url = `https://api.dexscreener.com/latest/dex/tokens/${addressOrSymbol}`;
    } else {
      // Search by symbol
      url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(addressOrSymbol)}`;
    }

    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('DexScreener API error:', response.status);
      return null;
    }

    const data = await response.json();
    const pairs = data.pairs || [];
    
    if (pairs.length === 0) {
      return null;
    }

    // Filter for Base chain pairs and sort by liquidity
    const basePairs = pairs.filter((p: any) => p.chainId === 'base');
    const sortedPairs = basePairs.sort((a: any, b: any) => 
      (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
    );

    const mainPair = sortedPairs[0] || pairs[0];
    
    return formatDexScreenerData(mainPair);
  } catch (error) {
    console.error('Error fetching DexScreener data:', error);
    return null;
  }
}

/**
 * Get comprehensive token data by trying multiple sources
 */
export async function getTokenData(identifier: string): Promise<TokenInfo | null> {
  // Try CoinGecko first (more comprehensive for major tokens)
  const cgData = await getCoinGeckoToken(identifier);
  if (cgData) {
    return cgData;
  }

  // Fall back to DexScreener (better for new/small tokens)
  const dexData = await getDexScreenerToken(identifier);
  if (dexData) {
    return dexData;
  }

  return null;
}

/**
 * Get multiple token prices in one call (CoinGecko simple price)
 */
export async function getTokenPrices(addresses: string[]): Promise<Record<string, TokenPrice>> {
  try {
    const API_KEY = process.env.COINGECKO_API_KEY;
    const baseUrl = API_KEY 
      ? 'https://pro-api.coingecko.com/api/v3'
      : 'https://api.coingecko.com/api/v3';
    
    const addressList = addresses.map(a => a.toLowerCase()).join(',');
    const url = `${baseUrl}/simple/token_price/base?contract_addresses=${addressList}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`;
    
    const headers: HeadersInit = {
      'accept': 'application/json',
    };
    if (API_KEY) {
      headers['x-cg-pro-api-key'] = API_KEY;
    }

    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      console.error('CoinGecko prices error:', response.status);
      return {};
    }

    const data = await response.json();
    
    // Format response
    const result: Record<string, TokenPrice> = {};
    for (const [address, priceData] of Object.entries(data)) {
      result[address] = {
        usd: (priceData as any).usd,
        usd_24h_change: (priceData as any).usd_24h_change,
        usd_market_cap: (priceData as any).usd_market_cap,
        usd_24h_vol: (priceData as any).usd_24h_vol,
        last_updated: new Date().toISOString(),
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching token prices:', error);
    return {};
  }
}

/**
 * Search for tokens across platforms
 */
export async function searchTokens(query: string, limit: number = 10): Promise<TokenInfo[]> {
  try {
    const API_KEY = process.env.COINGECKO_API_KEY;
    const baseUrl = API_KEY 
      ? 'https://pro-api.coingecko.com/api/v3'
      : 'https://api.coingecko.com/api/v3';
    
    const url = `${baseUrl}/search?query=${encodeURIComponent(query)}`;
    const headers: HeadersInit = {
      'accept': 'application/json',
    };
    if (API_KEY) {
      headers['x-cg-pro-api-key'] = API_KEY;
    }

    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const coins = (data.coins || []).slice(0, limit);
    
    // Get detailed info for each coin
    const results = await Promise.all(
      coins.map(async (coin: any) => {
        const detailUrl = `${baseUrl}/coins/${coin.id}?localization=false&tickers=false&community_data=false&developer_data=false`;
        try {
          const detailResponse = await fetch(detailUrl, { headers });
          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            return formatCoinGeckoData(detailData);
          }
        } catch (e) {
          console.error('Error fetching coin detail:', e);
        }
        return null;
      })
    );
    
    return results.filter((r): r is TokenInfo => r !== null);
  } catch (error) {
    console.error('Error searching tokens:', error);
    return [];
  }
}

// Helper functions to format data from different sources

function formatCoinGeckoData(data: any): TokenInfo {
  const platformData = data.platforms?.base || data.contract_address;
  
  return {
    id: data.id,
    symbol: data.symbol?.toUpperCase(),
    name: data.name,
    address: platformData,
    chainId: platformData ? 'base' : undefined,
    image: data.image?.large || data.image?.small,
    currentPrice: data.market_data?.current_price?.usd,
    marketCap: data.market_data?.market_cap?.usd,
    totalVolume: data.market_data?.total_volume?.usd,
    priceChange24h: data.market_data?.price_change_24h,
    priceChangePercentage24h: data.market_data?.price_change_percentage_24h,
    circulatingSupply: data.market_data?.circulating_supply,
    totalSupply: data.market_data?.total_supply,
    fullyDilutedValuation: data.market_data?.fully_diluted_valuation?.usd,
    ath: data.market_data?.ath?.usd,
    athDate: data.market_data?.ath_date?.usd,
    atl: data.market_data?.atl?.usd,
    atlDate: data.market_data?.atl_date?.usd,
    description: data.description?.en,
    links: {
      homepage: data.links?.homepage?.filter((h: string) => h),
      twitter: data.links?.twitter_screen_name,
      telegram: data.links?.telegram_channel_identifier,
      discord: data.links?.discord_url,
    },
  };
}

function formatDexScreenerData(pair: any): TokenInfo {
  return {
    id: pair.baseToken.address,
    symbol: pair.baseToken.symbol,
    name: pair.baseToken.name,
    address: pair.baseToken.address,
    chainId: pair.chainId,
    currentPrice: parseFloat(pair.priceUsd || '0'),
    marketCap: pair.marketCap,
    totalVolume: pair.volume?.h24,
    priceChangePercentage24h: pair.priceChange?.h24,
    liquidity: {
      usd: pair.liquidity?.usd,
    },
    priceChange: {
      h1: pair.priceChange?.h1,
      h6: pair.priceChange?.h6,
      h24: pair.priceChange?.h24,
    },
    volume: {
      h24: pair.volume?.h24,
    },
    txns: {
      h24: {
        buys: pair.txns?.h24?.buys,
        sells: pair.txns?.h24?.sells,
      },
    },
  };
}

/**
 * Format token data for display
 */
export function formatTokenDisplay(token: TokenInfo): string {
  const parts: string[] = [];
  
  parts.push(`**${token.name} (${token.symbol})**`);
  
  if (token.currentPrice) {
    const priceStr = token.currentPrice < 0.01 
      ? token.currentPrice.toExponential(4)
      : token.currentPrice.toFixed(token.currentPrice < 1 ? 6 : 2);
    parts.push(`💵 Price: $${priceStr}`);
  }
  
  if (token.priceChangePercentage24h !== undefined) {
    const emoji = token.priceChangePercentage24h >= 0 ? '📈' : '📉';
    parts.push(`${emoji} 24h Change: ${token.priceChangePercentage24h.toFixed(2)}%`);
  }
  
  if (token.marketCap) {
    parts.push(`📊 Market Cap: $${formatLargeNumber(token.marketCap)}`);
  }
  
  if (token.totalVolume) {
    parts.push(`💹 24h Volume: $${formatLargeNumber(token.totalVolume)}`);
  }
  
  if (token.liquidity?.usd) {
    parts.push(`💧 Liquidity: $${formatLargeNumber(token.liquidity.usd)}`);
  }
  
  if (token.address) {
    parts.push(`📍 Contract: \`${token.address}\``);
  }
  
  return parts.join('\n');
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
