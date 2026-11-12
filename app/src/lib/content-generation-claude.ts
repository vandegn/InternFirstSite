import Anthropic from '@anthropic-ai/sdk';
import type { ArticleWriter } from '@/lib/content-generation';

// The real ArticleWriter: one streamed Claude request per article, with the
// response constrained to the article JSON schema. Streaming because a full
// guide is a long generation and a non-streaming request can hit HTTP
// timeouts; `finalMessage()` still hands back the complete message.
//
// Server-only: it reads ANTHROPIC_API_KEY. Never import from a client component.

export const CONTENT_MODEL = process.env.CONTENT_MODEL ?? 'claude-opus-5-5';

export function createClaudeWriter(client = new Anthropic()): ArticleWriter {
  return async ({ system, prompt, schema }) => {
    const stream = client.beta.messages.stream({
      model: CONTENT_MODEL,
      max_tokens: 32000,
      // Server-side fallback: if a safety classifier declines the request on
      // the primary model, the API re-runs it on a fallback model inside the
      // same call instead of handing back an empty refusal.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // The system prompt is identical for every article in a run, so it is
      // the natural cache breakpoint; the per-topic text goes in the user turn.
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: prompt }],
      output_config: {
        effort: 'high',
        format: { type: 'json_schema', schema },
      },
    });
    const message = await stream.finalMessage();
    const text = message.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
    return {
      text,
      model: message.model,
      stopReason: message.stop_reason,
      usage: message.usage as unknown as Record<string, unknown>,
    };
  };
}
