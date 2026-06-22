// Centralised, validated environment config.
// Loaded once at startup; throws if required vars are missing or invalid.

import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Walk up from this file looking for a `.env` in the monorepo root or backend folder.
// monorepo layout: ContentGPT/.env   or   ContentGPT/backend/.env
const here = dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  resolve(here, '..', '..', '..', '.env'), // ../../../.env (from src/lib)
  resolve(here, '..', '..', '.env'),       // ../../.env   (from src)
  resolve(here, '..', '.env'),             // ../.env
];
for (const candidate of envCandidates) {
  if (existsSync(candidate)) {
    loadDotenv({ path: candidate, override: false });
    break;
  }
}

const envSchema = z.object({
  MANIFEST_BASE_URL: z
    .string()
    .url()
    .default('https://app.manifest.build/v1'),
  MANIFEST_API_KEY: z
    .string()
    .min(1, 'MANIFEST_API_KEY is required — copy .env.example to .env and add your key'),
  MANIFEST_MODEL: z.string().min(1).default('auto'),
  PORT: z.coerce.number().int().positive().default(8787),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // Surface a clear, single-line error rather than zod's nested issues.
  const issues = parsed.error.issues
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('; ');
  throw new Error(`Invalid backend environment — ${issues}`);
}

export const env = parsed.data;
export type Env = typeof env;
