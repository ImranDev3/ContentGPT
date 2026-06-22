// Health check — pings Manifest with a one-token call so the UI can show
// the resolved model id and round-trip latency in the topbar.

import { Hono } from 'hono';
import { pingModel } from '../lib/manifest.js';

export const healthRoute = new Hono();

healthRoute.get('/', async (c) => {
  const started = Date.now();
  try {
    const { model } = await pingModel(1);
    return c.json({
      ok: true,
      model: model ?? 'auto',
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
