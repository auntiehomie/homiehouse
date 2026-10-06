import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { llmChat } from '@/lib/llm';
import { SAFETY_MODULES } from '@/lib/safety-curriculum';
import { getKBModulesForTrack, deduplicateModules } from '@/lib/kb-curriculum';
import type { LearningModule as KBLearningModule } from '@/lib/kb-curriculum';

// Free-tier-only AI provider chain (Cerebras → Groq → Gemini → OpenRouter)
// Per docs/AI_PROVIDER_STRATEGY.md: we deliberately do NOT fall back to paid OpenAI/Claude.
// The shared llmChat handles the fallback chain automatically.

export const maxDuration = 30;

interface LearningModule {
  id: string;
  title: string;
  description: string;
  whyItMatters: string;
  objectives: string[];
  estimatedMinutes: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
}

interface LearningPlan {
  track: 'ai' | 'finance' | 'creator' | 'decentralization' | 'all';
  level: 'beginner' | 'intermediate' | 'advanced';
  summary: string;
  modules: LearningModule[];
}

// ─── Reusable module library ──────────────────────────────────────────────────

const EXTRA_MODULES: Record<string, LearningModule> = {
  'ethereum-history': {
    id: 'ethereum-history',
    title: 'The History of Ethereum',
    description: 'Trace Ethereum from Vitalik\'s 2013 whitepaper through the genesis block, The DAO hack, The Merge, and the upgrades reshaping the chain today.',
    whyItMatters: 'Understanding Ethereum\'s history explains every design decision the ecosystem has made — and why they matter for the future.',
    objectives: [
      'Explain why Vitalik Buterin created Ethereum and what gap it filled beyond Bitcoin',
      'Describe The Merge (2022) and what changing to Proof of Stake meant for the network',
      'Name the major hard forks and upgrades: Constantinople, EIP-1559, Shanghai, Dencun',
      'Understand how The DAO hack of 2016 led to the ETH/ETC split',
    ],
    estimatedMinutes: 30,
    difficulty: 'beginner',
    tags: ['ethereum', 'history', 'fundamentals'],
  },
  'dao-history': {
    id: 'dao-history',
    title: 'The History of DAOs',
    description: 'From the infamous DAO hack of 2016 to Nouns, ConstitutionDAO, and on-chain treasuries managing billions — trace how decentralized autonomous organizations evolved.',
    whyItMatters: 'DAOs represent a new model for human coordination. Understanding their history — including the failures — is essential for evaluating any governance system.',
    objectives: [
      'Explain what The DAO was, why it was hacked for $60M ETH, and how it forced an Ethereum hard fork',
      'Understand how MolochDAO introduced minimalist grant-giving DAOs in 2019',
      'Describe ConstitutionDAO and what it revealed about DAO coordination at scale',
      'Identify the key tools DAOs use today: Snapshot, Tally, Gnosis Safe',
    ],
    estimatedMinutes: 30,
    difficulty: 'beginner',
    tags: ['dao', 'history', 'governance'],
  },
  'defi-hacks': {
    id: 'defi-hacks',
    title: 'A History of DeFi Hacks',
    description: 'Walk through the biggest DeFi exploits — Ronin bridge ($625M), Wormhole ($320M), Euler Finance ($197M) — and understand the attack vectors that made them possible.',
    whyItMatters: 'Every major DeFi hack teaches something about system design. Knowing this history makes you a better evaluator of protocols and a safer participant.',
    objectives: [
      'Name the top 5 DeFi hacks by size and describe how each happened',
      'Explain the difference between reentrancy attacks, oracle manipulation, and bridge vulnerabilities',
      'Understand what a flash loan attack is and why it\'s unique to DeFi',
      'Apply a checklist for assessing protocol safety before depositing funds',
    ],
    estimatedMinutes: 35,
    difficulty: 'intermediate',
    tags: ['security', 'hacks', 'DeFi', 'risk'],
  },
  'farcaster-history': {
    id: 'farcaster-history',
    title: 'Farcaster: History & Protocol',
    description: 'Learn how Dan Romero and Varun Srinivasan built a "sufficiently decentralized" social protocol from scratch — and how it evolved from invite-only to Frames and beyond.',
    whyItMatters: 'Farcaster is the infrastructure for crypto-native social. Understanding its design decisions explains why it works differently from every other platform you\'ve used.',
    objectives: [
      'Describe how Farcaster stores identity on-chain (FIDs on Optimism) while keeping content off-chain (Hubs)',
      'Explain what a Farcaster Hub is and why the network requires multiple hubs for decentralization',
      'Understand the timeline: 2022 beta → channels → Frames → open protocol',
      'Identify the key clients (Warpcast, HomieHouse, Supercast) and why multiple clients matter',
    ],
    estimatedMinutes: 25,
    difficulty: 'beginner',
    tags: ['farcaster', 'history', 'social', 'protocol'],
  },
  'security-decentralization': {
    id: 'security-decentralization',
    title: 'Security in Decentralization',
    description: 'Master the threat model for Web3: phishing, fake mints, wallet drainers, rug pulls, and how to protect yourself without sacrificing your ability to participate.',
    whyItMatters: 'In Web3, you are your own bank — which means you\'re also your own security team. Most losses are preventable with the right habits.',
    objectives: [
      'Identify the most common Web3 scams: fake airdrops, approval drainers, phishing sites',
      'Understand what a token approval is and how to revoke unnecessary ones',
      'Set up a hardware wallet and understand when cold storage is worth it',
      'Apply a simple rule: never share your seed phrase, never approve contracts you don\'t understand',
    ],
    estimatedMinutes: 30,
    difficulty: 'beginner',
    tags: ['security', 'opsec', 'wallet', 'safety'],
  },
  'venice-ai': {
    id: 'venice-ai',
    title: 'Venice.ai: Private AI on Web3',
    description: 'Explore Venice.ai — a privacy-first AI platform built on decentralized infrastructure where your conversations are never stored, logged, or used for training.',
    whyItMatters: 'As AI becomes central to daily life, the question of who controls your data becomes critical. Venice shows how Web3 principles apply to AI infrastructure.',
    objectives: [
      'Explain how Venice.ai differs from ChatGPT and Claude in terms of data privacy',
      'Understand how decentralized inference keeps your prompts private',
      'Explore Venice\'s model selection and how open-source models power it',
      'Evaluate privacy claims: what "your data isn\'t stored" actually means',
    ],
    estimatedMinutes: 20,
    difficulty: 'beginner',
    tags: ['venice', 'AI', 'privacy', 'web3'],
  },
  'how-llms-actually-work': {
    id: 'how-llms-actually-work',
    title: 'How AI "Thinks": LLMs in Plain English',
    description: 'Demystify large language models like the ones powering ChatGPT, Claude, and HomieHouse\'s own AI features — what they\'re actually doing when they "answer" you, and why they sometimes confidently make things up.',
    whyItMatters: 'You interact with AI models constantly now — knowing roughly how they work makes you a sharper, more skeptical user instead of someone who either fears or blindly trusts the output.',
    objectives: [
      'Explain what a token is and how a model predicts the next one',
      'Understand what "training" actually means at a high level, without the math',
      'Explain why models hallucinate and how to spot a likely-wrong answer',
      'Compare a few real models (Claude, GPT, open-source options) at a conceptual level',
    ],
    estimatedMinutes: 25,
    difficulty: 'beginner',
    tags: ['AI', 'machine-learning', 'LLMs', 'fundamentals'],
  },
  'ai-agents-onchain': {
    id: 'ai-agents-onchain',
    title: 'AI Agents That Own Wallets and Trade On-Chain',
    description: 'Meet the wave of autonomous AI agents that hold their own crypto wallets, post on Farcaster, trade tokens, and coordinate with other agents — including the one built into this app.',
    whyItMatters: 'AI agents with on-chain wallets are one of the fastest-growing intersections of AI and crypto — understanding how they work helps you evaluate which ones are legitimate and which are hype.',
    objectives: [
      'Explain what it means for an AI agent to "own" a wallet and sign transactions autonomously',
      'Understand the basic agent loop: perceive (read casts/data) → decide (LLM call) → act (post, trade, reply)',
      'Identify real examples: trading agents, social agents like @thehomie, and agent-to-agent marketplaces',
      'Spot the difference between a genuinely autonomous agent and a scripted bot wearing an "AI" label',
    ],
    estimatedMinutes: 25,
    difficulty: 'intermediate',
    tags: ['AI', 'agents', 'automation', 'web3'],
  },
  'ai-security-prompt-injection': {
    id: 'ai-security-prompt-injection',
    title: 'Prompt Injection: The New Frontier of Hacks',
    description: 'Just like DeFi has flash-loan attacks and reentrancy bugs, AI systems have their own exploit class — prompt injection. Learn how attackers manipulate AI agents and how builders defend against it.',
    whyItMatters: 'As AI agents get wallets and permissions, securing them against manipulation becomes exactly as important as securing a smart contract.',
    objectives: [
      'Explain what prompt injection is and how it differs from traditional code exploits',
      'Understand why an AI agent that reads untrusted content (like social posts) is especially exposed',
      'Identify real-world prompt injection incidents against AI agents and chatbots',
      'Apply basic defensive patterns: input sanitization, permission boundaries, human-in-the-loop for high-stakes actions',
    ],
    estimatedMinutes: 20,
    difficulty: 'intermediate',
    tags: ['AI', 'security', 'prompt-injection', 'agents'],
  },
  'ai-crypto-convergence': {
    id: 'ai-crypto-convergence',
    title: 'Why AI and Crypto Keep Colliding',
    description: 'From decentralized GPU marketplaces to on-chain model provenance to agent-native payment rails, explore the handful of ways AI and crypto are genuinely merging — and which are still mostly narrative.',
    whyItMatters: 'Every cycle brings hype around "AI x crypto" — knowing the real infrastructure from the marketing lets you tell which projects are solving something real.',
    objectives: [
      'Explain what decentralized compute marketplaces (like Render, Akash, io.net) actually provide',
      'Understand why crypto rails (stablecoins, micropayments) are a natural fit for machine-to-machine AI agent payments',
      'Describe how on-chain provenance could help verify AI-generated content',
      'Separate genuine AI-crypto infrastructure from projects that just added "AI" to their pitch deck',
    ],
    estimatedMinutes: 25,
    difficulty: 'intermediate',
    tags: ['AI', 'crypto', 'infrastructure', 'convergence'],
  },
};

