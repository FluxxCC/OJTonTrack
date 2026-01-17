import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export async function GET(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    const url = new URL(req.url);
    const idnumber = url.searchParams.get("idnumber");
    const limit = Number(url.searchParams.get("limit") || 20);

    if (!idnumber) {
      return NextResponse.json({ error: "idnumber is required" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("notifications")
      .select("*")
      .eq("idnumber", idnumber)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      // If table doesn't exist, return empty list instead of crashing
      if (error.code === '42P01') {
        return NextResponse.json({ notifications: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ notifications: data || [] });
  } catch (e) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    const body = await req.json();
    const { id, markAllRead, idnumber } = body;

    if (markAllRead && idnumber) {
      const { error } = await admin
        .from("notifications")
        .update({ is_read: true })
        .eq("idnumber", idnumber)
        .eq("is_read", false);
        
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (id) {
      const { error } = await admin
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);
        
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
