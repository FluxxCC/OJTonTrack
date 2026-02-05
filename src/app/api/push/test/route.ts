import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
const webPush: any = require("web-push");

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ success: false, error: "Supabase admin not configured" }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    let idnumber = String(body?.idnumber || "").trim();
    let message = String(body?.message || "").trim() || "This is a test notification";
    let role = String(body?.role || "").trim() || "student";

    if (!idnumber) {
      try {
        const cookieHeader = (req as any).headers?.get?.("cookie") || "";
        const match = cookieHeader.match(/(^|;)\s*ojt_session=([^;]+)/);
        if (match) {
          const obj = JSON.parse(decodeURIComponent(match[2]));
          if (obj?.idnumber) {
            idnumber = String(obj.idnumber).trim();
          }
          if (obj?.role) {
            role = String(obj.role).trim();
          }
        }
      } catch {}
    }

    if (!idnumber) {
      return NextResponse.json({ success: false, error: "idnumber is required (provide in body or ensure ojt_session cookie is set)" }, { status: 400 });
    }

    const pub = process.env.VAPID_PUBLIC_KEY || "";
    const priv = process.env.VAPID_PRIVATE_KEY || "";

    const envInfo = {
      has_public: !!pub,
      has_private: !!priv
    };

    if (!pub || !priv) {
      return NextResponse.json({ success: false, error: "VAPID keys not configured", env: envInfo }, { status: 500 });
    }

    const { data, error } = await admin
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth,idnumber,role")
      .eq("idnumber", idnumber);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const subs = Array.isArray(data) ? data : [];
    const subsFound = subs.length;

    if (subsFound === 0) {
      return NextResponse.json({ success: false, subs_found: 0, error: "No subscriptions found for this account" }, { status: 404 });
    }

    webPush.setVapidDetails(
      "mailto:onboarding@ojtontrak.online",
      pub,
      priv
    );

    const attempts: Array<{ endpoint: string; status: "ok" | "failed"; code?: number; error?: string }> = [];
    let sent = 0;

    for (const s of subs) {
      const subscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      };
      try {
        const payload = JSON.stringify({
          title: "Test Notification",
          body: message,
          icon: "/icons-192.png",
          tag: `test-${idnumber}-${Date.now()}`,
          url: role === "supervisor" ? "/portal/supervisor" : "/portal/student"
        });
        await webPush.sendNotification(subscription as any, payload);
        sent += 1;
        attempts.push({ endpoint: s.endpoint, status: "ok" });
      } catch (err: any) {
        const statusCode = err?.statusCode || err?.code;
        attempts.push({ endpoint: s.endpoint, status: "failed", code: statusCode, error: err?.message });
        if (statusCode === 410 || statusCode === 404) {
          try { await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint); } catch {}
        }
      }
    }

    return NextResponse.json({
      success: sent > 0,
      sent,
      subs_found: subsFound,
      push_attempts: attempts
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || "Unexpected error" }, { status: 500 });
  }
}
