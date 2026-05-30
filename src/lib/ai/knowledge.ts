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
      'farcaster id', 'custody address', 'key registry',
    ],
    content: `
Farcaster is a sufficiently decentralized social network protocol built by Dan Romero and Varun Srinivasan.

Core concepts:
- **FID (Farcaster ID)**: A unique integer ID registered on-chain (Optimism). Your identity on Farcaster.
- **Casts**: Posts on Farcaster, up to 320 characters. Stored on Farcaster Hubs (off-chain, but anchored to chain state).
- **Hubs**: Nodes that replicate and store all Farcaster data. Anyone can run a hub. Hypersnap is one such hub.
- **Signers**: Ed25519 keypairs authorized by your custody address to write on your behalf (sign casts, reactions, etc.).
- **Channels**: Topic-scoped feeds, e.g. /ethereum, /ai, /privacy. Channel membership is stored on-chain.
- **Frames / Mini Apps**: Interactive apps embedded in casts. Mini Apps use the Farcaster Mini Apps SDK and can launch full web apps inside the Farcaster client.
- **Custody Address**: An Ethereum wallet that owns a FID. You can change it but not lose it without transferring.
- **Key Registry**: An Optimism smart contract that tracks which signers are authorized for each FID.
- **Warps**: Tipping currency native to Warpcast (not a token, stored off-chain by Warpcast).
- **Snapchain**: The latest Farcaster hub protocol using a DAG-based consensus. Replaces the original Merkle-based approach.
- **"Sufficiently decentralized"**: The Farcaster thesis — the network is open enough that no single entity can shut it down, even if clients like Warpcast are centralized.

Key players:
- Warpcast: The main Farcaster client, built by Merkle Manufactory (the Farcaster team).
- Neynar: Developer API platform for Farcaster. Makes building on Farcaster easier.
- Supercast, Herocast, Yup, Jam: Alternative Farcaster clients.
`,
  },
  {
    id: 'ethereum_ecosystem',
    title: 'Ethereum & Layer 2s',
    keywords: [
      'ethereum', 'eth', 'l2', 'layer 2', 'optimism', 'base', 'arbitrum', 'zksync', 'polygon',
      'evm', 'smart contract', 'solidity', 'gas', 'wei', 'gwei', 'eip', 'proof of stake',
      'merge', 'beacon chain', 'defi', 'uniswap', 'aave', 'rollup', 'blob', 'eip-4844',
    ],
    content: `
Ethereum is the leading programmable blockchain — a decentralized computer that runs smart contracts.

Key concepts:
- **Smart Contracts**: Programs deployed on Ethereum that run exactly as written, without the ability for anyone to alter them once deployed.
- **Gas**: The fee paid for computation. Denominated in gwei (1 gwei = 0.000000001 ETH).
- **Proof of Stake (PoS)**: Ethereum's current consensus — validators lock up ETH to propose/attest blocks. Replaced Proof of Work in "The Merge" (Sept 2022).
- **Layer 2 (L2)**: Networks built on top of Ethereum that inherit its security but offer lower fees and higher throughput.

Major L2s:
- **Optimism (OP)**: Optimistic rollup. Used by Farcaster's Key Registry and ID Registry.
- **Base**: L2 by Coinbase, built on the OP Stack. Home to much Farcaster/crypto culture.
- **Arbitrum**: Another optimistic rollup, dominant in DeFi.
- **zkSync / Starknet**: Zero-knowledge rollups — use ZK proofs for faster finality.
- **Polygon**: Side-chain + validity rollup; used widely but different security model.

EIP-4844 (Proto-Danksharding): Introduced "blobs" — cheap temporary data storage that dramatically cut L2 fees in 2024.

DeFi:
- **Uniswap**: Decentralized exchange using AMM (automated market maker).
- **Aave / Compound**: Lending/borrowing protocols.
- **Curve**: Stablecoin-focused AMM.
`,
  },
  {
    id: 'decentralization',
    title: 'Decentralization & Web3',
    keywords: [
      'decentralized', 'decentralization', 'web3', 'sovereignty', 'dao', 'governance',
      'public goods', 'gitcoin', 'censorship resistance', 'permissionless', 'trustless',
      'open source', 'protocol', 'coordination', 'commons', 'retroPGF', 'optimism governance',
    ],
    content: `
Decentralization means distributing control so no single party can censor, shut down, or control a system.

Key principles:
- **Permissionless**: Anyone can participate without approval (e.g., anyone can run an Ethereum node or Farcaster hub).
- **Trustless**: You don't need to trust a third party — math and code enforce the rules.
- **Censorship Resistance**: Your data and ability to transact cannot be blocked by a government or company.
- **Self-Sovereignty**: You own your keys, therefore your assets and identity.

DAOs (Decentralized Autonomous Organizations):
- Organizations governed by token holders via on-chain voting.
- Examples: Uniswap DAO, Optimism Collective, Nouns DAO.
- Challenges: voter apathy, plutocracy (rich voters dominate), slow decision-making.

Public Goods Funding:
- **Gitcoin Grants**: Quadratic funding — small donors amplify each other.
- **RetroPGF (Optimism)**: Retroactive rewards for public goods that have already proven their value.
- **Protocol Guild**: Funds Ethereum core developers directly.

Web3 vs Web2:
- Web1: Read-only internet (static pages).
- Web2: Read-write (social media, but platforms own your data).
- Web3: Read-write-own (users own their data, identity, and assets).

Farcaster in this context: A Web3 social network where your social graph lives on-chain and cannot be taken from you.
`,
  },
  {
    id: 'privacy',
    title: 'Privacy & Cryptography',
    keywords: [
      'privacy', 'zk', 'zero knowledge', 'zk proof', 'zkp', 'encryption', 'e2e',
      'end to end', 'self custody', 'private key', 'seed phrase', 'mnemonic', 'signal',
      'tornado', 'mixer', 'stealth address', 'zcash', 'monero', 'semaphore', 'worldcoin',
    ],
    content: `
Privacy in Web3 combines cryptography with decentralization to let users control their own data.

Zero-Knowledge Proofs (ZKPs):
- Cryptographic technique proving you know something without revealing what it is.
- Example: prove you're over 18 without revealing your birthdate.
- **zk-SNARKs**: Succinct, non-interactive proofs (used by Zcash, Aztec).
- **zk-STARKs**: Transparent, post-quantum secure (used by StarkNet).
- **Semaphore**: ZK membership proofs used in Farcaster-adjacent apps (prove you're a Farcaster user without revealing which one).

Key privacy tools:
- **Tornado Cash**: Ethereum mixing protocol for transaction privacy (sanctioned by OFAC in 2022, developer arrested).
- **Stealth Addresses**: One-time addresses so payments can't be linked to your identity.
- **Zcash / Monero**: Privacy-focused cryptocurrencies with hidden sender/receiver.
- **Signal Protocol**: The gold standard for E2E encrypted messaging (used by Signal, WhatsApp).

Self-Custody:
- Owning your private keys = owning your assets. "Not your keys, not your coins."
- Seed phrases (BIP-39 mnemonics): 12 or 24 words that can regenerate all your keys.
- Hardware wallets (Ledger, Trezor): Store private keys offline.

Farcaster & Privacy:
- Casts are public by default and stored on open hubs.
- DMs (Direct Casts): Encrypted, but Merkle/Warpcast operates the server.
- Future: The community is exploring ZK-based private channels.
`,
  },
  {
    id: 'ai_web3',
    title: 'AI & Decentralized Intelligence',
    keywords: [
      'ai', 'artificial intelligence', 'llm', 'large language model', 'gpt', 'claude', 'llama',
      'mistral', 'ollama', 'open source ai', 'bittensor', 'gensyn', 'agent', 'ai agent',
      'autonomous', 'groq', 'inference', 'decentralized ai', 'open ai', 'anthropic',
    ],
    content: `
AI and Web3 are converging — decentralized networks are being used to coordinate AI compute and data.

Open Source Models:
- **Llama 3.1/3.2 (Meta)**: Powerful open-weight models. 8B param version runs on a laptop.
- **Mistral**: French AI company with strong open models (Mistral 7B, Mixtral 8x7B).
- **Gemma (Google)**: Open-weight models from Google.
- These can run locally via **Ollama** (desktop/server) or **LM Studio**.

Decentralized AI Infrastructure:
- **Bittensor (TAO)**: Decentralized network where miners compete to produce the best AI responses. Token rewards for quality outputs.
- **Gensyn**: Decentralized compute network for training ML models.
- **Akash**: Decentralized cloud computing (can run AI inference).
- **Ritual**: AI coprocessor for smart contracts — on-chain computations can call AI models.

AI Agents on Farcaster:
- Bots and AI agents are active on Farcaster. Some notable ones: @askgpt, various analytics bots.
- Frames can integrate AI: a frame can call an LLM API when a user interacts with it.
- The community is exploring AI-curated feeds, AI co-pilots for composing casts.

Inference APIs:
- **Groq**: Ultra-fast inference using custom LPU chips. Free tier available. Supports Llama 3.1 70B.
- **Together.ai**: Runs open-source models at scale.
- **Replicate**: Runs ML models via API.

Key tension: Centralized AI companies (OpenAI, Anthropic) vs. open-source models (Meta Llama, Mistral). The Web3 community strongly favors open-source.
`,
  },
  {
    id: 'crypto_culture',
    title: 'Crypto Culture & Ecosystem',
    keywords: [
      'nft', 'defi', 'degen', 'based', 'onchain', 'meme', 'airdrop', 'token', 'dao',
      'gm', 'wagmi', 'ngmi', 'lfg', 'alpha', 'degen score', 'higher', 'moxie', 'farcon',
    ],
    content: `
Crypto culture has its own vocabulary and norms. Understanding them helps navigate Farcaster.

Common terms:
- **gm / gn**: Good morning / good night. Community greeting.
- **wagmi / ngmi**: We're all gonna make it / not gonna make it.
- **degen**: Short for degenerate — someone who takes high-risk bets. Used affectionately.
- **alpha**: Exclusive or early information about a promising opportunity.
- **based**: Being authentic, not caring about others' opinions. Also Base (the L2).
- **onchain**: Doing things with crypto / blockchain. "Fully onchain" = no centralized parts.
- **LFG**: Let's f***ing go! Expression of excitement.

Farcaster-specific:
- **Moxie**: Social token protocol on Farcaster — creators earn tokens based on engagement.
- **Degen**: A memecoin on Base that became deeply integrated with Farcaster culture.
- **Higher**: Community/movement on Farcaster about optimism and positive vibes.
- **FarCon**: Annual Farcaster in-person conference.
- **Yaps (Kaito)**: Attention scoring system for Farcaster activity.

NFTs:
- Digital ownership certificates on blockchain. Proved cultural value through art, gaming, identity.
- Key projects: CryptoPunks, Bored Apes (BAYC), Nouns, Art Blocks.
- On Farcaster: Nouns has a strong community presence.
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
  { label: 'How do L2s work?', topic: 'ethereum' },
  { label: 'What are ZK proofs?', topic: 'privacy' },
  { label: 'Explain decentralization', topic: 'decentralization' },
  { label: 'AI + Web3?', topic: 'ai' },
  { label: 'What is a FID?', topic: 'farcaster' },
  { label: 'What is Base?', topic: 'ethereum' },
  { label: 'Self-custody explained', topic: 'privacy' },
];
