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
  ],
};

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
      return NextResponse.json({ ...FALLBACK_PLAN, track, level });
    }

    const prompt = `You are a Web3 / decentralization education expert. Create a personalized learning plan as a JSON object.

User profile:
- Track: ${track} (learner = understand concepts, creator = build things on-chain, financial = manage assets, all = full picture)
- Level: ${level}
- Specific goals: ${specificGoals || 'not provided'}

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
      return NextResponse.json({ ...FALLBACK_PLAN, track, level });
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
