import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROJECT_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_KEY = "sb_publishable_upvTd4y1nomu_QsNu9GgVg_Dq4c_6pS";
const ALLOWED_ORIGINS = new Set(["https://tasneem-travel-preview.pages.dev"]);
const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const corsFor = (origin: string) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "null",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
});
function json(status: number, body: Record<string, unknown>, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(origin), "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function normalizePhone(value: string) {
  return value.replace(/[\s().-]/g, "").replace(/^00/, "+");
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsFor(origin) });
  if (!ALLOWED_ORIGINS.has(origin)) return json(403, { error: "origin_not_allowed" }, origin);
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" }, origin);
  if ((req.headers.get("apikey") ?? "") !== PUBLIC_KEY) return json(401, { error: "unauthorized" }, origin);
  if (Number(req.headers.get("content-length") ?? "0") > 3000) return json(413, { error: "payload_too_large" }, origin);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }, origin); }
  const bookingId = clean(body.booking_id, 36).toLowerCase();
  const phone = normalizePhone(clean(body.phone, 24));
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(bookingId) || phone.length < 8) {
    return json(422, { error: "invalid_lookup" }, origin);
  }
  const { data, error } = await supabase.from("booking_requests")
    .select("id, phone, status, created_at, updated_at")
    .eq("id", bookingId).maybeSingle();
  if (error) {
    console.error("booking_lookup_failed", error.message);
    return json(500, { error: "lookup_unavailable" }, origin);
  }
  if (!data || normalizePhone(data.phone) !== phone) {
    return json(404, { error: "not_found" }, origin);
  }
  return json(200, {
    success: true,
    status: data.status,
    created_at: data.created_at,
    updated_at: data.updated_at
  }, origin);
});