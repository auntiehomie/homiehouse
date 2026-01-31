# Token Information System

Comprehensive token data and analysis system for HomieHouse, integrating multiple data sources to provide real-time cryptocurrency information.

## 🎯 Overview

This system enhances both **Ask Homie** (the AI agent) and **homiehouse** (the mini app) with powerful token research capabilities, combining:

- **Real-time market data** from CoinGecko and DexScreener
- **AI-powered analysis** via Perplexity
- **Intelligent risk assessment** based on market metrics
- **Interactive widgets** for token displays

## 🏗️ Architecture

### Core Components

1. **Token Data Service** (`src/lib/token-data.ts`)
   - Multi-source data aggregation (CoinGecko, DexScreener)
   - Automatic fallback between providers
   - Price, market cap, volume, liquidity tracking
   - Support for contract addresses, symbols, and names

2. **API Endpoints** (`src/app/api/tokens/...`)
   - `/api/tokens/[identifier]` - Get detailed token info
   - `/api/tokens/search` - Search tokens by name/symbol
   - `/api/tokens/prices` - Batch price lookups

3. **AI Agent Integration** (`src/lib/ai/agents.ts`)
   - `get_token_info` tool - Real-time token data lookup
   - `search_tokens` tool - Find tokens by query
   - Available in FarcasterResearchAgent

4. **Enhanced Token Analysis** (`src/app/api/miniapp/analyze-token/`)
   - Combines real-time data with AI research
   - Automated risk assessment
   - Scam detection indicators

5. **UI Components** (`src/components/TokenPriceWidget.tsx`)
   - Real-time price display
   - Compact and full view modes
   - Auto-refresh every 30 seconds

## 📊 Data Sources

### CoinGecko
- **Purpose**: Primary data source for established tokens
- **Coverage**: Major cryptocurrencies, market data, descriptions
- **Rate Limit**: 10-50 calls/minute (free tier)
- **API Key**: Optional (set `COINGECKO_API_KEY` for pro features)

### DexScreener
- **Purpose**: DEX trading data, new/small tokens
- **Coverage**: Real-time DEX prices, liquidity, trading volume
- **Rate Limit**: Public API, no key required
- **Best For**: New tokens, Base chain tokens

## 🚀 Usage

### 1. Ask Homie (AI Agent)

Users can now ask Ask Homie about tokens:

```
"What's the price of ETH?"
"Tell me about $DEGEN"
"Search for tokens called 'Base'"
"Get info on 0x4200000000000000000000000000000000000006"
```

The agent automatically:
- Fetches real-time market data
- Provides price, market cap, volume
- Identifies risks (low liquidity, volatility)
- Includes links to project websites/socials

### 2. Mini App Token Analysis

Enhanced `/api/miniapp/analyze-token` endpoint:

**Before:**
- Only Perplexity web search
- No real-time price data
- Limited risk assessment

**After:**
- Real-time CoinGecko/DexScreener data
- Live price, market cap, volume
- Automated risk scoring
- Works even without Perplexity API

### 3. API Endpoints

#### Get Token Information
```typescript
GET /api/tokens/ethereum
GET /api/tokens/ETH
GET /api/tokens/0x4200000000000000000000000000000000000006

Response:
{
  "success": true,
  "token": {
    "name": "Ethereum",
    "symbol": "ETH",
    "currentPrice": 2500.00,
    "marketCap": 300000000000,
    "priceChangePercentage24h": 2.5,
    // ... more data
  },
  "formatted": "**Ethereum (ETH)**\n💵 Price: $2,500.00..."
}
```

#### Search Tokens
```typescript
GET /api/tokens/search?q=base&limit=5

Response:
{
  "success": true,
  "count": 5,
  "tokens": [...]
}
```

#### Batch Prices
```typescript
POST /api/tokens/prices
{
  "addresses": [
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "0x4200000000000000000000000000000000000006"
  ]
}
```

### 4. Token Price Widget

```tsx
import TokenPriceWidget from '@/components/TokenPriceWidget';

// Full widget
<TokenPriceWidget tokenIdentifier="ethereum" />

// Compact mode
<TokenPriceWidget tokenIdentifier="ETH" compact />
```

## 🎨 Features

### Real-Time Market Data
- ✅ Current price with 24h change
- ✅ Market capitalization
- ✅ Trading volume
- ✅ Liquidity information
- ✅ Circulating/total supply
- ✅ All-time high/low
- ✅ Contract address and chain info

### Risk Assessment
Automatic risk scoring based on:
- **Liquidity**: < $10K = Extreme Risk, < $50K = High Risk
- **Market Cap**: < $100K = Very High Risk, < $1M = High Risk
- **Volatility**: > 20% daily change flagged
- **Volume**: Low volume-to-mcap ratio flagged
- **Scam Indicators**: Detection from analysis text

### Intelligence Features
- **Multi-source fallback**: CoinGecko → DexScreener
- **Smart search**: Name, symbol, or contract address
- **Base chain focus**: Prioritizes Base network tokens
- **Auto-refresh**: Widget updates every 30s
- **Error handling**: Graceful degradation

## 🔧 Setup

