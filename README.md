# edge — Beacon Spear Lite (Edge)

Cloudflare Worker that runs Beacon Spear in lite mode: local rule evaluation, template rendering, and HTTP dispatch to Bark/ntfy — all configured via Cloudflare KV.

Target: Cloudflare Workers (free tier compatible).

## How It Works

1. Receives `POST /api/ingest/{endpoint_id}` with a JSON body.
2. Authenticates the request using a `token_hash` from KV config.
3. Evaluates forwarding rules locally (field matching, regex, keyword filters).
4. Renders notification templates and dispatches to Bark or ntfy via HTTP.

No backend round-trip required. Best-effort delivery, no durable retries or message history.

Supported paths:

- `POST /api/ingest/{endpoint_id}` — ingest + rule evaluation + dispatch
- `GET /healthz` — health check (returns `{"ok": true, "mode": "lite"}`)

## Configuration

All configuration is stored in a Cloudflare KV namespace bound as `EDGE_CONFIG`.

The backend exports config via `GET /api/edge-config` (authenticated). Push the JSON blob to KV under the key `"config"`.

Config shape (stored in KV):

```json
{
  "endpoints": {
    "<endpoint_id>": {
      "token_hash": "<sha256 hex of ingest token>",
      "rules": [
        {
          "channel_type": "bark",
          "channel_config": { "base_url": "https://bark.example.com", "device_key": "..." },
          "filters": {
            "endpoint_ids": ["<endpoint_id>"],
            "body.contains": "keyword",
            "body.regex": "pattern"
          },
          "payload_template": {
            "title": "{{title}}",
            "body": "{{body}}",
            "group": "{{group}}"
          }
        }
      ]
    }
  }
}
```

## Deployment

1. Create a KV namespace:

```bash
npx wrangler kv namespace create EDGE_CONFIG
```

2. Update `wrangler.toml` with the namespace ID.

3. Push config to KV:

```bash
npx wrangler kv key put --namespace-id=<ns_id> config '<json blob>'
```

4. Deploy:

```bash
npm run deploy
```

## Local Dev

```bash
npm install
npm run dev
```

For local dev with KV, use `wrangler dev --local` and populate a local KV namespace.

## Tests

```bash
npm test
```

## Limitations

- HTTP providers only (Bark, ntfy). MQTT is not supported (no TCP sockets in Workers).
- Best-effort delivery. No durable retries or message persistence.
- User-supplied regex in rule filters could cause ReDoS; keep patterns simple.
