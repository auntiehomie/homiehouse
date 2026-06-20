/**
 * Token Data Service
 * Aggregates token information from multiple sources:
 * - Neynar (Farcaster-native tokens on Base)
 * - CoinGecko (price, market data, market cap)
 * - DexScreener (DEX trading data, liquidity)
 * - Base blockchain data
 */

// Common Base tokens mapping (symbol -> contract address)
const BASE_TOKENS: Record<string, string> = {
  'USDC': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'WETH': '0x4200000000000000000000000000000000000006',
  'DAI': '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
  'DEGEN': '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed',
  'MOXIE': '0x8C9037D1Ef5c6D1f6816278C7AAF5491d24CD527',
  'HIGHER': '0x0578d8A44db98B23BF096A382e016e29a5Ce0ffe',
  'ONCHAIN': '0x8752f1a2b2a6e87e6ae2d3d7c03f0f3f3f3f3f3f', // placeholder
  'NATIVE': '0x0000000000000000000000000000000000000000', // needs actual address
};

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
 * Get token data from Clanker API (Farcaster-native tokens)
 * Searches by name, symbol, or contract address
 */
export async function getClankerToken(identifier: string): Promise<TokenInfo | null> {
  try {
    // Get more results to find exact matches
    const url = `https://www.clanker.world/api/tokens?q=${encodeURIComponent(identifier)}&includeMarket=true&limit=10`;
    
    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Clanker API error:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
      return null;
    }

    // If identifier is a contract address, take the first match
    if (identifier.startsWith('0x')) {
      const token = data.data[0];
      const market = token.market_data;
      
      return {
        id: token.contract_address,
        symbol: token.symbol?.toUpperCase() || '',
        name: token.name || '',
        address: token.contract_address,
        chainId: 'base',
        image: token.img_url || undefined,
        currentPrice: market?.price_usd ? parseFloat(market.price_usd) : undefined,
        marketCap: market?.market_cap ? parseFloat(market.market_cap) : undefined,
        totalVolume: market?.volume_24h ? parseFloat(market.volume_24h) : undefined,
        priceChangePercentage24h: market?.price_change_percentage_24h ? parseFloat(market.price_change_percentage_24h) : undefined,
        description: token.description || token.metadata?.description || `${token.name} - Deployed via Clanker on Base`,
        links: {
          homepage: token.metadata?.socialMediaUrls?.find((s: any) => s.platform === 'website')?.url ? [token.metadata.socialMediaUrls.find((s: any) => s.platform === 'website').url] : [`https://www.clanker.world/clanker/${token.contract_address}`],
          twitter: token.metadata?.socialMediaUrls?.find((s: any) => s.platform === 'twitter')?.url?.split('/').pop(),
        },
        liquidity: market?.liquidity_usd ? {
          usd: parseFloat(market.liquidity_usd)
        } : undefined,
      };
    }

    // For name/symbol search, find exact match first
    const upperIdentifier = identifier.toUpperCase();
    const exactMatch = data.data.find((t: any) => 
      t.symbol?.toUpperCase() === upperIdentifier || 
      t.name?.toUpperCase() === upperIdentifier
    );
    
    // Use exact match if found, otherwise use first result
    const token = exactMatch || data.data[0];
    const market = token.market_data;
    
    // Log what data we got
    console.log(`Clanker token found: ${token.symbol} - Has market data: ${!!market}, Has price: ${!!market?.price_usd}`);
    
    // If no market data, log warning
    if (!market || !market.price_usd) {
      console.warn(`Token ${token.symbol} (${token.contract_address}) found but missing market data`);
    }
    
    // Convert Clanker format to TokenInfo
    return {
      id: token.contract_address,
      symbol: token.symbol?.toUpperCase() || '',
      name: token.name || '',
      address: token.contract_address,
      chainId: 'base',
      image: token.img_url || undefined,
      currentPrice: market?.price_usd ? parseFloat(market.price_usd) : undefined,
      marketCap: market?.market_cap ? parseFloat(market.market_cap) : undefined,
      totalVolume: market?.volume_24h ? parseFloat(market.volume_24h) : undefined,
      priceChangePercentage24h: market?.price_change_percentage_24h ? parseFloat(market.price_change_percentage_24h) : undefined,
      description: token.description || token.metadata?.description || `${token.name} - Deployed via Clanker on Base`,
      links: {
        homepage: token.metadata?.socialMediaUrls?.find((s: any) => s.platform === 'website')?.url ? [token.metadata.socialMediaUrls.find((s: any) => s.platform === 'website').url] : [`https://www.clanker.world/clanker/${token.contract_address}`],
        twitter: token.metadata?.socialMediaUrls?.find((s: any) => s.platform === 'twitter')?.url?.split('/').pop(),
      },
      liquidity: market?.liquidity_usd ? {
        usd: parseFloat(market.liquidity_usd)
      } : undefined,
    };
  } catch (error) {
    console.error('Error fetching Clanker token data:', error);
    return null;
  }
}

