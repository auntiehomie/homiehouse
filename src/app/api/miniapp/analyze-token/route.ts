import { NextRequest, NextResponse } from 'next/server';
import { getTokenData, formatTokenDisplay } from '@/lib/token-data';
import { calculateInvestmentRatingFromData } from './helpers';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token name, symbol, or address is required' },
        { status: 400 }
      );
    }

    // First, get real-time token data
    const tokenData = await getTokenData(token);

    if (!tokenData) {
      return NextResponse.json(
        { error: `Token "${token}" not found. Please check the name, symbol, or contract address.` },
        { status: 404 }
      );
    }

    // Format basic token info
    const basicInfo = formatTokenDisplay(tokenData);

    const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || process.env.NEXT_PUBLIC_PERPLEXITY_API_KEY;
    
    // If no Perplexity key, return just the real-time data with simple analysis
    if (!PERPLEXITY_API_KEY) {
      const simpleAnalysis = generateSimpleAnalysis(tokenData);
      const riskFactors = extractRiskFactorsFromData(tokenData);
      const investmentRating = calculateInvestmentRatingFromData(tokenData);

      return NextResponse.json({
        token: tokenData.name,
        symbol: tokenData.symbol,
        realTimeData: tokenData,
        basicInfo,
        analysis: simpleAnalysis,
        summary: {
          investmentRating,
          riskFactors,
          lastUpdated: new Date().toISOString()
        },
        disclaimer: 'This analysis is for informational purposes only and should not be considered financial advice. Always do your own research and consult with financial advisors before making investment decisions.'
      });
    }

    // Use Perplexity for deeper research with real-time data context
    const searchPrompt = `Analyze the cryptocurrency token "${tokenData.name} (${tokenData.symbol})" for investment potential.

CURRENT MARKET DATA (Real-time from CoinGecko/DexScreener):
- Price: $${tokenData.currentPrice?.toFixed(tokenData.currentPrice < 1 ? 6 : 2) || 'N/A'}
- Market Cap: $${formatNumber(tokenData.marketCap)}
- 24h Volume: $${formatNumber(tokenData.totalVolume)}
- 24h Change: ${tokenData.priceChangePercentage24h?.toFixed(2)}%
- Liquidity: $${formatNumber(tokenData.liquidity?.usd)}
${tokenData.address ? `- Contract: ${tokenData.address}` : ''}
${tokenData.chainId ? `- Blockchain: ${tokenData.chainId}` : ''}

Research and provide:

1. DEVELOPER/TEAM: Who created it, team background, social media presence, reputation
2. TOKENOMICS: Total supply, circulating supply, token distribution, vesting schedules  
3. USE CASE: What problem does it solve, utility, real-world adoption
4. COMMUNITY: Social media activity, community size, engagement levels
5. RED FLAGS: Any scam indicators, rug pull risks, suspicious activity, audit status
6. COMPETITIVE ANALYSIS: Similar projects, market position
7. RECENT NEWS: Latest developments, partnerships, controversies

Provide factual, up-to-date information from reliable sources. Flag any concerns clearly. Consider the real-time market data provided above when making your assessment.`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a cryptocurrency research analyst. Provide factual, objective analysis based on current web data. Always cite sources and clearly flag any red flags or risks.'
          },
          {
            role: 'user',
            content: searchPrompt
          }
        ],
        temperature: 0.2,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const deepAnalysis = data.choices?.[0]?.message?.content;

    if (!deepAnalysis) {
      throw new Error('No analysis generated');
    }

    // Combine real-time data with deep analysis
    const combinedAnalysis = `${basicInfo}\n\n---\n\n${deepAnalysis}`;

    // Parse the analysis and extract key risk factors
    const riskFactors = extractRiskFactors(deepAnalysis);
    const dataRiskFactors = extractRiskFactorsFromData(tokenData);
    const allRiskFactors = [...new Set([...riskFactors, ...dataRiskFactors])];
    
    const investmentRating = calculateInvestmentRating(deepAnalysis, tokenData);

    return NextResponse.json({
      token: tokenData.name,
      symbol: tokenData.symbol,
      realTimeData: tokenData,
      basicInfo,
      analysis: combinedAnalysis,
      summary: {
        investmentRating,
        riskFactors: allRiskFactors,
        lastUpdated: new Date().toISOString()
      },
      disclaimer: 'This analysis is for informational purposes only and should not be considered financial advice. Always do your own research and consult with financial advisors before making investment decisions.'
    });
  } catch (error) {
    console.error('Error analyzing token:', error);
    return NextResponse.json(
      { error: 'Failed to analyze token', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function formatNumber(num: number | undefined): string {
  if (num === undefined || num === null) return 'N/A';
  
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(2) + 'B';
  } else if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(2) + 'M';
  } else if (num >= 1_000) {
    return (num / 1_000).toFixed(2) + 'K';
  }
  return num.toFixed(2);
}

function generateSimpleAnalysis(tokenData: any): string {
  let analysis = `## ${tokenData.name} (${tokenData.symbol}) Analysis\n\n`;
  
  analysis += `### Market Overview\n`;
  
  if (tokenData.currentPrice) {
    analysis += `The token is currently trading at $${tokenData.currentPrice.toFixed(tokenData.currentPrice < 1 ? 6 : 2)}`;
    if (tokenData.priceChangePercentage24h) {
      analysis += ` with a 24-hour change of ${tokenData.priceChangePercentage24h > 0 ? '+' : ''}${tokenData.priceChangePercentage24h.toFixed(2)}%`;
    }
    analysis += `.\n\n`;
  }
  
  if (tokenData.marketCap) {
    analysis += `Market capitalization stands at $${formatNumber(tokenData.marketCap)}`;
    if (tokenData.marketCap < 1_000_000) {
      analysis += ` (⚠️ Micro-cap - very high risk)`;
    } else if (tokenData.marketCap < 100_000_000) {
      analysis += ` (⚠️ Small-cap - high volatility)`;
    }
    analysis += `.\n\n`;
  }
  
  if (tokenData.totalVolume) {
    analysis += `Trading volume in the last 24 hours: $${formatNumber(tokenData.totalVolume)}.\n\n`;
  }
  
  if (tokenData.liquidity?.usd) {
    analysis += `Liquidity: $${formatNumber(tokenData.liquidity.usd)}`;
    if (tokenData.liquidity.usd < 50_000) {
      analysis += ` (⚠️ Low liquidity - high slippage risk)`;
    }
    analysis += `.\n\n`;
  }
  
  if (tokenData.description) {
    analysis += `### About\n${tokenData.description.substring(0, 500)}${tokenData.description.length > 500 ? '...' : ''}\n\n`;
  }
  
  analysis += `### Important Notes\n`;
  analysis += `- Always conduct thorough research before investing\n`;
  analysis += `- Check the project's official website and social media\n`;
  analysis += `- Verify smart contract audits\n`;
  analysis += `- Be cautious of anonymous teams and unaudited contracts\n`;
  analysis += `- Never invest more than you can afford to lose\n`;
  
  return analysis;
}

function extractRiskFactors(analysis: string): string[] {
  const riskKeywords = [
    'scam', 'rug pull', 'honeypot', 'suspicious', 'warning',
    'red flag', 'unlocked liquidity', 'anonymous team', 'no audit',
    'pump and dump', 'low liquidity', 'concentrated holders'
  ];

  const factors: string[] = [];
  const lowerAnalysis = analysis.toLowerCase();

  riskKeywords.forEach(keyword => {
    if (lowerAnalysis.includes(keyword)) {
      factors.push(keyword);
    }
  });

  return [...new Set(factors)]; // Remove duplicates
}

function extractRiskFactorsFromData(tokenData: any): string[] {
  const factors: string[] = [];
  
  // Check liquidity
  if (tokenData.liquidity?.usd && tokenData.liquidity.usd < 50_000) {
    factors.push('low liquidity');
  }
  
  // Check market cap
  if (tokenData.marketCap && tokenData.marketCap < 1_000_000) {
    factors.push('micro-cap');
  }
  
  // Check price volatility
  if (tokenData.priceChangePercentage24h && Math.abs(tokenData.priceChangePercentage24h) > 20) {
    factors.push('high volatility');
  }
  
  // Check trading volume
  if (tokenData.totalVolume && tokenData.marketCap) {
    const volumeToMcapRatio = tokenData.totalVolume / tokenData.marketCap;
    if (volumeToMcapRatio < 0.01) {
      factors.push('low trading volume');
    }
  }
  
  return factors;
}

function calculateInvestmentRating(analysis: string, tokenData?: any): string {
  const lowerAnalysis = analysis.toLowerCase();
  
  // Scam indicators
  const scamIndicators = ['scam', 'rug pull', 'honeypot', 'fraud'];
  const hasScamIndicators = scamIndicators.some(indicator => lowerAnalysis.includes(indicator));
  
  if (hasScamIndicators) {
    return '🚨 SCAM ALERT - DO NOT INVEST';
  }

  // Check real-time data for additional red flags
  if (tokenData) {
    // Extremely low liquidity is a major red flag
    if (tokenData.liquidity?.usd && tokenData.liquidity.usd < 10_000) {
      return '🚨 EXTREME RISK - Very low liquidity ($' + (tokenData.liquidity.usd / 1000).toFixed(1) + 'K)';
    }
    
    // Micro-cap + low volume = high risk
    if (tokenData.marketCap && tokenData.marketCap < 100_000 && 
        tokenData.totalVolume && tokenData.totalVolume < 10_000) {
      return '🔴 VERY HIGH RISK - Micro-cap with low volume';
    }
  }

  // High risk indicators
  const highRiskIndicators = [
    'high risk', 'no audit', 'anonymous team', 'no liquidity',
    'red flag', 'suspicious', 'warning'
  ];
  const highRiskCount = highRiskIndicators.filter(indicator => 
    lowerAnalysis.includes(indicator)
  ).length;

  if (highRiskCount >= 3) {
    return '🔴 HIGH RISK - Proceed with extreme caution';
  }

  // Medium risk indicators
  const mediumRiskIndicators = [
    'limited information', 'small market cap', 'low trading volume',
    'new project', 'unproven team'
  ];
  const mediumRiskCount = mediumRiskIndicators.filter(indicator =>
    lowerAnalysis.includes(indicator)
  ).length;

  if (mediumRiskCount >= 2 || highRiskCount > 0) {
    return '🟡 MEDIUM RISK - Research thoroughly before investing';
  }

  // Low risk indicators
  const lowRiskIndicators = [
    'audited', 'doxxed team', 'established', 'high liquidity',
    'reputable', 'good track record', 'transparent'
  ];
  const lowRiskCount = lowRiskIndicators.filter(indicator =>
    lowerAnalysis.includes(indicator)
  ).length;

  if (lowRiskCount >= 3) {
    return '🟢 LOWER RISK - Still conduct your own research';
  }

  return '🟡 MEDIUM RISK - Research thoroughly before investing';
}
