import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
        return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
    }

    const body = await req.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint is required" }, { status: 400 });
    }

    const { error } = await admin
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Unsubscribe error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
