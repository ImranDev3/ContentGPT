// Manifest.build provider factory — wraps @ai-sdk/openai-compatible
// so we can use Vercel AI SDK's streamText / generateText against Manifest.

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { env } from './env.js';

export const manifest = createOpenAICompatible({
  name: 'manifest',
  baseURL: env.MANIFEST_BASE_URL,
  apiKey: env.MANIFEST_API_KEY,
});

export const manifestModel = manifest.chatModel(env.MANIFEST_MODEL);
