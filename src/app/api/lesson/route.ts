import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Redis } from '@upstash/redis';
import { llmChat, getLLMProviders } from '@/lib/llm';
import { ELI5_INSTRUCTION } from '@/lib/eli5';
import { rateLimit } from '@/lib/ratelimit';

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try { return new Redis({ url, token }); } catch { return null; }
}

// Claude (primary writer) can take ~50s on a content-heavy lesson; give web
// enrichment + generation + quiz verification headroom so a slow call never
// times out mid-generation.
export const maxDuration = 120;

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface LessonContent {
  intro: string;
  concepts: Array<{
    title: string;
    explanation: string;
    analogy?: string;
  }>;
  practicalExample: string;
  quickActions: string[];
  summary: string;
  quiz: QuizQuestion[];
}


function fallbackLesson(title: string, description: string, objectives: string[]): LessonContent {
  return {
    intro: `This module covers ${title.toLowerCase()}. ${description}`,
    concepts: objectives.slice(0, 3).map((obj, i) => ({
      title: obj.replace(/^(understand|explain|learn|identify|describe|explore)\s+/i, '').replace(/^\w/, (c: string) => c.toUpperCase()),
      explanation: `This concept covers: ${obj.charAt(0).toLowerCase() + obj.slice(1)}. Take your time here — understanding this building block will make the rest of the module click into place.`,
      analogy: i === 0 ? `Think of ${title} like learning a new city: you start with a map (the overview), then explore each neighborhood (the concepts) one at a time.` : undefined,
    })),
    practicalExample: `Try searching Farcaster or Google for "${title}" to see how practitioners talk about it in the real world. Look for specific tools, projects, or use cases that match what you're learning here.`,
    quickActions: [
      `Search Farcaster for "${title}" and read 3 recent posts`,
      'Write down one question this module raised that you want to dig into later',
      `Find one project or app that uses ${title.split(' ')[0]} in the wild and bookmark it`,
    ],
    summary: `${title} is a core piece of the Web3 stack. Understanding it gives you a foundation for evaluating real projects and making better decisions as a participant in decentralized systems.`,
    quiz: [
      {
        question: `What is the main purpose of this module on ${title}?`,
        options: [
          'To provide entertainment',
          `To teach foundational concepts of ${title.toLowerCase()}`,
          'To sell crypto',
          'To replace traditional education',
        ],
        correctIndex: 1,
        explanation: `This module is designed to give you a practical foundation in ${title.toLowerCase()} as part of your decentralization journey.`,
      },
      {
        question: 'Why is understanding decentralization important?',
        options: [
          'It helps you make money quickly',
          'It is required by law',
          'It lets you understand and participate in systems without central gatekeepers',
          'It replaces the internet',
        ],
        correctIndex: 2,
        explanation: 'Decentralization removes single points of control, giving you more ownership and freedom in digital systems.',
      },
      {
        question: 'What is the best way to learn about Web3 concepts?',
        options: [
          'Wait until the technology is perfect',
          'Read theory only',
          'Combine reading with hands-on experimentation',
          'Ask someone else to do it for you',
        ],
        correctIndex: 2,
        explanation: 'The most effective learning combines understanding concepts with practical, hands-on exploration.',
      },
    ],
  };
}

/**
 * Best-effort parse of an LLM lesson response.
 *
 * Tolerates code fences and prose wrapped around the JSON (weaker free models
 * often add "Here's the lesson:" preambles despite instructions), and validates
 * that the result actually has usable content before accepting it. Returns null
 * if nothing usable can be extracted.
 */
function parseLessonJson(raw: string): LessonContent | null {
  if (!raw) return null;
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  const candidates = [stripped];
  // Also try the outermost {...} span in case there's prose around it.
  const first = stripped.indexOf('{');
  const last = stripped.lastIndexOf('}');
  if (first >= 0 && last > first) candidates.push(stripped.slice(first, last + 1));

  for (const c of candidates) {
    try {
      const obj = JSON.parse(c);
      if (
        obj && typeof obj === 'object' &&
        Array.isArray(obj.concepts) && obj.concepts.length > 0 &&
        Array.isArray(obj.quiz) && obj.quiz.length > 0 &&
        typeof obj.intro === 'string'
      ) {
        return obj as LessonContent;
      }
    } catch {}
  }
  return null;
}

