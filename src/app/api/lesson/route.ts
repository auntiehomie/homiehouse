import { NextRequest, NextResponse } from 'next/server';
import { llmChat, getLLMProviders } from '@/lib/llm';

export const maxDuration = 60;

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

export async function POST(req: NextRequest) {
  try {
    const { moduleId, title, description, whyItMatters, objectives, difficulty, tags } = await req.json();

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const configuredProviders = getLLMProviders().map(p => p.name).join(',') || 'none';
    console.error(`[lesson] START title="${title}" providers=${configuredProviders}`);

    if (getLLMProviders().length === 0) {
      console.error('[lesson] No AI provider configured, returning fallback');
      return NextResponse.json(fallbackLesson(title, description, objectives));
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
  "intro": "3-4 sentence engaging intro that hooks the reader, states what they'll learn, and why it matters RIGHT NOW in 2026.",
  "concepts": [
    {
      "title": "Short, memorable concept name (3-5 words)",
      "explanation": "4-6 sentences. Define the concept clearly, explain HOW it works mechanically, give a specific real-world example (name an actual protocol, token, or event), and explain why it matters. No vague generalities — be specific and concrete.",
      "analogy": "One vivid sentence comparing this to something from everyday life (banking, real estate, restaurant, sports, etc.)"
    }
  ],
  "practicalExample": "5-6 sentences walking through a specific, named real-world scenario — e.g. 'When Alice swaps ETH for USDC on Uniswap v3...' or 'When the MakerDAO DAO voted in 2023 to...' Make it concrete enough that the reader can verify it themselves.",
  "quickActions": [
    "Specific action with a named tool or site the learner can do in 5-10 minutes",
    "A second concrete action — explore something, try a transaction, read a specific page",
    "A third action that deepens understanding or connects to the broader Web3 world"
  ],
  "summary": "3 sentences. Core insight + one thing that surprises most people + how it connects to the bigger decentralization picture.",
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
- 4 quiz questions, each testing a different concept
- Quiz questions must have exactly 4 options
- correctIndex is 0-based (0=A, 1=B, 2=C, 3=D)
- Authoritative but accessible tone — treat the reader as smart, not as a beginner who needs hand-holding
- NEVER use placeholder text or generic statements. Every sentence must teach something specific.`;

    let content: string;
    try {
      const { message, provider } = await llmChat({
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 3500,
        temperature: 0.7,
      });
      content = message.content?.trim() ?? '';
      console.error(`[lesson] generated via ${provider} (${content.length} chars)`);
    } catch (aiErr: any) {
      console.error('[lesson] All AI providers failed, using fallback:', aiErr?.message);
      return NextResponse.json(fallbackLesson(title, description, objectives ?? []));
    }

    const cleaned = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();

    let lesson: LessonContent;
    try {
      lesson = JSON.parse(cleaned) as LessonContent;
    } catch {
      console.error('[lesson] Failed to parse AI response, using fallback');
      return NextResponse.json(fallbackLesson(title, description, objectives ?? []));
    }

    return NextResponse.json(lesson);
  } catch (error: any) {
    console.error('[lesson] Error:', error?.message || error);
    return NextResponse.json(fallbackLesson('', '', []));
  }
}
