# Token Information System - Quick Start

## 🚀 Getting Started

The token information system is now fully integrated! Here's how to use it:

## 1️⃣ Ask Homie - AI Token Queries

Simply ask Ask Homie about any token:

### Example Queries:
```
"What's the price of Ethereum?"
"Tell me about $DEGEN"
"Search for tokens called Base"
"Get info on 0x4200000000000000000000000000000000000006"
"Is this token safe?" (when viewing a token cast)
"What's the market cap of BRETT?"
"Find tokens similar to USDC"
```

### What You'll Get:
- ✅ Real-time price
- ✅ Market cap & volume
- ✅ 24h price change
- ✅ Liquidity information
- ✅ Risk warnings (if applicable)
- ✅ Contract address & links
- ✅ Project description

## 2️⃣ Mini App Token Analysis

In the Ask Homie mini app, go to the "💎 Token" tab:

1. Enter token name, symbol, or contract address
2. Click "Analyze"
3. Get comprehensive report with:
   - Real-time market data
   - AI-powered research
   - Risk assessment
   - Scam detection

### Example:
```
Input: "DEGEN"

Output:
- 💵 Price: $0.0123
- 📊 Market Cap: $45.2M
- 📈 24h Change: +5.2%
- 💧 Liquidity: $1.2M
- ⚠️ Risk: 🟡 MEDIUM RISK
- 📍 Contract: 0x4ed4...
```

## 3️⃣ API Endpoints

### Get Token Info
```bash
GET /api/tokens/ethereum
GET /api/tokens/ETH
GET /api/tokens/0x4200000000000000000000000000000000000006
```

### Search Tokens
```bash
GET /api/tokens/search?q=base&limit=5
```

### Batch Prices
```bash
POST /api/tokens/prices
{
  "addresses": ["0x833...", "0x420..."]
}
```

## 4️⃣ React Components

### Token Price Widget

```tsx
import TokenPriceWidget from '@/components/TokenPriceWidget';

// Full widget with all details
<TokenPriceWidget tokenIdentifier="ethereum" />

// Compact mode (smaller display)
<TokenPriceWidget tokenIdentifier="ETH" compact />
```

## 🎯 Common Use Cases

### 1. Check Token Price
**Ask Homie:** *"What's ETH trading at?"*

### 2. Research New Token
**Mini App:** Enter contract address → Get full analysis

### 3. Due Diligence
**Ask Homie:** *"Is $NEWTOKEN safe to buy?"*
- Gets real-time metrics
- Checks liquidity
- Warns about risks

### 4. Portfolio View
Add widgets to dashboard:
```tsx
<TokenPriceWidget tokenIdentifier="ETH" compact />
<TokenPriceWidget tokenIdentifier="USDC" compact />
<TokenPriceWidget tokenIdentifier="DEGEN" compact />
```

## ⚠️ Important Notes

### No API Keys Required
System works out of the box! Optional keys for better performance:
- `COINGECKO_API_KEY` - Higher rate limits
- Already have `PERPLEXITY_API_KEY` for deep analysis

### Risk Warnings
Always displays:
- Low liquidity warnings
- Volatility alerts
- Scam indicators
- "Not financial advice" disclaimer

### Supported Chains
- **Base** (primary focus)
- **Ethereum**
- Other major chains via CoinGecko

## 🎨 Example Conversations

### Basic Price Check
```
User: What's the price of DEGEN?
Homie: **DEGEN**
💵 Price: $0.0123
📈 24h Change: +5.2%
📊 Market Cap: $45.2M
💹 24h Volume: $2.1M
💧 Liquidity: $1.2M
📍 Contract: `0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed`
```

### Safety Analysis
```
User: Is $NEWTOKEN safe?
Homie: Let me check... *[fetches data]*

**NEWTOKEN**
💵 Price: $0.00001
📊 Market Cap: $50K
💧 Liquidity: $8K

⚠️ **HIGH RISK FACTORS:**
- Very low liquidity ($8K) - high slippage risk
- Micro-cap ($50K) - extremely volatile
- New token with limited data

🔴 Risk Rating: VERY HIGH RISK

I'd recommend extreme caution. This token has:
- Low liquidity making it hard to sell
- Tiny market cap = high volatility
- Limited trading history

Always DYOR and never invest more than you can lose!
```

### Token Search
```
User: Find tokens related to AI
Homie: *[searches CoinGecko]*

Found 5 tokens:

1. **Artificial Intelligence (AI)**
   💵 $0.45
   📊 MCap: $125M
   📈 24h: +2.3%

2. **SingularityNET (AGIX)**
   💵 $0.32
   📊 MCap: $405M
   📈 24h: -1.2%

[... 3 more results]

Which would you like to know more about?
```

## 📊 Risk Assessment Levels

### 🟢 Lower Risk
- Market cap > $100M
- Liquidity > $500K
- Good trading volume
- Established project

### 🟡 Medium Risk
- Market cap $1M-$100M
- Moderate liquidity
- Some risk factors
- Research recommended

### 🔴 High Risk
- Market cap < $1M
- Low liquidity < $50K
- High volatility
- Proceed with caution

### 🚨 Extreme Risk / Scam Alert
- Liquidity < $10K
- Known scam indicators
- Anonymous team
- No audit
- **DO NOT INVEST**

## 🔧 Troubleshooting

### Token Not Found
Try:
1. Full token name: "ethereum" not "eth coin"
2. Contract address: `0x4ed4...` (most reliable)
3. Check spelling and capitalization

### Slow Response
- CoinGecko free tier has rate limits
- Add API key for faster responses
- Data cached for 30 seconds

### Wrong Chain
- Specify chain: "USDC on Base"
- System prioritizes Base network
- Use contract address for exact match

## 📚 Resources

- Full Documentation: `docs/TOKEN_INFORMATION_SYSTEM.md`
- CoinGecko API: https://www.coingecko.com/en/api
- DexScreener: https://dexscreener.com

## 💡 Pro Tips

1. **Use Contract Addresses** for new/small tokens
2. **Check Liquidity First** - most important risk factor
3. **Compare Tokens** by asking for multiple at once
4. **Set Up Widgets** for tokens you track
5. **Always DYOR** - this is just data, not advice!

---

**Ready to start?** Just ask Ask Homie about any token! 🚀
