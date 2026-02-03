import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
        return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
    }

    const body = await req.json();
    const { idnumber, role, subscription } = body;

    if (!idnumber || !subscription || !subscription.endpoint) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const cleanId = String(idnumber).trim();

    // Check if subscription already exists
    const { data: existing } = await admin
      .from("push_subscriptions")
      .select("id")
      .eq("endpoint", subscription.endpoint)
      .single();

    if (existing) {
      // Update role/idnumber if changed (unlikely for same endpoint but possible)
      await admin
        .from("push_subscriptions")
        .update({
            idnumber: cleanId,
            role: String(role || "user"),
            updated_at: new Date().toISOString()
        })
        .eq("id", existing.id);
    } else {
      // Insert new
      const { error } = await admin
        .from("push_subscriptions")
        .insert({
          idnumber: cleanId,
          role: String(role || "user"),
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth
        });

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Subscribe error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
