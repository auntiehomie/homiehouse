// Premium learning tracks — Pro-gated content covering advanced DeFi, trading safety,
// and creator economy. Free users see teasers; Pro subscribers get full access.
//
// Module structure mirrors safety-curriculum.ts for consistency.

export interface PremiumModule {
  id: string;
  title: string;
  description: string;
  whyItMatters: string;
  objectives: string[];
  estimatedMinutes: number;
  difficulty: 'intermediate' | 'advanced';
  tags: string[];
  track: 'defi' | 'trading' | 'creator';
}

export interface PremiumTrack {
  id: string;
  emoji: string;
  title: string;
  description: string;
  modules: PremiumModule[];
}

// ── Advanced DeFi Track ───────────────────────────────────────────────────────

const DEFI_MODULES: PremiumModule[] = [
  {
    id: 'prem-defi-yield',
    title: 'Yield Strategies: Lending, Staking, and LP Positions',
    description:
      'Understand how lending protocols, liquid staking, and AMM liquidity positions generate returns — and where the risks live in each model.',
    whyItMatters:
      'Yield is payment for taking risk. Knowing which risk you are being paid for separates strategy from gambling.',
    objectives: [
      'Compare lending, staking, and LP yield sources',
      'Calculate real vs nominal yield accounting for impermanent loss',
      'Evaluate protocol risk: TVL, audit history, admin keys, insurance',
      'Build a yield portfolio with correlated-risk awareness',
    ],
    estimatedMinutes: 20,
    difficulty: 'intermediate',
    tags: ['defi', 'yield', 'lending', 'liquidity'],
    track: 'defi',
  },
  {
    id: 'prem-defi-leverage',
    title: 'Leverage and Lending Loops',
    description:
      'Recursive borrowing, leveraged staking, and the liquidation cascade — how leverage amplifies both returns and wipeout risk.',
    whyItMatters:
      'Leverage is the most common way sophisticated DeFi users lose everything. Understanding liquidation mechanics is survival.',
    objectives: [
      'Model a leveraged lending loop step by step',
      'Calculate liquidation price for common strategies',
      'Recognize cascading liquidation risk across protocols',
      'Set stop-loss or deleverage triggers before they are needed',
    ],
    estimatedMinutes: 22,
    difficulty: 'advanced',
    tags: ['defi', 'leverage', 'lending', 'risk'],
    track: 'defi',
  },
  {
    id: 'prem-defi-mev',
    title: 'MEV and You: Sandwich Attacks, Frontrunning, and Protection',
    description:
      'What maximal extractable value means for regular users — how bots profit from your trades and how to protect yourself.',
    whyItMatters:
      'MEV extraction is a hidden tax on every trade. Understanding it lets you minimize slippage and choose MEV-resistant venues.',
    objectives: [
      'Explain sandwich attacks, frontrunning, and backrunning',
      'Identify MEV-protected DEXes and RPCs',
      'Configure slippage and gas settings to reduce MEV exposure',
      'Understand the role of block builders and relays',
    ],
    estimatedMinutes: 18,
    difficulty: 'advanced',
    tags: ['defi', 'mev', 'trading', 'security'],
    track: 'defi',
  },
  {
    id: 'prem-defi-stablecoins',
    title: 'Stablecoin Deep Dive: Collateral, Peg Mechanisms, and Depeg Risk',
    description:
      'How different stablecoins maintain their peg — overcollateralized, algorithmic, and fiat-backed — and what happens when they break.',
    whyItMatters:
      'Stablecoins are the plumbing of DeFi. A depeg can cascade through every protocol you use.',
    objectives: [
      'Classify stablecoins by collateral type and peg mechanism',
      'Analyze a stablecoin\'s collateral ratio and redemption path',
      'Recognize early warning signs of a depeg event',
      'Build a multi-stablecoin safety strategy',
    ],
    estimatedMinutes: 20,
    difficulty: 'intermediate',
    tags: ['defi', 'stablecoins', 'risk'],
    track: 'defi',
  },
];

// ── Trading Safety Pro Track ──────────────────────────────────────────────────

