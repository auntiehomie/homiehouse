import { NextRequest, NextResponse } from 'next/server';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGroq } from '@langchain/groq';

export const maxDuration = 30;

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

function getModel() {
  if (process.env.ANTHROPIC_API_KEY)
    return new ChatAnthropic({ model: 'claude-sonnet-4-6', temperature: 0.7 });
  if (process.env.GROQ_API_KEY)
    return new ChatGroq({ model: 'llama-3.3-70b-versatile', temperature: 0.7 });
  if (process.env.OPENAI_API_KEY)
    return new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0.7 });
  return null;
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

    const model = getModel();

    if (!model) {
      console.warn('[lesson] No AI provider configured, returning fallback');
      return NextResponse.json(fallbackLesson(title, description, objectives));
    }

    const prompt = `You are a friendly, practical Web3 / decentralization educator. Generate a lesson for this learning module.

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

    const response = await model.invoke(prompt);
    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

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
    return NextResponse.json({ error: 'Failed to generate lesson' }, { status: 500 });
  }
}