### Environment Variables

Optional but recommended:

```bash
# CoinGecko Pro API (for higher rate limits)
COINGECKO_API_KEY=your_coingecko_key

# Perplexity (for deep analysis in mini app)
NEXT_PUBLIC_PERPLEXITY_API_KEY=your_perplexity_key
PERPLEXITY_API_KEY=your_perplexity_key
```

**Note**: System works without API keys using free tiers.

### Installation

All dependencies are already in `package.json`. The system uses:
- Existing fetch API (no additional libraries)
- Built-in TypeScript types
- Next.js API routes

## 📝 Implementation Details

### Token Data Flow

```
User Query → Agent Tool Call → Token Data Service
                                     ↓
                          ┌──────────┴──────────┐
                          ↓                     ↓
                    CoinGecko API        DexScreener API
                          ↓                     ↓
                     Format Data          Format Data
                          ↓                     ↓
                          └──────────┬──────────┘
                                     ↓
                              Return TokenInfo
                                     ↓
                            Display to User
```

### Risk Calculation Logic

```typescript
// Liquidity-based
< $10K   → 🚨 Extreme Risk
< $50K   → 🔴 High Risk
< $500K  → 🟡 Medium Risk
> $500K  → 🟢 Lower Risk

// Market Cap-based
< $100K  → 🚨 Very High Risk (Micro-cap)
< $1M    → 🔴 High Risk (Small-cap)
< $100M  → 🟡 Medium Risk
> $100M  → 🟢 Lower Risk (Established)

// Combined Score
Multiple factors → Final rating
```

## 🎯 Use Cases

### 1. Due Diligence
User asks: *"Is $NEWTOKEN safe to invest in?"*

Ask Homie:
1. Fetches real-time data (price, liquidity, volume)
2. Checks risk factors (liquidity < $50K → ⚠️)
3. Provides market metrics
4. Warns about low liquidity/volume

### 2. Price Discovery
User: *"What's DEGEN trading at?"*

Response:
- Current price: $0.0123
- 24h change: +5.2%
- Market cap: $45M
- DEX: Uniswap/Aerodrome

### 3. Token Research
User: *"Find tokens related to AI"*

1. Searches CoinGecko for "AI" tokens
2. Returns top 5 matches with prices
3. User selects one for detailed info

### 4. Portfolio Tracking
Embed `TokenPriceWidget` in dashboard:
```tsx
<TokenPriceWidget tokenIdentifier="ETH" compact />
<TokenPriceWidget tokenIdentifier="USDC" compact />
<TokenPriceWidget tokenIdentifier="DEGEN" compact />
```

## 🔐 Security & Best Practices

### API Key Management
- Store keys in `.env.local` (gitignored)
- Use `process.env` for server-side access
- Never expose keys in client-side code
- Rate limit API calls to avoid bans

### Data Validation
- Validate all user inputs
- Sanitize contract addresses (0x prefix, length check)
- Handle API failures gracefully
- Cache results when possible

### User Warnings
Always display:
```
⚠️ This analysis is for informational purposes only.
Not financial advice. Always DYOR (Do Your Own Research).
```

## 📈 Future Enhancements

Potential improvements:
- [ ] Historical price charts
- [ ] Token holder analytics
- [ ] Social sentiment analysis
- [ ] Price alerts/notifications
- [ ] Multi-chain support (beyond Base)
- [ ] Portfolio tracking
- [ ] DEX trade execution integration
- [ ] Token comparison tool

## 🐛 Troubleshooting

### Token Not Found
**Issue**: "Token not found" error

**Solutions**:
1. Try contract address instead of name/symbol
2. Check if token exists on supported chains
3. Verify spelling (case-sensitive)
4. Token might be too new/small for CoinGecko

### Rate Limiting
**Issue**: 429 errors from CoinGecko

**Solutions**:
1. Add `COINGECKO_API_KEY` for higher limits
2. Implement caching (Redis/memory)
3. Reduce refresh frequency
4. Use batch endpoints for multiple tokens

### Stale Data
**Issue**: Price data seems outdated

**Solutions**:
1. Check API response timestamps
2. Verify auto-refresh is working
3. Clear browser cache
4. Check if API is down (status page)

## 📚 API Reference

### `getTokenData(identifier: string)`
Main function to fetch token data.

**Parameters:**
- `identifier`: Token name, symbol, or contract address

**Returns:** `TokenInfo | null`

**Example:**
```typescript
const eth = await getTokenData('ethereum');
const usdc = await getTokenData('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
```

### `searchTokens(query: string, limit?: number)`
Search for tokens by keyword.

**Parameters:**
- `query`: Search term
- `limit`: Max results (default: 10)

**Returns:** `TokenInfo[]`

### `formatTokenDisplay(token: TokenInfo)`
Format token data for display.

**Returns:** Markdown-formatted string

## 🤝 Contributing

When adding new token data sources:

1. Add new fetch function in `src/lib/token-data.ts`
2. Implement format converter
3. Update fallback chain in `getTokenData()`
4. Add tests for new provider
5. Document rate limits and API keys

## 📄 License

Part of HomieHouse project. See main LICENSE file.
