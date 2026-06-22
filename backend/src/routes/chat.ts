// Chat streaming endpoint.
//
// Accepts the Vercel AI SDK UI Message Stream shape from the frontend's
// useChat hook. Optionally injects Wikipedia public-domain context when
// the X-Copyright-Free header is set. Streams back the AI SDK UI Message
// Stream format that useChat consumes natively.

import { Hono } from 'hono';
import {
  convertToCoreMessages,
  streamText,
  type TextStreamPart,
  type ToolSet,
  type UIMessage,
} from 'ai';
import { manifestModel } from '../lib/manifest.js';
import { getWikiContext } from '../lib/wiki.js';
import {
  BASE_SYSTEM,
  COPYRIGHT_SYSTEM,
  WIKI_CONTEXT_HEADER,
} from '../lib/prompts.js';

export const chatRoute = new Hono();

// Set the request-level flag from the header (typed in types.d.ts).
chatRoute.use('*', async (c, next) => {
  c.set('copyrightFree', c.req.header('x-copyright-free') === 'true');
  await next();
});

chatRoute.post('/', async (c) => {
  // The frontend posts { messages: UIMessage[] }.
  const body = (await c.req.json().catch(() => null)) as { messages?: UIMessage[] } | null;
  if (!body?.messages || !Array.isArray(body.messages)) {
    return c.json({ error: 'Body must be { messages: UIMessage[] }' }, 400);
  }

  const copyrightFree = c.get('copyrightFree');
  const coreMessages = convertToCoreMessages(body.messages);

  // Build the system prompt. If copyright-free mode is on, fetch Wikipedia
  // context for the latest user message and append it.
  let system = BASE_SYSTEM;
  if (copyrightFree) {
    const lastUser = [...coreMessages].reverse().find((m) => m.role === 'user');
    const userText = extractUserText(lastUser?.content);
    const summaries = userText ? await getWikiContext(userText, 3) : [];
    system = `${COPYRIGHT_SYSTEM}${WIKI_CONTEXT_HEADER(summaries)}`;
  }

  try {
    const result = streamText({
      model: manifestModel,
      system,
      messages: coreMessages,
      maxTokens: 4096,
      // Strip <think>...</think> blocks that some models emit. The strip is
      // applied to the stream before sending, so the UI sees clean text.
      experimental_transform: [stripThinkTags],
    });

    return result.toDataStreamResponse();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 502);
  }
});

// Pull the textual part of a UIMessage content value (string or array of parts).
function extractUserText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => {
        if (typeof p === 'string') return p;
        if (p && typeof p === 'object' && 'text' in p && typeof (p as { text: unknown }).text === 'string') {
          return (p as { text: string }).text;
        }
        return '';
      })
      .join(' ')
      .trim();
  }
  return '';
}

// A simple Vercel AI SDK transform that drops <think>...</think> blocks.
function stripThinkTags() {
  let buffer = '';
  let inThink = false;
  return new TransformStream<TextStreamPart<ToolSet>, TextStreamPart<ToolSet>>({
    transform(chunk, controller) {
      if (chunk.type !== 'text-delta') {
        controller.enqueue(chunk);
        return;
      }
      buffer += chunk.textDelta;
      let out = '';
      let i = 0;
      while (i < buffer.length) {
        if (!inThink) {
          const open = buffer.indexOf('<think>', i);
          if (open === -1) {
            out += buffer.slice(i);
            i = buffer.length;
            break;
          }
          out += buffer.slice(i, open);
          i = open + '<think>'.length;
          inThink = true;
        } else {
          const close = buffer.indexOf('</think>', i);
          if (close === -1) {
            // Hold the rest in the buffer; we may be mid-tag.
            i = buffer.length;
            break;
          }
          i = close + '</think>'.length;
          inThink = false;
        }
      }
      // Keep the last 7 chars (length of "</think>") in the buffer to detect
      // a closing tag that arrives in the next chunk.
      buffer = buffer.slice(Math.max(0, buffer.length - 7));
      if (out) controller.enqueue({ ...chunk, textDelta: out });
    },
    flush() {
      // If a tag was never closed, drop what's left in the buffer silently.
      // Anything outside <think>...</think> will already have been emitted.
      void buffer;
    },
  });
}