// ─── Advanced modules (not in EXTRA_MODULES, used in advanced tier plans) ─────

const ADVANCED_MODULES: Record<string, LearningModule> = {
  'l2-scaling': {
    id: 'l2-scaling',
    title: 'L2 Scaling: Rollups, Sidechains, and the Future',
    description: 'Compare Ethereum L2s like Arbitrum, Optimism, Base, and zkSync — how they work, their tradeoffs, and why the rollup-centric roadmap matters.',
    whyItMatters: 'Most on-chain activity now happens on L2s. Understanding the differences helps you choose where to transact, build, or invest.',
    objectives: [
      'Explain the difference between optimistic and zk rollups',
      'Compare the leading L2s by TVL, fees, and ecosystem maturity',
      'Understand how L2s settle data to Ethereum L1 and why blob space (EIP-4844) matters',
      'Evaluate when to use an L2 vs when L1 is necessary',
    ],
    estimatedMinutes: 30,
    difficulty: 'intermediate',
    tags: ['ethereum', 'L2', 'scaling', 'rollups'],
  },
  'mev-and-pbs': {
    id: 'mev-and-pbs',
    title: 'MEV & Proposer-Builder Separation',
    description: 'Understand Maximal Extractable Value — how block producers extract value from transaction ordering — and how Proposer-Builder Separation (PBS) reshapes Ethereum\'s incentive landscape.',
    whyItMatters: 'MEV affects every trade you make on-chain. Understanding it reveals the hidden economic layer of every blockchain.',
    objectives: [
      'Explain what MEV is and how sandwich attacks, frontrunning, and arbitrage work',
      'Understand how PBS separates block building from block proposing',
      'Describe how Flashbots and mev-boost changed the MEV landscape',
      'Evaluate the regulatory and centralization concerns around MEV',
    ],
    estimatedMinutes: 35,
    difficulty: 'advanced',
    tags: ['MEV', 'ethereum', 'economics', 'PBS'],
  },
  'cross-chain-interop': {
    id: 'cross-chain-interop',
    title: 'Cross-Chain Interoperability',
    description: 'Explore bridges, messaging protocols (LayerZero, Chainlink CCIP), and chain abstraction — how assets and data move between blockchain ecosystems.',
    whyItMatters: 'The multi-chain future is already here. Understanding bridges and interoperability helps you avoid the $2B+ that\'s been lost to bridge hacks.',
    objectives: [
      'Explain how a token bridge works and why bridges are particularly vulnerable to hacks',
      'Compare messaging protocols: LayerZero, Chainlink CCIP, Wormhole, Axelar',
      'Understand the concept of chain abstraction and intent-based bridging',
      'Apply a security checklist before using any bridge',
    ],
    estimatedMinutes: 30,
    difficulty: 'advanced',
    tags: ['cross-chain', 'bridges', 'interoperability', 'security'],
  },
  'zkml-intro': {
    id: 'zkml-intro',
    title: 'Zero-Knowledge Machine Learning (zkML)',
    description: 'Understand how zero-knowledge proofs can verify that an AI model ran correctly without revealing the model or the input data.',
    whyItMatters: 'zkML bridges the two most important cryptographic primitives of this decade — ZK proofs and AI — enabling verifiable, private computation.',
    objectives: [
      'Explain at a high level how ZK proofs can verify computation without re-running it',
      'Understand the tradeoffs: proving time, model constraints, verifier trust',
      'Identify real zkML projects and their use cases (DeFi, identity, prediction markets)',
      'Separate what\'s production-ready from what\'s still research',
    ],
    estimatedMinutes: 30,
    difficulty: 'advanced',
    tags: ['ZK', 'AI', 'machine-learning', 'cryptography'],
  },
  'defi-yield-strategies': {
    id: 'defi-yield-strategies',
    title: 'DeFi Yield Strategies: From Simple to Complex',
    description: 'Explore real yield vs. token emissions, looping strategies, delta-neutral positions, and how to evaluate whether a DeFi yield is sustainable or a Ponzi.',
    whyItMatters: 'Yield is the primary reason most people enter DeFi — understanding which yields are real and which are marketing separates long-term participants from those who get liquidated.',
    objectives: [
      'Distinguish real yield (protocol revenue) from token emission rewards',
      'Understand leveraged lending positions (looping) and their liquidation risks',
      'Explain how delta-neutral strategies work in concentrated liquidity AMMs',
      'Apply a checklist: where is the yield coming from, and what breaks it?',
    ],
    estimatedMinutes: 35,
    difficulty: 'advanced',
    tags: ['DeFi', 'yield', 'strategies', 'risk'],
  },
  'smart-contract-architecture': {
    id: 'smart-contract-architecture',
    title: 'Smart Contract Architecture & Upgradeability',
    description: 'Design patterns for production-grade smart contracts: proxy patterns, diamond standard, access control, and upgradeability strategies.',
    whyItMatters: 'Production smart contracts require careful architecture. Understanding these patterns separates tutorial code from deployable systems.',
    objectives: [
      'Explain the Transparent Proxy, UUPS, and Beacon proxy patterns',
      'Understand the Diamond Standard (EIP-2535) for large contract systems',
      'Compare access control: Ownable, AccessControl, role-based patterns',
      'Evaluate when upgradeability is appropriate and when immutability is better',
    ],
    estimatedMinutes: 30,
    difficulty: 'advanced',
    tags: ['solidity', 'architecture', 'smart-contracts', 'security'],
  },
  'creator-economics': {
    id: 'creator-economics',
    title: 'Creator Economics on Web3',
    description: 'Explore how creators monetize on Web3: NFT royalties, token-gated content, subscription NFTs, social tokens, and split protocols.',
    whyItMatters: 'Web3 gives creators new revenue models that don\'t rely on platform algorithms or ad revenue — understanding them opens doors to sustainable creative income.',
    objectives: [
      'Understand how NFT royalties work and why they\'re different from Web2 revenue sharing',
      'Explore token-gated content models (Hypersub, Paragraph, Unlock Protocol)',
      'Learn how split protocols (0xSplits, Zora) automate revenue sharing',
      'Compare the economics of Web3 creator platforms vs traditional social media',
    ],
    estimatedMinutes: 25,
    difficulty: 'intermediate',
    tags: ['creator', 'NFT', 'economics', 'monetization'],
  },
  'gas-optimization': {
    id: 'gas-optimization',
    title: 'Gas Optimization for Solidity',
    description: 'Deep dive into EVM gas mechanics: storage layout, calldata vs memory, unchecked arithmetic, and how to shave 30%+ off deployment and execution costs.',
    whyItMatters: 'In a world where every transaction costs money, gas optimization is a competitive advantage — and a sign of professional craftsmanship.',
    objectives: [
      'Understand how SSTORE, SLOAD, and storage layout affect gas costs',
      'Apply packing optimizations, unchecked blocks, and assembly tricks safely',
      'Use foundry gas snapshots to measure improvements quantitatively',
      'Know the tradeoffs: readability vs gas savings, and when to optimize',
    ],
    estimatedMinutes: 35,
    difficulty: 'advanced',
    tags: ['solidity', 'gas', 'optimization', 'EVM'],
  },
  'identity-systems': {
    id: 'identity-systems',
    title: 'Web3 Identity Systems Compared',
    description: 'Compare ENS, Lens, Farcaster FIDs, DIDs, and soulbound tokens — different approaches to on-chain identity, reputation, and social graphs.',
    whyItMatters: 'Your on-chain identity is becoming as important as your offline one. Understanding how different identity systems work helps you navigate the social layer of Web3.',
    objectives: [
      'Compare ENS (.eth names), Lens profiles, and Farcaster FIDs as identity primitives',
      'Understand soulbound tokens (SBTs) and verifiable credentials for reputation',
      'Explain what Decentralized Identifiers (DIDs) are and how they differ from ENS',
      'Evaluate which identity system fits different use cases: social, financial, professional',
    ],
    estimatedMinutes: 25,
    difficulty: 'intermediate',
    tags: ['identity', 'ENS', 'farcaster', 'lens', 'DID'],
  },
};

