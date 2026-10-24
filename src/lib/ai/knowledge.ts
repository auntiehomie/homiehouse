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
    id: 'homiehouse',
    title: 'What is Homiehouse?',
    keywords: ['homiehouse', 'homie house', 'hypersnap'],
    content: `Homiehouse is a Hypersnap client that helps people learn about the ideas and technology behind topics discussed in casts. Its learning scope includes AI, crypto, Web3, decentralization, privacy, encryption, and decentralized social. Ask Homie helps explain unfamiliar concepts in plain English.
An open protocol, its clients, and its infrastructure operators are distinct. Open participation does not mean nobody owns the companies, apps, or infrastructure involved. Discuss control, governance, moderation, data portability, and dependencies separately rather than promising absolute ownership or censorship resistance.`,
  },
  {
    id: 'decentralized_social',
    title: 'Decentralized Social',
    keywords: ['decentralized social', 'federation', 'federated', 'activitypub', 'social graph', 'portable identity'],
    content: `Decentralized social distributes some control over identity, content, or hosting across participants. Different designs include federation and shared protocols. Evaluate who operates servers, controls keys, moderates content, and can change rules. Account and social-graph portability depend on the protocol and available clients. Public casts are not private messages; decentralization alone does not provide confidentiality.`,
  },
  {
    id: 'encryption',
    title: 'Encryption Basics',
    keywords: ['encryption', 'encrypt', 'ciphertext', 'end-to-end', 'end to end', 'e2ee'],
    content: `Encryption turns readable data into ciphertext using cryptographic keys. Encryption in transit protects a connection; encryption at rest protects stored data. End-to-end encryption keeps message decryption keys with the intended endpoints, so a relay should store ciphertext without being able to read message contents. Metadata may still be visible. Recipient verification, key recovery, and multi-device access affect security. Digital signatures establish authenticity and integrity; they do not hide content. Public casts are not end-to-end encrypted.`,
  },
  {
    id: 'farcaster_protocol',
    title: 'Decentralized Social Protocols',
    keywords: [
      'decentralized social', 'cast', 'warpcast', 'fid', 'hub', 'channel', 'frame',
      'mini app', 'miniapp', 'signer', 'snapchain', 'hubs', 'merkle',
      'account id', 'custody address', 'key registry', 'reaction', 'recast',
      'follow', 'direct cast', 'dc', 'notification', 'embed', 'parent cast',
    ],
    content: `
Decentralized social protocols let multiple apps use shared identity, social graphs, and public posts. Their designs vary; check where data is stored, who operates infrastructure, and what users can move between apps.

## Identity and keys
- An account identifier can be separate from a changeable username.
- A custody wallet may authorize signing keys for routine actions without exposing its recovery phrase.
- A registry can record which keys are authorized for an account.

## Posts and conversations
- Posts may include text, images, links, replies, and interactive embeds.
- Likes, reposts, and replies are commonly distributed as signed messages.
- Public posts should be treated as public. Network replication can make deletion incomplete.
- Private messaging requires separate end-to-end encryption; public-feed storage does not make messages private.

## Infrastructure and portability
- Independent nodes can replicate and index messages. Running multiple operators can reduce reliance on one provider, though it does not guarantee decentralization by itself.
- Open protocols let different apps read or publish compatible activity, subject to protocol support and infrastructure access.
- Portability depends on the protocol, the user's keys, and whether other apps support the same data formats.
`,
  },
  {
    id: 'getting_started_farcaster',
    title: 'Getting Started with Decentralized Social',
    keywords: [
      'how to join', 'how to get started', 'new to decentralized social', 'sign up', 'register',
      'get a fid', 'create account', 'onboard', 'first cast', 'find people',
      'who to follow', 'invite', 'invite code', 'invites',
    ],
    content: `
## Getting started
1. Choose an app that supports the social protocol you want to use.
2. Review how account recovery and signing permissions work before connecting a wallet.
3. Set up a profile, follow people or topics, and explore public conversations.
4. Remember that public posts can be copied or retained by other network participants.

## Finding people and topics
- Search for subjects you care about and follow relevant accounts.
- Explore topic feeds or communities when the app offers them.
- Check which services host, index, and moderate the content you see.

## Key things to know
- A username may change while an account identifier stays the same.
- Portability varies by protocol and by the apps that support it.
- Public posts are not private messages. Use end-to-end encryption for confidential conversations.
- HomieHouse can help explain concepts you encounter in your feed.
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
- **Optimism (OP)**: Optimistic rollup. Some protocols use identity and key registries. Has its own governance token (OP) and the "Superchain" vision.
- **Base**: L2 by Coinbase, built on the OP Stack. No native token. Home to much of crypto social culture. Very low fees. Degen and Moxie are examples of social tokens.
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

## Decentralized Social on Ethereum
- FID registration: Optimism (ID Registry contract)
- Signer authorization: Optimism (Key Registry contract)
- Storage rental: Optimism (Storage Registry contract)
- Social tokens (such as Degen and Moxie): mostly on Base
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
- **Permissionless**: Anyone can participate without approval — run an Ethereum node, build on open social protocols, deploy a contract. No gatekeepers.
- **Trustless**: Rules are enforced by math and code, not promises. You don't need to trust a company to honor their terms.
- **Censorship Resistance**: No government or company can block your transactions or delete your data from a truly decentralized system.
- **Self-Sovereignty**: Own your private keys → own your assets and identity. "Not your keys, not your coins."
- **Portability**: A portable social graph can let you bring follows to another compatible app if one client disappears.
- **Interoperability**: Open protocols allow any developer to build clients, tools, or extensions. Open protocols can support many compatible apps and tools.

## The "Sufficiently Decentralized" Design Goal
A protocol may aim to be decentralized *enough* that:
- No single entity can shut it down
- Users can always switch clients without losing their social graph
- Core protocol rules can't be changed unilaterally
A client can be centralized even when the protocol it uses is open. The distinction matters.

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

Open social systems can make accounts, follows, and content portable across compatible apps.
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

An anonymous membership proof can show that a person belongs to a group without revealing which member they are.

### Types of ZKPs
- **zk-SNARKs**: Succinct, non-interactive. Small proof size, fast to verify. Used by Zcash, Aztec, many L2s. Requires a "trusted setup" ceremony.
- **zk-STARKs**: Transparent (no trusted setup), post-quantum secure, but larger proofs. Used by StarkNet.
- **PLONK**: Universal trusted setup (one ceremony for all circuits). Used by many modern ZK projects.
- **Groth16**: Very fast verify, small proofs. Used by Zcash, Tornado Cash.

### Zero-knowledge applications in social systems
- **Semaphore**: ZK group membership — prove you're in a set (e.g. members of a community) without revealing which member. Used in anonymous polls and attestations.
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

## Decentralized Social & Privacy
- **Casts are public** by default. Stored on open hubs, readable by anyone.
- **Direct Casts (DCs)**: Encrypted between sender and receiver, but Warpcast/Merkle operates the relay server. Private from the public, but not from Warpcast.
- **Pseudonymity**: You can use decentralized social networks pseudonymously (no real name required) but your on-chain custody address is public and may link to other activity.
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
How Ask Homie works: instead of just asking the LLM a question cold, we first retrieve relevant context (from the knowledge base + live public posts via Hypersnap), then include that context in the prompt. The LLM reasons over real, current information rather than just its training data.

## AI Agents in Decentralized Social
- Bots can participate in social networks as analytics bots, AI reply guys, cast schedulers.
- Frames can integrate AI: a frame calls an LLM when a user taps a button.
- AI-curated feeds: models rank or filter your feed based on your interests.
- On-chain agents: autonomous agents that hold wallets, execute transactions, respond to events.

## Key tension
Centralized AI (OpenAI, Anthropic) vs. open-source ecosystem (Meta Llama, Mistral). Web3 communities often favor open-source for sovereignty and censorship-resistance reasons.
`,
  },
  {
    id: 'crypto_culture',
    title: 'Crypto Culture & Ecosystem',
    keywords: [
      'nft', 'defi', 'degen', 'based', 'onchain', 'meme', 'airdrop', 'token', 'dao',
      'gm', 'wagmi', 'ngmi', 'lfg', 'alpha', 'degen score', 'higher', 'moxie', 'farcon',
      'yaps', 'kaito', 'nouns', 'purple', 'social network ecosystem', 'social network tokens',
    ],
    content: `
Crypto culture has developed its own vocabulary, norms, and community rituals. Fluency helps you navigate online communities.

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


## Social Tokens & Culture
- **Moxie**: Social token protocol used on Base and in online communities. Creators earn Moxie tokens based on engagement. Fans can buy "Fan Tokens" of their favorite casters.
- **Degen (DEGEN)**: A memecoin on Base that became deeply woven into decentralized social culture. Users tip each other "degens" in casts. High speculation, strong community identity.
- **Higher**: Community/movement on the social network about optimism, positive vibes, and "going higher." Associated with the Higher token and the /higher channel.
- **FarCon**: Annual in-person community conference. Highly attended by the core community.
- **Yaps (Kaito)**: Attention scoring system for online social activity. Tracks mindshare and influence. Used by projects to reward engaged community members.
- **Purple**: Nouns-style DAO with community members holding Purple NFTs and funding related projects.
- **Warps**: Tipping currency inside Warpcast. Not a token. Used to tip casters and boost visibility.

## NFTs
- Digital ownership certificates on a blockchain. Proved that digital scarcity is real and culturally valuable.
- **ERC-721**: Standard NFT contract — each token is unique.
- **ERC-1155**: Multi-token standard — can have fungible + non-fungible in one contract. Used for gaming items.
- Key historic projects: **CryptoPunks** (first NFT culture), **Bored Apes (BAYC)** (community + IP), **Nouns** (daily auction, DAO treasury), **Art Blocks** (generative art on-chain).
- In decentralized social communities, Nouns has a strong presence. Many casters collect and discuss NFTs daily.

## Airdrops
Free token distributions to early users or holders of a related asset. Used to bootstrap communities and reward early believers.
- Famous: Uniswap's UNI airdrop (400 UNI to every past user), ENS airdrop, Optimism OP airdrop.
- Strategy: "farming" — using protocols specifically to qualify for future airdrops.
- Risk: sybil detection (projects filter fake/duplicate wallets) and regulatory uncertainty.

## Memecoins
Tokens with no fundamental utility — value is purely social/cultural consensus. High risk, high community energy.
- Degen, Higher, Moxie (community-driven)
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
  { label: 'What is Homiehouse?', topic: 'homiehouse' },
  { label: 'How do I get started?', topic: 'getting_started' },
  { label: 'How do L2s work?', topic: 'ethereum' },
  { label: 'What are ZK proofs?', topic: 'privacy' },
  { label: 'Explain decentralization', topic: 'decentralization' },
  { label: 'AI + Web3?', topic: 'ai' },
  { label: 'How does decentralized social work?', topic: 'decentralized_social' },
  { label: 'How does encryption protect messages?', topic: 'encryption' },
  { label: 'What is Base?', topic: 'ethereum' },
  { label: 'Self-custody explained', topic: 'privacy' },
  { label: 'What is Degen?', topic: 'crypto_culture' },
];
