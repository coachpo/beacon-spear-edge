import test from "node:test";
import assert from "node:assert/strict";

import { handleEdgeRequest } from "./core.mjs";

function makeEnv(overrides) {
  return {
    EDGE_INGEST_KEYS: "edge-in",
    UPSTREAM_INGEST_URL: "https://up.example/api/ingest/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    UPSTREAM_INGEST_KEY: "up-key",
    EDGE_NAME: "cf",
    ...overrides,
  };
}

test("rejects missing key", async () => {
  const env = makeEnv();
  const req = new Request("https://edge.example/api/ingest/abcd", { method: "POST", body: "hi" });
  const resp = await handleEdgeRequest(req, env);
  assert.equal(resp.status, 401);
});

test("forwards with replaced key and preserves query", async () => {
  const env = makeEnv({ EDGE_EXPECT_ENDPOINT_ID: "abcd" });

  const calls = [];
  globalThis.fetch = async (r) => {
    const url = new URL(r.url);
    calls.push({
      url: url.toString(),
      key: r.headers.get("X-Beacon-Ingest-Key"),
      hop: r.headers.get("X-Beacon-Edge-Hop"),
    });
    return new Response("{\"message_id\":\"x\"}", { status: 201, headers: { "Content-Type": "application/json" } });
  };

  const req = new Request("https://edge.example/api/ingest/abcd?x=1&y=2", {
    method: "POST",
    headers: { "X-Beacon-Ingest-Key": "edge-in", "Content-Type": "text/plain" },
    body: "hello",
  });
  const resp = await handleEdgeRequest(req, env);
  assert.equal(resp.status, 201);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].key, "up-key");
  assert.equal(calls[0].hop, "1");
  assert.ok(calls[0].url.includes("?"));
  assert.ok(calls[0].url.includes("x=1"));
  assert.ok(calls[0].url.includes("y=2"));
});

test("alias route forwards with same behavior", async () => {
  const env = makeEnv({ EDGE_EXPECT_ENDPOINT_ID: "abcd" });

  const calls = [];
  globalThis.fetch = async (r) => {
    const url = new URL(r.url);
    calls.push({
      url: url.toString(),
      key: r.headers.get("X-Beacon-Ingest-Key"),
      hop: r.headers.get("X-Beacon-Edge-Hop"),
    });
    return new Response("{\"message_id\":\"x\"}", {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  };

  const req = new Request("https://edge.example/api/i/abcd?x=1", {
    method: "POST",
    headers: { "X-Beacon-Ingest-Key": "edge-in", "Content-Type": "text/plain" },
    body: "hello",
  });
  const resp = await handleEdgeRequest(req, env);
  assert.equal(resp.status, 201);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].key, "up-key");
  assert.equal(calls[0].hop, "1");
  assert.ok(calls[0].url.includes("x=1"));
});

test("enforces hop limit", async () => {
  const env = makeEnv({ EDGE_MAX_HOPS: "2" });
  globalThis.fetch = async () => new Response("ok", { status: 201 });
  const req = new Request("https://edge.example/api/ingest/abcd", {
    method: "POST",
    headers: { "X-Beacon-Ingest-Key": "edge-in", "X-Beacon-Edge-Hop": "2" },
    body: "hello",
  });
  const resp = await handleEdgeRequest(req, env);
  assert.equal(resp.status, 508);
});
