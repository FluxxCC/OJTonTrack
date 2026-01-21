import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
const webPush: any = require("web-push");

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
    const body = await req.json().catch(() => ({}));
    const idnumber = String(body?.idnumber || "").trim();
    const message = String(body?.message || "").trim();
    if (!idnumber || !message) {
      return NextResponse.json({ error: "idnumber and message are required" }, { status: 400 });
    }

    const pub = process.env.VAPID_PUBLIC_KEY || "";
    const priv = process.env.VAPID_PRIVATE_KEY || "";
    if (!pub || !priv) {
      return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
    }

    const { data, error } = await admin
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth")
      .eq("idnumber", idnumber);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const subs = Array.isArray(data) ? data : [];
    if (subs.length === 0) return NextResponse.json({ ok: true, sent: 0 });

    webPush.setVapidDetails(
      "mailto:onboarding@ojtontrack.site",
      pub,
      priv
    );

    let sent = 0;
    for (const s of subs) {
      const subscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      };
      try {
        const payload = JSON.stringify({
          title: "Evaluation Available",
          body: message,
          icon: "/icons-192.png",
          tag: `evaluation-available-${idnumber}-${Date.now()}`,
          url: "/portal/supervisor?tab=evaluation"
        });
        await webPush.sendNotification(subscription as any, payload);
        sent += 1;
      } catch (err: any) {
        const statusCode = err?.statusCode || err?.code;
        if (statusCode === 410 || statusCode === 404) {
          try {
            await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          } catch {}
        }
      }
    }

    return NextResponse.json({ ok: true, sent });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
