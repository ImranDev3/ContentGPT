// Health check — pings Manifest with a minimal request so the UI can show
// the resolved model id and round-trip latency in the topbar.

import { Hono } from 'hono';
import { generateText } from 'ai';
import { manifestModel } from '../lib/manifest.js';

export const healthRoute = new Hono();

healthRoute.get('/', async (c) => {
  const started = Date.now();
  try {
    // 1-token request is enough to confirm auth + resolve model id.
    const result = await generateText({
      model: manifestModel,
      prompt: 'ping',
      maxTokens: 1,
    });
    return c.json({
      ok: true,
      model: result.response.modelId ?? 'auto',
      latencyMs: Date.now() - started,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json(
      { ok: false, error: message, latencyMs: Date.now() - started },
      502,
    );
  }
});
