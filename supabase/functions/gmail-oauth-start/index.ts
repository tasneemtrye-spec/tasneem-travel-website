// Gmail OAuth authorization URL generator.
// Deploy with verify_jwt=true. This function only issues a short-lived signed state
// and never returns or stores Google tokens.

const ADMIN_EMAIL = "tasneemtrye@gmail.com";
const REDIRECT_URI =
  "https://kbllhakivjduwanefvtf.supabase.co/functions/v1/gmail-oauth-callback";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://tasneem-travel-preview.pages.dev",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function signState(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405, headers: corsHeaders });
  }

  const origin = req.headers.get("origin");
  if (origin !== "https://tasneem-travel-preview.pages.dev") {
    return Response.json({ error: "origin_not_allowed" }, { status: 403, headers: corsHeaders });
  }

  const authorization = req.headers.get("authorization") ?? "";
  const jwt = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const claims = decodeJwtPayload(jwt);
  const now = Math.floor(Date.now() / 1000);
  if (
    !claims ||
    claims.email !== ADMIN_EMAIL ||
    claims.role !== "authenticated" ||
    typeof claims.exp !== "number" ||
    claims.exp <= now
  ) {
    return Response.json({ error: "admin_authentication_required" }, { status: 401, headers: corsHeaders });
  }

  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const stateSecret = Deno.env.get("GOOGLE_OAUTH_STATE_SECRET");
  if (!clientId || !stateSecret || stateSecret.length < 32) {
    return Response.json({ error: "oauth_configuration_incomplete" }, { status: 503, headers: corsHeaders });
  }

  const statePayload = base64UrlEncode(JSON.stringify({
    aud: "tasneem-gmail-oauth",
    iat: now,
    exp: now + 600,
    nonce: crypto.randomUUID(),
  }));
  const signature = await signState(statePayload, stateSecret);
  const state = statePayload + "." + signature;

  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  }).toString();

  return Response.json(
    { authorization_url: url.toString(), expires_in_seconds: 600 },
    { headers: { ...corsHeaders, "Cache-Control": "no-store" } },
  );
});
