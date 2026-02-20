# edge/AGENTS.md

## Overview

Beacon Spear Lite — Cloudflare Worker that evaluates forwarding rules locally and dispatches to Bark/ntfy via HTTP. Configured entirely via KV (`EDGE_CONFIG` binding). No backend round-trip.

## Commands

```bash
npm install        # install wrangler
npm run dev        # local dev (wrangler dev)
npm test           # native Node.js test runner
npm run lint       # node --check on source files
npm run deploy     # wrangler deploy
```

## Architecture

```
src/
├── cloudflare-worker.mjs  # Entry point, delegates to handleLiteRequest
├── lite.mjs               # Request handler (auth, validation, rule eval, dispatch)
├── rules.mjs              # Rule filter matching (field match, regex, keyword)
├── template.mjs           # Notification template rendering (Mustache-style)
├── providers.mjs          # Bark + ntfy HTTP dispatch
└── lite.test.mjs          # Tests (node --test)
```

## Request Flow

```
POST /api/ingest/{endpoint_id} → auth (token_hash from KV) → rule eval → template render → HTTP dispatch
GET /healthz → {"ok": true, "mode": "lite"}
```

## Configuration

All runtime config in Cloudflare KV (key: `"config"`). Backend exports config via `GET /api/edge-config`. Push to KV with `wrangler kv key put`.

See `edge/README.md` for config shape and deployment steps.

## Conventions

- Pure ESM (`"type": "module"`)
- No external runtime deps (wrangler is devDep only)
- Native Node.js test runner (no Jest/Vitest)
- Linting via `node --check` (syntax validation only)

## Limitations

- HTTP providers only (Bark, ntfy). No MQTT (no TCP sockets in Workers)
- Best-effort delivery. No durable retries or message persistence
- User-supplied regex in filters could cause ReDoS — keep patterns simple
