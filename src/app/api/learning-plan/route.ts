import { NextRequest, NextResponse } from 'next/server';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGroq } from '@langchain/groq';

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
  track: 'learner' | 'creator' | 'financial' | 'all';
  level: 'beginner' | 'intermediate' | 'advanced';
  summary: string;
  modules: LearningModule[];
}

function getModel() {
  if (process.env.ANTHROPIC_API_KEY)
    return new ChatAnthropic({ model: 'claude-sonnet-4-6', temperature: 0.7 });
  if (process.env.GROQ_API_KEY)
    return new ChatGroq({ model: 'llama-3.3-70b-versatile', temperature: 0.7 });
  if (process.env.OPENAI_API_KEY)
    return new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0.7 });
  return null;
}

const FALLBACK_FINANCIAL_PLAN: LearningPlan = {
  track: 'financial',
  level: 'beginner',
  summary:
    'Build real financial literacy in Web3 — from what a token actually is, to evaluating tokenomics, to understanding the protocols (like Hyperliquid) reshaping decentralized finance.',
  modules: [
    {
      id: 'what-is-a-token',
      title: 'What Is a Crypto Token?',
      description:
        'Break down the different types of crypto tokens — utility, governance, LP, and revenue-sharing — and understand how they differ from coins.',
      whyItMatters:
        'Every financial decision in Web3 involves tokens. Knowing what you actually own is the foundation of everything else.',
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
      description:
        "Learn how to evaluate a token's supply, distribution, vesting schedules, and emission rate — the signals that separate strong projects from pump-and-dumps.",
      whyItMatters:
        'Tokenomics determines long-term value. A great product with bad tokenomics can still destroy your investment.',
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
      id: 'hyperliquid-case-study',
      title: 'Hyperliquid: A Case Study in Protocol Tokens',
      description:
        'Examine Hyperliquid (HYPE) — a decentralized perpetuals exchange that grew to surpass Solana in market cap by mid-2026 — as a real-world lesson in protocol value accrual.',
      whyItMatters:
        'Hyperliquid shows how a protocol can capture value through fees, community distribution, and product-market fit. Understanding it sharpens your lens for evaluating any token.',
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
      id: 'defi-protocol-tokens',
      title: 'DeFi Protocol Tokens & Governance',
      description:
        'Learn how governance tokens like UNI, AAVE, and MKR work — and when holding them makes sense beyond speculation.',
      whyItMatters:
        'Protocol tokens let you participate in shaping the future of financial infrastructure. They also earn fees when designed well.',
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
      id: 'on-chain-portfolio',
      title: 'Building & Tracking an On-Chain Portfolio',
      description:
        'Set up a real on-chain portfolio using tools like Zapper, DeBank, or Zerion. Understand gas costs, slippage, and how to think about position sizing.',
      whyItMatters:
        'Managing your own assets on-chain is the whole point of DeFi. A clear view of your portfolio is your most important risk tool.',
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
      id: 'risk-management-defi',
      title: 'DeFi Risk Management',
      description:
        'Understand smart contract risk, liquidation mechanics, impermanent loss, and how to size positions so a single exploit does not wipe you out.',
      whyItMatters:
        'DeFi yields are real, but so are the risks. The investors who survive long-term are those who understand what can go wrong.',
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
      'Connect Venice\'s model to the broader Web3 principle of user-owned data and permissionless access',
    ],
    estimatedMinutes: 20,
    difficulty: 'beginner',
    tags: ['venice', 'AI', 'privacy', 'web3'],
  },
  'how-llms-actually-work': {
    id: 'how-llms-actually-work',
    title: 'How AI Actually "Thinks": LLMs in Plain English',
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
      'Identify real examples: trading agents, social agents like @homiehouselol, and agent-to-agent marketplaces',
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

const FALLBACK_PLAN: LearningPlan = {
  track: 'learner',
  level: 'beginner',
  summary:
    'Welcome to your decentralization journey! This plan will take you from zero to confidently navigating the Web3 world, starting with the essentials.',
  modules: [
    {
      id: 'wallet-basics',
      title: 'Your First Crypto Wallet',
      description:
        'Learn what a crypto wallet is, how it works, and how to set one up safely. Understand the difference between custodial and self-custody wallets.',
      whyItMatters:
        'Your wallet is your identity and bank account in Web3 — without it, you cannot participate.',
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
      description:
        'Explore the core idea of decentralization — removing single points of control — and why it matters in finance, social media, and beyond.',
      whyItMatters:
        'Understanding decentralization lets you see why Web3 exists and what problems it is actually trying to solve.',
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
      description:
        'Dive into the mechanics of a blockchain — blocks, chains, consensus, and why data stored on-chain is practically immutable.',
      whyItMatters:
        'Knowing how blockchains work turns you from a consumer into someone who can evaluate any project or claim.',
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
      description:
        'Learn how your Ethereum address becomes your identity, how ENS names work, and the concept of on-chain reputation.',
      whyItMatters:
        "Your on-chain identity follows you everywhere — it's your reputation, your history, and your access pass.",
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
      description:
        'Discover Farcaster — a decentralized social protocol built on Ethereum — and how HomieHouse gives you a home in this ecosystem.',
      whyItMatters:
        'Farcaster is where crypto-native conversation happens; understanding it opens doors to community, information, and opportunity.',
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
    // AI/ML modules, framed for a crypto-curious audience rather than as a
    // standalone data-science course — ties into what learners are already here for.
    EXTRA_MODULES['how-llms-actually-work'],
    EXTRA_MODULES['venice-ai'],
    EXTRA_MODULES['ai-agents-onchain'],
  ],
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const track = searchParams.get('track') ?? 'learner';
  const level = searchParams.get('level') ?? 'beginner';
  const fallback = track === 'financial' ? FALLBACK_FINANCIAL_PLAN : FALLBACK_PLAN;
  return NextResponse.json({ ...fallback, track, level });
}

export async function POST(req: NextRequest) {
  try {
    const { track, level, specificGoals } = await req.json();

    if (!track || !level) {
      return NextResponse.json(
        { error: 'track and level are required' },
        { status: 400 },
      );
    }

    const model = getModel();

    if (!model) {
      console.warn('[learning-plan] No AI provider configured, returning fallback plan');
      const fallback = track === 'financial' ? FALLBACK_FINANCIAL_PLAN : FALLBACK_PLAN;
      return NextResponse.json({ ...fallback, track, level });
    }

    const financialTrackGuidance = track === 'financial' || track === 'all' ? `
IMPORTANT — Token & DeFi curriculum requirements:
- Include a foundational module on "What is a crypto token?" covering utility tokens, governance tokens, LP tokens
- Include a tokenomics module covering supply, vesting, FDV vs market cap, and how to spot red flags
- Include a module specifically on Hyperliquid (HYPE token): it is a decentralized perpetuals exchange that grew to a top-10 asset by mid-2026, surpassing Solana's market cap. Cover why its community-first distribution (no VCs, large airdrop) and fee revenue model made it a notable case study in protocol value accrual. Arthur Hayes famously targeted $150 for HYPE. Use this as a real-world example of evaluating a protocol token.
- Include modules on DeFi portfolio management, governance tokens, and DeFi risk management (liquidations, impermanent loss, smart contract risk)
` : '';

    const prompt = `You are a Web3 / decentralization education expert. Create a personalized learning plan as a JSON object.

User profile:
- Track: ${track} (learner = understand concepts, creator = build things on-chain, financial = manage assets and understand DeFi tokens, all = full picture)
- Level: ${level}
- Specific goals: ${specificGoals || 'not provided'}
${financialTrackGuidance}
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
  - AI agents on-chain: agents that own wallets and sign transactions, the perceive-decide-act loop, real examples like this app's own @homiehouselol
  - Venice.ai: privacy-first AI on decentralized infrastructure, why data ownership matters for AI the same way it does for money
  - Prompt injection & AI security: the "flash loan attack" of the AI world, how agents that read untrusted content get manipulated, defensive patterns
  - AI x crypto convergence: decentralized compute (Render, Akash, io.net), agent-to-agent stablecoin payments, on-chain content provenance — and how to tell real infrastructure from hype
- Web3 philosophy: decentralization principles, censorship resistance, permissionless systems, ownership
- NFTs: ERC-721, use cases beyond art, gaming, ticketing, music royalties
- DAOs: governance tokens, voting, Snapshot, Tally, Gnosis Safe, real examples

Return ONLY valid JSON — no markdown, no code fences, no explanation. Match this TypeScript type exactly:

{
  "track": "${track}",
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
- Tailor content specifically to the "${track}" track and "${level}" level
- If goals are provided, weave them into the module selection and summary
- Mix theory and practical skills
- Difficulty values must be exactly: beginner, intermediate, or advanced
- estimatedMinutes should be realistic (15-45 min per module)
- ids must be lowercase kebab-case slugs`;

    const response = await model.invoke(prompt);
    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

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
      const fallback = track === 'financial' ? FALLBACK_FINANCIAL_PLAN : FALLBACK_PLAN;
      return NextResponse.json({ ...fallback, track, level });
    }

    // Ensure the track/level from the request are in the response
    plan.track = track;
    plan.level = level;

    return NextResponse.json(plan);
  } catch (error: any) {
    console.error('[learning-plan] Error:', error?.message || error);
    return NextResponse.json(
      { error: 'Failed to generate learning plan' },
      { status: 500 },
    );
  }
}
