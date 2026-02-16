import { getEnvInt, getEnvStringAny, parseCommaList } from "./env.mjs";

function constantTimeEqual(a, b) {
  const aa = String(a || "");
  const bb = String(b || "");
  if (aa.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < aa.length; i++) {
    out |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
  }
  return out === 0;
}

function anyKeyMatches(provided, allowedKeys) {
  const p = String(provided || "").trim();
  if (!p) return false;
  for (const k of allowedKeys) {
    if (constantTimeEqual(p, k)) return true;
  }
  return false;
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function buildUpstreamUrl(upstreamIngestUrl, requestUrl) {
  const upstream = new URL(String(upstreamIngestUrl));
  const incoming = new URL(String(requestUrl));

  if (incoming.search) {
    const incomingParams = new URLSearchParams(incoming.search);
    for (const [k, v] of incomingParams.entries()) {
      upstream.searchParams.append(k, v);
    }
  }

  return upstream;
}

function parseIngestEndpointIdFromPath(pathname) {
  const parts = String(pathname || "").split("/").filter(Boolean);
  if (parts.length !== 3) return "";
  if (parts[0] !== "api" || parts[1] !== "ingest") return "";
  return parts[2];
}

export async function handleEdgeRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/healthz") {
    return jsonResponse({ ok: true }, 200);
  }

  const endpointId = parseIngestEndpointIdFromPath(url.pathname);
  if (!endpointId) {
    return jsonResponse({ code: "not_found", message: "not found" }, 404);
  }

  if (request.method !== "POST") {
    return jsonResponse({ code: "method_not_allowed", message: "method not allowed" }, 405);
  }

  const incomingKey = request.headers.get("X-Beacon-Ingest-Key");
  const allowedIncoming = parseCommaList(
    getEnvStringAny(env, ["EDGE_INGEST_KEYS", "EDGE-INGEST-KEYS"]),
  );
  if (allowedIncoming.length === 0) {
    return jsonResponse({ code: "misconfigured", message: "missing EDGE_INGEST_KEYS" }, 500);
  }
  if (!anyKeyMatches(incomingKey, allowedIncoming)) {
    return jsonResponse({ code: "not_authenticated", message: "unauthorized" }, 401);
  }

  const expectedEndpointId = getEnvStringAny(env, [
    "EDGE_EXPECT_ENDPOINT_ID",
    "EDGE-EXPECT-ENDPOINT-ID",
  ]).trim();
  if (expectedEndpointId && expectedEndpointId !== endpointId) {
    return jsonResponse({ code: "not_authenticated", message: "unauthorized" }, 401);
  }

  const maxHops = getEnvInt(env, "EDGE_MAX_HOPS", 5);
  const prevHop = request.headers.get("X-Beacon-Edge-Hop");
  const hop = prevHop ? parseInt(prevHop, 10) : 0;
  const hopCount = Number.isFinite(hop) ? hop + 1 : 1;
  if (hopCount > maxHops) {
    return jsonResponse({ code: "loop_detected", message: "too many hops" }, 508);
  }

  const upstreamKey = getEnvStringAny(env, ["UPSTREAM_INGEST_KEY", "UPSTREAM-INGEST-KEY"]).trim();
  if (!upstreamKey) {
    return jsonResponse({ code: "misconfigured", message: "missing UPSTREAM_INGEST_KEY" }, 500);
  }

  let upstreamIngestUrl = getEnvStringAny(env, [
    "UPSTREAM_INGEST_URL",
    "UPSTREAM-INGEST-URL",
  ]).trim();
  if (!upstreamIngestUrl) {
    const base = getEnvStringAny(env, ["UPSTREAM_BASE_URL", "UPSTREAM-BASE-URL"]).trim();
    const upstreamEndpointId = getEnvStringAny(env, [
      "UPSTREAM_ENDPOINT_ID",
      "UPSTREAM-ENDPOINT-ID",
    ]).trim();
    if (base && upstreamEndpointId) {
      upstreamIngestUrl = `${base.replace(/\/+$/, "")}/api/ingest/${upstreamEndpointId}`;
    }
  }
  if (!upstreamIngestUrl) {
    return jsonResponse({ code: "misconfigured", message: "missing UPSTREAM_INGEST_URL" }, 500);
  }

  const upstreamUrl = buildUpstreamUrl(upstreamIngestUrl, request.url);

  const contentType = request.headers.get("Content-Type");
  const userAgent = request.headers.get("User-Agent");
  const accept = request.headers.get("Accept");
  const headers = new Headers();
  if (contentType) headers.set("Content-Type", contentType);
  if (userAgent) headers.set("User-Agent", userAgent);
  if (accept) headers.set("Accept", accept);
  headers.set("X-Beacon-Ingest-Key", upstreamKey);
  headers.set("X-Beacon-Edge-Hop", String(hopCount));

  const edgeName = getEnvStringAny(env, ["EDGE_NAME", "EDGE-NAME"]).trim();
  if (edgeName) headers.set("X-Beacon-Edge-Name", edgeName);
  const eoIp = request.eo && request.eo.clientIp ? String(request.eo.clientIp) : "";
  const cfIp = request.headers.get("CF-Connecting-IP") || "";
  const ip = eoIp || cfIp;
  if (ip) headers.set("X-Beacon-Edge-Client-IP", ip);
  if (ip) headers.set("X-Forwarded-For", ip);

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
    body: request.body,
    duplex: "half",
  };

  const resp = await fetch(new Request(upstreamUrl.toString(), init));
  return resp;
}