const TRADING_MODULES: PremiumModule[] = [
  {
    id: 'prem-trading-forensics',
    title: 'On-Chain Forensics: Tracking Scam Flows',
    description:
      'Follow the money. Learn to trace stolen funds through bridges, mixers, and DEXes using block explorers and analytics tools.',
    whyItMatters:
      'Understanding how scammers move and launder funds helps you spot patterns before becoming a victim — and recover assets when possible.',
    objectives: [
      'Trace a transaction through multiple hops using block explorers',
      'Identify common laundering patterns: peel chains, bridges, mixers',
      'Recognize dust attacks and address poisoning techniques',
      'Use free analytics tools to assess wallet risk scores',
    ],
    estimatedMinutes: 22,
    difficulty: 'intermediate',
    tags: ['forensics', 'scams', 'security', 'on-chain'],
    track: 'trading',
  },
  {
    id: 'prem-trading-taxes',
    title: 'Crypto Taxes: Tracking, Reporting, and Staying Compliant',
    description:
      'A practical guide to crypto tax obligations — capital gains, DeFi income, airdrops, staking rewards, and cross-chain tracking.',
    whyItMatters:
      'Tax authorities are increasing crypto enforcement. Good records from day one save thousands in penalties and accountant fees.',
    objectives: [
      'Classify taxable events: trades, staking rewards, airdrops, LP fees',
      'Choose a cost-basis method (FIFO, LIFO, specific ID)',
      'Set up wallet tracking for automated tax reporting',
      'Understand wash-sale rules and cross-jurisdiction obligations',
    ],
    estimatedMinutes: 20,
    difficulty: 'intermediate',
    tags: ['taxes', 'compliance', 'tracking'],
    track: 'trading',
  },
  {
    id: 'prem-trading-psychology',
    title: 'Trading Psychology: Managing FOMO, Panic, and Greed',
    description:
      'The mental game of trading — position sizing, journaling, detachment, and building rules that survive emotional markets.',
    whyItMatters:
      'Even perfect technical analysis fails without emotional discipline. The best traders are systematic, not emotional.',
    objectives: [
      'Recognize emotional triggers: FOMO entries, panic exits, revenge trading',
      'Build a position-sizing framework based on account risk',
      'Start and maintain a trading journal with win/loss review',
      'Design pre-trade and post-trade routines that reduce impulsivity',
    ],
    estimatedMinutes: 18,
    difficulty: 'intermediate',
    tags: ['psychology', 'trading', 'risk-management'],
    track: 'trading',
  },
  {
    id: 'prem-trading-derivatives',
    title: 'Derivatives: Perps, Options, and Structured Products',
    description:
      'How perpetual futures, options vaults, and structured products work — and why most retail traders lose money on them.',
    whyItMatters:
      'Derivatives concentrate risk. Understanding funding rates, theta decay, and liquidation before trading is the difference between strategy and gambling.',
    objectives: [
      'Explain funding rate mechanics and their impact on perp positions',
      'Understand options Greeks: delta, theta, gamma, vega',
      'Evaluate options vault strategies (covered calls, cash-secured puts)',
      'Recognize when structured-product marketing hides risk',
    ],
    estimatedMinutes: 24,
    difficulty: 'advanced',
    tags: ['derivatives', 'perps', 'options', 'risk'],
    track: 'trading',
  },
];

// ── Creator Economy Track ─────────────────────────────────────────────────────

