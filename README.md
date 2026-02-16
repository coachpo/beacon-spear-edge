# edge

Edge functions that proxy Beacon Spear ingestion.

These functions accept requests in the same shape as the backend Ingest API and forward them to a configured next hop.

Supported paths:

- `POST /api/ingest/{endpoint_id}`
- `POST /api/i/{endpoint_id}` (alias)
- `GET /healthz`

Configuration model:

- Incoming requests must include `X-Beacon-Ingest-Key` matching the edge function's configured key(s).
- Each edge function is configured with a next hop ingestion URL and the next hop `X-Beacon-Ingest-Key`.

The forwarder preserves the request path shape and forwards the raw request body as-is.
Incoming query parameters are appended to the configured upstream ingest URL.

The forwarder sets:

- `X-Beacon-Edge-Hop` (loop prevention)
- `X-Beacon-Edge-Name` (optional)
- `X-Beacon-Edge-Client-IP` (best effort)
- `X-Forwarded-For` (best effort)

This supports multi-hop routing such as:

- Request -> EdgeOne -> Cloudflare -> Ingestion
- Request -> EdgeOne -> Ingestion
- Request -> Cloudflare -> Ingestion
- Request -> Cloudflare -> EdgeOne -> Ingestion

## Cloudflare Workers

This repo includes `wrangler.toml` for Workers.

Configuration bindings:

- Incoming auth:
  - `EDGE_INGEST_KEYS` (secret, comma-separated)
  - optionally `EDGE_EXPECT_ENDPOINT_ID` (var)
- Next hop:
  - `UPSTREAM_INGEST_URL` (var, full URL to `/api/ingest/{endpoint_id}`)
  - `UPSTREAM_INGEST_KEY` (secret)
- Loop safety:
  - `EDGE_MAX_HOPS` (var, default 5)

Optional:

- `EDGE_NAME` (var): sets `X-Beacon-Edge-Name`

Example:

```bash
npx wrangler secret put EDGE_INGEST_KEYS
npx wrangler secret put UPSTREAM_INGEST_KEY
```

Local dev (no Cloudflare account needed):

```bash
npm install
npx wrangler dev --local --port 8787 \
  --var EDGE_NAME:cloudflare-local \
  --var EDGE_INGEST_KEYS:edge-local-key \
  --var EDGE_EXPECT_ENDPOINT_ID:<endpoint_id_hex> \
  --var UPSTREAM_INGEST_URL:http://127.0.0.1:8000/api/ingest/<endpoint_id_hex> \
  --var UPSTREAM_INGEST_KEY:<backend_ingest_key>

curl -X POST "http://127.0.0.1:8787/api/ingest/<endpoint_id_hex>?via=cf" \
  -H "X-Beacon-Ingest-Key: edge-local-key" \
  --data-binary "hello from workers"
```

## Tencent EdgeOne

Tencent EdgeOne uses the same handler via `src/edgeone-worker.mjs`.

EdgeOne environment variable names cannot contain `_`. Use the `-` variants instead:

- `EDGE-INGEST-KEYS`
- `EDGE-EXPECT-ENDPOINT-ID`
- `UPSTREAM-INGEST-URL`
- `UPSTREAM-INGEST-KEY`
- `EDGE-MAX-HOPS`

Multi-hop note:

- When chaining `EdgeOne -> Cloudflare -> Ingestion`, configure EdgeOne's `UPSTREAM-INGEST-URL` to point at the Cloudflare worker's `/api/ingest/{endpoint_id}`.
- EdgeOne's `UPSTREAM-INGEST-KEY` must match one of the Cloudflare worker's `EDGE_INGEST_KEYS`.
