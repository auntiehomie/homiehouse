import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token name, symbol, or address is required' },
        { status: 400 }
      );
    }

    const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
    if (!PERPLEXITY_API_KEY) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    // Use Perplexity to search for comprehensive token information
    const searchPrompt = `Analyze the cryptocurrency token "${token}" for investment potential. Research and provide:

1. TOKEN BASICS: Official name, symbol, blockchain, contract address, launch date
2. DEVELOPER/TEAM: Who created it, team background, social media presence, reputation
3. MARKET DATA: Current price, market cap, trading volume, liquidity, holder count
4. TOKENOMICS: Total supply, circulating supply, token distribution, vesting schedules
5. USE CASE: What problem does it solve, utility, real-world adoption
6. COMMUNITY: Social media activity, community size, engagement levels
7. RED FLAGS: Any scam indicators, rug pull risks, suspicious activity, audit status
8. COMPETITIVE ANALYSIS: Similar projects, market position
9. RECENT NEWS: Latest developments, partnerships, controversies

Provide factual, up-to-date information from reliable sources. Flag any concerns clearly.`;

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
    const analysis = data.choices?.[0]?.message?.content;

    if (!analysis) {
      throw new Error('No analysis generated');
    }

    // Parse the analysis and extract key risk factors
    const riskFactors = extractRiskFactors(analysis);
    const investmentRating = calculateInvestmentRating(analysis);

    return NextResponse.json({
      token,
      analysis,
      summary: {
        investmentRating, // High Risk / Medium Risk / Low Risk / Scam Alert
        riskFactors,
        lastUpdated: new Date().toISOString()
      },
      disclaimer: 'This analysis is for informational purposes only and should not be considered financial advice. Always do your own research and consult with financial advisors before making investment decisions.'
    });
  } catch (error) {
    console.error('Error analyzing token:', error);
    return NextResponse.json(
      { error: 'Failed to analyze token' },
      { status: 500 }
    );
  }
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

function calculateInvestmentRating(analysis: string): string {
  const lowerAnalysis = analysis.toLowerCase();
  
  // Scam indicators
  const scamIndicators = ['scam', 'rug pull', 'honeypot', 'fraud'];
  const hasScamIndicators = scamIndicators.some(indicator => lowerAnalysis.includes(indicator));
  
  if (hasScamIndicators) {
    return '🚨 SCAM ALERT - DO NOT INVEST';
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