const CREATOR_MODULES: PremiumModule[] = [
  {
    id: 'prem-creator-monetization',
    title: 'Creator Monetization: Hypersub, Tips, and Token-Gated Content',
    description:
      'Turn your Farcaster presence into income. Subscription models, tipping infrastructure, and how to price token-gated content.',
    whyItMatters:
      'Farcaster\'s direct creator-audience relationship eliminates platform rent-seeking. Learning monetization tools lets you capture value you already create.',
    objectives: [
      'Compare Hypersub, tipping, and token-gating revenue models',
      'Price subscriptions and gated content based on audience size',
      'Build a content funnel: free → follower → subscriber → patron',
      'Track revenue metrics and optimize conversion rates',
    ],
    estimatedMinutes: 18,
    difficulty: 'intermediate',
    tags: ['creator', 'monetization', 'hypersub', 'farcaster'],
    track: 'creator',
  },
  {
    id: 'prem-creator-community',
    title: 'Community Building: From Followers to Superfans',
    description:
      'How to grow an engaged community on Farcaster — channel strategy, conversation design, and turning passive followers into active participants.',
    whyItMatters:
      'A small, engaged community generates more revenue than a large, passive audience. Participation architecture is the foundation.',
    objectives: [
      'Design a channel strategy aligned with your content niche',
      'Create participation loops: daily rituals, challenges, collaborative content',
      'Use curated lists and group chats to deepen community ties',
      'Measure community health: engagement rate, retention, referrals',
    ],
    estimatedMinutes: 18,
    difficulty: 'intermediate',
    tags: ['creator', 'community', 'growth', 'farcaster'],
    track: 'creator',
  },
  {
    id: 'prem-creator-content',
    title: 'Content Strategy: Casts, Threads, Frames, and Media',
    description:
      'What works on Farcaster — thread structure, frame design, video timing, and the algorithm-friendly formats that drive discovery.',
    whyItMatters:
      'Farcaster rewards different content patterns than Twitter or TikTok. Platform-native formats get exponentially more reach.',
    objectives: [
      'Structure high-performing threads: hook, body, CTA',
      'Design frames that drive interaction and shares',
      'Optimize posting cadence and timing for your audience',
      'Repurpose content across Farcaster, newsletters, and social',
    ],
    estimatedMinutes: 18,
    difficulty: 'intermediate',
    tags: ['creator', 'content', 'frames', 'growth'],
    track: 'creator',
  },
  {
    id: 'prem-creator-brand',
    title: 'Building Your On-Chain Brand',
    description:
      'How to build a recognizable brand on Farcaster — consistent visual identity, on-chain reputation, collaborations, and sponsorship deals.',
    whyItMatters:
      'Your Farcaster identity is portable. Building a strong on-chain brand today creates leverage for sponsorships, collaborations, and future opportunities.',
    objectives: [
      'Design a consistent visual identity across channels and frames',
      'Build on-chain reputation through contributions and attestations',
      'Approach and negotiate sponsorship deals professionally',
      'Create a media kit and rate card for brand partnerships',
    ],
    estimatedMinutes: 18,
    difficulty: 'intermediate',
    tags: ['creator', 'branding', 'sponsorships', 'reputation'],
    track: 'creator',
  },
];

// ── Public API ────────────────────────────────────────────────────────────────────

/** All premium tracks with their modules. */
export const PREMIUM_TRACKS: PremiumTrack[] = [
  {
    id: 'defi',
    emoji: '🏦',
    title: 'Advanced DeFi',
    description: 'Yield strategies, leverage management, MEV protection, and stablecoin deep dives for users ready to move beyond the basics.',
    modules: DEFI_MODULES,
  },
  {
    id: 'trading',
    emoji: '📊',
    title: 'Trading Safety Pro',
    description: 'On-chain forensics, tax compliance, trading psychology, and derivatives — the skills that separate professionals from gamblers.',
    modules: TRADING_MODULES,
  },
  {
    id: 'creator',
    emoji: '🎨',
    title: 'Creator Economy',
    description: 'Monetize your Farcaster presence with subscriptions, token-gated content, community building, and sponsorship deals.',
    modules: CREATOR_MODULES,
  },
];

/** Look up a premium module by ID. */
export function getPremiumModule(id: string): PremiumModule | undefined {
  for (const track of PREMIUM_TRACKS) {
    const mod = track.modules.find(m => m.id === id);
    if (mod) return mod;
  }
  return undefined;
}

/** All premium module IDs for quick lookup. */
export const PREMIUM_MODULE_IDS = new Set(
  PREMIUM_TRACKS.flatMap(t => t.modules.map(m => m.id))
);