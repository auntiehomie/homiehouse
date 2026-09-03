/**
 * Lesson warmup script — pre-generates all lesson modules into the Upstash
 * cache so users get instant cache hits instead of waiting ~60s for LLM
 * generation (which often times out on Vercel's serverless functions).
 *
 * Run with: npx tsx scripts/warmup-lessons.ts
 *
 * Requires UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN + OPENROUTER_API_KEY
 * in .env.local (or exported in the shell environment).
 *
 * The script calls the lesson API for each module with the v7 cache key,
 * which matches what the production API route uses. Once cached, the lesson
 * is served instantly for 30 days.
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!UPSTASH_URL || !UPSTASH_TOKEN) {
  console.error('❌ Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
  process.exit(1);
}

if (!OPENROUTER_KEY && !GEMINI_KEY) {
  console.error('❌ Missing OPENROUTER_API_KEY or GEMINI_API_KEY — need at least one LLM provider');
  process.exit(1);
}

// ─── All module definitions (mirrors src/app/api/learning-plan/route.ts) ────

interface Module {
  id: string;
  title: string;
  description: string;
  whyItMatters: string;
  objectives: string[];
  estimatedMinutes: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
}

const FINANCIAL_MODULES: Module[] = [
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
    id: 'defi-protocol-tokens',
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
    id: 'on-chain-portfolio',
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
];

const LEARNER_MODULES: Module[] = [
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
];

const EXTRA_MODULES: Module[] = [
  {
    id: 'ethereum-history',
    title: 'The History of Ethereum',
    description: "Trace Ethereum from Vitalik's 2013 whitepaper through the genesis block, The DAO hack, The Merge, and the upgrades reshaping the chain today.",
    whyItMatters: "Understanding Ethereum's history explains every design decision the ecosystem has made — and why they matter for the future.",
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
  {
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
  {
    id: 'defi-hacks',
    title: 'A History of DeFi Hacks',
    description: 'Walk through the biggest DeFi exploits — Ronin bridge ($625M), Wormhole ($320M), Euler Finance ($197M) — and understand the attack vectors that made them possible.',
    whyItMatters: 'Every major DeFi hack teaches something about system design. Knowing this history makes you a better evaluator of protocols and a safer participant.',
    objectives: [
      'Name the top 5 DeFi hacks by size and describe how each happened',
      'Explain the difference between reentrancy attacks, oracle manipulation, and bridge vulnerabilities',
      "Understand what a flash loan attack is and why it's unique to DeFi",
      'Apply a checklist for assessing protocol safety before depositing funds',
    ],
    estimatedMinutes: 35,
    difficulty: 'intermediate',
    tags: ['security', 'hacks', 'DeFi', 'risk'],
  },
  {
    id: 'farcaster-history',
    title: 'Farcaster: History & Protocol',
    description: 'Learn how Dan Romero and Varun Srinivasan built a "sufficiently decentralized" social protocol from scratch — and how it evolved from invite-only to Frames and beyond.',
    whyItMatters: "Farcaster is the infrastructure for crypto-native social. Understanding its design decisions explains why it works differently from every other platform you've used.",
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
  {
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
  {
    id: 'venice-ai',
    title: 'Venice.ai: Private AI on Web3',
    description: 'Explore Venice.ai — a privacy-first AI platform built on decentralized infrastructure where your conversations are never stored, logged, or used for training.',
    whyItMatters: 'As AI becomes central to daily life, the question of who controls your data becomes critical. Venice shows how Web3 principles apply to AI infrastructure.',
    objectives: [
      'Explain how Venice.ai differs from ChatGPT and Claude in terms of data privacy',
      'Understand how decentralized inference keeps your prompts private',
      "Explore Venice's model selection and how open-source models power it",
      "Connect Venice's model to the broader Web3 principle of user-owned data and permissionless access",
    ],
    estimatedMinutes: 20,
    difficulty: 'beginner',
    tags: ['venice', 'AI', 'privacy', 'web3'],
  },
  {
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
  {
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
  {
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
  {
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
];

const ALL_MODULES: Module[] = [
  ...LEARNER_MODULES,
  ...FINANCIAL_MODULES,
  ...EXTRA_MODULES,
];

// Deduplicate by id
const UNIQUE_MODULES = Array.from(
  new Map(ALL_MODULES.map((m) => [m.id, m])).values()
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function checkCache(moduleId: string, eli5 = false): Promise<boolean> {
  const key = `lesson:v7:${moduleId}${eli5 ? ':eli5' : ''}`;
  const url = `${UPSTASH_URL}/get/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  if (!res.ok) return false;
  const data = await res.json() as any;
  return data?.result !== null;
}

async function warmLesson(mod: Module): Promise<'cached' | 'generated' | 'failed'> {
  // Check if already cached
  try {
    const exists = await checkCache(mod.id);
    if (exists) {
      console.log(`  ✓ ${mod.id} — already cached`);
      return 'cached';
    }
  } catch {
    // ignore cache check errors, proceed to generate
  }

  // Generate by calling the lesson API (same path the app uses)
  // We call the local API route which handles LLM generation + caching.
  // In production this would be homiehouse.lol/api/lesson, but we can
  // also call it directly if running locally with the dev server.
  const API_URL = process.env.WARMUP_API_URL || 'http://localhost:3000';
  const endpoint = `${API_URL}/api/lesson`;

  console.log(`  ⏳ ${mod.id} — generating...`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000); // 2 min timeout

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moduleId: mod.id,
        title: mod.title,
        description: mod.description,
        whyItMatters: mod.whyItMatters,
        objectives: mod.objectives,
        difficulty: mod.difficulty,
        tags: mod.tags,
        eli5: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`  ✗ ${mod.id} — HTTP ${res.status}: ${text.slice(0, 200)}`);
      return 'failed';
    }

    const data = await res.json() as any;
    const hasQuiz = Array.isArray(data?.quiz) && data.quiz.length > 0;
    const hasConcepts = Array.isArray(data?.concepts) && data.concepts.length > 0;

    if (!hasQuiz || !hasConcepts) {
      console.error(`  ⚠ ${mod.id} — generated but missing quiz or concepts (fallback?)`);
      return 'failed';
    }

    // Check quiz answer distribution
    const correctIndices = data.quiz.map((q: any) => q.correctIndex);
    const allSame = correctIndices.every((v: number) => v === correctIndices[0]);
    const distribution = correctIndices.reduce((acc: Record<number, number>, v: number) => {
      acc[v] = (acc[v] || 0) + 1;
      return acc;
    }, {});

    console.log(`  ✅ ${mod.id} — ${data.concepts.length} concepts, ${data.quiz.length} quiz Qs, correctIndex: [${correctIndices.join(', ')}]${allSame ? ' ⚠️ ALL SAME!' : ''}`);
    return 'generated';
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      console.error(`  ✗ ${mod.id} — timed out (120s)`);
    } else {
      console.error(`  ✗ ${mod.id} — ${err?.message || err}`);
    }
    return 'failed';
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n📚 Lesson Warmup — ${UNIQUE_MODULES.length} modules\n`);

  let cached = 0;
  let generated = 0;
  let failed = 0;
  const failedIds: string[] = [];

  for (const mod of UNIQUE_MODULES) {
    const result = await warmLesson(mod);
    if (result === 'cached') cached++;
    else if (result === 'generated') generated++;
    else { failed++; failedIds.push(mod.id); }
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`📊 Results: ${cached} cached, ${generated} generated, ${failed} failed`);
  if (failedIds.length > 0) {
    console.log(`\n❌ Failed modules:`);
    failedIds.forEach((id) => console.log(`   - ${id}`));
  }
  console.log(`\n${cached + generated}/${UNIQUE_MODULES.length} lessons now served from cache.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
