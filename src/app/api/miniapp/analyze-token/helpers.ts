/**
 * Additional helper function for calculating investment rating from just token data
 */
export function calculateInvestmentRatingFromData(tokenData: any): string {
  // Check for extreme red flags
  if (tokenData.liquidity?.usd && tokenData.liquidity.usd < 10_000) {
    return '🚨 EXTREME RISK - Very low liquidity';
  }
  
  if (tokenData.marketCap && tokenData.marketCap < 100_000) {
    return '🔴 VERY HIGH RISK - Micro-cap token';
  }
  
  // High risk indicators
  let riskScore = 0;
  
  if (tokenData.liquidity?.usd && tokenData.liquidity.usd < 50_000) riskScore += 2;
  if (tokenData.marketCap && tokenData.marketCap < 1_000_000) riskScore += 2;
  if (tokenData.priceChangePercentage24h && Math.abs(tokenData.priceChangePercentage24h) > 20) riskScore += 1;
  if (tokenData.totalVolume && tokenData.totalVolume < 50_000) riskScore += 1;
  
  if (riskScore >= 4) {
    return '🔴 HIGH RISK - Proceed with extreme caution';
  }
  
  if (riskScore >= 2) {
    return '🟡 MEDIUM RISK - Research thoroughly before investing';
  }
  
  // Check for positive indicators
  let positiveScore = 0;
  
  if (tokenData.marketCap && tokenData.marketCap > 100_000_000) positiveScore += 2;
  if (tokenData.liquidity?.usd && tokenData.liquidity.usd > 500_000) positiveScore += 2;
  if (tokenData.totalVolume && tokenData.marketCap && 
      tokenData.totalVolume / tokenData.marketCap > 0.1) positiveScore += 1;
  
  if (positiveScore >= 4) {
    return '🟢 LOWER RISK - Still conduct your own research';
  }
  
  return '🟡 MEDIUM RISK - Research thoroughly before investing';
}
