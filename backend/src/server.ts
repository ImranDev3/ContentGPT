// Hono app entry. Mounts routes, sets up CORS for the Next.js dev server,
// and binds to the configured port via @hono/node-server.

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './lib/env.js';
import { healthRoute } from './routes/health.js';
import { chatRoute } from './routes/chat.js';
import { wikiRoute } from './routes/wiki.js';

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Copyright-Free'],
    exposeHeaders: ['Content-Type'],
    credentials: false,
    maxAge: 600,
  }),
);

app.get('/', (c) =>
  c.json({ name: 'ContentGPT backend', ok: true, env: env.NODE_ENV }),
);

app.route('/v1/health', healthRoute);
app.route('/v1/chat', chatRoute);
app.route('/v1/wiki', wikiRoute);

app.notFound((c) => c.json({ error: 'Not found', path: c.req.path }, 404));
app.onError((err, c) => {
  console.error('[backend] Unhandled error:', err);
  return c.json({ error: err.message }, 500);
});

const port = env.PORT;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[backend] ContentGPT API listening on http://localhost:${info.port}`);
});