// ─── Level-aware fallback plans ──────────────────────────────────────────────

// ── Decentralization Track (was "learner") ───────────────────────────────────
const DECENTRALIZATION_BEGINNER: LearningPlan = {
  track: 'decentralization',
  level: 'beginner',
  summary: 'Welcome to your decentralization journey! This plan will take you from zero to confidently navigating the Web3 world, starting with the essentials.',
  modules: [
    {
      id: 'wallet-basics',
      title: 'Your First Crypto Wallet',
      description: 'Learn what a crypto wallet is, how it works, and how to set one up safely. Understand the difference between custodial and self-custody wallets.',
      whyItMatters: 'Your wallet is your identity and bank account in Web3 — without it, you cannot participate.',
      objectives: [
        'Understand what a seed phrase is and why it must be kept secret',
        'Set up a self-custody wallet like MetaMask or Coinbase Wallet',
        'Know the difference between hot and cold wallets',
        'Send and receive your first transaction safely',
      ],
      estimatedMinutes: 25,
      difficulty: 'beginner',
      tags: ['wallet', 'security', 'basics'],
    },
    {
      id: 'what-is-decentralization',
      title: 'What Is Decentralization?',
      description: 'Explore the core idea of decentralization — removing single points of control — and why it matters in finance, social media, and beyond.',
      whyItMatters: 'Understanding decentralization lets you see why Web3 exists and what problems it is actually trying to solve.',
      objectives: [
        'Explain the difference between centralized and decentralized systems',
        'Name real-world examples where decentralization changes the power balance',
        'Understand why censorship resistance matters',
        'Describe how peer-to-peer networks work at a high level',
      ],
      estimatedMinutes: 20,
      difficulty: 'beginner',
      tags: ['philosophy', 'web3', 'basics'],
    },
    {
      id: 'blockchain-basics',
      title: 'How Blockchains Work',
      description: 'Dive into the mechanics of a blockchain — blocks, chains, consensus, and why data stored on-chain is practically immutable.',
      whyItMatters: 'Knowing how blockchains work turns you from a consumer into someone who can evaluate any project or claim.',
      objectives: [
        'Describe what a block contains and how blocks link together',
        'Understand proof of work vs proof of stake consensus',
        'Explain why transactions are final on-chain',
        'Read a simple block explorer entry',
      ],
      estimatedMinutes: 30,
      difficulty: 'beginner',
      tags: ['blockchain', 'consensus', 'fundamentals'],
    },
    {
      id: 'web3-identity',
      title: 'Identity in Web3',
      description: 'Learn how your Ethereum address becomes your identity, how ENS names work, and the concept of on-chain reputation.',
      whyItMatters: "Your on-chain identity follows you everywhere — it's your reputation, your history, and your access pass.",
      objectives: [
        'Understand how a public/private key pair creates your identity',
        'Register or understand an ENS (.eth) name',
        'Explore what on-chain activity reveals about a wallet',
        'Understand why pseudonymity is different from anonymity',
      ],
      estimatedMinutes: 20,
      difficulty: 'beginner',
      tags: ['identity', 'ENS', 'privacy'],
    },
    {
      id: 'intro-to-farcaster',
      title: 'Welcome to Farcaster',
      description: 'Discover Farcaster — a decentralized social protocol built on Ethereum — and how HomieHouse gives you a home in this ecosystem.',
      whyItMatters: 'Farcaster is where crypto-native conversation happens; understanding it opens doors to community, information, and opportunity.',
      objectives: [
        'Explain what a Farcaster FID and signer are',
        'Post your first cast and follow relevant channels',
        'Understand how casts are stored on-chain vs off-chain',
        'Connect your wallet to your Farcaster identity',
      ],
      estimatedMinutes: 20,
      difficulty: 'beginner',
      tags: ['farcaster', 'social', 'community'],
    },
    EXTRA_MODULES['ethereum-history'],
    EXTRA_MODULES['security-decentralization'],
  ],
};

