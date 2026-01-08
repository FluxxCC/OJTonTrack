import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseClient";
import webPush from "web-push";

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
    const body = await req.json().catch(() => ({}));
    const idnumber = String(body?.idnumber || "").trim();
    const message = String(body?.message || "").trim();
    const origin = String(body?.origin || "").trim();
    
    console.log(`[Send-Attendance] Request for ID: '${idnumber}', Message: '${message}'`);

    if (!idnumber || !message) {
      return NextResponse.json({ error: "idnumber and message are required" }, { status: 400 });
    }

    const pub = process.env.VAPID_PUBLIC_KEY || "";
    const priv = process.env.VAPID_PRIVATE_KEY || "";
    if (!pub || !priv) {
      console.warn("[Send-Attendance] VAPID keys missing");
      return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
    }

    const { data, error } = await admin
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth")
      .eq("idnumber", idnumber);
    
    if (error) {
        console.error(`[Send-Attendance] DB Error:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    const subs = Array.isArray(data) ? data : [];
    console.log(`[Send-Attendance] Found ${subs.length} subscriptions for ${idnumber}`);

    if (subs.length === 0) return NextResponse.json({ ok: true, sent: 0 });

    webPush.setVapidDetails(
      "mailto:admin@ojtontrack.local",
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
            const appUrl = origin || (process.env.NEXT_PUBLIC_APP_URL || "");
            const url = appUrl ? `${appUrl.replace(/\/$/, "")}/portal/supervisor?tab=attendance` : "/portal/supervisor?tab=attendance";
            const payload = JSON.stringify({
              title: "Attendance Update",
              body: message,
              icon: "/icons-192.png",
              tag: `attendance-update-${idnumber}-${Date.now()}`,
              url
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
