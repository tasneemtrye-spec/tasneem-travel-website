// Public Google OAuth callback. Deploy with verify_jwt=false.
// It validates a short-lived HMAC-signed state, exchanges the one-time code,
// verifies the authorized Google account, and displays the refresh token once.
// Never log authorization codes, access tokens, refresh tokens, or client secrets.

const ADMIN_EMAIL = "tasneemtrye@gmail.com";
const REDIRECT_URI =
  "https://kbllhakivjduwanefvtf.supabase.co/functions/v1/gmail-oauth-callback";

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function htmlPage(title: string, body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body><main><h1>${title}</h1>${body}</main></body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "Pragma": "no-cache",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      },
    },
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] ?? char);
}

async function verifyState(state: string, secret: string): Promise<boolean> {
  const parts = state.split(".");
  if (parts.length !== 2) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(parts[1]),
      new TextEncoder().encode(parts[0]),
    );
    if (!valid) return false;

    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
    const now = Math.floor(Date.now() / 1000);
    return payload.aud === "tasneem-gmail-oauth" &&
      Number.isInteger(payload.iat) &&
      Number.isInteger(payload.exp) &&
      payload.iat <= now + 30 &&
      payload.exp > now &&
      payload.exp - payload.iat <= 600 &&
      typeof payload.nonce === "string" &&
      payload.nonce.length >= 20;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") {
    return htmlPage("Invalid request", "<p>Only the Google redirect is accepted.</p>", 405);
  }

  const params = new URL(req.url).searchParams;
  const googleError = params.get("error");
  if (googleError) {
    return htmlPage("Google authorization cancelled", "<p>No Gmail token was created. You may close this page.</p>", 400);
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) {
    return htmlPage("Invalid OAuth response", "<p>The authorization code or state is missing.</p>", 400);
  }

  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
  const stateSecret = Deno.env.get("GOOGLE_OAUTH_STATE_SECRET");
  if (!clientId || !clientSecret || !stateSecret || stateSecret.length < 32) {
    return htmlPage("Server configuration incomplete", "<p>OAuth server settings are not complete. No token was stored.</p>", 503);
  }

  if (!await verifyState(state, stateSecret)) {
    return htmlPage("Invalid or expired authorization", "<p>The security state is invalid or expired. Restart the authorization flow from the admin panel.</p>", 400);
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    return htmlPage("Google token exchange failed", "<p>Google did not issue tokens. Check the OAuth client and exact redirect URI, then retry.</p>", 502);
  }

  const tokens = await tokenResponse.json();
  if (typeof tokens.access_token !== "string" || typeof tokens.refresh_token !== "string" || typeof tokens.scope !== "string" || !tokens.scope.split(" ").includes("https://www.googleapis.com/auth/gmail.send")) {
    return htmlPage("Refresh token not returned", "<p>Google did not return an offline refresh token or the required Gmail send permission. Revoke the previous grant if needed, then restart with consent.</p>", 502);
  }

  const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userInfoResponse.ok) {
    return htmlPage("Google account verification failed", "<p>The Google account could not be verified. No token was displayed.</p>", 502);
  }
  const userInfo = await userInfoResponse.json();
  if (userInfo.email !== ADMIN_EMAIL || userInfo.email_verified !== true) {
    return htmlPage("Wrong Google account", "<p>Authorize only with the approved administration account. No token was displayed.</p>", 403);
  }

  const token = escapeHtml(tokens.refresh_token);
  return htmlPage(
    "Gmail authorization complete",
    `<p>Authorized account: <strong>${ADMIN_EMAIL}</strong></p><p>Copy this refresh token now and add it to Supabase Edge Function Secrets as <code>GOOGLE_OAUTH_REFRESH_TOKEN</code>. This page is not stored by the function. Do not send the token in chat or email.</p><textarea readonly rows="5" cols="80">${token}</textarea><p>After saving it as a Supabase secret, close this page. The token is shown only in this response.</p>`,
  );
});
