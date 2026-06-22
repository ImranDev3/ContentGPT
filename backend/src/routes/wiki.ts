// Direct Wikipedia lookup endpoint, used by the UI's copyright-free mode
// (so the model can cite real URLs without re-fetching server-side).

import { Hono } from 'hono';
import { z } from 'zod';
import { getWikiContext } from '../lib/wiki.js';

export const wikiRoute = new Hono();

const querySchema = z.object({
  q: z.string().min(2).max(500),
  limit: z.coerce.number().int().min(1).max(5).default(3),
});

wikiRoute.get('/summary', async (c) => {
  const parsed = querySchema.safeParse({
    q: c.req.query('q'),
    limit: c.req.query('limit'),
  });
  if (!parsed.success) {
    return c.json({ error: 'Bad request', issues: parsed.error.issues }, 400);
  }
  const summaries = await getWikiContext(parsed.data.q, parsed.data.limit);
  return c.json({ summaries });
});