const DECENTRALIZATION_INTERMEDIATE: LearningPlan = {
  track: 'decentralization',
  level: 'intermediate',
  summary: 'Level up your Web3 understanding with deeper dives into Ethereum history, DAO governance, protocol design, and scaling solutions.',
  modules: [
    EXTRA_MODULES['blockchain-basics'] || {
      id: 'blockchain-basics-int',
      title: 'Blockchain Mechanics Deep Dive',
      description: 'Go beyond the basics: understand state transitions, the EVM, gas accounting, and how blocks are actually constructed.',
      whyItMatters: 'A deep understanding of blockchain mechanics turns you into someone who can evaluate any protocol or claim.',
      objectives: [
        'Explain how state transitions work in the EVM',
        'Understand gas, gas price, and why blocks have gas limits',
        'Describe how a mempool works and what it means for transaction ordering',
        'Read and interpret a raw Ethereum transaction',
      ],
      estimatedMinutes: 30,
      difficulty: 'intermediate',
      tags: ['blockchain', 'EVM', 'gas', 'fundamentals'],
    },
    EXTRA_MODULES['ethereum-history'],
    EXTRA_MODULES['dao-history'],
    EXTRA_MODULES['farcaster-history'],
    EXTRA_MODULES['security-decentralization'],
    ADVANCED_MODULES['l2-scaling'],
    ADVANCED_MODULES['identity-systems'],
  ],
};

const DECENTRALIZATION_ADVANCED: LearningPlan = {
  track: 'decentralization',
  level: 'advanced',
  summary: 'Master the deep mechanics of Web3: governance systems, L2 scaling tradeoffs, MEV economics, and cross-chain interoperability.',
  modules: [
    EXTRA_MODULES['ethereum-history'],
    EXTRA_MODULES['dao-history'],
    EXTRA_MODULES['defi-hacks'],
    ADVANCED_MODULES['l2-scaling'],
    ADVANCED_MODULES['mev-and-pbs'],
    ADVANCED_MODULES['cross-chain-interop'],
    ADVANCED_MODULES['identity-systems'],
  ],
};

// ── Finance Track (was "financial") ──────────────────────────────────────────
const FINANCE_BEGINNER: LearningPlan = {
  track: 'finance',
  level: 'beginner',
  summary: 'Build real financial literacy in Web3 — from what a token actually is, to evaluating tokenomics, to understanding the protocols reshaping decentralized finance.',
  modules: [
    {
      id: 'what-is-a-token',
      title: 'What Is a Crypto Token?',
      description: 'Break down the different types of crypto tokens — utility, governance, LP, and revenue-sharing — and understand how they differ from coins.',
      whyItMatters: 'Every financial decision in Web3 involves tokens. Knowing what you actually own is the foundation of everything else.',
      objectives: [
        'Explain the difference between a coin (e.g. ETH) and a token (e.g. HYPE, UNI)',
        'Identify utility tokens, governance tokens, and LP tokens',
        'Understand how tokens are created and deployed on a chain',
        'Read a token contract address on a block explorer',
      ],
      estimatedMinutes: 25,
      difficulty: 'beginner',
      tags: ['tokens', 'fundamentals', 'DeFi'],
    },
    {
      id: 'tokenomics-101',
      title: 'Tokenomics: Reading Between the Lines',
      description: "Learn how to evaluate a token's supply, distribution, vesting schedules, and emission rate — the signals that separate strong projects from pump-and-dumps.",
      whyItMatters: 'Tokenomics determines long-term value. A great product with bad tokenomics can still destroy your investment.',
      objectives: [
        "Read a token's circulating supply vs max supply",
        'Understand what vesting and cliff schedules mean for price',
        'Spot red flags: insider concentration, unlocks, and inflation',
        'Compare market cap vs fully diluted valuation (FDV)',
      ],
      estimatedMinutes: 30,
      difficulty: 'beginner',
      tags: ['tokenomics', 'research', 'investing'],
    },
    {
      id: 'on-chain-portfolio-beginner',
      title: 'Building & Tracking an On-Chain Portfolio',
      description: 'Set up a real on-chain portfolio using tools like Zapper, DeBank, or Zerion. Understand gas costs, slippage, and how to think about position sizing.',
      whyItMatters: 'Managing your own assets on-chain is the whole point of DeFi. A clear view of your portfolio is your most important risk tool.',
      objectives: [
        'Connect a wallet to a portfolio tracker and understand what it shows',
        'Calculate the true cost of a trade including gas and slippage',
        'Set a simple position-sizing rule for DeFi allocations',
        'Export your transaction history for tax purposes',
      ],
      estimatedMinutes: 25,
      difficulty: 'beginner',
      tags: ['portfolio', 'tools', 'DeFi', 'tax'],
    },
    {
      id: 'defi-protocol-tokens-beginner',
      title: 'DeFi Protocol Tokens & Governance',
      description: 'Learn how governance tokens like UNI, AAVE, and MKR work — and when holding them makes sense beyond speculation.',
      whyItMatters: 'Protocol tokens let you participate in shaping the future of financial infrastructure.',
      objectives: [
        'Explain what a governance vote is and how quorum works',
        'Understand ve-tokenomics (vote-escrowed locking for yield)',
        'Identify protocols where the token genuinely captures value vs vanity governance',
        'Participate in or simulate a governance vote',
      ],
      estimatedMinutes: 30,
      difficulty: 'intermediate',
      tags: ['governance', 'DeFi', 'protocol-tokens'],
    },
    EXTRA_MODULES['defi-hacks'],
  ],
};

