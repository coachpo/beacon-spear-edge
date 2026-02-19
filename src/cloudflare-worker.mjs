import { handleEdgeRequest } from "./core.mjs";
import { handleLiteRequest } from "./lite.mjs";

export default {
  async fetch(request, env) {
    if (env.EDGE_CONFIG) {
      return handleLiteRequest(request, env);
    }
    return handleEdgeRequest(request, env);
  },
};