/**
 * Independent second-pass check of the generated quiz.
 *
 * Re-derives the correct option for every question with a temperature-0 model
 * call (a different framing than generation, so it genuinely re-answers rather
 * than echoing), fixes any `correctIndex` that disagrees, and drops questions
 * the verifier flags as ambiguous or factually broken. Fails open: on any error
 * the original quiz is returned unchanged, so verification can never break a
 * lesson.
 */
async function verifyQuiz(quiz: QuizQuestion[], topicContext: string): Promise<QuizQuestion[]> {
  if (!Array.isArray(quiz) || quiz.length === 0) return quiz;
  if (getLLMProviders().length === 0) return quiz;

  const LETTERS = ['A', 'B', 'C', 'D'];
  const questionsBlock = quiz
    .map((q, i) => {
      const opts = (q.options ?? []).map((o, oi) => `   ${LETTERS[oi]}. ${o}`).join('\n');
      return `Q${i + 1}: ${q.question}\n${opts}`;
    })
    .join('\n\n');

  const verifyPrompt = `You are a meticulous fact-checker for a Web3 education quiz. For EACH question below, independently work out which single option is factually correct. Do NOT assume option A is correct — judge each option on its own merits.
${topicContext ? `\nReference facts you may rely on:\n${topicContext}\n` : ''}
Ground truth to enforce: a GOVERNANCE token = voting/decision rights in a protocol; a UTILITY token = access to or payment for a product/service; an LP (liquidity provider) token = a depositor's share of a liquidity pool. Never accept an answer that assigns these the wrong way round.

${questionsBlock}

Return ONLY a JSON array — no markdown, no prose. One object per question:
[{"q":1,"correct":"A","valid":true}]
- "correct": the letter (A/B/C/D) of the one unambiguously correct option.
- "valid": false if the question has no single correct answer, has more than one correct answer, or is factually broken; otherwise true.`;

  try {
    const { message } = await llmChat({
      messages: [{ role: 'user', content: verifyPrompt }],
      maxTokens: 700,
      temperature: 0,
    });
    const raw = (message.content ?? '')
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    const verdicts = JSON.parse(raw) as Array<{ q: number; correct: string; valid: boolean }>;
    if (!Array.isArray(verdicts)) return quiz;

    const result: QuizQuestion[] = [];
    for (let i = 0; i < quiz.length; i++) {
      const v = verdicts.find((x) => Number(x?.q) === i + 1);
      if (!v) { result.push(quiz[i]); continue; }            // no verdict → keep as generated
      if (v.valid === false) continue;                        // flawed question → drop it
      const idx = LETTERS.indexOf(String(v.correct ?? '').trim().toUpperCase());
      if (idx < 0 || idx >= (quiz[i].options?.length ?? 0)) {
        result.push(quiz[i]);                                 // unparseable letter → keep original
      } else {
        result.push({ ...quiz[i], correctIndex: idx });       // apply the verified answer
      }
    }

    // Never let verification empty the quiz; if it flagged everything, keep the original set.
    if (result.length === 0) return quiz;
    if (result.length !== quiz.length) {
      console.error(`[lesson] quiz verification dropped ${quiz.length - result.length} question(s)`);
    }
    return result;
  } catch (err: any) {
    console.error('[lesson] quiz verification failed, keeping original:', err?.message);
    return quiz;
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const { success: rateLimitOk } = rateLimit(`lesson:${ip}`, 5, 3600);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Too many lesson requests. Please try again later.' }, { status: 429 });
    }

    const { moduleId, title, description, whyItMatters, objectives, difficulty, tags, eli5 = false } = await req.json();

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    if (getLLMProviders().length === 0 && !process.env.PERPLEXITY_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      console.error('[lesson] No AI provider configured, returning fallback');
      return NextResponse.json(fallbackLesson(title, description, objectives));
    }

    // ── Cache check — return stored lesson if available ──────────────────────
    const redis = getRedis();
    // v3: regenerate every module through the Claude-primary path (v2 cached the
    // dry free-model prose). Each module regenerates once, then caches 30 days.
    const cacheKey = moduleId ? `lesson:v3:${moduleId}${eli5 ? ':eli5' : ''}` : null;
    if (redis && cacheKey) {
      try {
        const cached = await redis.get<LessonContent>(cacheKey);
        if (cached) {
          console.error(`[lesson] cache hit: ${moduleId}`);
          return NextResponse.json(cached);
        }
      } catch {}
    }

    const titleLower = title?.toLowerCase() ?? '';
    const tagSet = tags?.map((t: string) => t.toLowerCase()) ?? [];

    const isHyperliquid = titleLower.includes('hyperliquid') || tagSet.some((t: string) => t.includes('hyperliquid') || t === 'hype');
    const isEthereum = titleLower.includes('ethereum') || titleLower.includes('eth') || tagSet.includes('ethereum');
    const isSmartContract = titleLower.includes('smart contract') || tagSet.includes('smart-contracts') || tagSet.includes('smart contracts');
    const isBlockchain = titleLower.includes('blockchain') || tagSet.includes('blockchain');
    const isDeFi = titleLower.includes('defi') || titleLower.includes('decentralized finance') || tagSet.includes('defi');
    const isNFT = titleLower.includes('nft') || titleLower.includes('non-fungible') || tagSet.includes('nft');
    const isDAO = titleLower.includes('dao') || tagSet.includes('dao');
    const isWallet = titleLower.includes('wallet') || titleLower.includes('key') || tagSet.includes('wallet');
    const isOnChainData = titleLower.includes('on-chain') || titleLower.includes('onchain') || titleLower.includes('data storage') || tagSet.includes('storage');
    const isEthHistory = (titleLower.includes('history') && isEthereum) || titleLower.includes('ethereum history') || titleLower.includes('history of ethereum');
    const isDeFiHacks = titleLower.includes('hack') || titleLower.includes('exploit') || (titleLower.includes('security') && isDeFi) || tagSet.includes('hacks');
    const isSecurity = titleLower.includes('security') || titleLower.includes('opsec') || titleLower.includes('phishing') || tagSet.includes('security') || tagSet.includes('safety');
    const isFarcasterHistory = titleLower.includes('farcaster') || tagSet.includes('farcaster') || tagSet.includes('protocol');
    const isVenice = titleLower.includes('venice') || tagSet.includes('venice');
    const isDAOHistory = isDAO && (titleLower.includes('history') || titleLower.includes('origin') || titleLower.includes('hack'));

    const topicContext = [
      isHyperliquid && `
FACTUAL CONTEXT — Hyperliquid:
- Hyperliquid is a decentralized perpetuals (perps) exchange built on its own L1 chain (HyperEVM), not Ethereum or Solana
- HYPE is the native token — launched November 2024 via a community airdrop with NO VC allocation, widely praised
- By mid-2026 HYPE surpassed Solana in market cap, becoming a top-10 crypto asset
- Arthur Hayes publicly targeted $150 for HYPE and exited near that level in June 2026
- Protocol fees fund an Assistance Fund and token buybacks — a real on-chain revenue model
- Key risk: single team-controlled chain; decentralization unproven; regulatory risk applies
- Users trade perps directly on app.hyperliquid.xyz with no KYC and self-custody`,

      isEthereum && `
FACTUAL CONTEXT — Ethereum (source: ethereum.org):
- Ethereum is a programmable blockchain — unlike Bitcoin (store of value), Ethereum runs code called smart contracts
- ETH is the native currency; used to pay "gas" (transaction fees) that compensate validators
- Ethereum moved from Proof of Work to Proof of Stake in "The Merge" (September 2022), cutting energy use ~99.95%
- The EVM (Ethereum Virtual Machine) is the engine that executes smart contracts — it's what makes Ethereum programmable
- Layer 2s (Arbitrum, Optimism, Base, zkSync) process transactions off-chain and post proofs back to Ethereum, reducing fees
- Key stats: thousands of dapps, billions in DeFi TVL, the most-used smart contract platform as of 2026
- Ethereum's roadmap includes sharding and further scaling improvements under "The Surge," "The Verge," "The Purge"`,

      isSmartContract && `
FACTUAL CONTEXT — Smart Contracts (source: IBM Think + ethereum.org):
- A smart contract is self-executing code stored on a blockchain that runs automatically when predefined conditions are met
- Nick Szabo coined the term in 1994; Ethereum made them practical at scale starting in 2015
- Once deployed, a smart contract cannot be altered — immutability is a feature and a risk (bugs are permanent)
- Smart contracts eliminate intermediaries: escrow, insurance payouts, voting, loans — all can be automated in code
- Solidity is the most common language for writing Ethereum smart contracts; Rust is used on Solana
- Real examples: Uniswap (automated trading), Aave (lending), ENS (name registration) — all run purely on smart contracts
- Audits are critical: the DAO hack (2016, $60M) and many others show that smart contract bugs can be catastrophic`,

      isBlockchain && `
FACTUAL CONTEXT — Blockchain:
- A blockchain is a distributed ledger: a chain of "blocks" each containing a batch of transactions, cryptographically linked
- Decentralization means no single entity controls the chain — thousands of nodes each hold a full copy
- Consensus mechanisms (Proof of Work, Proof of Stake) let nodes agree on the correct state without trusting each other
- Immutability: once a block is confirmed and buried under subsequent blocks, altering it requires redoing all the work after it
- Public blockchains (Bitcoin, Ethereum) are permissionless — anyone can read, transact, or run a node
- Private/consortium blockchains restrict access; used in enterprise supply chain, trade finance (e.g. IBM Food Trust)
- Key tradeoff (the "blockchain trilemma"): decentralization, security, and scalability — hard to have all three at once`,

      isDeFi && `
FACTUAL CONTEXT — DeFi (Decentralized Finance):
- DeFi refers to financial services (lending, trading, yield, derivatives) built on smart contracts with no bank or broker
- Total Value Locked (TVL) measures how much crypto is deposited in DeFi protocols — a key health metric
- Core primitives: DEXs (Uniswap, Curve), lending markets (Aave, Compound), stablecoins (DAI, USDC), yield aggregators
- Liquidity providers earn trading fees by depositing into AMM (Automated Market Maker) pools
- Risks: smart contract bugs, oracle manipulation, liquidation cascades, regulatory uncertainty
- "DeFi summer" (2020) exploded adoption; TVL grew from under $1B to over $15B in months
- Real yield vs. token emissions: sustainable DeFi protocols generate actual fee revenue rather than inflating token rewards`,

      isNFT && `
FACTUAL CONTEXT — NFTs:
- NFT (Non-Fungible Token): a unique on-chain token — unlike ETH (fungible, every unit identical), each NFT is distinct
- ERC-721 is the Ethereum standard for NFTs; ERC-1155 allows both fungible and non-fungible in one contract
- What's actually stored: usually the image lives off-chain (IPFS or a server); the NFT just records ownership and metadata URI
- Use cases beyond art: event tickets, gaming items, domain names (ENS), music royalties, real-world asset tokenization
- OpenSea, Blur, and Magic Eden are major NFT marketplaces; each takes a platform fee (often 2-2.5%)
- The 2021 boom saw NFTs like CryptoPunks and Bored Apes sell for millions; market cooled significantly in 2022-2023
- Creator royalties on secondary sales were a defining feature but are now enforced inconsistently across platforms`,

      isDAO && `
FACTUAL CONTEXT — DAOs:
- DAO (Decentralized Autonomous Organization): a community governed by token holders, with rules enforced by smart contracts
- Token holders vote on proposals — treasury spending, protocol upgrades, parameter changes — proportional to holdings
- Examples: Uniswap DAO (governs the DEX), MakerDAO (governs DAI stablecoin), Nouns DAO (daily NFT auction funds proposals)
- Tools: Snapshot (off-chain voting, free), Tally (on-chain execution), Gnosis Safe (multi-sig treasury)
- Key challenge: voter apathy — most governance tokens are never used to vote; a small group often controls outcomes
- Legal status is evolving: Wyoming, Marshall Islands recognize DAOs as legal entities; most jurisdictions still unclear
- "Code is law" tension: when code has bugs or unexpected outcomes, communities must decide whether to override via vote`,

      isWallet && `
FACTUAL CONTEXT — Wallets & Keys:
- A crypto wallet doesn't "store" crypto — it stores private keys that prove ownership of on-chain assets
- Private key: a 256-bit secret number. Public key + address derived from it. Lose the private key = lose access forever
- Seed phrase (12 or 24 words): a human-readable backup of the private key. Anyone with your seed phrase owns your funds
- Hot wallets (MetaMask, Phantom): connected to internet, convenient, more attack surface
- Cold wallets (Ledger, Trezor): hardware device, keys never touch the internet, safer for large amounts
- Smart contract wallets (Safe, Argent): multi-sig or social recovery — can recover access without a seed phrase
- Never share your seed phrase with anyone or enter it on a website — legitimate services never ask for it`,

      isOnChainData && `
FACTUAL CONTEXT — On-Chain Data Storage:
- On-chain storage means data is written directly into the blockchain's state — it's permanent, transparent, and expensive
- Ethereum charges gas per byte of storage: storing 1KB on-chain can cost dollars to hundreds of dollars depending on congestion
- The "calldata" field in a transaction is cheaper than contract storage — used for posting L2 proofs and blobs (EIP-4844)
- Off-chain storage alternatives: IPFS (content-addressed, decentralized), Arweave (permanent storage with one-time fee), Filecoin (incentivized storage market)
- Most NFT images, dapp frontends, and large datasets live off-chain with only a hash or URI stored on-chain
- The Graph Protocol indexes on-chain data and makes it queryable via GraphQL — the "Google of Web3"
- Ceramic, Lens Protocol, and Farcaster use hybrid models: identity/social graph on-chain, content in decentralized off-chain stores`,

      isEthHistory && `
FACTUAL CONTEXT — History of Ethereum:
- Vitalik Buterin published the Ethereum whitepaper in November 2013, aged 19, proposing a "world computer" beyond Bitcoin
- The Ethereum genesis block was mined on July 30, 2015 — the network went live with an initial supply from the 2014 crowdsale
- The DAO hack (June 2016): ~$60M in ETH drained via reentrancy attack; community split over whether to hard fork to recover funds. Fork happened → Ethereum (ETH) continued; Ethereum Classic (ETC) preserved the original chain
- EIP-1559 (August 2021): replaced unpredictable gas auctions with a base fee that gets burned, making ETH deflationary under high usage
- The Merge (September 15, 2022): Ethereum switched from Proof of Work to Proof of Stake, cutting energy usage ~99.95% — no new mining hardware needed
- Shanghai upgrade (April 2023): enabled ETH withdrawals from staking for the first time — ~18M ETH unlocked
- Dencun upgrade (March 2024): introduced EIP-4844 "proto-danksharding" — blob transactions that cut L2 transaction costs by 10-100x
- Ethereum's roadmap (The Surge, Verge, Purge, Splurge) targets 100,000+ TPS through full danksharding`,

      isDAOHistory && `
FACTUAL CONTEXT — History of DAOs:
- "The DAO" (April 2016): the first famous DAO raised 12.7M ETH (~$150M) as a decentralized venture fund; hacked for 3.6M ETH ($60M) via reentrancy bug, triggering the ETH/ETC hard fork
- MolochDAO (February 2019): a minimalist, rage-quit-enabled DAO designed for Ethereum grant-giving; inspired hundreds of forks
- "DeFi Summer" 2020: Compound launched COMP governance tokens, kickstarting DAO governance for DeFi protocols
- ConstitutionDAO (November 2021): raised $47M in ETH in one week to bid on a US Constitution copy; lost the Sotheby's auction to Ken Griffin; returned funds. Showed DAOs could mobilize massive capital fast
- Nouns DAO (August 2021–present): one NFT auctioned daily, all proceeds go to treasury; holders vote on proposals — a model for sustainable DAO funding
- Uniswap DAO governs the largest DEX with a treasury in the billions; UNI holders vote on protocol fee switches
- Wyoming (2021) and Marshall Islands became first jurisdictions to recognize DAOs as legal entities
- Key challenge: voter apathy — in most DAOs, <10% of governance tokens ever vote`,

      isDeFiHacks && `
FACTUAL CONTEXT — History of DeFi Hacks:
- The DAO (2016): $60M ETH via reentrancy — the attack that split Ethereum. Root cause: a contract called an external address before updating its own balance
- Poly Network (August 2021): $611M drained across Ethereum, BSC, Polygon — largest DeFi hack ever. The attacker returned all funds, claiming it was a "white hat" demonstration
- Wormhole bridge (February 2022): $320M — attacker forged a validator signature on a cross-chain bridge between Solana and Ethereum. Jump Crypto covered the loss to keep Wormhole alive
- Ronin bridge (March 2022): $625M in ETH + USDC — hackers (later attributed to North Korea's Lazarus Group) compromised 5 of 9 validator keys. Axie Infinity's Ronin sidechain was drained
- Euler Finance (March 2023): $197M flash loan attack exploiting a logic flaw in a lending function. The attacker returned 90%+ after on-chain negotiations
- Common attack vectors: reentrancy, flash loan price manipulation, oracle manipulation, bridge key compromise, logic errors in upgrade functions
- How to assess protocol safety: look for audits (Certik, Trail of Bits, OpenZeppelin), bug bounties, how long code has been live, insurance coverage (Nexus Mutual)`,

      isSecurity && !isDeFiHacks && `
FACTUAL CONTEXT — Web3 Security & Opsec:
- The most common losses are NOT protocol hacks — they're phishing, social engineering, and bad opsec by individual users
- Wallet drainers: malicious smart contract approvals (you sign a transaction that lets a contract transfer all your tokens). Always check what you're approving on Etherscan before signing
- Revoke.cash and Revoke.wtf let you see and revoke all open token approvals — do this regularly
- Seed phrase attacks: legitimate services NEVER ask for your seed phrase. Anyone who does is a scammer
- Hardware wallets (Ledger, Trezor): keys never touch the internet; best for funds you don't trade daily
- Multisig (Gnosis Safe): requires M-of-N signatures to execute a transaction — best for DAO treasuries and large holdings
- "Approval phishing" is now the #1 attack vector: you sign a setApprovalForAll transaction and the attacker drains your NFTs/tokens
- SIM swap: attackers bribe phone carriers to redirect your number, breaking SMS 2FA. Use authenticator apps (not SMS) for all crypto exchange accounts`,

      isFarcasterHistory && `
FACTUAL CONTEXT — Farcaster Protocol & History:
- Founded by Dan Romero and Varun Srinivasan (both former Coinbase executives) in 2020; public beta launched 2022
- Key design philosophy: "sufficiently decentralized" — Farcaster stores identity on-chain (Ethereum/Optimism) but content off-chain via Hubs, enabling low-cost posting while maintaining censorship resistance
- FID (Farcaster ID): an on-chain integer (e.g. FID 3 = Dan Romero) registered on the Farcaster ID Registry contract on Optimism
- Hubs: a network of off-chain servers that sync and store all casts (posts), reactions, and links. Anyone can run a Hub (Neynar, Pinata, and others provide managed hubs)
- Signers: each app (Warpcast, HomieHouse) has a registered signer key authorized to act on behalf of your FID — this is how you post without signing every transaction with your wallet
- Channels (launched late 2023): topic-based feeds (like /defi, /web3) where casts are organized by shared interest
- Frames (January 2024): interactive mini-apps embedded in casts — polls, NFT mints, games, swap interfaces — powered by a simple open standard
- Warpcast is the primary client built by Farcaster's team; HomieHouse, Supercast, Yup, and others are third-party clients on the same protocol`,

      isVenice && `
FACTUAL CONTEXT — Venice.ai:
- Venice.ai is a privacy-first AI platform launched in 2024 that runs open-source models on decentralized infrastructure
- Core value proposition: your conversations are not stored, not logged, and not used to train models — unlike ChatGPT (OpenAI) or Claude (Anthropic), which retain conversation data
- Venice uses open-source models including Llama, Mistral, and other community models — not proprietary closed models
- Model inference runs on distributed GPU infrastructure; your prompts are processed without Venice seeing them
- Users can pay with crypto (including stablecoins), maintaining financial privacy alongside conversational privacy
- Venice represents the convergence of Web3 and AI: applying decentralization principles (user sovereignty, permissionless access, no single company in control) to AI inference
- Contrast with centralized AI: OpenAI can read your conversations, train on them, and comply with government requests for data. Venice's architecture makes this structurally impossible
- The platform also supports image generation and code assistance with the same privacy guarantees`,
    ].filter(Boolean).join('\n');

    const prompt = `You are a knowledgeable, direct Web3 and decentralization educator writing for curious people who want real understanding — not hype. Generate a thorough, in-depth lesson for this learning module.
${topicContext ? `\n${topicContext}\n` : ''}
Module:
- Title: ${title}
- Description: ${description}
- Why it matters: ${whyItMatters}
- Learning objectives: ${objectives?.join(', ')}
- Difficulty: ${difficulty}
- Tags: ${tags?.join(', ')}

Return ONLY valid JSON — no markdown, no code fences. Use this exact structure:

{
  "intro": "2-3 short sentences (max ~45 words total) that hook the reader, state what they'll learn, and why it matters RIGHT NOW in 2026. Keep it tight and scannable — no filler.",
  "concepts": [
    {
      "title": "Short, memorable concept name (3-5 words)",
      "explanation": "5-6 sentences. (1) Define the concept clearly. (2) Explain HOW it works mechanically. (3) Describe a specific real-world example naming an actual protocol, token, or event. (4) Explain why it matters and what changes when you understand it. Write each point as its own short sentence so the explanation can be read one step at a time. No vague generalities — be specific and concrete.",
      "analogy": "One vivid sentence comparing this to something from everyday life (banking, real estate, restaurant, sports, etc.)"
    }
  ],
  "practicalExample": "2-3 sentences (max ~60 words) walking through ONE specific, named real-world scenario — e.g. 'When Alice swaps ETH for USDC on Uniswap v3...' or 'When the MakerDAO DAO voted in 2023 to...' Concrete enough to verify, but bite-sized — no scrolling required.",
  "quickActions": [
    "Specific action with a named tool or site the learner can do in 5-10 minutes",
    "A second concrete action — explore something, try a transaction, read a specific page",
    "A third action that deepens understanding or connects to the broader Web3 world"
  ],
  "summary": "2 short sentences (max ~35 words). The single core insight + how it connects to the bigger decentralization picture. Punchy and memorable.",
  "quiz": [
    {
      "question": "A specific, knowledge-testing question (not 'what is the purpose of this module')",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "2-3 sentences: why the correct answer is right AND why each wrong answer is wrong or misleading."
    }
  ]
}

Requirements:
- 3-4 concepts, each with a REAL example (name actual protocols, tokens, events, or companies)
- Concepts should build on each other — start with the foundation, end with the implications
- 3 quick actions (each must name a specific website, tool, or resource)
- 6 quiz questions, each testing a different concept or detail from the lesson
- Quiz questions must have exactly 4 options
- Authoritative but accessible tone — treat the reader as smart, not as a beginner who needs hand-holding
- NEVER use placeholder text or generic statements. Every sentence must teach something specific.

QUIZ ACCURACY — THIS IS CRITICAL, ERRORS HERE BREAK TRUST:
- correctIndex is 0-based (0=A, 1=B, 2=C, 3=D). It MUST point to the option that is unambiguously, factually correct.
- Before finalizing each question, re-read the option at correctIndex and confirm it is TRUE and the other three are clearly FALSE. If two options could both be defended as correct, rewrite the question.
- Watch out for "reversed pair" distractors (e.g. swapping which token does what). Verify the definitions are not backwards. Ground truth to respect: a GOVERNANCE token = voting/decision rights in a protocol; a UTILITY token = access to or payment for a product/service; an LP (liquidity provider) token = a depositor's share of a liquidity pool. Never mark an option correct that assigns these the wrong way round.
- The "explanation" must restate the correct fact so it can be checked against the option at correctIndex — they must agree.`
      + (eli5 ? `\n\n${ELI5_INSTRUCTION} This applies to every field above — intro, concepts, practicalExample, summary, and quiz explanations all need to be understandable with zero prior crypto/web3 knowledge.` : '');

    let content = '';
    let usedProvider = '';

    // Optional Tavily web-search enrichment — built once and shared by every
    // generation tier so the latest facts inform whichever model writes.
    let enrichedPrompt = prompt;
    if (process.env.TAVILY_API_KEY) {
      const searchQuery = [title, ...(tags ?? []).slice(0, 2), 'blockchain cryptocurrency 2026'].join(' ');
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      try {
        const r = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query: searchQuery, max_results: 4, search_depth: 'basic' }),
          signal: ctrl.signal,
        });
        clearTimeout(t);
        if (r.ok) {
          const data = await r.json();
          const hits: any[] = (data.results ?? []).slice(0, 4);
          if (hits.length > 0) {
            enrichedPrompt = prompt + '\n\nCURRENT WEB SEARCH RESULTS (use these for the latest facts and figures — they are more recent than your training data):\n' +
              hits.map((h, i) => `[${i + 1}] ${h.title} — ${h.url}\n${(h.content ?? '').slice(0, 400)}`).join('\n\n');
          }
        }
      } catch {
        clearTimeout(t);
      }
    }

    // ── Tier 1: Claude (Anthropic) — PRIMARY writer for warm, high-quality prose.
    // Lessons generate once per module and cache for 30 days, so the cost stays
    // low. Model overridable via LESSON_ANTHROPIC_MODEL (default Sonnet).
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const res = await anthropic.messages.create({
          model: process.env.LESSON_ANTHROPIC_MODEL || 'claude-sonnet-5',
          max_tokens: 2500,
          temperature: 0.7,
          messages: [{ role: 'user', content: enrichedPrompt }],
        });
        const block = res.content[0];
        content = block?.type === 'text' ? block.text.trim() : '';
        if (content) usedProvider = 'anthropic';
      } catch (anthErr: any) {
        console.error('[lesson] Anthropic (primary) failed, falling back:', anthErr?.message);
      }
    }

    // ── Tier 2: Perplexity Sonar — real-time web search baked in ──────────────
    if (!content && process.env.PERPLEXITY_API_KEY) {
      const perplexityClient = new OpenAI({
        apiKey: process.env.PERPLEXITY_API_KEY,
        baseURL: 'https://api.perplexity.ai',
      });
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 25000);
      try {
        const res = await perplexityClient.chat.completions.create(
          { model: 'sonar', messages: [{ role: 'user', content: enrichedPrompt }], max_tokens: 2500, temperature: 0.5 },
          { signal: ctrl.signal },
        );
        clearTimeout(t);
        content = res.choices[0]?.message?.content?.trim() ?? '';
        if (content) usedProvider = 'perplexity-sonar';
      } catch {
        clearTimeout(t);
      }
    }

    // ── Tier 3: free provider stack (Cerebras → Groq → Gemini → OpenRouter) ────
    if (!content) {
      try {
        const { message, provider } = await llmChat({
          messages: [{ role: 'user', content: enrichedPrompt }],
          maxTokens: 2500,
          temperature: 0.5,
        });
        content = message.content?.trim() ?? '';
        usedProvider = provider + (enrichedPrompt !== prompt ? '+tavily' : '');
      } catch (aiErr: any) {
        console.error('[lesson] Free providers failed:', aiErr?.message);
      }
    }

    if (!content) {
      console.error('[lesson] All providers failed, using fallback');
      return NextResponse.json(fallbackLesson(title, description, objectives ?? []));
    }

    console.error(`[lesson] generated via ${usedProvider} (${content.length} chars)`);

    let lesson = parseLessonJson(content);

    // One strict retry via the free stack before giving up — small models
    // sometimes wrap the JSON in prose or truncate on the first attempt.
    if (!lesson && getLLMProviders().length > 0) {
      try {
        const { message } = await llmChat({
          messages: [{
            role: 'user',
            content: prompt + '\n\nIMPORTANT: Reply with ONLY the JSON object described above — start with { and end with }. No prose, no markdown, no code fences.',
          }],
          maxTokens: 2500,
          temperature: 0.4,
        });
        lesson = parseLessonJson(message.content ?? '');
        if (lesson) console.error('[lesson] recovered on strict retry');
      } catch (retryErr: any) {
        console.error('[lesson] retry failed:', retryErr?.message);
      }
    }

    if (!lesson) {
      console.error('[lesson] Failed to parse AI response, using fallback');
      return NextResponse.json(fallbackLesson(title, description, objectives ?? []));
    }

    // ── Second-pass quiz verification — correct wrong answers, drop bad Qs ───
    try {
      lesson.quiz = await verifyQuiz(lesson.quiz, topicContext);
    } catch {
      // verifyQuiz already fails open, but guard the assignment too
    }

    // ── Cache the (verified) lesson for 30 days ─────────────────────────────
    if (redis && cacheKey) {
      try { await redis.set(cacheKey, lesson, { ex: 60 * 60 * 24 * 30 }); } catch {}
    }

    return NextResponse.json(lesson);
  } catch (error: any) {
    console.error('[lesson] Error:', error?.message || error);
    return NextResponse.json(fallbackLesson('', '', []));
  }
}
