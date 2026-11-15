# Gmail OAuth setup — draft only

## Scope and safety

This implementation is a review-branch draft. It has **not** been deployed to Supabase, and no live project settings or secrets have been changed.

It uses the narrow Gmail scope `https://www.googleapis.com/auth/gmail.send`, plus `openid email` to verify that the authorizing account is `tasneemtrye@gmail.com`.

## Exact Google redirect URI

Register this exact URI under **Authorized redirect URIs** for the Google OAuth Web application client:

```
https://kbllhakivjduwanefvtf.supabase.co/functions/v1/gmail-oauth-callback
```

Do not add a JavaScript origin. The callback is a server-side Edge Function.

## Edge Functions and verification modes

- `gmail-oauth-start`: deploy with JWT verification **enabled**. It accepts POST only, requires the Supabase admin JWT email claim to equal `tasneemtrye@gmail.com`, and only allows the existing Cloudflare preview origin.
- `gmail-oauth-callback`: deploy with JWT verification **disabled**, because Google's redirect does not carry a Supabase JWT. The handler validates a short-lived HMAC-signed state before exchanging Google's one-time authorization code.
- Both functions must be deployed only after reviewing this draft and explicitly approving deployment.

## Required Supabase Edge Function secrets

Set these only after deployment is approved:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_STATE_SECRET` — random secret with at least 32 characters
- `GOOGLE_OAUTH_REFRESH_TOKEN` — obtained from the callback, stored only as a Supabase secret

The callback verifies the Google account through OpenID Connect and only displays a refresh token when the verified email is exactly `tasneemtrye@gmail.com`. It does not log tokens or persist them in a database. The response uses no-store/no-cache headers and a restrictive Content Security Policy.

## Important Google Testing limitation

The consent screen is currently **External / Testing**. Google documents that refresh tokens for External apps in Testing expire after **7 days** when the app requests Gmail scopes such as `gmail.send`. This is unsuitable as a permanent production notification credential.

Google also classifies `gmail.send` as a **sensitive scope**. Verification requirements and possible exceptions depend on the actual use case. Do not publish the app or assume production authorization is permanent until the owner has reviewed Google's current verification requirements.

Official references:

- https://developers.google.com/identity/protocols/oauth2
- https://developers.google.com/workspace/gmail/api/auth/web-server
- https://developers.google.com/workspace/gmail/api/auth/scopes
- https://developers.google.com/identity/protocols/oauth2/production-readiness/overview

## Deployment status (2026-11-15)\n\n- Both functions have now been deployed to Supabase project `kbllhakivjduwanefvtf`. `gmail-oauth-start` is ACTIVE with `verify_jwt=true`; `gmail-oauth-callback` is ACTIVE with `verify_jwt=false`.\n- Their deployed source was read back and matched the reviewed source. No live HTTP end-to-end test was performed.\n- Google client secrets and the HMAC state secret have not yet been added to Supabase. Add them manually in Edge Function Secrets; never send them in chat.\n- No Google authorization has been completed and no email has been sent.\n\n## Not yet implemented

- No admin-panel button invokes `gmail-oauth-start` yet.
- No sender function uses `GOOGLE_OAUTH_REFRESH_TOKEN` yet.
- No Google OAuth client has been created or its secret saved.
- No live HTTP end-to-end OAuth test has been performed.
- No email has been sent.
