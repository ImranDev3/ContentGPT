// Chat streaming endpoint.
//
// Receives { messages: UIMessage[] } from the Vercel AI SDK's `useChat`,
// converts to the OpenAI Responses API input shape, optionally augments
// the system prompt with public-domain context, then streams back in
// the AI SDK data-stream protocol that useChat consumes natively.

import { Hono } from 'hono';
import { streamResponses, type ResponsesInputItem } from '../lib/manifest.js';
import { getWikiContext } from '../lib/wiki.js';
import { getWebSearch } from '../lib/search.js';
import {
  BASE_SYSTEM,
  COPYRIGHT_SYSTEM,
  WIKI_CONTEXT_HEADER,
  WEB_SEARCH_HEADER,
} from '../lib/prompts.js';

export const chatRoute = new Hono();

// Convert UIMessage → Responses API input item. Supports text + image
// attachments (via experimental_attachments on the frontend).
function uiMessagesToInput(
  messages: { id?: string; role?: string; content?: unknown; experimental_attachments?: Array<{ url?: string; contentType?: string; name?: string }> }[],
): ResponsesInputItem[] {
  const out: ResponsesInputItem[] = [];
  for (const m of messages) {
    const role = m.role;
    if (role !== 'user' && role !== 'assistant') continue;

    const content: ResponsesInputItem['content'] = [];

    // Text part
    if (typeof m.content === 'string' && m.content.length > 0) {
      content.push(role === 'user'
        ? { type: 'input_text', text: m.content }
        : { type: 'output_text', text: m.content });
    } else if (Array.isArray(m.content)) {
      // UIMessage can have array-shaped content (parts)
      for (const part of m.content) {
        if (typeof part === 'string' && part.length > 0) {
          content.push(role === 'user'
            ? { type: 'input_text', text: part }
            : { type: 'output_text', text: part });
        } else if (part && typeof part === 'object' && 'text' in part && typeof (part as { text: unknown }).text === 'string') {
          const t = (part as { text: string }).text;
          if (t.length > 0) {
            content.push(role === 'user'
              ? { type: 'input_text', text: t }
              : { type: 'output_text', text: t });
          }
        }
      }
    }

    // Image attachments (frontend sends them as data URLs)
    if (Array.isArray(m.experimental_attachments)) {
      for (const att of m.experimental_attachments) {
        if (att?.url && (att.contentType?.startsWith('image/') ?? true)) {
          content.push({ type: 'input_image', image_url: att.url });
        }
      }
    }

    if (content.length > 0) out.push({ role, content });
  }
  return out;
}

function extractLastUserText(input: ResponsesInputItem[]): string {
  for (let i = input.length - 1; i >= 0; i--) {
    const item = input[i];
    if (item?.role !== 'user') continue;
    if (typeof item.content === 'string') return item.content;
    for (const part of item.content) {
      if (part.type === 'input_text') return part.text;
    }
  }
  return '';
}

chatRoute.use('*', async (c, next) => {
  c.set('copyrightFree', c.req.header('x-copyright-free') === 'true');
  await next();
});

chatRoute.post('/', async (c) => {
  const body = (await c.req.json().catch(() => null)) as
    | { messages?: unknown[] }
    | null;
  if (!body?.messages || !Array.isArray(body.messages)) {
    return c.json({ error: 'Body must be { messages: UIMessage[] }' }, 400);
  }

  const copyrightFree = c.get('copyrightFree');
  const webSearch = c.req.header('x-web-search') === 'true';
  const input = uiMessagesToInput(body.messages as Parameters<typeof uiMessagesToInput>[0]);

  // Build the system prompt. Layer copyright + wiki + web-search contexts
  // on top of the base system prompt when the corresponding flags are on.
  let system = BASE_SYSTEM;
  if (copyrightFree || webSearch) {
    const lastUserText = extractLastUserText(input);

    const [wikiSummaries, webSnippets] = await Promise.all([
      copyrightFree && lastUserText ? getWikiContext(lastUserText, 2) : Promise.resolve([]),
      webSearch && lastUserText ? getWebSearch(lastUserText, 3) : Promise.resolve([]),
    ]);

    const parts: string[] = [];
    if (copyrightFree) parts.push(COPYRIGHT_SYSTEM + WIKI_CONTEXT_HEADER(wikiSummaries));
    if (webSearch) parts.push(WEB_SEARCH_HEADER + formatWebSnippets(webSnippets));
    system = parts.join('\n\n') || system;
  }

  // AI SDK data-stream protocol: `f:`, `0:`, `e:`, `d:` lines.
  const messageId = `msg-${cryptoRandom()}`;
  const encoder = new TextEncoder();
  let closed = false;
  let buffer = '';
  // Strip <think>…</think> blocks that some models emit. We hold back the
  // last 8 characters in a small buffer so a closing tag that arrives split
  // across chunks is still detected.
  const thinkOpen = '<think>';
  const thinkClose = '</think>';
  let inThink = false;

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(line: string) {
        if (closed) return;
        controller.enqueue(encoder.encode(line + '\n'));
      }
      function sendData(payload: unknown) {
        send(`${payload}`);
      }

      sendData(`f:${JSON.stringify({ messageId })}`);

      try {
        for await (const ev of streamResponses({ instructions: system, input })) {
          if (ev.type === 'delta' && typeof ev.text === 'string') {
            buffer += ev.text;
            let out = '';
            let i = 0;
            while (i < buffer.length) {
              if (!inThink) {
                const open = buffer.indexOf(thinkOpen, i);
                if (open === -1) {
                  out += buffer.slice(i);
                  i = buffer.length;
                  break;
                }
                out += buffer.slice(i, open);
                i = open + thinkOpen.length;
                inThink = true;
              } else {
                const close = buffer.indexOf(thinkClose, i);
                if (close === -1) {
                  i = buffer.length;
                  break;
                }
                i = close + thinkClose.length;
                inThink = false;
              }
            }
            buffer = buffer.slice(Math.max(0, buffer.length - thinkClose.length));
            if (out.length > 0) sendData(`0:${JSON.stringify(out)}`);
          } else if (ev.type === 'completed') {
            sendData(`e:${JSON.stringify({ finishReason: ev.finishReason ?? 'stop', usage: { promptTokens: null, completionTokens: null }, isContinued: false })}`);
          } else if (ev.type === 'error') {
            sendData(`8:${JSON.stringify(ev.message ?? 'Stream error')}`); // AI SDK error frame
            break;
          } else if (ev.type === 'done') {
            // handled after the loop
          }
        }
        sendData(`d:${JSON.stringify({ finishReason: 'stop' })}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        sendData(`8:${JSON.stringify(message)}`);
      } finally {
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});

function formatWebSnippets(snippets: { title: string; url: string; snippet: string }[]): string {
  if (snippets.length === 0) return '';
  return snippets
    .map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet}\n${s.url}`)
    .join('\n\n');
}

function cryptoRandom(): string {
  // Lightweight, dependency-free unique id.
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
