import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@^9";

const PROJECT_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_KEY = "sb_publishable_upvTd4y1nomu_QsNu9GgVg_Dq4c_6pS";
const ALLOWED_ORIGINS = new Set([
  "https://tasneem-travel-preview.pages.dev"
]);
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
function clean(v: unknown, max: number) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
async function sha256(v: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, "0")).join("");
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsFor(origin) });
  }
  if (!ALLOWED_ORIGINS.has(origin)) return json(403, { error: "origin_not_allowed" }, origin);
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" }, origin);
  if ((req.headers.get("apikey") ?? "") !== PUBLIC_KEY) return json(401, { error: "unauthorized" }, origin);
  if (Number(req.headers.get("content-length") ?? "0") > 12000) return json(413, { error: "payload_too_large" }, origin);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }, origin); }
  if (clean(body["bot-field"], 200)) return json(200, { success: true }, origin);

  const full_name = clean(body.full_name, 90);
  const phone = clean(body.phone, 24);
  const email = clean(body.email, 254).toLowerCase();
  const service = clean(body.service, 80);
  const destination = clean(body.destination, 160);
  const travel_date = clean(body.travel_date, 10);
  const travellers = clean(body.travellers, 20) || "2";
  const contact_method = clean(body.contact_method, 40) || "واتساب";
  const message = clean(body.message, 1500);
  const privacy_consent = body.privacy_consent === true;
  const services = ["حجز طيران", "حجز فندق", "برنامج سياحي", "تأشيرة / خدمات سفر", "خدمة أخرى"];
  const travellerOptions = ["1", "2", "3", "4", "5", "6", "7", "8 أو أكثر"];
  const contactOptions = ["واتساب", "اتصال هاتفي", "البريد الإلكتروني"];

  if (full_name.length < 2 || phone.length < 8 || !services.includes(service) || !privacy_consent ||
      !travellerOptions.includes(travellers) || !contactOptions.includes(contact_method) ||
      (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
      (travel_date && !/^\d{4}-\d{2}-\d{2}$/.test(travel_date))) {
    return json(422, { error: "invalid_form" }, origin);
  }

  const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (turnstileSecret) {
    const token = clean(body.turnstile_token, 2048);
    if (!token) return json(400, { error: "captcha_required" }, origin);
    const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: turnstileSecret, response: token })
    });
    const verdict = await verify.json();
    if (!verdict.success) return json(400, { error: "captcha_failed" }, origin);
  }

  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = await sha256(forwarded + (Deno.env.get("RATE_LIMIT_SALT") ?? PROJECT_URL));
  const { data: allowed, error: rateError } = await supabase.rpc("consume_booking_rate_limit", { p_ip_hash: ipHash });
  if (rateError || allowed !== true) return json(429, { error: "rate_limited" }, origin);

  const { data, error } = await supabase.from("booking_requests").insert({
    full_name, phone, email: email || null, service, destination: destination || null,
    travel_date: travel_date || null, travellers, contact_method, message: message || null, privacy_consent
  }).select("id,created_at").single();
  if (error) {
    console.error("booking_insert_failed", error.message);
    return json(500, { error: "submission_failed" }, origin);
  }

  const smtpHost = Deno.env.get("SMTP_HOSTNAME") ?? "smtp.gmail.com";
  const smtpPort = Number(Deno.env.get("SMTP_PORT") ?? "465");
  const smtpUsername = Deno.env.get("SMTP_USERNAME");
  const smtpPassword = Deno.env.get("SMTP_PASSWORD");
  const smtpFrom = Deno.env.get("SMTP_FROM");
  const notifyEmail = Deno.env.get("NOTIFY_EMAIL");
  let emailSent = false;
  if (smtpUsername && smtpPassword && smtpFrom && notifyEmail && smtpPort === 465) {
    let transport: ReturnType<typeof nodemailer.createTransport> | undefined;
    try {
      transport = nodemailer.createTransport({
        host: smtpHost,
        port: 465,
        secure: true,
        auth: { user: smtpUsername, pass: smtpPassword },
      });
      const info = await transport.sendMail({
        from: smtpFrom,
        to: notifyEmail,
        subject: "طلب سفر جديد - تسنيم",
        text: [
          "وصل طلب سفر جديد إلى موقع تسنيم.",
          `رقم الطلب: ${data.id}`,
          `الاسم: ${full_name}`,
          `الهاتف: ${phone}`,
          `البريد: ${email || "غير محدد"}`,
          `الخدمة: ${service}`,
          `الوجهة: ${destination || "غير محددة"}`,
          `تاريخ السفر: ${travel_date || "غير محدد"}`,
          `المسافرون: ${travellers}`,
          `طريقة التواصل: ${contact_method}`,
          `التفاصيل: ${message || "لا توجد"}`,
        ].join("\\n"),
      });
      emailSent = Boolean(info.messageId);
    } catch (e) {
      console.error("notification_email_error", String(e));
    } finally {
      transport?.close();
    }
  } else if (smtpPort !== 465 && smtpUsername && smtpPassword) {
    console.error("notification_email_config_invalid", "SMTP_PORT must be 465");
  }
  return json(201, { success: true, booking_id: data.id, email_notification_sent: emailSent }, origin);
});