const FINANCE_INTERMEDIATE: LearningPlan = {
  track: 'finance',
  level: 'intermediate',
  summary: 'Deepen your DeFi knowledge with real protocol case studies, risk analysis frameworks, and practical portfolio management strategies.',
  modules: [
    {
      id: 'what-is-a-token-int',
      title: 'Token Design & Standards Deep Dive',
      description: 'Understand ERC-20, ERC-721, ERC-1155, and specialized token standards — including what makes tokens fungible, non-fungible, or semi-fungible.',
      whyItMatters: 'Every DeFi position is a token position. Understanding token standards helps you evaluate what you\'re actually buying.',
      objectives: [
        'Compare ERC-20, ERC-721, and ERC-1155 token standards',
        'Understand token metadata, URI schemes, and why they matter for NFTs',
        'Explain how wrapped tokens (WETH, wBTC) work and their trust assumptions',
        'Explore emerging standards: ERC-4626 (tokenized vaults), ERC-6551 (token-bound accounts)',
      ],
      estimatedMinutes: 30,
      difficulty: 'intermediate',
      tags: ['tokens', 'standards', 'ERC', 'fundamentals'],
    },
    {
      id: 'hyperliquid-case-study',
      title: 'Hyperliquid: A Case Study in Protocol Tokens',
      description: 'Examine Hyperliquid (HYPE) — a decentralized perpetuals exchange that grew to surpass Solana in market cap by mid-2026 — as a real-world lesson in protocol value accrual.',
      whyItMatters: 'Hyperliquid shows how a protocol can capture value through fees, community distribution, and product-market fit. Understanding it sharpens your lens for evaluating any token.',
      objectives: [
        'Explain what a perpetuals DEX is and why it attracts volume',
        'Understand how Hyperliquid distributed HYPE (no VCs, airdrop-first)',
        'Read protocol revenue and see how it flows back to token holders',
        'Evaluate why HYPE grew from launch to top-10 asset and what risks remain',
      ],
      estimatedMinutes: 35,
      difficulty: 'intermediate',
      tags: ['hyperliquid', 'HYPE', 'perps', 'case-study', 'DeFi'],
    },
    {
      id: 'defi-protocol-tokens-int',
      title: 'DeFi Protocol Tokens & Governance',
      description: 'Learn how governance tokens like UNI, AAVE, and MKR work — and when holding them makes sense beyond speculation.',
      whyItMatters: 'Protocol tokens let you participate in shaping the future of financial infrastructure. They also earn fees when designed well.',
      objectives: [
        'Explain what a governance vote is and how quorum works',
        'Understand ve-tokenomics (vote-escrowed locking for yield)',
        'Identify protocols where the token genuinely captures value vs vanity governance',
        'Participate in or simulate a governance vote',
      ],
      estimatedMinutes: 30,
      difficulty: 'intermediate',
      tags: ['governance', 'DeFi', 'protocol-tokens'],
    },
    {
      id: 'risk-management-defi',
      title: 'DeFi Risk Management',
      description: 'Understand smart contract risk, liquidation mechanics, impermanent loss, and how to size positions so a single exploit does not wipe you out.',
      whyItMatters: 'DeFi yields are real, but so are the risks. The investors who survive long-term are those who understand what can go wrong.',
      objectives: [
        'Name the top 5 DeFi risk categories: smart contract, oracle, liquidity, protocol, regulatory',
        'Understand how lending liquidations work and how to avoid them',
        'Calculate impermanent loss on an LP position',
        'Apply a simple rule: never put more in a single protocol than you can afford to lose',
      ],
      estimatedMinutes: 35,
      difficulty: 'intermediate',
      tags: ['risk', 'DeFi', 'security', 'lending'],
    },
    EXTRA_MODULES['defi-hacks'],
  ],
};

const FINANCE_ADVANCED: LearningPlan = {
  track: 'finance',
  level: 'advanced',
  summary: 'Master advanced DeFi concepts: yield strategies, MEV economics, cross-chain finance, and protocol-level risk assessment.',
  modules: [
    {
      id: 'hyperliquid-case-study-adv',
      title: 'Hyperliquid: A Case Study in Protocol Tokens',
      description: 'Examine Hyperliquid (HYPE) — a decentralized perpetuals exchange that grew to surpass Solana in market cap by mid-2026.',
      whyItMatters: 'Hyperliquid shows how a protocol can capture value through fees, community distribution, and product-market fit.',
      objectives: [
        'Explain what a perpetuals DEX is and why it attracts volume',
        'Understand how Hyperliquid distributed HYPE (no VCs, airdrop-first)',
        'Read protocol revenue and see how it flows back to token holders',
        'Evaluate why HYPE grew from launch to top-10 asset and what risks remain',
      ],
      estimatedMinutes: 35,
      difficulty: 'intermediate',
      tags: ['hyperliquid', 'HYPE', 'perps', 'case-study', 'DeFi'],
    },
    EXTRA_MODULES['defi-hacks'],
    ADVANCED_MODULES['defi-yield-strategies'],
    ADVANCED_MODULES['mev-and-pbs'],
    ADVANCED_MODULES['cross-chain-interop'],
    {
      id: 'risk-management-defi-adv',
      title: 'DeFi Risk Management',
      description: 'Understand smart contract risk, liquidation mechanics, impermanent loss, and how to size positions so a single exploit does not wipe you out.',
      whyItMatters: 'DeFi yields are real, but so are the risks.',
      objectives: [
        'Name the top 5 DeFi risk categories: smart contract, oracle, liquidity, protocol, regulatory',
        'Understand how lending liquidations work and how to avoid them',
        'Calculate impermanent loss on an LP position',
        'Apply a simple rule: never put more in a single protocol than you can afford to lose',
      ],
      estimatedMinutes: 35,
      difficulty: 'intermediate',
      tags: ['risk', 'DeFi', 'security', 'lending'],
    },
  ],
};

// ── AI Track ─────────────────────────────────────────────────────────────────
const AI_BEGINNER: LearningPlan = {
  track: 'ai',
  level: 'beginner',
  summary: 'Understand how AI actually works, why it\'s converging with crypto, and what privacy-first AI means for you — no technical background required.',
  modules: [
    EXTRA_MODULES['how-llms-actually-work'],
    EXTRA_MODULES['venice-ai'],
    {
      id: 'ai-vs-traditional-software',
      title: 'AI vs Traditional Software: What Changed',
      description: 'Understand the fundamental shift from rule-based programming to statistical models that learn from data — and why this changes everything about how we build.',
      whyItMatters: 'Knowing the difference between deterministic software and probabilistic AI is the foundation of understanding everything from chatbot behavior to agent autonomy.',
      objectives: [
        'Explain how traditional software (if-then) differs from ML models (pattern recognition)',
        'Understand why AI systems produce different outputs for the same input',
        'Recognize the types of problems AI is good at vs bad at',
        'Describe how training data quality shapes model behavior',
      ],
      estimatedMinutes: 20,
      difficulty: 'beginner',
      tags: ['AI', 'fundamentals', 'comparison'],
    },
    EXTRA_MODULES['ai-crypto-convergence'],
  ],
};

const AI_INTERMEDIATE: LearningPlan = {
  track: 'ai',
  level: 'intermediate',
  summary: 'Go deeper into how AI agents work, why prompt injection is the new attack vector, and how AI and crypto infrastructure are merging in practice.',
  modules: [
    EXTRA_MODULES['how-llms-actually-work'],
    EXTRA_MODULES['venice-ai'],
    EXTRA_MODULES['ai-agents-onchain'],
    EXTRA_MODULES['ai-security-prompt-injection'],
    EXTRA_MODULES['ai-crypto-convergence'],
    {
      id: 'ai-agent-tool-use',
      title: 'AI Agent Tool Use & Autonomy',
      description: 'Explore how AI agents use tools — APIs, wallets, databases — to take actions beyond just generating text, and the safety implications of giving agents real-world capabilities.',
      whyItMatters: 'Tool-using agents are the bridge between "AI that talks" and "AI that does." Understanding tool use is key to evaluating agent safety and capability.',
      objectives: [
        'Explain how an LLM can call external APIs, databases, or smart contracts',
        'Understand the function-calling pattern and structured output formats',
        'Evaluate what happens when an agent gets access to signing keys and money',
        'Apply a risk framework: what permissions should an agent never have?',
      ],
      estimatedMinutes: 25,
      difficulty: 'intermediate',
      tags: ['AI', 'agents', 'tools', 'safety'],
    },
  ],
};

