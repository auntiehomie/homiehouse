/**
 * Static knowledge base for Ask Homie.
 * Each topic has keywords (for detection) and content (injected into the LLM context).
 * Keep entries concise — they go directly into the context window.
 */

export interface KnowledgeTopic {
  id: string;
  title: string;
  keywords: string[];
  content: string;
}

export const KNOWLEDGE_TOPICS: KnowledgeTopic[] = [
  {
    id: 'farcaster_protocol',
    title: 'Farcaster Protocol',
    keywords: [
      'farcaster', 'cast', 'warpcast', 'fid', 'hub', 'channel', 'frame',
      'mini app', 'miniapp', 'neynar', 'signer', 'snapchain', 'hubs', 'merkle',
      'farcaster id', 'custody address', 'key registry', 'reaction', 'recast',
      'follow', 'direct cast', 'dc', 'notification', 'embed', 'parent cast',
    ],
    content: `
Farcaster is a sufficiently decentralized social network protocol built by Dan Romero and Varun Srinivasan.

## Identity
- **FID (Farcaster ID)**: A unique integer registered on-chain (Optimism). Your permanent identity — it never changes even if your username does.
- **Username**: A human-readable handle (e.g. @dwr.eth). Stored off-chain by Warpcast; can be changed.
- **Custody Address**: An Ethereum wallet that owns your FID. Changing it is possible but deliberate.
- **Signers**: Ed25519 keypairs authorized by your custody address to sign casts and actions on your behalf. Apps like Warpcast or HomieHouse create a signer when you connect.
- **Key Registry**: An Optimism smart contract that tracks which signers are valid for each FID.

## Content
- **Casts**: Posts up to 320 characters. Can include text, images, links, and embeds. Stored on Farcaster Hubs.
- **Reactions**: Likes and recasts. Stored on hubs, not on-chain.
- **Threads**: Casts replying to other casts form conversation threads via parent_hash references.
- **Embeds**: URLs or cast hashes embedded in a cast. Clients render previews for images, links, and frames.
- **Direct Casts (DCs)**: Encrypted 1:1 or group messages. Server is currently operated by Warpcast/Merkle.

## Infrastructure
- **Hubs**: Nodes that replicate and store all Farcaster messages. Anyone can run one. Examples: Hypersnap (haatz.quilibrium.com), Neynar's hubs, Merkle's hubs.
- **Snapchain**: The current hub protocol — a DAG-based consensus replacing the original Merkle-tree approach. Faster sync, better conflict resolution.
- **Consensus**: Hubs gossip messages peer-to-peer. There is no global ordering of casts (unlike a blockchain) — hubs converge on the same state eventually.

## Channels
- Topic-scoped feeds like /ethereum, /ai, /privacy, /base.
- Membership stored on-chain (Base). Anyone can join; channel hosts can moderate.
- Casts can be posted "into" a channel by including the channel URL as a parent.
- Popular channels: /farcaster, /ethereum, /base, /degen, /higher, /nouns, /art, /devs.

## Frames & Mini Apps
- **Frames**: Interactive buttons/images embedded in casts. A cast can become a mini-app: voting, minting, games.
- **Mini Apps**: Full web apps launched inside the Farcaster client using the Mini Apps SDK. Can request wallet connections, send transactions, read user data.
- **Frame validator**: Warpcast and others validate frame metadata (fc:frame tags) before rendering.

## Key Players
- **Warpcast**: Main client by Merkle Manufactory (the Farcaster core team). iOS, Android, web.
- **Neynar**: Developer API platform — makes building on Farcaster easy. Widely used.
- **Supercast, Herocast, Yup, Jam**: Alternative Farcaster clients with different UX focuses.
- **Hypersnap**: Open-source Farcaster hub implementation. Runs a full hub node, exposes search API.

## Economics
- **Warps**: Tipping currency inside Warpcast. Not a token — stored off-chain by Warpcast. Used to tip and boost casts.
- **Storage Units**: You must purchase storage (rent) to write to Farcaster. 1 storage unit = ~5,000 casts + 2,500 reactions. Priced in ETH, paid on Optimism.
- **FID registration**: Costs a small ETH amount on Optimism. One-time fee.
`,
  },
  {
    id: 'getting_started_farcaster',
    title: 'Getting Started on Farcaster',
    keywords: [
      'how to join', 'how to get started', 'new to farcaster', 'sign up', 'register',
      'get a fid', 'create account', 'onboard', 'first cast', 'find people',
      'who to follow', 'invite', 'invite code', 'invites',
    ],
    content: `
## How to join Farcaster

1. **Download Warpcast** (iOS or Android) or go to warpcast.com
2. **Create an account** — you'll need a phone number for spam prevention
3. **Pay the storage fee** — a small ETH amount (~$5-10 at typical prices) on Optimism or Base. Warpcast abstracts this.
4. **Your FID is minted** on Optimism automatically
5. **Start casting** — your first cast, follows, and reactions are free once storage is bought

## Finding people to follow
- Check popular channels: /farcaster, /ethereum, /base, /ai, /privacy
- Look at who the people you follow interact with
- Search for topics you care about
- Neynar's social graph API surfaces mutual follows and power users

## Key things to know as a new user
- Your username is NOT your identity — your FID is. You can change your username anytime.
- Your social graph (follows, followers) is portable. If Warpcast shuts down, you can take it to another client.
- Casts are public by default and permanent (stored on hubs).
- You can delete a cast but hubs may retain it; treat it as permanent.
- "Channels" are like subreddits/hashtags. Cast into them to reach that community.

## HomieHouse as an onboarding client
- HomieHouse lets you browse the Farcaster feed, view profiles, and compose casts
- Connect your Farcaster account via the AuthKit flow (sign in with Farcaster)
- Ask Homie (this chat) can help you understand anything you see in your feed
`,
  },
  {
    id: 'ethereum_ecosystem',
    title: 'Ethereum & Layer 2s',
    keywords: [
      'ethereum', 'eth', 'l2', 'layer 2', 'optimism', 'base', 'arbitrum', 'zksync', 'polygon',
      'evm', 'smart contract', 'solidity', 'gas', 'wei', 'gwei', 'eip', 'proof of stake',
      'merge', 'beacon chain', 'defi', 'uniswap', 'aave', 'rollup', 'blob', 'eip-4844',
      'transaction', 'block', 'validator', 'staking', 'wallet', 'metamask', 'rainbow',
    ],
    content: `
Ethereum is the leading programmable blockchain — a global decentralized computer that runs smart contracts.

## Core concepts
- **Smart Contracts**: Programs deployed on Ethereum. Once deployed, they run exactly as written — no one can alter them (unless they built in an upgrade mechanism).
- **Gas**: The fee for computation. Paid in ETH, denominated in gwei (1 gwei = 0.000000001 ETH). Gas = units of computation × price per unit.
- **Transactions**: Every state change (send ETH, call a contract, mint an NFT) is a transaction signed by your private key.
- **Blocks**: Transactions are batched into blocks ~every 12 seconds. Each block references the previous one — that's the chain.
- **Proof of Stake (PoS)**: Ethereum's consensus since "The Merge" (Sept 2022). Validators lock up (stake) 32 ETH to propose and attest to blocks. Energy use dropped ~99.95%.
- **Wallets**: Software that manages private keys. MetaMask, Rainbow, Rabby are popular browser/mobile wallets. Ledger/Trezor are hardware wallets.

## Layer 2s (L2s)
L2s are networks that inherit Ethereum's security but batch transactions off-chain, posting only a summary to Ethereum. Result: 10-100x lower fees, faster confirmations.

### How rollups work
1. Users transact on the L2
2. The L2 sequencer batches hundreds of transactions
3. The batch is posted to Ethereum mainnet as calldata or a blob
4. Ethereum validators verify the batch (either via fraud proofs or ZK proofs)

### Major L2s
- **Optimism (OP)**: Optimistic rollup. Used by Farcaster's ID Registry and Key Registry. Has its own governance token (OP) and the "Superchain" vision.
- **Base**: L2 by Coinbase, built on the OP Stack. No native token. Home to much of Farcaster/crypto culture. Very low fees. Where Degen, Moxie, and many Farcaster tokens live.
- **Arbitrum**: Optimistic rollup, dominant in DeFi (GMX, Camelot, etc). Has its own ARB governance token.
- **zkSync**: Zero-knowledge rollup from Matter Labs. Uses ZK proofs for near-instant finality.
- **Starknet**: ZK rollup from StarkWare. Uses Cairo (custom language), powerful for gaming/high-throughput apps.
- **Polygon**: Started as a sidechain (different security model), now transitioning to a ZK validity rollup (Polygon zkEVM).

## EIP-4844 (Proto-Danksharding)
Introduced "blobs" — cheap temporary data storage for L2s. Cut L2 fees by 10-100x when launched in 2024. Blobs are pruned after ~18 days; permanent data still goes to calldata.

## DeFi (Decentralized Finance)
- **Uniswap**: Largest decentralized exchange. Uses AMM (automated market maker) — no order book, just liquidity pools.
- **Aave / Compound**: Lending and borrowing protocols. Supply assets to earn interest; borrow against collateral.
- **Curve**: AMM optimized for stablecoins and pegged assets (low slippage).
- **Lido**: Liquid staking — stake ETH, receive stETH that accrues rewards while remaining liquid.
- **Pendle**: Yield trading — split yield-bearing tokens into principal and yield components.

## Farcaster on Ethereum
- FID registration: Optimism (ID Registry contract)
- Signer authorization: Optimism (Key Registry contract)
- Storage rental: Optimism (Storage Registry contract)
- Farcaster tokens (Degen, Moxie, etc.): mostly on Base
`,
  },
  {
    id: 'decentralization',
    title: 'Decentralization & Web3',
    keywords: [
      'decentralized', 'decentralization', 'web3', 'sovereignty', 'dao', 'governance',
      'public goods', 'gitcoin', 'censorship resistance', 'permissionless', 'trustless',
      'open source', 'protocol', 'coordination', 'commons', 'retroPGF', 'optimism governance',
      'self sovereign', 'portable', 'open protocol', 'interop',
    ],
    content: `
Decentralization means distributing control so no single party can censor, shut down, or extract rent from a system.

## Core principles
- **Permissionless**: Anyone can participate without approval — run an Ethereum node, build on Farcaster, deploy a contract. No gatekeepers.
- **Trustless**: Rules are enforced by math and code, not promises. You don't need to trust a company to honor their terms.
- **Censorship Resistance**: No government or company can block your transactions or delete your data from a truly decentralized system.
- **Self-Sovereignty**: Own your private keys → own your assets and identity. "Not your keys, not your coins."
- **Portability**: Your Farcaster social graph lives on-chain. If your client disappears, you can take your followers/follows to another client.
- **Interoperability**: Open protocols allow any developer to build clients, tools, or extensions. Farcaster has 10+ clients, 100s of apps.

## "Sufficiently Decentralized" (Farcaster's thesis)
Farcaster doesn't claim to be maximally decentralized. It claims to be decentralized *enough* that:
- No single entity can shut it down
- Users can always switch clients without losing their social graph
- Core protocol rules can't be changed unilaterally
Warpcast (the client) is centralized; Farcaster (the protocol) is not. The distinction matters.

## DAOs (Decentralized Autonomous Organizations)
Organizations governed by token holders via on-chain voting.

How they work:
1. Token holders submit proposals
2. Voting period (usually 5-7 days)
3. If quorum + threshold met, proposal executes automatically on-chain

Examples:
- **Uniswap DAO**: Controls the Uniswap protocol treasury and fee switches
- **Optimism Collective**: Two-chamber governance (Token House + Citizens' House). Funds public goods via RetroPGF.
- **Nouns DAO**: One Noun NFT auctioned every day. Proceeds go to the DAO treasury. Nouns holders vote.
- **ENS DAO**: Governs the Ethereum Name Service (.eth domains)

Challenges: voter apathy, plutocracy (whale voters dominate), slow decision-making, governance attacks.

## Public Goods Funding
- **Gitcoin Grants**: Quadratic funding — community donations are matched by a pool. Many small donors = more match than one large donor. Rewards breadth of support.
- **RetroPGF (Optimism)**: Retroactive public goods funding. Rewards projects that have *already* proven their value. "Impact = profit" philosophy.
- **Protocol Guild**: Funds Ethereum core developers directly via a vesting contract. ~170 contributors.

## Web1 → Web2 → Web3
- **Web1** (1990s–2000s): Read-only. Static pages. You consumed content.
- **Web2** (2000s–2020s): Read-write. Social media, UGC. Platforms own your data and monetize it.
- **Web3** (2020s–): Read-write-own. Users own their data, identity, assets. Platforms compete for users they can't lock in.

Farcaster is Web3 social: your account, follows, and content belong to you — not to Warpcast.
`,
  },
  {
    id: 'privacy',
    title: 'Privacy & Cryptography',
    keywords: [
      'privacy', 'zk', 'zero knowledge', 'zk proof', 'zkp', 'encryption', 'e2e',
      'end to end', 'self custody', 'private key', 'seed phrase', 'mnemonic', 'signal',
      'tornado', 'mixer', 'stealth address', 'zcash', 'monero', 'semaphore', 'worldcoin',
      'anonymous', 'pseudonymous', 'onchain identity', 'wallet privacy',
    ],
    content: `
Privacy in Web3 combines cryptography with decentralization to give users control over what they reveal and to whom.

## Zero-Knowledge Proofs (ZKPs)
A ZKP lets you prove you know something (or that a statement is true) without revealing the underlying data.

Classic example: Prove you're over 18 without revealing your birthdate or name.

Farcaster example: Prove you're a Farcaster user without revealing which account — used in anonymous voting or private attestations.

### Types of ZKPs
- **zk-SNARKs**: Succinct, non-interactive. Small proof size, fast to verify. Used by Zcash, Aztec, many L2s. Requires a "trusted setup" ceremony.
- **zk-STARKs**: Transparent (no trusted setup), post-quantum secure, but larger proofs. Used by StarkNet.
- **PLONK**: Universal trusted setup (one ceremony for all circuits). Used by many modern ZK projects.
- **Groth16**: Very fast verify, small proofs. Used by Zcash, Tornado Cash.

### ZK applications on Farcaster
- **Semaphore**: ZK group membership — prove you're in a set (e.g. Farcaster users) without revealing which member. Used in anonymous polls and attestations.
- **Zupass**: ZK identity system used at Zuzalu/FarCon. Prove you attended an event without revealing your name.
- **ZK frames**: Frames that verify credentials (e.g. "prove you hold X NFT") without exposing wallet address.

## Self-Custody & Key Management
- **Private key**: A random 256-bit number. Whoever has it controls the wallet. Never share it.
- **Seed phrase (BIP-39 mnemonic)**: 12 or 24 words that can regenerate all keys in a wallet. Write it on paper, store offline.
- **Hardware wallets**: Ledger, Trezor, GridPlus. Store private keys on a dedicated device. Never exposed to the internet.
- **Smart contract wallets**: Safe (Gnosis Safe), Argent. Multisig or social recovery. More flexible but require on-chain transactions.

Rule: "Not your keys, not your coins." If an exchange holds your assets, they can freeze, lose, or get hacked.

## Privacy tools
- **Tornado Cash**: Ethereum mixing protocol for transaction privacy. Sanctioned by OFAC in Aug 2022; developer Roman Storm arrested. Still functional on-chain but legally risky in the US.
- **Stealth Addresses (ERC-5564)**: One-time addresses generated per payment. Sender and receiver are unlinkable on-chain.
- **Railgun**: ZK shielded pool on Ethereum/Polygon/BSC. Lets you transact privately without leaving the EVM.
- **Zcash (ZEC)**: Privacy-focused blockchain. Shielded transactions hide sender, receiver, and amount using zk-SNARKs.
- **Monero (XMR)**: Privacy coin using ring signatures + stealth addresses. All transactions are private by default.
- **Signal Protocol**: Gold standard for E2E encrypted messaging. Used by Signal, WhatsApp, and optionally in others.

## Farcaster & Privacy
- **Casts are public** by default. Stored on open hubs, readable by anyone.
- **Direct Casts (DCs)**: Encrypted between sender and receiver, but Warpcast/Merkle operates the relay server. Private from the public, but not from Warpcast.
- **Pseudonymity**: You can use Farcaster pseudonymously (no real name required) but your on-chain custody address is public and may link to other activity.
- **Future**: Community exploring ZK-based private channels and anonymous attestations via Semaphore.
`,
  },
  {
    id: 'ai_web3',
    title: 'AI & Decentralized Intelligence',
    keywords: [
      'ai', 'artificial intelligence', 'llm', 'large language model', 'gpt', 'claude', 'llama',
      'mistral', 'ollama', 'open source ai', 'bittensor', 'gensyn', 'agent', 'ai agent',
      'autonomous', 'groq', 'inference', 'decentralized ai', 'open ai', 'anthropic',
      'fine tune', 'embedding', 'vector', 'rag', 'retrieval', 'context window',
    ],
    content: `
AI and Web3 are converging — open-source models, decentralized compute networks, and on-chain agents are reshaping both fields.

## Open Source vs Closed Models
- **OpenAI (GPT-4o, o1)**: Closed, API-only. Industry-leading capabilities. Requires paying OpenAI.
- **Anthropic (Claude)**: Closed, API-only. Strong reasoning, long context. Powers HomieHouse's Ask Homie.
- **Meta Llama 3.1/3.3**: Open-weight. 8B runs on a laptop; 70B needs a GPU server; 405B needs a cluster. Competitive with GPT-4 at 70B.
- **Mistral**: French AI company. Mistral 7B (fast, small), Mixtral 8x7B (MoE), Mistral Large (frontier). Open weights.
- **Gemma (Google)**: Open-weight from Google. Good for fine-tuning.
- **Phi (Microsoft)**: Small but capable models. Phi-3-mini runs on a phone.

## Running Models Locally
- **Ollama**: Run LLMs locally on Mac/Linux/Windows. One-line install, supports Llama, Mistral, Phi, Gemma. OpenAI-compatible API at localhost:11434.
- **LM Studio**: Desktop GUI for running local models. Easier for non-technical users.
- **vLLM**: Production-grade inference server. Optimized for GPU throughput. Used in self-hosted deployments.

## Fast Cloud Inference
- **Groq**: Ultra-fast inference on custom LPU chips. Free tier available. Supports Llama 3.3 70B, Mixtral. 500+ tokens/sec.
- **Together.ai**: Runs many open-source models. Pay-per-token.
- **Replicate**: Run any ML model via API. Good for image models too.
- **Fireworks.ai**: Fast inference, supports function calling with open models.

## Decentralized AI Infrastructure
- **Bittensor (TAO)**: Decentralized network where miners compete to produce the best AI responses. Validators score outputs. Token rewards for quality. Think: crypto incentives for AI compute.
- **Gensyn**: Decentralized compute network for training ML models. Uses a verification protocol to trustlessly prove training happened correctly.
- **Akash**: Decentralized cloud compute marketplace. Can run AI inference cheaper than AWS.
- **Ritual**: AI coprocessor for smart contracts. Smart contracts can call AI models on-chain. Enables "AI-powered DeFi."
- **Grass**: Decentralized web scraping network. Users earn tokens by sharing bandwidth for AI training data collection.

## RAG (Retrieval-Augmented Generation)
How Ask Homie works: instead of just asking the LLM a question cold, we first retrieve relevant context (from the knowledge base + live Farcaster casts via Hypersnap), then include that context in the prompt. The LLM reasons over real, current information rather than just its training data.

## AI Agents on Farcaster
- Bots are active citizens on Farcaster: analytics bots, AI reply guys, cast schedulers.
- Frames can integrate AI: a frame calls an LLM when a user taps a button.
- AI-curated feeds: models rank or filter your feed based on your interests.
- On-chain agents: autonomous agents that hold wallets, execute transactions, respond to events.

## Key tension
Centralized AI (OpenAI, Anthropic) vs. open-source ecosystem (Meta Llama, Mistral). The Web3/Farcaster community strongly favors open-source for sovereignty and censorship-resistance reasons.
`,
  },
  {
    id: 'crypto_culture',
    title: 'Crypto Culture & Ecosystem',
    keywords: [
      'nft', 'defi', 'degen', 'based', 'onchain', 'meme', 'airdrop', 'token', 'dao',
      'gm', 'wagmi', 'ngmi', 'lfg', 'alpha', 'degen score', 'higher', 'moxie', 'farcon',
      'yaps', 'kaito', 'nouns', 'purple', 'farcaster ecosystem', 'farcaster tokens',
    ],
    content: `
Crypto culture has developed its own vocabulary, norms, and community rituals. Fluency helps you navigate Farcaster.

## Common slang
- **gm / gn**: Good morning / good night. A daily community greeting ritual. Earnest and ironic at the same time.
- **wagmi / ngmi**: "We're all gonna make it" / "not gonna make it." Optimism vs. writing someone off.
- **degen**: Short for degenerate — someone who takes high-risk bets, apes into new tokens, chases yields. Used affectionately.
- **ape in**: To buy into something quickly without much research.
- **alpha**: Exclusive or early information about a profitable opportunity. "Dropping alpha" = sharing an edge.
- **based**: Being authentic, not caring about others' approval. Also: related to the Base L2.
- **onchain**: Doing things with crypto / on a blockchain. "Fully onchain" = no centralized components.
- **LFG**: "Let's f***ing go!" — expression of excitement/hype.
- **rekt**: Wrecked — lost money on a trade or got liquidated.
- **ser**: "Sir" — ironic/formal address. "Ser, this is a Wendy's."
- **fren**: "Friend" — warm, ironic community term.
- **CT**: Crypto Twitter (now Crypto X). The broader crypto conversation on Twitter/X.
- **FC**: Farcaster.

## Farcaster-specific tokens & culture
- **Moxie**: Social token protocol on Farcaster and Base. Creators earn Moxie tokens based on engagement. Fans can buy "Fan Tokens" of their favorite casters.
- **Degen (DEGEN)**: A memecoin on Base that became deeply woven into Farcaster culture. Users tip each other "degens" in casts. High speculation, strong community identity.
- **Higher**: Community/movement on Farcaster about optimism, positive vibes, and "going higher." Associated with the Higher token and the /higher channel.
- **FarCon**: Annual Farcaster in-person conference. Highly attended by the core community.
- **Yaps (Kaito)**: Attention scoring system for Farcaster activity. Tracks mindshare and influence. Used by projects to reward engaged community members.
- **Purple**: Nouns-style DAO on Farcaster. Members hold Purple NFTs and fund Farcaster ecosystem projects.
- **Warps**: Tipping currency inside Warpcast. Not a token. Used to tip casters and boost visibility.

## NFTs
- Digital ownership certificates on a blockchain. Proved that digital scarcity is real and culturally valuable.
- **ERC-721**: Standard NFT contract — each token is unique.
- **ERC-1155**: Multi-token standard — can have fungible + non-fungible in one contract. Used for gaming items.
- Key historic projects: **CryptoPunks** (first NFT culture), **Bored Apes (BAYC)** (community + IP), **Nouns** (daily auction, DAO treasury), **Art Blocks** (generative art on-chain).
- On Farcaster: Nouns has a very strong community presence. Many casters collect and discuss NFTs daily.

## Airdrops
Free token distributions to early users or holders of a related asset. Used to bootstrap communities and reward early believers.
- Famous: Uniswap's UNI airdrop (400 UNI to every past user), ENS airdrop, Optimism OP airdrop.
- Strategy: "farming" — using protocols specifically to qualify for future airdrops.
- Risk: sybil detection (projects filter fake/duplicate wallets) and regulatory uncertainty.

## Memecoins
Tokens with no fundamental utility — value is purely social/cultural consensus. High risk, high community energy.
- Degen, Higher, Moxie (Farcaster-native)
- PEPE, WIF, BONK, BRETT (broader crypto)
- Can 100x or go to zero. Community and narrative matter more than fundamentals.
`,
  },
  {
    id: 'wallets_onchain',
    title: 'Wallets, Transactions & On-Chain Activity',
    keywords: [
      'wallet', 'metamask', 'rainbow', 'coinbase wallet', 'rabby', 'safe', 'multisig',
      'send eth', 'transfer', 'approve', 'allowance', 'bridge', 'swap', 'mint',
      'nonce', 'pending transaction', 'stuck transaction', 'gas price', 'priority fee',
      'base fee', 'eip-1559', 'rpc', 'infura', 'alchemy', 'drainer', 'phishing',
    ],
    content: `
## Types of wallets
- **EOA (Externally Owned Account)**: A wallet controlled by a private key. MetaMask, Rainbow, Rabby. Simple, widely supported.
- **Smart contract wallet**: Controlled by code — Safe (multisig), Argent (social recovery), Coinbase Smart Wallet. More features, slightly more complexity.
- **Hardware wallet**: Ledger, Trezor, GridPlus Lattice. Private key never leaves the device. Best security for large holdings.
- **MPC wallet**: Private key split between you and a provider (e.g. Privy, Turnkey). More user-friendly recovery, some trust tradeoffs.

## How transactions work (EIP-1559)
Since the London hard fork, Ethereum transactions have:
- **Base fee**: Set by the network, burned (not paid to miners). Adjusts based on block fullness.
- **Priority fee (tip)**: Goes to the validator. You set this to get included faster.
- **Max fee**: The maximum you'll pay per gas. If base + priority > max, transaction waits.

Gas price = base fee + priority fee. You pay: gas used × gas price. Unused gas is refunded.

## Common transaction types
- **ETH transfer**: Send ETH from one address to another. ~21,000 gas.
- **ERC-20 transfer**: Send a token. ~65,000 gas.
- **Approve**: Allow a contract to spend your tokens. Required before most DeFi interactions.
- **Swap**: Exchange tokens via a DEX like Uniswap. ~120,000–200,000 gas.
- **Mint**: Create a new NFT. Gas varies widely.
- **Bridge**: Move assets between L1 and L2, or between two L2s. Usually 15 min–7 days depending on method.

## Stuck transactions
If your transaction is pending for too long:
1. Check if gas price is too low (compare to current network rates on etherscan)
2. Send a new transaction with the same nonce but higher gas price ("speed up" or "cancel" in MetaMask)
3. A cancel transaction sends 0 ETH to yourself with the same nonce + higher gas

## Security — avoiding scams
- **Approval drainers**: Malicious contracts that ask for unlimited token approval, then drain your wallet. Always check what you're approving. Use Revoke.cash to revoke old approvals.
- **Phishing**: Fake sites that look like Uniswap/OpenSea/MetaMask. Always verify the URL. Bookmark real sites.
- **Seed phrase requests**: No legitimate app ever asks for your seed phrase. If something asks, it's a scam.
- **Social engineering**: DMs offering "support" or "opportunities" are almost always scams.
- **Contract verification**: Before interacting with a new contract, check it on Etherscan. Is it verified? Is it audited?

## Useful tools
- **Etherscan / Basescan / Optimistic.etherscan**: Block explorers. See any transaction, wallet, or contract.
- **Revoke.cash**: See and revoke token approvals.
- **Zapper / Zerion / DeBank**: Portfolio trackers. See all your assets across chains.
- **Alchemy / Infura**: RPC providers. Your wallet uses one of these to talk to the blockchain.
`,
  },
];

