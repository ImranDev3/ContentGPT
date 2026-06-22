# ContentGPT

A fast, clean, **Mac-style AI content generation chatbot** powered by [Manifest.build](https://app.manifest.build).

![ContentGPT](https://img.shields.io/badge/license-MIT-blue) ![Next.js 14](https://img.shields.io/badge/Next.js-14-black) ![Hono](https://img.shields.io/badge/Hono-4-orange) ![Manifest](https://img.shields.io/badge/Manifest-AI-purple)

## Features

- 💬 **Streaming chat** — token-by-token responses, stop button, Markdown rendering with code highlighting
- 🖼️ **Image paste/upload** — paste (Ctrl+V) or pick an image; AI sees it via multimodal vision
- 🛡️ **Copyright-free toggle** — when enabled, the model leans on public-domain Wikipedia context and cites sources
- 🍎 **Mac-style UI** — frosted glass, SF Pro/Inter, dark + light mode, responsive
- ⚡ **Fast** — Hono backend, Next.js frontend, Vercel AI SDK streaming
- 🔌 **Model-agnostic** — swap Manifest for any OpenAI-compatible endpoint by editing one file

## Architecture

```
ContentGPT/
├── frontend/   Next.js 14 (App Router, TypeScript, Tailwind v4, shadcn/ui)
└── backend/    Hono on Node.js (TypeScript, Vercel AI SDK, Wikipedia REST)
```

The frontend posts to `/api/*`; Next.js rewrites proxy those calls to the Hono backend on `:8787`. The Hono backend holds the Manifest API key (kept server-side) and forwards to `https://app.manifest.build/v1/chat/completions`.

## Quick start

### 1. Get a Manifest API key
1. Sign in at [app.manifest.build](https://app.manifest.build)
2. Create an API key (starts with `mnfst_`)

### 2. Install
```bash
git clone https://github.com/ImranDev3/ContentGPT.git
cd ContentGPT
cp .env.example .env       # add your MANIFEST_API_KEY
npm run install:all        # installs root + backend + frontend
```

### 3. Run
```bash
npm run dev
```
- Frontend: http://localhost:3000
- Backend:  http://localhost:8787

## Configuration

All configuration lives in `.env` (gitignored). See `.env.example` for the full list.

| Var | Default | Purpose |
| --- | --- | --- |
| `MANIFEST_BASE_URL` | `https://app.manifest.build/v1` | OpenAI-compatible endpoint |
| `MANIFEST_API_KEY` | _(required)_ | Your Manifest key |
| `MANIFEST_MODEL` | `auto` | Model id; `auto` lets the provider pick |
| `PORT` | `8787` | Backend HTTP port |

## Copyright-free mode

Click the **shield** toggle in the topbar to enable. When on, the backend:
1. Injects a system prompt that instructs the model to produce original wording and cite public-domain sources
2. Pre-fetches 1–3 Wikipedia REST API summaries for entities in your prompt and includes them as context
3. The model is asked to append `[Source: en.wikipedia.org/wiki/Title]` markers when it draws on that context

Wikipedia calls fail silently — copyright-free mode degrades to prompt-only if the API is unreachable.

## Development

```bash
# Run both services
npm run dev

# Run only the backend
npm run dev:backend

# Run only the frontend
npm run dev:frontend

# Build for production
npm run build
```

## Deployment

- **Frontend** → [Vercel](https://vercel.com) (Next.js native)
- **Backend** → any Node host ([Render](https://render.com), [Railway](https://railway.app), [Fly.io](https://fly.io))

Set `MANIFEST_API_KEY` in your host's environment. Update the rewrite destination in `frontend/next.config.mjs` to your backend's production URL.

## Tech stack

- **Frontend**: Next.js 14 · TypeScript · Tailwind v4 · shadcn/ui · Vercel AI SDK · zustand · react-markdown · lucide-react
- **Backend**: Hono · @hono/node-server · Vercel AI SDK (`@ai-sdk/openai-compatible`) · zod · Wikipedia REST

## License

MIT — see [LICENSE](LICENSE).