const AI_ADVANCED: LearningPlan = {
  track: 'ai',
  level: 'advanced',
  summary: 'Master the deep intersection of AI and crypto: zkML, agent architectures, decentralized compute infrastructure, and AI security at scale.',
  modules: [
    EXTRA_MODULES['ai-agents-onchain'],
    EXTRA_MODULES['ai-security-prompt-injection'],
    EXTRA_MODULES['ai-crypto-convergence'],
    {
      id: 'ai-agent-tool-use-adv',
      title: 'AI Agent Tool Use & Autonomy',
      description: 'Explore how AI agents use tools to take actions beyond just generating text, and the safety implications of giving agents real-world capabilities.',
      whyItMatters: 'Tool-using agents are the bridge between "AI that talks" and "AI that does."',
      objectives: [
        'Explain how an LLM can call external APIs, databases, or smart contracts',
        'Understand the function-calling pattern and structured output formats',
        'Evaluate what happens when an agent gets access to signing keys and money',
        'Apply a risk framework: what permissions should an agent never have?',
      ],
      estimatedMinutes: 25,
      difficulty: 'intermediate',
      tags: ['AI', 'agents', 'tools', 'safety'],
    },
    ADVANCED_MODULES['zkml-intro'],
    {
      id: 'building-an-ai-agent',
      title: 'Building Your First On-Chain AI Agent',
      description: 'Walk through the architecture of an agent that reads on-chain data, makes decisions via an LLM, and executes transactions — from design to deployment.',
      whyItMatters: 'The best way to understand agent risk is to build one. This module gives you the mental model for every agent you\'ll encounter.',
      objectives: [
        'Design an agent loop: perceive → reason → act → observe',
        'Implement a simple agent that monitors a wallet and sends alerts',
        'Understand how to safely manage private keys for an autonomous agent',
        'Deploy a basic agent and evaluate when human-in-the-loop is needed',
      ],
      estimatedMinutes: 40,
      difficulty: 'advanced',
      tags: ['AI', 'agents', 'development', 'autonomy'],
    },
  ],
};

// ── Creator Track ────────────────────────────────────────────────────────────
const CREATOR_BEGINNER: LearningPlan = {
  track: 'creator',
  level: 'beginner',
  summary: 'Start building on Web3: understand smart contracts, NFTs, developer tooling, and how to go from idea to deployed project.',
  modules: [
    {
      id: 'what-is-a-smart-contract',
      title: 'What Is a Smart Contract?',
      description: 'Understand what smart contracts are, how they execute on the EVM, and why "code is law" is both powerful and dangerous.',
      whyItMatters: 'Smart contracts are the building blocks of every dApp, token, and DAO. Understanding them is the first step to building anything.',
      objectives: [
        'Explain what a smart contract is and how it runs on-chain',
        'Understand the concept of immutable deployed code',
        'Read a simple smart contract (token transfer) and understand what it does',
        'Describe the difference between deploying and interacting with a contract',
      ],
      estimatedMinutes: 25,
      difficulty: 'beginner',
      tags: ['smart-contracts', 'fundamentals', 'EVM'],
    },
    {
      id: 'nfts-beyond-art',
      title: 'NFTs Beyond Art: Utility and Use Cases',
      description: 'Explore how NFTs power gaming items, event tickets, music royalties, domain names, and membership passes — not just profile pictures.',
      whyItMatters: 'NFTs are a general-purpose ownership primitive. Understanding the full range of use cases opens creative and entrepreneurial doors.',
      objectives: [
        'Explain how an NFT represents ownership of any unique digital or physical asset',
        'Compare NFT use cases: art, gaming, ticketing, music, identity, DeFi collateral',
        'Understand the difference between on-chain and off-chain NFT metadata',
        'Set up and mint a simple NFT on a testnet',
      ],
      estimatedMinutes: 25,
      difficulty: 'beginner',
      tags: ['NFT', 'creator', 'ownership'],
    },
    {
      id: 'dapp-architecture',
      title: 'dApp Architecture: Front to Back',
      description: 'Understand how decentralized applications work end-to-end: frontend, smart contracts, indexers, and storage — and how they differ from Web2 apps.',
      whyItMatters: 'Knowing the full stack helps you plan, build, and debug — and avoids the "it works on my machine" trap of Web3 development.',
      objectives: [
        'Map out a dApp architecture: wallet connection, contract interaction, data indexing',
        'Understand how a frontend reads and writes to the blockchain',
        'Explain what an indexer (The Graph) does and why you need one',
        'Compare on-chain vs off-chain storage strategies (IPFS, Arweave, traditional DBs)',
      ],
      estimatedMinutes: 30,
      difficulty: 'beginner',
      tags: ['dApp', 'architecture', 'development'],
    },
    {
      id: 'developer-tooling',
      title: 'Web3 Developer Tooling',
      description: 'Survey the tools every Web3 developer needs: Remix, Hardhat, Foundry, wagmi, viem, The Graph, and Tenderly — when to use each.',
      whyItMatters: 'The right tools cut months off your learning curve. This module gives you a map so you spend time building, not researching.',
      objectives: [
        'Compare development frameworks: Hardhat vs Foundry vs Remix',
        'Understand how wagmi/viem simplify frontend-onchain interaction',
        'Set up a local development environment with a forked mainnet',
        'Use a block explorer + Tenderly to debug a failed transaction',
      ],
      estimatedMinutes: 25,
      difficulty: 'beginner',
      tags: ['tools', 'development', 'solidity'],
    },
    {
      id: 'solidity-basics',
      title: 'Solidity Fundamentals',
      description: 'Write your first Solidity contracts: state variables, functions, mappings, events, and the basic patterns every contract uses.',
      whyItMatters: 'Solidity is the dominant language for Ethereum smart contracts. Knowing the basics lets you read and write real contracts.',
      objectives: [
        'Write a simple storage contract with read/write functions',
        'Understand state variables, mappings, and structs',
        'Use events for logging and off-chain notification',
        'Deploy and interact with your contract on a testnet',
      ],
      estimatedMinutes: 35,
      difficulty: 'beginner',
      tags: ['solidity', 'smart-contracts', 'development'],
    },
    ADVANCED_MODULES['creator-economics'],
  ],
};

