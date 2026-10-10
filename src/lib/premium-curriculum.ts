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

// ── Premium Lesson Content ──────────────────────────────────────────────────────
// Full lessons with concepts, examples, and quizzes for the detail page.

export interface PremiumLesson {
  concepts: Array<{ title: string; explanation: string; analogy?: string }>;
  practicalExample: string;
  quickActions: string[];
  summary: string;
  quiz: Array<{
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }>;
}

const PREMIUM_LESSONS: Record<string, PremiumLesson> = {
  'prem-defi-yield': {
    concepts: [
      {
        title: 'Where Yield Comes From',
        explanation: 'Yield in DeFi is payment for providing something the protocol needs — liquidity for traders, collateral for borrowers, or security for validators. Lending protocols pay interest because borrowers need capital. DEXes pay LP fees because traders need counterparties. Liquid staking protocols share staking rewards because they aggregate capital to run validators. Each yield source has a different risk profile, and understanding what you are being paid for is the first step to managing that risk.',
        analogy: 'Think of lending yield like renting out your apartment on Airbnb. You earn rent for providing a place to stay, but you bear vacancy risk (your funds sit idle when no one borrows) and damage risk (bad loans = defaults). Staking yield is more like owning a rental building — you earn consistently but have less flexibility (unstaking periods).',
      },
      {
        title: 'Real vs Nominal Yield',
        explanation: 'The APR a protocol shows is nominal — it does not account for token price changes, impermanent loss, or protocol token dilution. If you earn 20% APR in a token that drops 30%, your real return is negative. Similarly, high staking yields in inflationary tokens are just recycling — you get more tokens but each is worth less. Always calculate yield in the asset you care about (usually stablecoins or ETH), not in the protocol governance token.',
        analogy: 'A savings account offering 10% interest sounds great — until you realize it pays in Monopoly money that lost half its value.',
      },
      {
        title: 'Evaluating Protocol Risk',
        explanation: 'Every DeFi protocol carries four layers of risk: smart contract risk (code bugs), economic risk (oracle manipulation, liquidation cascades), governance risk (admin keys, multisig owners), and counterparty risk (who you are actually lending to). Audit reports reduce but do not eliminate smart contract risk. TVL (Total Value Locked) is a proxy for trust and battle-testing. Insurance protocols like Nexus Mutual can cover some smart contract risks.',
      },
    ],
    practicalExample: 'Alice has $5,000 in USDC. She considers three options: (1) Aave lending at 4% APY (stable, audited, $10B+ TVL), (2) a new yield aggregator offering 35% APY on USDC (unaudited fork, $2M TVL, anonymous team), (3) an ETH-USDC LP position earning 15% in fees plus governance tokens. Using the risk framework from this lesson, she eliminates option 2 (unacceptable smart contract + governance risk). Between options 1 and 3, she calculates that the LP position would need to sustain its fee APR through a 20% ETH drawdown to match Aave returns — and decides to split $4,000 into Aave and $1,000 into the LP position for upside exposure with limited risk.',
    quickActions: [
      'Go to DefiLlama.com and look up the TVL of your favorite DeFi protocol',
      'Calculate the real APR (in stablecoins) of any yield farm you are considering',
      'Check if the protocol has a public audit from a reputable firm (Trail of Bits, OpenZeppelin, Certora)',
      'Review the multisig signers for the protocol — are they known entities or anonymous?',
    ],
    summary: 'Yield is not free money — it is payment for risk. Know which risk you are being paid for, calculate returns in stable terms, and never deposit more than you can afford to lose into unaudited or low-TVL protocols.',
    quiz: [
      {
        question: 'What does APR in a DeFi protocol represent?',
        options: ['Guaranteed monthly returns', 'The total protocol treasury size', 'The nominal annualized return rate, not accounting for token price changes', 'The developer share of all deposits'],
        correctIndex: 2,
        explanation: 'APR is the nominal annualized rate. It does not account for token price changes, impermanent loss, or dilution from token emissions. Real returns can be negative even with high nominal APR.',
      },
      {
        question: 'Which of these is the biggest risk for a new, unaudited yield aggregator?',
        options: ['Impermanent loss', 'The token price going down', 'Smart contract risk (code bugs or exploits)', 'High gas fees'],
        correctIndex: 2,
        explanation: 'Unaudited smart contracts carry the highest risk — a single bug can drain all deposited funds instantly, which is a permanent loss, unlike a price decline which can recover.',
      },
    ],
  },
  'prem-trading-psychology': {
    concepts: [
      {
        title: 'The FOMO Cycle',
        explanation: 'Fear of Missing Out drives retail traders to buy assets after they have already pumped significantly. The cycle is predictable: an asset rallies → social media amplifies the narrative → late buyers FOMO in near the top → the asset pulls back or dumps → FOMO buyers panic-sell at a loss. Breaking this cycle requires a pre-written investment thesis and entry rules that you follow regardless of what your Twitter feed is saying.',
        analogy: 'FOMO buying is like sprinting to board a train that has already left the station. Even if you catch it, you paid a premium for a seat on a journey that might reverse direction.',
      },
      {
        title: 'Position Sizing as Emotional Guardrails',
        explanation: 'Most emotional trading mistakes come from positions that are too large. When 2% of your portfolio is at risk, a 20% drawdown is annoying. When 40% is at risk, the same drawdown triggers panic. Professional traders size positions so that any single trade cannot meaningfully impact their net worth — typically 1-2% risk per trade. This mechanical rule removes emotion from the equation.',
      },
      {
        title: 'The Trading Journal',
        explanation: 'A trading journal captures what you traded, why you traded it, your emotional state at entry and exit, and the outcome. Over time, patterns emerge: you may find you trade best in the morning, or that you lose money every time you trade after a sleepless night, or that your best trades come from a specific type of setup. The journal transforms trading from gambling into a systematic, improvable skill.',
      },
    ],
    practicalExample: 'Bob started 2026 with $10,000. In January, he FOMO-bought a memecoin after seeing it pumped on Farcaster — up 200% in a day. He put in $4,000 (40% position size). The coin dumped 60% overnight. Panicking, he sold at a $2,400 loss. After reviewing his journal, Bob set new rules: never enter a trade within 2 hours of seeing an influencer post, max 2% risk per trade, and mandatory 24-hour cooling-off before any position over $500. Over the next 6 months, his win rate went from 30% to 55%.',
    quickActions: [
      'Start a trading journal today — a simple spreadsheet is enough: date, asset, entry price, thesis, emotion (1-10), exit price, result',
      'Set a maximum position size rule (e.g. 2% of portfolio per trade) and write it down',
      'Before your next trade, ask: "Am I buying because of my research or because of a social media post?"',
      'Review your last 5 losing trades — what emotional pattern do they share?',
    ],
    summary: 'The market is not your enemy — your own psychology is. Position sizing, journaling, and pre-written rules are the tools that turn emotional traders into systematic, profitable ones.',
    quiz: [
      {
        question: 'What is the primary purpose of a trading journal?',
        options: ['To calculate taxes', 'To identify patterns in your decision-making and improve over time', 'To prove to others you are profitable', 'To track which influencers gave the best tips'],
        correctIndex: 1,
        explanation: 'A trading journal reveals emotional patterns, decision biases, and setup-specific performance. It turns trading into a skill you can systematically improve rather than gambling.',
      },
      {
        question: 'Why should a single trade risk no more than 1-2% of your portfolio?',
        options: ['Brokers require it', 'It prevents any single trade from causing emotional decisions that cascade into bigger losses', 'Tax regulations limit position sizes', 'Blockchain transaction limits enforce it'],
        correctIndex: 1,
        explanation: 'Small position sizes remove the emotional stakes. A 20% loss on a 1% position is a 0.2% portfolio drawdown — annoying, not catastrophic. This lets you make rational decisions instead of panic-driven ones.',
      },
    ],
  },
  'prem-creator-monetization': {
    concepts: [
      {
        title: 'The Creator Monetization Funnel',
        explanation: 'Successful Farcaster creators build a monetization ladder: free content (casts, threads) builds audience → free subscribers (follows, channel membership) deepen engagement → paid subscribers (Hypersub) provide recurring revenue → high-value patrons (token-gated content, 1:1 consultations) deliver premium income. Each step filters for higher intent and willingness to pay. The key insight: do not rush the monetization. Build credibility with free content first.',
        analogy: 'A musician does not start by selling $500 backstage passes. They first play free shows, build a local following, release music, sell $20 tickets, and only after years of trust do fans pay for VIP experiences. Farcaster monetization follows the same progression.',
      },
      {
        title: 'Pricing Your Content',
        explanation: 'Hypersub subscriptions typically range from $5-50/month depending on niche and value delivered. Financial/investment content commands higher prices than entertainment. The right price is the one where you feel motivated to consistently deliver value and subscribers feel they are getting more than they paid for. Start lower than you think, prove your value with consistent delivery, then raise prices for new subscribers.',
      },
      {
        title: 'The Value Loop',
        explanation: 'The most sustainable monetization model on Farcaster is a value loop: you share knowledge freely → followers learn and succeed → they attribute their success to you → they subscribe to get more/deeper access → their continued success becomes social proof → more followers join. This loop creates organic growth that compounds. Creators who gate everything behind paywalls kill their own growth — nobody subscribes to content they have never seen.',
      },
    ],
    practicalExample: 'Sarah runs a daily Farcaster thread on DeFi market analysis. After 3 months and 2,000 followers, she launches a Hypersub at $15/month offering: (1) early access to her daily analysis 4 hours before the public thread, (2) a weekly deep-dive report with on-chain data, and (3) a subscriber-only group chat. She converts 3% of followers (60 subscribers = $900/month). After 6 months of consistent delivery, her follower count grows to 5,000, subscribers grow to 150 ($2,250/month), and she adds a $500/month "institutional tier" with 1:1 portfolio reviews, attracting 3 clients ($1,500/month). Total: $3,750/month from content that she was already creating for free.',
    quickActions: [
      'Identify your content niche — what do you know better than most people?',
      'Commit to a consistent publishing schedule (daily/weekly) for 30 days before launching any paid tier',
      'Research successful Hypersub creators in your niche — what do subscribers get that free followers do not?',
      'Draft your first paid-subscriber offering: at least 2-3 concrete benefits that justify the monthly price',
    ],
    summary: 'Farcaster monetization is a long game. Build credibility with free content, price affordably at launch, focus on consistent delivery over viral moments, and let the value loop compound your audience and income over time.',
    quiz: [
      {
        question: 'What is the recommended approach to pricing your Hypersub?',
        options: ['Price as high as possible from day one', 'Start lower, prove your value with consistent delivery, then raise prices for new subscribers', 'Offer everything for free to maximize followers', 'Price based on what the biggest creator charges'],
        correctIndex: 1,
        explanation: 'Starting lower reduces the barrier to entry, lets you build a subscriber base and testimonials, and creates room to raise prices as your value proposition strengthens. Existing subscribers typically keep their original rate.',
      },
      {
        question: 'Why should creators share substantial free content alongside paid content?',
        options: ['Farcaster requires it', 'Free content builds the top of the funnel — subscribers come from people who already know your value', 'Paid subscriptions earn more from ads', 'It is required by Hypersub terms of service'],
        correctIndex: 1,
        explanation: 'Nobody subscribes to content they have never seen. Free content demonstrates your expertise, builds trust, and creates the "I want more of this" feeling that converts followers into subscribers.',
      },
    ],
  },
};

/** Get full lesson content for a premium module (Pro subs only). */
export function getPremiumLessonContent(moduleId: string): PremiumLesson | undefined {
  return PREMIUM_LESSONS[moduleId];
}