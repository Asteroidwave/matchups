import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Claude client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { message, system, model = 'claude-3-5-sonnet-20241022', max_tokens = 1024 } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Call Claude API
    const response = await anthropic.messages.create({
      model,
      max_tokens,
      system: system || 'You are a helpful assistant.',
      messages: [
        {
          role: 'user',
          content: message,
        },
      ],
    });

    // Extract text content from response
    const textContent = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n');

    return NextResponse.json({
      content: textContent,
      usage: response.usage,
      model: response.model,
    });
  } catch (error: any) {
    console.error('Claude API error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to process request',
        details: error.error?.message,
      },
      { status: error.status || 500 }
    );
  }
}