const CREATOR_INTERMEDIATE: LearningPlan = {
  track: 'creator',
  level: 'intermediate',
  summary: 'Level up your building skills: ERC standards, testing, composability, and the economics of creating on Web3.',
  modules: [
    {
      id: 'solidity-basics-int',
      title: 'Solidity: Intermediate Patterns',
      description: 'Move beyond basic contracts: inheritance, libraries, modifiers, error handling, and the patterns that production code relies on.',
      whyItMatters: 'Real contracts use inheritance, libraries, and careful error handling. These patterns separate tutorial code from deployable systems.',
      objectives: [
        'Use inheritance to compose contract behavior safely',
        'Apply custom modifiers for access control and validation',
        'Understand reentrancy guards and why they\'re essential',
        'Use libraries for reusable, gas-efficient code',
      ],
      estimatedMinutes: 30,
      difficulty: 'intermediate',
      tags: ['solidity', 'patterns', 'development'],
    },
    {
      id: 'erc-standards',
      title: 'ERC Standards: The Building Blocks',
      description: 'Deep dive into the ERC standards that power the ecosystem: ERC-20 (tokens), ERC-721 (NFTs), ERC-1155 (multi-token), and emerging standards.',
      whyItMatters: 'Implementing ERC standards correctly is the difference between a trusted contract and one that loses user funds.',
      objectives: [
        'Implement ERC-20, ERC-721, and ERC-1155 from scratch or via OpenZeppelin',
        'Understand extension standards: ERC-4626 (vaults), ERC-6551 (token-bound accounts)',
        'Compare the tradeoffs of different implementation approaches',
        'Test your implementation against the standard interface',
      ],
      estimatedMinutes: 35,
      difficulty: 'intermediate',
      tags: ['ERC', 'standards', 'solidity', 'NFT'],
    },
    {
      id: 'smart-contract-testing',
      title: 'Testing Smart Contracts',
      description: 'Write comprehensive test suites with Foundry: unit tests, fuzz tests, invariant tests, and fork tests that simulate mainnet conditions.',
      whyItMatters: 'Testing catches bugs before they cost millions. The DeFi hacks history is largely a history of untested edge cases.',
      objectives: [
        'Write unit tests for a simple token contract',
        'Use fuzz testing to find edge cases automatically',
        'Set up fork tests that simulate real mainnet state',
        'Integrate test coverage into your CI pipeline',
      ],
      estimatedMinutes: 30,
      difficulty: 'intermediate',
      tags: ['testing', 'foundry', 'security', 'development'],
    },
    {
      id: 'composability',
      title: 'Composability: The Web3 Superpower',
      description: 'Understand how smart contracts can call each other, compose like LEGO blocks, and why this property makes Web3 fundamentally different from Web2.',
      whyItMatters: 'Composability is what lets a single wallet interact with dozens of protocols seamlessly. Understanding it unlocks creative product design.',
      objectives: [
        'Explain how a contract can call another contract\'s functions',
        'Understand the delegatecall pattern and proxy contracts',
        'Build a simple contract that composes with existing DeFi protocols',
        'Identify the risks: composability amplifies both opportunity and exploit surface',
      ],
      estimatedMinutes: 25,
      difficulty: 'intermediate',
      tags: ['composability', 'architecture', 'DeFi'],
    },
    ADVANCED_MODULES['creator-economics'],
  ],
};

const CREATOR_ADVANCED: LearningPlan = {
  track: 'creator',
  level: 'advanced',
  summary: 'Master production-grade smart contract development: architecture patterns, gas optimization, security, and advanced Solidity.',
  modules: [
    {
      id: 'erc-standards-adv',
      title: 'ERC Standards: The Building Blocks',
      description: 'Deep dive into the ERC standards that power the ecosystem.',
      whyItMatters: 'Implementing ERC standards correctly is the difference between a trusted contract and one that loses user funds.',
      objectives: [
        'Implement ERC-20, ERC-721, and ERC-1155 from scratch or via OpenZeppelin',
        'Understand extension standards: ERC-4626 (vaults), ERC-6551 (token-bound accounts)',
        'Compare the tradeoffs of different implementation approaches',
        'Test your implementation against the standard interface',
      ],
      estimatedMinutes: 35,
      difficulty: 'intermediate',
      tags: ['ERC', 'standards', 'solidity', 'NFT'],
    },
    ADVANCED_MODULES['smart-contract-architecture'],
    ADVANCED_MODULES['gas-optimization'],
    {
      id: 'smart-contract-auditing',
      title: 'Smart Contract Auditing & Security',
      description: 'Learn how auditors find vulnerabilities: reentrancy, integer overflows, access control flaws, and logic bugs — then apply these techniques to your own code.',
      whyItMatters: 'Professional developers audit their own code before anyone else does. An auditing mindset catches bugs before they become exploits.',
      objectives: [
        'Recreate and fix the classic reentrancy, overflow, and access-control vulnerabilities',
        'Use static analysis tools (Slither, Mythril) to scan contracts automatically',
        'Write an audit report for a simple contract covering 5 key areas',
        'Understand when to hire a professional auditor and what deliverables to expect',
      ],
      estimatedMinutes: 35,
      difficulty: 'advanced',
      tags: ['security', 'auditing', 'solidity', 'testing'],
    },
    EXTRA_MODULES['defi-hacks'],
    ADVANCED_MODULES['creator-economics'],
  ],
};

// ─── Level-aware safety plan (survival track, merged into decentralization) ──

const SAFETY_PLAN: LearningPlan = {
  track: 'decentralization',
  level: 'beginner',
  summary: 'Learn the habits that help you participate in crypto without letting one scam, signature, or oversized bet knock you out of the ecosystem.',
  modules: SAFETY_MODULES as unknown as LearningModule[],
};

// ─── Plan lookup ──────────────────────────────────────────────────────────────

const PLANS_BY_TRACK_LEVEL: Record<string, Record<string, LearningPlan>> = {
  decentralization: {
    beginner: DECENTRALIZATION_BEGINNER,
    intermediate: DECENTRALIZATION_INTERMEDIATE,
    advanced: DECENTRALIZATION_ADVANCED,
  },
  finance: {
    beginner: FINANCE_BEGINNER,
    intermediate: FINANCE_INTERMEDIATE,
    advanced: FINANCE_ADVANCED,
  },
  ai: {
    beginner: AI_BEGINNER,
    intermediate: AI_INTERMEDIATE,
    advanced: AI_ADVANCED,
  },
  creator: {
    beginner: CREATOR_BEGINNER,
    intermediate: CREATOR_INTERMEDIATE,
    advanced: CREATOR_ADVANCED,
  },
};

// ─── Legacy redirect map ─────────────────────────────────────────────────────

const LEGACY_TRACK_MAP: Record<string, string> = {
  learner: 'decentralization',
  financial: 'finance',
  survival: 'decentralization', // merged into decentralization
};

