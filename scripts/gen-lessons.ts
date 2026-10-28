/**
 * Standalone lesson generator — calls OpenRouter directly, saves JSON files.
 * No dev server needed. Run with: npx tsx scripts/gen-lessons.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { writeFileSync, existsSync, readFileSync } from 'fs';

config({ path: resolve(process.cwd(), '.env.local') });

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY!;
if (!OPENROUTER_KEY) { console.error('❌ No OPENROUTER_API_KEY'); process.exit(1); }

// ─── Module definitions ─────────────────────────────────────────────────────
interface Module {
  id: string; title: string; description: string; whyItMatters: string;
  objectives: string[]; difficulty: string; tags: string[];
}

const MODULES: Module[] = [
  { id: 'wallet-basics', title: 'Your First Crypto Wallet', description: 'Learn what a crypto wallet is, how it works, and how to set one up safely. Understand the difference between custodial and self-custody wallets.', whyItMatters: 'Your wallet is your identity and bank account in Web3 — without it, you cannot participate.', objectives: ['Understand what a seed phrase is and why it must be kept secret','Set up a self-custody wallet like MetaMask or Coinbase Wallet','Know the difference between hot and cold wallets','Send and receive your first transaction safely'], difficulty: 'beginner', tags: ['wallet','security','basics'] },
  { id: 'what-is-decentralization', title: 'What Is Decentralization?', description: 'Explore the core idea of decentralization — removing single points of control — and why it matters in finance, social media, and beyond.', whyItMatters: 'Understanding decentralization lets you see why Web3 exists and what problems it is actually trying to solve.', objectives: ['Explain the difference between centralized and decentralized systems','Name real-world examples where decentralization changes the power balance','Understand why censorship resistance matters','Describe how peer-to-peer networks work at a high level'], difficulty: 'beginner', tags: ['philosophy','web3','basics'] },
  { id: 'blockchain-basics', title: 'How Blockchains Work', description: 'Dive into the mechanics of a blockchain — blocks, chains, consensus, and why data stored on-chain is practically immutable.', whyItMatters: 'Knowing how blockchains work turns you from a consumer into someone who can evaluate any project or claim.', objectives: ['Describe what a block contains and how blocks link together','Understand proof of work vs proof of stake consensus','Explain why transactions are final on-chain','Read a simple block explorer entry'], difficulty: 'beginner', tags: ['blockchain','consensus','fundamentals'] },
  { id: 'web3-identity', title: 'Identity in Web3', description: 'Learn how your Ethereum address becomes your identity, how ENS names work, and the concept of on-chain reputation.', whyItMatters: "Your on-chain identity follows you everywhere — it's your reputation, your history, and your access pass.", objectives: ['Understand how a public/private key pair creates your identity','Register or understand an ENS (.eth) name','Explore what on-chain activity reveals about a wallet','Understand why pseudonymity is different from anonymity'], difficulty: 'beginner', tags: ['identity','ENS','privacy'] },
  { id: 'intro-to-farcaster', title: 'Welcome to Farcaster', description: 'Discover Farcaster — a decentralized social protocol built on Ethereum — and how HomieHouse gives you a home in this ecosystem.', whyItMatters: 'Farcaster is where crypto-native conversation happens; understanding it opens doors to community, information, and opportunity.', objectives: ['Explain what a Farcaster FID and signer are','Post your first cast and follow relevant channels','Understand how casts are stored on-chain vs off-chain','Connect your wallet to your Farcaster identity'], difficulty: 'beginner', tags: ['farcaster','social','community'] },
  { id: 'what-is-a-token', title: 'What Is a Crypto Token?', description: 'Break down the different types of crypto tokens — utility, governance, LP, and revenue-sharing — and understand how they differ from coins.', whyItMatters: 'Every financial decision in Web3 involves tokens. Knowing what you actually own is the foundation of everything else.', objectives: ['Explain the difference between a coin (e.g. ETH) and a token (e.g. HYPE, UNI)','Identify utility tokens, governance tokens, and LP tokens','Understand how tokens are created and deployed on a chain','Read a token contract address on a block explorer'], difficulty: 'beginner', tags: ['tokens','fundamentals','DeFi'] },
  { id: 'tokenomics-101', title: 'Tokenomics: Reading Between the Lines', description: "Learn how to evaluate a token's supply, distribution, vesting schedules, and emission rate — the signals that separate strong projects from pump-and-dumps.", whyItMatters: 'Tokenomics determines long-term value. A great product with bad tokenomics can still destroy your investment.', objectives: ["Read a token's circulating supply vs max supply",'Understand what vesting and cliff schedules mean for price','Spot red flags: insider concentration, unlocks, and inflation','Compare market cap vs fully diluted valuation (FDV)'], difficulty: 'beginner', tags: ['tokenomics','research','investing'] },
  { id: 'hyperliquid-case-study', title: 'Hyperliquid: A Case Study in Protocol Tokens', description: 'Examine Hyperliquid (HYPE) — a decentralized perpetuals exchange that grew to surpass Solana in market cap by mid-2026 — as a real-world lesson in protocol value accrual.', whyItMatters: 'Hyperliquid shows how a protocol can capture value through fees, community distribution, and product-market fit.', objectives: ['Explain what a perpetuals DEX is and why it attracts volume','Understand how Hyperliquid distributed HYPE (no VCs, airdrop-first)','Read protocol revenue and see how it flows back to token holders','Evaluate why HYPE grew from launch to top-10 asset and what risks remain'], difficulty: 'intermediate', tags: ['hyperliquid','HYPE','perps','case-study','DeFi'] },
  { id: 'defi-protocol-tokens', title: 'DeFi Protocol Tokens & Governance', description: 'Learn how governance tokens like UNI, AAVE, and MKR work — and when holding them makes sense beyond speculation.', whyItMatters: 'Protocol tokens let you participate in shaping the future of financial infrastructure.', objectives: ['Explain what a governance vote is and how quorum works','Understand ve-tokenomics (vote-escrowed locking for yield)','Identify protocols where the token genuinely captures value vs vanity governance','Participate in or simulate a governance vote'], difficulty: 'intermediate', tags: ['governance','DeFi','protocol-tokens'] },
  { id: 'on-chain-portfolio', title: 'Building & Tracking an On-Chain Portfolio', description: 'Set up a real on-chain portfolio using tools like Zapper, DeBank, or Zerion. Understand gas costs, slippage, and how to think about position sizing.', whyItMatters: 'Managing your own assets on-chain is the whole point of DeFi. A clear view of your portfolio is your most important risk tool.', objectives: ['Connect a wallet to a portfolio tracker and understand what it shows','Calculate the true cost of a trade including gas and slippage','Set a simple position-sizing rule for DeFi allocations','Export your transaction history for tax purposes'], difficulty: 'beginner', tags: ['portfolio','tools','DeFi','tax'] },
  { id: 'risk-management-defi', title: 'DeFi Risk Management', description: 'Understand smart contract risk, liquidation mechanics, impermanent loss, and how to size positions so a single exploit does not wipe you out.', whyItMatters: 'DeFi yields are real, but so are the risks.', objectives: ['Name the top 5 DeFi risk categories: smart contract, oracle, liquidity, protocol, regulatory','Understand how lending liquidations work and how to avoid them','Calculate impermanent loss on an LP position','Apply a simple rule: never put more in a single protocol than you can afford to lose'], difficulty: 'intermediate', tags: ['risk','DeFi','security','lending'] },
  { id: 'ethereum-history', title: 'The History of Ethereum', description: "Trace Ethereum from Vitalik's 2013 whitepaper through the genesis block, The DAO hack, The Merge, and the upgrades reshaping the chain today.", whyItMatters: "Understanding Ethereum's history explains every design decision the ecosystem has made.", objectives: ['Explain why Vitalik Buterin created Ethereum and what gap it filled beyond Bitcoin','Describe The Merge (2022) and what changing to Proof of Stake meant for the network','Name the major hard forks and upgrades: Constantinople, EIP-1559, Shanghai, Dencun','Understand how The DAO hack of 2016 led to the ETH/ETC split'], difficulty: 'beginner', tags: ['ethereum','history','fundamentals'] },
  { id: 'dao-history', title: 'The History of DAOs', description: 'From the infamous DAO hack of 2016 to Nouns, ConstitutionDAO, and on-chain treasuries managing billions — trace how decentralized autonomous organizations evolved.', whyItMatters: 'DAOs represent a new model for human coordination.', objectives: ['Explain what The DAO was, why it was hacked for $60M ETH, and how it forced an Ethereum hard fork','Understand how MolochDAO introduced minimalist grant-giving DAOs in 2019','Describe ConstitutionDAO and what it revealed about DAO coordination at scale','Identify the key tools DAOs use today: Snapshot, Tally, Gnosis Safe'], difficulty: 'beginner', tags: ['dao','history','governance'] },
  { id: 'defi-hacks', title: 'A History of DeFi Hacks', description: 'Walk through the biggest DeFi exploits — Ronin bridge ($625M), Wormhole ($320M), Euler Finance ($197M) — and understand the attack vectors that made them possible.', whyItMatters: 'Every major DeFi hack teaches something about system design.', objectives: ['Name the top 5 DeFi hacks by size and describe how each happened','Explain the difference between reentrancy attacks, oracle manipulation, and bridge vulnerabilities',"Understand what a flash loan attack is and why it's unique to DeFi",'Apply a checklist for assessing protocol safety before depositing funds'], difficulty: 'intermediate', tags: ['security','hacks','DeFi','risk'] },
  { id: 'farcaster-history', title: 'Farcaster: History & Protocol', description: 'Learn how Dan Romero and Varun Srinivasan built a "sufficiently decentralized" social protocol from scratch.', whyItMatters: "Farcaster is the infrastructure for crypto-native social.", objectives: ['Describe how Farcaster stores identity on-chain (FIDs on Optimism) while keeping content off-chain (Hubs)','Explain what a Farcaster Hub is and why the network requires multiple hubs for decentralization','Understand the timeline: 2022 beta to channels to Frames to open protocol','Identify the key clients (Warpcast, HomieHouse, Supercast) and why multiple clients matter'], difficulty: 'beginner', tags: ['farcaster','history','social','protocol'] },
  { id: 'security-decentralization', title: 'Security in Decentralization', description: 'Master the threat model for Web3: phishing, fake mints, wallet drainers, rug pulls, and how to protect yourself.', whyItMatters: "In Web3, you are your own bank — which means you're also your own security team.", objectives: ['Identify the most common Web3 scams: fake airdrops, approval drainers, phishing sites','Understand what a token approval is and how to revoke unnecessary ones','Set up a hardware wallet and understand when cold storage is worth it',"Apply a simple rule: never share your seed phrase, never approve contracts you don't understand"], difficulty: 'beginner', tags: ['security','opsec','wallet','safety'] },
  { id: 'venice-ai', title: 'Venice.ai: Private AI on Web3', description: 'Explore Venice.ai — a privacy-first AI platform built on decentralized infrastructure where your conversations are never stored, logged, or used for training.', whyItMatters: 'As AI becomes central to daily life, the question of who controls your data becomes critical.', objectives: ['Explain how Venice.ai differs from ChatGPT and Claude in terms of data privacy','Understand how decentralized inference keeps your prompts private',"Explore Venice's model selection and how open-source models power it","Connect Venice's model to the broader Web3 principle of user-owned data and permissionless access"], difficulty: 'beginner', tags: ['venice','AI','privacy','web3'] },
  { id: 'how-llms-actually-work', title: 'How AI Actually "Thinks": LLMs in Plain English', description: "Demystify large language models — what they're actually doing when they answer you, and why they sometimes confidently make things up.", whyItMatters: 'You interact with AI models constantly now — knowing roughly how they work makes you a sharper, more skeptical user.', objectives: ['Explain what a token is and how a model predicts the next one','Understand what "training" actually means at a high level, without the math','Explain why models hallucinate and how to spot a likely-wrong answer','Compare a few real models (Claude, GPT, open-source options) at a conceptual level'], difficulty: 'beginner', tags: ['AI','machine-learning','LLMs','fundamentals'] },
  { id: 'ai-agents-onchain', title: 'AI Agents That Own Wallets and Trade On-Chain', description: 'Meet the wave of autonomous AI agents that hold their own crypto wallets, post on Farcaster, trade tokens, and coordinate with other agents.', whyItMatters: 'AI agents with on-chain wallets are one of the fastest-growing intersections of AI and crypto.', objectives: ['Explain what it means for an AI agent to "own" a wallet and sign transactions autonomously','Understand the basic agent loop: perceive (read casts/data) → decide (LLM call) → act (post, trade, reply)','Identify real examples: trading agents, social agents like @thehomie, and agent-to-agent marketplaces','Spot the difference between a genuinely autonomous agent and a scripted bot wearing an "AI" label'], difficulty: 'intermediate', tags: ['AI','agents','automation','web3'] },
  { id: 'ai-security-prompt-injection', title: 'Prompt Injection: The New Frontier of Hacks', description: 'Just like DeFi has flash-loan attacks and reentrancy bugs, AI systems have their own exploit class — prompt injection.', whyItMatters: 'As AI agents get wallets and permissions, securing them against manipulation becomes exactly as important as securing a smart contract.', objectives: ['Explain what prompt injection is and how it differs from traditional code exploits','Understand why an AI agent that reads untrusted content (like social posts) is especially exposed','Identify real-world prompt injection incidents against AI agents and chatbots','Apply basic defensive patterns: input sanitization, permission boundaries, human-in-the-loop for high-stakes actions'], difficulty: 'intermediate', tags: ['AI','security','prompt-injection','agents'] },
  { id: 'ai-crypto-convergence', title: 'Why AI and Crypto Keep Colliding', description: 'From decentralized GPU marketplaces to on-chain model provenance to agent-native payment rails, explore the ways AI and crypto are genuinely merging.', whyItMatters: 'Every cycle brings hype around AI x crypto — knowing the real infrastructure from the marketing lets you tell which projects are solving something real.', objectives: ['Explain what decentralized compute marketplaces (like Render, Akash, io.net) actually provide','Understand why crypto rails (stablecoins, micropayments) are a natural fit for machine-to-machine AI agent payments','Describe how on-chain provenance could help verify AI-generated content','Separate genuine AI-crypto infrastructure from projects that just added AI to their pitch deck'], difficulty: 'intermediate', tags: ['AI','crypto','infrastructure','convergence'] },
];

// ─── Topic context (mirrors lesson route) ───────────────────────────────────
const TOPIC_CONTEXT: Record<string, string> = {
  'hyperliquid-case-study': `\nFACTUAL CONTEXT — Hyperliquid:\n- Hyperliquid is a decentralized perpetuals (perps) exchange built on its own L1 chain (HyperEVM)\n- HYPE is the native token — launched November 2024 via a community airdrop with NO VC allocation\n- By mid-2026 HYPE surpassed Solana in market cap, becoming a top-10 crypto asset\n- Protocol fees fund an Assistance Fund and token buybacks\n- Users trade perps directly on app.hyperliquid.xyz with no KYC and self-custody`,
  'ethereum-history': `\nFACTUAL CONTEXT — History of Ethereum:\n- Vitalik Buterin published the Ethereum whitepaper in November 2013\n- Genesis block mined July 30, 2015\n- The DAO hack (June 2016): ~$60M in ETH drained via reentrancy attack\n- EIP-1559 (August 2021): base fee that gets burned, making ETH deflationary\n- The Merge (September 15, 2022): PoW → PoS, cutting energy use ~99.95%\n- Shanghai upgrade (April 2023): enabled ETH withdrawals from staking\n- Dencun upgrade (March 2024): EIP-4844 blob transactions cutting L2 costs 10-100x`,
  'dao-history': `\nFACTUAL CONTEXT — History of DAOs:\n- "The DAO" (April 2016): first famous DAO, raised 12.7M ETH (~$150M), hacked for 3.6M ETH ($60M)\n- MolochDAO (February 2019): minimalist grant-giving DAO\n- ConstitutionDAO (November 2021): raised $47M in one week\n- Nouns DAO (August 2021): one NFT auctioned daily, all proceeds to treasury\n- Wyoming (2021) recognized DAOs as legal entities`,
  'defi-hacks': `\nFACTUAL CONTEXT — History of DeFi Hacks:\n- The DAO (2016): $60M ETH via reentrancy\n- Poly Network (August 2021): $611M drained across Ethereum, BSC, Polygon\n- Wormhole bridge (February 2022): $320M — attacker forged a validator signature\n- Ronin bridge (March 2022): $625M — Lazarus Group compromised 5 of 9 validator keys\n- Euler Finance (March 2023): $197M flash loan attack`,
  'farcaster-history': `\nFACTUAL CONTEXT — Farcaster Protocol & History:\n- Founded by Dan Romero and Varun Srinivasan (both former Coinbase) in 2020\n- FID (Farcaster ID): an on-chain integer registered on the Farcaster ID Registry on Optimism\n- Hubs: off-chain servers that sync and store all casts, reactions, and links\n- Signers: each app has a registered signer key authorized to act on behalf of your FID\n- Frames (January 2024): interactive mini-apps embedded in casts`,
  'security-decentralization': `\nFACTUAL CONTEXT — Web3 Security & Opsec:\n- Wallet drainers: malicious smart contract approvals\n- Revoke.cash lets you see and revoke all open token approvals\n- Seed phrase attacks: legitimate services NEVER ask for your seed phrase\n- Hardware wallets (Ledger, Trezor): keys never touch the internet\n- Multisig (Gnosis Safe): requires M-of-N signatures\n- "Approval phishing" is the #1 attack vector`,
  'venice-ai': `\nFACTUAL CONTEXT — Venice.ai:\n- Privacy-first AI platform launched in 2024\n- Uses open-source models (Llama, Mistral, etc.)\n- Model inference runs on distributed GPU infrastructure\n- Users can pay with crypto\n- No conversation storage, no logging, no training on user data`,
};

// ─── LLM call ────────────────────────────────────────────────────────────────
async function generateLesson(mod: Module): Promise<any> {
  const topicContext = TOPIC_CONTEXT[mod.id] || '';
  const tagStr = mod.tags.join(', ');

  const prompt = `You are a knowledgeable, direct Web3 and decentralization educator. Generate a thorough, in-depth lesson for this learning module.
${topicContext}
Module:
- Title: ${mod.title}
- Description: ${mod.description}
- Why it matters: ${mod.whyItMatters}
- Learning objectives: ${mod.objectives.join(', ')}
- Difficulty: ${mod.difficulty}
- Tags: ${tagStr}

Return ONLY valid JSON — no markdown, no code fences. Use this exact structure:

{
  "intro": "2-3 short sentences (max ~45 words total) that hook the reader",
  "concepts": [
    {
      "title": "Short, memorable concept name (3-5 words)",
      "explanation": "5-6 sentences. Define, explain HOW it works, give a REAL example, explain why it matters.",
      "analogy": "One vivid sentence comparing this to something from everyday life"
    }
  ],
  "practicalExample": "2-3 sentences walking through ONE specific real-world scenario",
  "quickActions": ["Specific action with a named tool", "A second concrete action", "A third action"],
  "summary": "2 short sentences. The core insight + connection to the bigger picture.",
  "quiz": [
    {
      "question": "A specific, knowledge-testing question",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 2,
      "explanation": "2-3 sentences: why the correct answer is right AND why each wrong answer is wrong."
    }
  ]
}

Requirements:
- 3-4 concepts, each with a REAL example (name actual protocols, tokens, events, or companies)
- 6 quiz questions, each testing a different concept or detail
- Quiz questions must have exactly 4 options
- VARY the correctIndex across questions — do NOT put the correct answer at the same index for every question
- Authoritative but accessible tone

QUIZ ACCURACY — THIS IS CRITICAL:
- correctIndex is 0-based (0=A, 1=B, 2=C, 3=D). It MUST point to the unambiguously correct option.
- Before finalizing each question, re-read the option at correctIndex and confirm it is TRUE and the others are clearly FALSE.
- Watch out for "reversed pair" distractors. Ground truth: GOVERNANCE token = voting rights; UTILITY token = access/payment; LP token = liquidity pool share.
- The "explanation" must restate the correct fact so it can be checked.`;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://homiehouse.lol',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-4.5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8000,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json() as any;
  const content = data.choices?.[0]?.message?.content?.trim() || '';

  // Parse JSON from the response
  const stripped = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const firstBrace = stripped.indexOf('{');
  const lastBrace = stripped.lastIndexOf('}');
  const jsonStr = firstBrace >= 0 && lastBrace > firstBrace
    ? stripped.slice(firstBrace, lastBrace + 1)
    : stripped;

  const lesson = JSON.parse(jsonStr);

  // Validate
  if (!Array.isArray(lesson.concepts) || lesson.concepts.length === 0) throw new Error('Missing concepts');
  if (!Array.isArray(lesson.quiz) || lesson.quiz.length === 0) throw new Error('Missing quiz');

  // Shuffle quiz options to break "always A" bias
  lesson.quiz = lesson.quiz.map((q: any) => {
    if (!q.options || q.options.length < 2) return q;
    const correctOption = q.options[q.correctIndex];
    const shuffled = [...q.options];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return { ...q, options: shuffled, correctIndex: shuffled.indexOf(correctOption) };
  });

  return lesson;
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const OUTDIR = 'src/data/lessons';
  let generated = 0, skipped = 0, failed = 0;

  console.log(`\n📚 Generating ${MODULES.length} lessons\n`);

  for (const mod of MODULES) {
    const filepath = `${OUTDIR}/${mod.id}.json`;

    if (existsSync(filepath)) {
      console.log(`  ✓ ${mod.id} — already exists`);
      skipped++;
      continue;
    }

    console.log(`  ⏳ ${mod.id} — generating...`);
    try {
      const lesson = await generateLesson(mod);
      writeFileSync(filepath, JSON.stringify(lesson, null, 2));
      const indices = lesson.quiz.map((q: any) => q.correctIndex);
      const allSame = indices.every((v: number) => v === indices[0]);
      console.log(`  ✅ ${mod.id} — ${lesson.concepts.length} concepts, ${lesson.quiz.length} quiz Qs, correctIndex: [${indices.join(',')}]${allSame ? ' ⚠️ ALL SAME!' : ''}`);
      generated++;
    } catch (err: any) {
      console.error(`  ✗ ${mod.id} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`📊 ${skipped} skipped, ${generated} generated, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);