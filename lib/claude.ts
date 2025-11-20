import Anthropic from '@anthropic-ai/sdk';

// Initialize Claude client (server-side only)
let anthropic: Anthropic | null = null;

function getClient(): Anthropic {
  if (typeof window !== 'undefined') {
    throw new Error('Claude client can only be used server-side');
  }

  if (!anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  return anthropic;
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeOptions {
  model?: string;
  max_tokens?: number;
  system?: string;
  temperature?: number;
}

/**
 * Call Claude API directly (server-side only)
 */
export async function callClaude(
  messages: ClaudeMessage[],
  options: ClaudeOptions = {}
): Promise<string> {
  const client = getClient();

  const {
    model = 'claude-3-5-sonnet-20241022',
    max_tokens = 1024,
    system = 'You are a helpful assistant.',
    temperature = 1,
  } = options;

  const response = await client.messages.create({
    model,
    max_tokens,
    system,
    temperature,
    messages: messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
  });

  // Extract text content
  const textContent = response.content
    .filter((block: any) => block.type === 'text')
    .map((block: any) => block.text)
    .join('\n');

  return textContent;
}

/**
 * Call Claude API via Next.js API route (client-side compatible)
 */
export async function callClaudeViaAPI(
  message: string,
  options: ClaudeOptions = {}
): Promise<{ content: string; usage?: any; model?: string }> {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      system: options.system,
      model: options.model,
      max_tokens: options.max_tokens,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to call Claude API');
  }

  return response.json();
}