function fallbackForTrack(track: string, level: string): LearningPlan {
  // Map legacy tracks to new ones
  const normalizedTrack = LEGACY_TRACK_MAP[track] || track;

  // "All" is a real choice in the UI, not an alias for the default track.
  // Build a balanced cross-track plan from the selected level so the fallback
  // remains useful even when AI personalization is unavailable.
  if (normalizedTrack === 'all') {
    const levelPlans = Object.values(PLANS_BY_TRACK_LEVEL)
      .map((plans) => plans[level] || plans.beginner)
      .filter(Boolean);
    const seen = new Set<string>();
    const modules = levelPlans
      .flatMap((plan) => plan.modules)
      .filter((module) => {
        if (seen.has(module.id)) return false;
        seen.add(module.id);
        return true;
      })
      .slice(0, 8);

    return {
      track: 'all',
      level: level as LearningPlan['level'],
      summary: 'A balanced path across decentralization, finance, AI, and creator skills — matched to your experience level.',
      modules,
    };
  }

  const trackPlans = PLANS_BY_TRACK_LEVEL[normalizedTrack];
  if (!trackPlans) {
    // Unknown track — default to decentralization beginner
    return { ...DECENTRALIZATION_BEGINNER, track: 'decentralization', level: 'beginner' };
  }

  const plan = trackPlans[level] || trackPlans.beginner;
  return { ...plan, track: normalizedTrack as LearningPlan['track'], level: level as LearningPlan['level'] };
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const track = searchParams.get('track') ?? 'decentralization';
  const level = searchParams.get('level') ?? 'beginner';

  // Map legacy tracks for backward compat
  const normalizedTrack = LEGACY_TRACK_MAP[track] || track;

  // If user explicitly requests the "survival" safety track
  if (track === 'survival') {
    return NextResponse.json({ ...SAFETY_PLAN, level });
  }

  let fallback = fallbackForTrack(normalizedTrack, level);

  // Enrich with KB modules
  try {
    const kbModules = await getKBModulesForTrack(normalizedTrack, level);
    if (kbModules.length > 0) {
      const deduped = deduplicateModules(fallback.modules, kbModules);
      fallback = {
        ...fallback,
        modules: [...fallback.modules, ...deduped.slice(0, 3)],
      };
    }
  } catch {
    // KB enrichment is best-effort; silent fallback
  }

  return NextResponse.json(fallback);
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const { success: rateLimitOk } = rateLimit(`learning-plan:${ip}`, 5, 3600);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Too many requests. Please try again in an hour.' }, { status: 429 });
    }

    const { track, level, specificGoals } = await req.json();

    if (!track || !level) {
      return NextResponse.json(
        { error: 'track and level are required' },
        { status: 400 },
      );
    }

    // Map legacy tracks for backward compat
    const normalizedTrack = LEGACY_TRACK_MAP[track] || track;

    // The safety curriculum is intentionally curated rather than generated:
    // safety guidance should be consistent, source-backed, and fast.
    if (track === 'survival') {
      return NextResponse.json({ ...SAFETY_PLAN, level });
    }

    // Fetch KB modules to include as context for the AI
    let kbContext = '';
    try {
      const kbModules = await getKBModulesForTrack(normalizedTrack, level);
      if (kbModules.length > 0) {
        kbContext = `\n\nRelevant Knowledge Base articles to draw from:\n${kbModules.map((m) => `- "${m.title}": ${m.description}`).join('\n')}`;
      }
    } catch {
      // KB enrichment is best-effort
    }

    const trackDescriptions: Record<string, string> = {
      decentralization: 'understand Web3 concepts, wallets, blockchains, DAOs, and how decentralized systems work',
      finance: 'manage assets, understand DeFi tokens, tokenomics, portfolio management, and on-chain financial literacy',
      ai: 'understand AI agents, LLMs, how AI intersects with crypto, AI security, and the AI-crypto frontier',
      creator: 'build things on-chain, write smart contracts, create NFTs, and understand Web3 developer tooling',
      all: 'full picture — a broad curriculum spanning decentralization, finance, AI, and building on Web3',
    };

    const trackDescription = trackDescriptions[normalizedTrack] || trackDescriptions.decentralization;

    const financeTrackGuidance = normalizedTrack === 'finance' || normalizedTrack === 'all' ? `
IMPORTANT — Token & DeFi curriculum requirements:
- Include a foundational module on "What is a crypto token?" covering utility tokens, governance tokens, LP tokens
- Include a tokenomics module covering supply, vesting, FDV vs market cap, and how to spot red flags
- Include a module specifically on Hyperliquid (HYPE token): it is a decentralized perpetuals exchange that grew to a top-10 asset by mid-2026, surpassing Solana's market cap. Cover why its community-first distribution (no VCs, large airdrop) and fee revenue model made it a notable case study in protocol value accrual. Arthur Hayes famously targeted $150 for HYPE. Use this as a real-world example of evaluating a protocol token.
- Include modules on DeFi portfolio management, governance tokens, and DeFi risk management (liquidations, impermanent loss, smart contract risk)
` : '';

    const prompt = `You are a Web3 / decentralization education expert. Create a personalized learning plan as a JSON object.

User profile:
- Track: ${normalizedTrack} (${trackDescription})
- Level: ${level}
- Specific goals: ${specificGoals || 'not provided'}
${financeTrackGuidance}
${kbContext}
Available topic areas to draw from (pick the most relevant for this user's track and goals):
- Wallet basics: seed phrases, hot/cold wallets, hardware wallets, MetaMask, multisig
- Ethereum history: Vitalik whitepaper (2013), genesis block (2015), The Merge (2022), EIP-1559, Dencun upgrade
- How Ethereum works: EVM, gas, smart contracts, L2s (Arbitrum, Optimism, Base)
- Smart contract development: Solidity, deployment, audits, security, real examples
- DAO history: The DAO hack (2016), MolochDAO, Nouns, ConstitutionDAO, governance evolution
- DeFi security & hacks: major hacks timeline (DAO hack, Ronin bridge, Wormhole), attack vectors, opsec
- Security in decentralization: smart contract audits, rug pulls, phishing, how to stay safe
- Farcaster history: Dan Romero + Varun Srinivasan, protocol evolution, FIDs, Hubs, Frames
- On-chain data & storage: IPFS, Arweave, Filecoin, The Graph, calldata, EIP-4844
- AI & machine learning (framed for a crypto-curious audience, not a data-science course):
  - How LLMs actually work: tokens, training, why models hallucinate, comparing Claude/GPT/open models
  - AI agents on-chain: agents that own wallets and sign transactions, the perceive-decide-act loop, real examples like this app's own @thehomie
  - Venice.ai: privacy-first AI on decentralized infrastructure, why data ownership matters for AI the same way it does for money
  - Prompt injection & AI security: the "flash loan attack" of the AI world, how agents that read untrusted content get manipulated, defensive patterns
  - AI x crypto convergence: decentralized compute (Render, Akash, io.net), agent-to-agent stablecoin payments, on-chain content provenance — and how to tell real infrastructure from hype
- Web3 philosophy: decentralization principles, censorship resistance, permissionless systems, ownership
- NFTs: ERC-721, use cases beyond art, gaming, ticketing, music royalties
- DAOs: governance tokens, voting, Snapshot, Tally, Gnosis Safe, real examples

Return ONLY valid JSON — no markdown, no code fences, no explanation. Match this TypeScript type exactly:

{
  "track": "${normalizedTrack}",
  "level": "${level}",
  "summary": "1-2 sentence personalized intro that references their goals and level",
  "modules": [
    {
      "id": "slug-style-id",
      "title": "Module Title",
      "description": "1-2 sentences describing what the module covers",
      "whyItMatters": "1 sentence explaining the practical importance",
      "objectives": ["bullet 1", "bullet 2", "bullet 3", "bullet 4"],
      "estimatedMinutes": 20,
      "difficulty": "beginner|intermediate|advanced",
      "tags": ["tag1", "tag2"]
    }
  ]
}

Requirements:
- Include 6-8 modules ordered from foundational to advanced
- Tailor content specifically to the "${normalizedTrack}" track and "${level}" level
- If specific goals are provided, weave them into the module selection and summary
- Mix theory and practical skills
- Difficulty values must be exactly: beginner, intermediate, or advanced
- estimatedMinutes should be realistic (15-45 min per module)
- ids must be lowercase kebab-case slugs`;

    const response = await llmChat({
      messages: [{ role: 'system', content: 'You are a Web3 / decentralization education expert. Create a personalized learning plan as a JSON object.' }, { role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 3000,
      timeoutMs: 25000,
    });
    const content = response.message.content ?? '';

    // Strip any accidental markdown code fences
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();

    let plan: LearningPlan;
    try {
      plan = JSON.parse(cleaned) as LearningPlan;
    } catch (parseError) {
      console.error('[learning-plan] Failed to parse AI response, using fallback', parseError);
      const fallback = fallbackForTrack(normalizedTrack, level);
      return NextResponse.json(fallback);
    }

    // Ensure the track/level from the request are in the response
    plan.track = normalizedTrack as LearningPlan['track'];
    plan.level = level as LearningPlan['level'];

    return NextResponse.json(plan);
  } catch (error: any) {
    console.error('[learning-plan] Error:', error?.message || error);
    return NextResponse.json(
      { error: 'Failed to generate learning plan' },
      { status: 500 },
    );
  }
}