import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
    const body = await req.json().catch(() => ({}));
    const idnumber = String(body?.idnumber || "").trim();
    const subscription = body?.subscription;
    if (!idnumber || !subscription) {
      return NextResponse.json({ error: "idnumber and subscription are required" }, { status: 400 });
    }
    const endpoint = String(subscription?.endpoint || "").trim();
    const p256dh = String(subscription?.keys?.p256dh || "");
    const auth = String(subscription?.keys?.auth || "");
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Invalid subscription keys" }, { status: 400 });
    }
    const created_at = new Date().toISOString();
    const { error } = await admin
      .from("push_subscriptions")
      .upsert({ idnumber, endpoint, p256dh, auth, created_at }, { onConflict: "endpoint" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

