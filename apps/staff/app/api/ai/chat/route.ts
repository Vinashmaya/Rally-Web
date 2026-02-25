import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// AI provider configuration — swap this when a provider is chosen
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  dealershipId?: string;
}

interface ChatResponse {
  message: ChatMessage;
}

// POST — AI chat proxy (provider-agnostic stub)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { messages, dealershipId } = body as ChatRequest;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: messages (non-empty array)' },
        { status: 400 },
      );
    }

    // Validate message structure
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return NextResponse.json(
          { error: 'Each message must have role and content fields' },
          { status: 400 },
        );
      }
    }

    // --- Provider Integration Point ---
    // When an AI provider is configured, replace this block with:
    //
    // OpenAI:
    //   const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    //   const completion = await openai.chat.completions.create({
    //     model: 'gpt-4',
    //     messages,
    //   });
    //   const assistantMessage = completion.choices[0].message;
    //
    // Anthropic:
    //   const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    //   const response = await anthropic.messages.create({
    //     model: 'claude-sonnet-4-20250514',
    //     messages,
    //   });
    //   const assistantMessage = { role: 'assistant', content: response.content[0].text };

    const lastUserMessage = messages.filter((m) => m.role === 'user').pop();

    const response: ChatResponse = {
      message: {
        role: 'assistant',
        content: `Rally AI is not yet configured. Your message was received: "${lastUserMessage?.content ?? ''}"${
          dealershipId ? ` (dealership: ${dealershipId})` : ''
        }. Configure OPENAI_API_KEY or ANTHROPIC_API_KEY to enable AI responses.`,
      },
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error('[API] AI chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
