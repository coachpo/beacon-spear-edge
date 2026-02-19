# edge/AGENTS.md

## Project Overview

Beacon Spear Lite (Edge) — a Cloudflare Worker that evaluates forwarding rules locally and dispatches notifications to Bark/ntfy via HTTP. Configured entirely via Cloudflare KV (`EDGE_CONFIG` binding).

Target: Cloudflare Workers only.

## Local Dev

From `edge/`:

- Install tooling (once):
  - `npm install`
- Run locally:
  - `npm run dev`
- Run tests:
  - `npm test`
- Lint:
  - `npm run lint`

## Configuration

All runtime config is stored in Cloudflare KV (bound as `EDGE_CONFIG`). See `edge/README.md` for the config shape and deployment instructions.

## Architecture

- `src/cloudflare-worker.mjs` — entry point, delegates to `handleLiteRequest`
- `src/lite.mjs` — request handler (auth, validation, rule evaluation, dispatch)
- `src/rules.mjs` — rule filter matching
- `src/template.mjs` — notification template rendering
- `src/providers.mjs` — Bark + ntfy HTTP dispatch
