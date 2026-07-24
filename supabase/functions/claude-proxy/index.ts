// Claude relay for the ISPS Checklist Reviewer.
// Holds the Anthropic API key server-side so the public dashboard never sees it.
//
// Deploy:   supabase functions deploy claude-proxy --no-verify-jwt
// Secrets:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// Optional: supabase secrets set ALLOWED_ORIGIN=https://elshall44-netizen.github.io
//
// Then set CLAUDE_PROXY_URL in index.html to
//   https://<project-ref>.supabase.co/functions/v1/claude-proxy

const ALLOWED_MODELS = new Set(["claude-opus-4-8", "claude-sonnet-5"]);

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "";
  const cors = {
    "Access-Control-Allow-Origin": allowedOrigin || "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: { message: "POST only" } }), {
      status: 405, headers: { ...cors, "content-type": "application/json" },
    });
  }
  // soft origin gate: browsers send Origin; if one is configured, require it to match
  if (allowedOrigin && origin && origin !== allowedOrigin) {
    return new Response(JSON.stringify({ error: { message: "origin not allowed" } }), {
      status: 403, headers: { ...cors, "content-type": "application/json" },
    });
  }

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) {
    return new Response(JSON.stringify({ error: { message: "relay not configured: ANTHROPIC_API_KEY secret missing" } }), {
      status: 500, headers: { ...cors, "content-type": "application/json" },
    });
  }

  let payload: Record<string, unknown>;
  try { payload = await req.json(); }
  catch { return new Response(JSON.stringify({ error: { message: "invalid JSON" } }), {
    status: 400, headers: { ...cors, "content-type": "application/json" } }); }

  if (!ALLOWED_MODELS.has(String(payload.model))) {
    return new Response(JSON.stringify({ error: { message: "model not allowed" } }), {
      status: 400, headers: { ...cors, "content-type": "application/json" },
    });
  }

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  });

  // pass the (possibly streaming SSE) body straight through
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      ...cors,
      "content-type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
});