/**
 * Get token data for Base network tokens using DexScreener
 * Replaces the removed Neynar fungibles endpoint.
 * DexScreener covers Base DEX pairs with price, liquidity, and volume data.
 */
export async function getNeynarToken(address: string): Promise<TokenInfo | null> {
  // Delegate to DexScreener for Base token lookups — no external API key required
  return getDexScreenerToken(address);
}

/**
 * Get comprehensive token data by trying multiple sources
 */
export async function getTokenData(identifier: string): Promise<TokenInfo | null> {
  // Check if identifier matches a known Base token symbol
  const upperIdentifier = identifier.toUpperCase();
  if (BASE_TOKENS[upperIdentifier]) {
    const address = BASE_TOKENS[upperIdentifier];
    // Try DexScreener for known Base tokens (covers DEX pairs on Base)
    const dexData = await getDexScreenerToken(address);
    if (dexData) {
      return dexData;
    }
  }

  // Try Clanker first for name/symbol searches (best for Farcaster-native tokens)
  if (!identifier.startsWith('0x')) {
    const clankerData = await getClankerToken(identifier);
    if (clankerData) {
      return clankerData;
    }
  }

  // If identifier is a contract address, try multiple Base-specific sources
  if (identifier.startsWith('0x') && identifier.length === 42) {
    // Try Clanker for contract addresses
    const clankerData = await getClankerToken(identifier);
    if (clankerData) {
      return clankerData;
    }
    
    // Try DexScreener for contract addresses on Base
    const dexData2 = await getDexScreenerToken(identifier);
    if (dexData2) {
      return dexData2;
    }
  }

  // Try CoinGecko (more comprehensive for major tokens)
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
  const results: TokenInfo[] = [];
  
  try {
    // First, try Clanker for Farcaster-native tokens
    const clankerUrl = `https://www.clanker.world/api/tokens?q=${encodeURIComponent(query)}&includeMarket=true&limit=${Math.min(limit, 20)}`;
    const clankerResponse = await fetch(clankerUrl, {
      headers: { 'accept': 'application/json' },
    });
    
    if (clankerResponse.ok) {
      const clankerData = await clankerResponse.json();
      const clankerTokens = (clankerData.data || []).slice(0, limit).map((token: any) => {
        const market = token.market_data;
        return {
          id: token.contract_address,
          symbol: token.symbol?.toUpperCase() || '',
          name: token.name || '',
          address: token.contract_address,
          chainId: 'base',
          image: token.img_url || undefined,
          currentPrice: market?.price_usd ? parseFloat(market.price_usd) : undefined,
          marketCap: market?.market_cap ? parseFloat(market.market_cap) : undefined,
          totalVolume: market?.volume_24h ? parseFloat(market.volume_24h) : undefined,
          priceChangePercentage24h: market?.price_change_percentage_24h ? parseFloat(market.price_change_percentage_24h) : undefined,
          description: token.description || token.metadata?.description || `${token.name} - Deployed via Clanker`,
        };
      });
      results.push(...clankerTokens);
    }
  } catch (error) {
    console.log('Clanker search failed, continuing with other sources:', error);
  }

  // If we have enough results from Clanker, return them
  if (results.length >= limit) {
    return results.slice(0, limit);
  }

  // Otherwise, also search CoinGecko
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
      return results;
    }

    const data = await response.json();
    const remainingLimit = limit - results.length;
    const coins = (data.coins || []).slice(0, remainingLimit);
    
    // Get detailed info for each coin
    const cgResults = await Promise.all(
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
    
    results.push(...cgResults.filter((r): r is TokenInfo => r !== null));
  } catch (error) {
    console.error('Error searching tokens:', error);
  }
  
  return results.slice(0, limit);
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
