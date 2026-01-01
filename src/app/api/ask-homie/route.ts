import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

const AI_PROVIDER = process.env.AI_PROVIDER || 'openai'; // 'openai' or 'claude'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are Homie, a helpful AI assistant for HomieHouse - a Farcaster-based social platform. 

Key Facts about Farcaster:
- Farcaster was created by Dan Romero and Varun Srinivasan
- It's a sufficiently decentralized social network protocol
- Built on Ethereum/Optimism blockchain
- Users own their social graph and data
- Accounts are identified by FIDs (Farcaster IDs)

Key Facts about HomieHouse:
- A social hub built on Farcaster protocol
- Users can view feeds, compose casts, and interact with the Farcaster network
- Integrates with Farcaster AuthKit for authentication

Be friendly, concise, and accurate. If you're not certain about something, say so rather than guessing.`;

export async function POST(req: NextRequest) {
  try {
    const { messages, provider: requestedProvider } = await req.json();

    // Allow per-request provider override, otherwise use env default
    const selectedProvider = requestedProvider || AI_PROVIDER;

    let response: string;
    let usedProvider = selectedProvider;

    try {
      if (selectedProvider === 'claude') {
        // Use Claude (Anthropic)
        const completion = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: messages.map((msg: any) => ({
            role: msg.role === 'system' ? 'user' : msg.role,
            content: msg.content,
          })),
        });

        response = completion.content[0].type === 'text' ? completion.content[0].text : '';
      } else {
        // Use OpenAI
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: SYSTEM_PROMPT
            },
            ...messages
          ],
          temperature: 0.7,
          max_tokens: 500,
        });

        response = completion.choices[0].message.content || '';
      }
    } catch (primaryError) {
      // Fallback to alternate provider if primary fails
      console.warn(`${selectedProvider} failed, trying fallback provider:`, primaryError);
      
      const fallbackProvider = selectedProvider === 'claude' ? 'openai' : 'claude';
      usedProvider = `${fallbackProvider} (fallback)`;

      if (fallbackProvider === 'claude') {
        const completion = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: messages.map((msg: any) => ({
            role: msg.role === 'system' ? 'user' : msg.role,
            content: msg.content,
          })),
        });

        response = completion.content[0].type === 'text' ? completion.content[0].text : '';
      } else {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: SYSTEM_PROMPT
            },
            ...messages
          ],
          temperature: 0.7,
          max_tokens: 500,
        });

        response = completion.choices[0].message.content || '';
      }
    }

    return NextResponse.json({ response, provider: usedProvider });
  } catch (error) {
    console.error(`Error calling AI providers:`, error);
    return NextResponse.json(
      { error: `Failed to get response from AI` },
      { status: 500 }
    );
  }
}
