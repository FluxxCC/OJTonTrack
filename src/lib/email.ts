import { getSupabaseAdmin } from "./supabaseClient";

export async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log("---------------------------------------------------");
    console.log(`[Mock Email] To: ${to}`);
    console.log(`[Mock Email] Subject: ${subject}`);
    console.log(`[Mock Email] HTML: ${html}`);
    console.log("---------------------------------------------------");
    return;
  }
  
  try {
    const from = process.env.SMTP_FROM || '"OJTonTrack" <onboarding@ojtontrack.site>';
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Failed to send email via Resend:", res.status, text);
      console.log("---------------------------------------------------");
      console.log(`[Mock Email (Fallback)] To: ${to}`);
      console.log(`[Mock Email (Fallback)] Subject: ${subject}`);
      console.log(`[Mock Email (Fallback)] HTML: ${html}`);
      console.log("---------------------------------------------------");
    }
  } catch (e) {
    console.error("Failed to send email via Resend:", e);
    // Fallback to log
    console.log("---------------------------------------------------");
    console.log(`[Mock Email (Fallback)] To: ${to}`);
    console.log(`[Mock Email (Fallback)] Subject: ${subject}`);
    console.log(`[Mock Email (Fallback)] HTML: ${html}`);
    console.log("---------------------------------------------------");
  }
}

export type EmailType =
  | "APPLICATION_APPROVED"
  | "APPLICATION_REJECTED"
  | "PASSWORD_CHANGED"
  | "REPORT_DEADLINE_REMINDER";

export async function sendTransactionalEmail(options: {
  to: string;
  subject: string;
  html: string;
  emailType: EmailType;
  userId?: number | null;
  triggeredBy?: string | null;
}) {
  await sendEmail(options.to, options.subject, options.html);
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return;
    await admin.from("email_logs").insert({
      user_id: options.userId ?? null,
      email_type: options.emailType,
      triggered_by: options.triggeredBy ?? null,
      sent_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Failed to log transactional email:", e);
  }
}
