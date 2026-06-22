// Manifest.build client.
//
// Despite the project documentation calling it the "OpenAI Responses API",
// Manifest's `/v1/responses` endpoint actually accepts Responses-API-style
// input but returns **Chat Completions**-format SSE chunks (the
// `chatcmpl-…` / `choices[0].delta.content` shape). We parse that here so
// callers can use a single clean `AsyncGenerator<StreamEvent>` API.

import { env } from './env.js';

export type ResponsesInputItem = {
  role: 'user' | 'assistant' | 'system';
  content:
    | string
    | Array<
        | { type: 'input_text'; text: string }
        | { type: 'output_text'; text: string }
        | { type: 'input_image'; image_url: string }
      >;
};

export interface StreamOptions {
  model?: string;
  instructions?: string;
  input: ResponsesInputItem[] | string;
  signal?: AbortSignal;
  maxOutputTokens?: number;
}

export interface StreamEvent {
  type: 'delta' | 'completed' | 'error' | 'done';
  text?: string;
  finishReason?: string;
  model?: string;
  message?: string;
}

const ENDPOINT = () => `${env.MANIFEST_BASE_URL.replace(/\/+$/, '')}/responses`;

/**
 * Reduce a structured input array to the compact string form Manifest
 * expects. Multi-part content (e.g. text + image) is joined with newlines.
 */
function flattenInput(input: ResponsesInputItem[] | string): string {
  if (typeof input === 'string') return input;
  return input
    .map((m) => {
      const role = m.role;
      if (typeof m.content === 'string') return `${role}: ${m.content}`;
      const parts = m.content
        .map((p) => {
          if (p.type === 'input_text' || p.type === 'output_text') return p.text;
          if (p.type === 'input_image') return '[image]';
          return '';
        })
        .filter(Boolean)
        .join('\n');
      return `${role}: ${parts}`;
    })
    .join('\n\n');
}

export async function* streamResponses(opts: StreamOptions): AsyncGenerator<StreamEvent> {
  const body: Record<string, unknown> = {
    model: opts.model ?? env.MANIFEST_MODEL,
    input: flattenInput(opts.input),
    instructions: opts.instructions,
    stream: true,
    store: false,
  };
  if (opts.maxOutputTokens) body.max_output_tokens = opts.maxOutputTokens;

  let res: Response;
  try {
    res = await fetch(ENDPOINT(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.MANIFEST_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (err) {
    yield { type: 'error', message: err instanceof Error ? err.message : String(err) };
    return;
  }

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '');
    yield {
      type: 'error',
      message: `[${res.status}] ${errText || res.statusText || 'Manifest request failed'}`,
    };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by blank lines (\n\n). Some servers also
      // emit just \n as a separator; we accept both.
      let sepIdx = buffer.indexOf('\n\n');
      if (sepIdx === -1) sepIdx = buffer.indexOf('\n');
      while (sepIdx !== -1) {
        const frame = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + (buffer[sepIdx] === '\r' ? 4 : 2));
        sepIdx = -1;
        const nextDouble = buffer.indexOf('\n\n');
        const nextSingle = buffer.indexOf('\n');
        sepIdx = nextDouble === -1 ? nextSingle : nextDouble;

        const lines = frame.split('\n');
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') {
            yield { type: 'done' };
            return;
          }
          if (!payload) continue;
          let parsed: unknown;
          try {
            parsed = JSON.parse(payload);
          } catch {
            continue;
          }
          // Chat Completions chunk shape from Manifest.
          const ev = parsed as {
            model?: string;
            choices?: Array<{
              index?: number;
              delta?: { content?: unknown; role?: string };
              finish_reason?: string | null;
            }>;
          };
          if (Array.isArray(ev.choices)) {
            for (const ch of ev.choices) {
              const content = ch.delta?.content;
              if (typeof content === 'string' && content.length > 0) {
                yield { type: 'delta', text: content };
              }
              if (typeof ch.finish_reason === 'string' && ch.finish_reason !== '') {
                yield { type: 'completed', finishReason: ch.finish_reason, model: ev.model };
              }
            }
          }
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* no-op */
    }
  }
  yield { type: 'done' };
}

/**
 * One-shot, non-streaming call. Used by the health probe.
 */
export async function pingModel(maxOutputTokens = 1): Promise<{ text: string; model?: string }> {
  let text = '';
  let model: string | undefined;
  for await (const ev of streamResponses({
    input: [{ role: 'user', content: 'ping' }],
    maxOutputTokens,
  })) {
    if (ev.type === 'delta') {
      if (ev.text) text += ev.text;
      if (ev.model) model = ev.model;
    } else if (ev.type === 'error') {
      throw new Error(ev.message ?? 'Manifest error');
    }
  }
  return { text, model };
}
