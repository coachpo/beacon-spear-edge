import { handleEdgeRequest } from "./core.mjs";

export default {
  async fetch(request, env) {
    return handleEdgeRequest(request, env);
  },
};
