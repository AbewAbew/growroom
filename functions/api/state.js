// Cloudflare Pages Function backing GET/PUT /api/state with KV storage —
// the cloud twin of serve.js's API, so the same frontend works locally
// (Node + growdata.json) and deployed (Pages + KV) with zero changes.
//
// Setup on the Pages project (see DEPLOY.md):
//   - KV namespace bound as GROW_KV
//   - optional GROW_KEY secret: when set, requests must carry the same value
//     in the x-grow-key header; the app prompts for it once and remembers it.
const STATE_KEY = "state";
const PREV_KEY = "state-prev"; // one-step undo, like growdata.prev.json locally
const MAX_BYTES = 20 * 1024 * 1024; // stay under KV's 25 MiB value cap

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function authorized(request, env) {
  return !env.GROW_KEY || request.headers.get("x-grow-key") === env.GROW_KEY;
}

export async function onRequestGet({ request, env }) {
  if (!env.GROW_KV) return json(500, { error: "KV binding GROW_KV is not configured" });
  if (!authorized(request, env)) return json(401, { error: "missing or wrong sync passphrase" });
  const value = await env.GROW_KV.get(STATE_KEY);
  if (value === null) return json(404, { error: "no saved state yet" });
  return new Response(value, {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

export async function onRequestPut({ request, env }) {
  if (!env.GROW_KV) return json(500, { error: "KV binding GROW_KV is not configured" });
  if (!authorized(request, env)) return json(401, { error: "missing or wrong sync passphrase" });
  const body = await request.text();
  if (body.length > MAX_BYTES) return json(413, { error: "state too large" });
  try {
    JSON.parse(body);
  } catch (error) {
    return json(400, { error: "invalid JSON" });
  }
  const previous = await env.GROW_KV.get(STATE_KEY);
  if (previous !== null) await env.GROW_KV.put(PREV_KEY, previous);
  await env.GROW_KV.put(STATE_KEY, body);
  return json(200, { ok: true, bytes: body.length });
}
