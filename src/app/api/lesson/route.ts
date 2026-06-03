import { NextRequest, NextResponse } from 'next/server';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGroq } from '@langchain/groq';

export const maxDuration = 30;

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
  "intro": "2-3 sentence engaging intro that hooks the reader and sets context. Speak directly to the learner.",
  "concepts": [
    {
      "title": "Concept name (short)",
      "explanation": "2-4 sentences explaining this concept clearly, avoiding jargon where possible.",
      "analogy": "1 sentence real-world analogy that makes this click (optional but strongly encouraged)"
    }
  ],
  "practicalExample": "3-5 sentences describing a concrete, relatable real-world example or scenario that illustrates the key idea of this module.",
  "quickActions": [
    "Specific, actionable step the learner can do right now (1 sentence)",
    "Another concrete action",
    "A third action"
  ],
  "summary": "2-3 sentences summarizing the key takeaway and how it connects to the learner's broader journey."
}

Requirements:
- 3-5 concepts
- 3 quick actions (specific and doable, not vague like 'research more')
- Friendly but authoritative tone
- All explanations must be accessible to someone at the ${difficulty} level`;

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