/** Return relevant knowledge snippets for a given question */
export function getRelevantKnowledge(question: string): { topics: string[]; content: string } {
  const q = question.toLowerCase();
  const matched: KnowledgeTopic[] = [];

  for (const topic of KNOWLEDGE_TOPICS) {
    if (topic.keywords.some(kw => q.includes(kw))) {
      matched.push(topic);
    }
  }

  if (matched.length === 0) return { topics: [], content: '' };

  const topics = matched.map(t => t.id);
  const content = matched
    .slice(0, 3) // cap at 3 topics to avoid overflowing context
    .map(t => `## ${t.title}\n${t.content.trim()}`)
    .join('\n\n---\n\n');

  return { topics, content };
}

/** Suggested starter questions for the UI */
export const SUGGESTED_QUESTIONS = [
  { label: 'What is Farcaster?', topic: 'farcaster' },
  { label: 'How do I get started?', topic: 'getting_started' },
  { label: 'How do L2s work?', topic: 'ethereum' },
  { label: 'What are ZK proofs?', topic: 'privacy' },
  { label: 'Explain decentralization', topic: 'decentralization' },
  { label: 'AI + Web3?', topic: 'ai' },
  { label: 'What is a FID?', topic: 'farcaster' },
  { label: 'What is Base?', topic: 'ethereum' },
  { label: 'Self-custody explained', topic: 'privacy' },
  { label: 'What is Degen?', topic: 'crypto_culture' },
];
