# Homiehouse MCP Server 🏠

A Model Context Protocol (MCP) server that acts as your friendly Farcaster assistant. Get AI-powered insights on casts, understand the ecosystem, and receive helpful suggestions - like having a knowledgeable friend explain Farcaster to you.

## Features

🤖 **AI-Powered Insights**: Claude analyzes casts and provides friendly, contextual explanations

📱 **Farcaster Ecosystem Expert**: Understands frames, channels, SnapChain, Warpcast, and community dynamics

🔍 **Comprehensive Tools**:
- `get_cast_details` - Deep dive into specific casts with AI commentary
- `read_feed` - Scan your feed with smart summaries
- `get_user_profile` - Learn about Farcaster users
- `search_casts` - Find and analyze casts by keyword
- `explain_cast` - Get detailed explanations and action suggestions

## Setup

### 1. Install Dependencies

```bash
cd mcp-server
npm install
```

### 2. Configure Environment

Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
NEYNAR_API_KEY=your_neynar_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
USER_FID=your_farcaster_fid
```

You can use the same keys from your main `.env.local` file!

### 3. Build

```bash
npm run build
```

### 4. Add to Claude Desktop

Edit your Claude Desktop config file:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

Add this configuration:

```json
{
  "mcpServers": {
    "homiehouse": {
      "command": "node",
      "args": ["C:\\Users\\amand\\homiehouse\\mcp-server\\dist\\index.js"]
    }
  }
}
```

*Note: Update the path to match your actual location*

### 5. Restart Claude Desktop

After restarting, you'll see the 🔨 tool icon - your Farcaster assistant is ready!

## Usage Examples

Once connected, you can ask Claude things like:

- "What's happening in my Farcaster feed?"
- "Explain this cast to me: [cast URL]"
- "Search for casts about SnapChain"
- "Tell me about user @dwr"
- "What should I know about the /base channel?"
- "Should I engage with this cast?"

Claude will use the MCP tools to fetch data from Farcaster and provide friendly, insightful responses.

## Tools Reference

### get_cast_details
Get detailed information and AI insights about a specific cast.

**Parameters:**
- `identifier` (string): Cast hash or Warpcast URL

**Example:**
```
Tell me about this cast: https://warpcast.com/dwr/0x123abc
```

### read_feed
Read and analyze your Farcaster feed.

**Parameters:**
- `feed_type` (string): "following", "global", or "channel"
- `channel` (string, optional): Channel ID like "base" or "farcaster"
- `limit` (number, optional): Number of casts (default: 10, max: 25)
- `get_insights` (boolean, optional): Generate AI insights (default: true)

**Example:**
```
What's trending in the /base channel?
```

### get_user_profile
Get information about a Farcaster user.

**Parameters:**
- `identifier` (string): FID or username (without @)

**Example:**
```
Tell me about user dwr
```

### search_casts
Search for casts and get insights.

**Parameters:**
- `query` (string): Search query
- `limit` (number, optional): Number of results (default: 10, max: 25)

**Example:**
```
Find casts about Ethereum L2s
```

### explain_cast
Get a detailed explanation of a cast with action suggestions.

**Parameters:**
- `cast_hash` (string): Cast hash

**Example:**
```
Explain this cast and tell me what I should do: 0x123abc...
```

## Development

**Watch mode** (rebuilds on changes):
```bash
npm run dev
```

**Debug mode**:
```bash
npm run inspector
```

## Farcaster Concepts

The AI assistant understands these key concepts:

- **Frames**: Interactive apps in casts (buttons, forms, games)
- **Channels**: Topic communities (e.g., /base, /farcaster, /degen)
- **SnapChain**: Photo-sharing game on Farcaster
- **Power Badge** (🔵): Verification for quality users
- **Moxie**: Social reputation token
- **Degen**: Community token for /degen channel
- **Higher**: Aspirational community/token

## Troubleshooting

**"Missing required environment variables"**
→ Make sure `.env` has `NEYNAR_API_KEY` and `ANTHROPIC_API_KEY`

**Claude Desktop doesn't show tools**
→ Check config file path and syntax, restart Claude Desktop

**"Failed to fetch cast"**
→ Verify your Neynar API key is valid

## Architecture

```
mcp-server/
├── src/
│   └── index.ts          # Main MCP server with tools
├── dist/                 # Compiled JavaScript
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
└── .env                  # Your credentials
```

The server uses:
- **@modelcontextprotocol/sdk** for MCP protocol
- **@neynar/nodejs-sdk** for Farcaster data
- **@anthropic-ai/sdk** for Claude AI insights

## License

MIT
