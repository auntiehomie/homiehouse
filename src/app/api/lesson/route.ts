import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 30;

function getGroq() {
  if (!process.env.GROQ_API_KEY) return null;
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });
}

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
      title: `Concept ${i + 1}`,
      explanation: obj,
    })),
    practicalExample: `As you work through ${title}, look for real-world applications in the projects and communities you already follow.`,
    quickActions: [
      'Read through the objectives above carefully',
      'Search Farcaster for conversations about this topic',
      'Take notes on 3 things you want to remember',
    ],
    summary: `Completing this module will give you a solid foundation in ${title.toLowerCase()} and prepare you for the next step in your learning journey.`,
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

    const groq = getGroq();

    if (!groq) {
      console.warn('[lesson] No AI provider configured, returning fallback');
      return NextResponse.json(fallbackLesson(title, description, objectives));
    }

    const isHyperliquidModule =
      title?.toLowerCase().includes('hyperliquid') ||
      tags?.some((t: string) => t.toLowerCase().includes('hyperliquid') || t.toLowerCase() === 'hype');

    const hyperliquidContext = isHyperliquidModule ? `
FACTUAL CONTEXT — use this for the Hyperliquid lesson:
- Hyperliquid is a decentralized perpetuals (perps) exchange built on its own L1 chain (HyperEVM), not on Ethereum or Solana
- HYPE is the native token — launched November 2024 via a large community airdrop with NO venture capital allocation, which was widely praised
- By mid-2026 HYPE has grown to surpass Solana (SOL) in market cap, becoming a top-10 crypto asset
- Prominent investor Arthur Hayes publicly targeted $150 for HYPE and exited near that level in June 2026
- Hyperliquid earns protocol fees from trading volume; those fees go to an Assistance Fund and token buybacks — a real revenue model
- Key risk: it is a single team-controlled chain; decentralization is not yet proven; regulatory risk applies
- Practical example: a user can trade perps directly on app.hyperliquid.xyz with no KYC and self-custody
` : '';

    const prompt = `You are a friendly, practical Web3 / decentralization educator. Generate a lesson for this learning module.
${hyperliquidContext}

Module:
- Title: ${title}
- Description: ${description}
- Why it matters: ${whyItMatters}
- Learning objectives: ${objectives?.join(', ')}
- Difficulty: ${difficulty}
- Tags: ${tags?.join(', ')}

Return ONLY valid JSON — no markdown, no code fences. Use this exact structure:

{
  "intro": "2-3 sentence engaging intro. Hook the reader, speak directly to them.",
  "concepts": [
    {
      "title": "Short concept name",
      "explanation": "2-3 sentences max. Clear, jargon-free.",
      "analogy": "1 sentence real-world analogy (strongly encouraged)"
    }
  ],
  "practicalExample": "3-4 sentences. A concrete real-world scenario that makes the key idea tangible.",
  "quickActions": [
    "Specific action the learner can do in the next 10 minutes",
    "Another concrete action",
    "A third action"
  ],
  "summary": "2 sentences. Key takeaway + how it connects to the broader journey.",
  "quiz": [
    {
      "question": "Clear question testing understanding of a key concept",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "1-2 sentences explaining why this answer is correct and the others aren't."
    }
  ]
}

Requirements:
- 3-4 concepts (keep explanations tight — 2-3 sentences each)
- 3 quick actions (specific, doable in minutes)
- 3-4 quiz questions covering different objectives
- Quiz questions must have exactly 4 options
- correctIndex is 0-based (0=A, 1=B, 2=C, 3=D)
- Friendly but authoritative tone
- Accessible to someone at the ${difficulty} level
- Quiz should feel like a checkpoint, not a trick test`;

    let content: string;
    try {
      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2000,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }],
      });
      content = response.choices[0]?.message?.content?.trim() ?? '';
    } catch (aiErr: any) {
      console.error('[lesson] AI call failed, using fallback:', aiErr?.message);
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
