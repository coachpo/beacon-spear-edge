import { handleEdgeRequest } from "./core.mjs";

addEventListener("fetch", (event) => {
  const runtimeEnv = globalThis.env || {};
  event.respondWith(handleEdgeRequest(event.request, runtimeEnv));
});
