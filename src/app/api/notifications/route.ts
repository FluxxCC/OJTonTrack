import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export async function GET(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    const url = new URL(req.url);
    const idnumber = url.searchParams.get("idnumber");
    const recipient_id = url.searchParams.get("recipient_id");
    const recipient_role = url.searchParams.get("recipient_role");
    const limit = Number(url.searchParams.get("limit") || 20);

    if (!idnumber && !recipient_id) {
      return NextResponse.json({ error: "idnumber or recipient_id is required" }, { status: 400 });
    }

    let query = admin
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (idnumber) {
      query = query.eq("idnumber", idnumber);
    } else if (recipient_id) {
      query = query.eq("recipient_id", Number(recipient_id));
      if (recipient_role) {
        query = query.eq("recipient_role", recipient_role);
      }
    }

    const { data, error } = await query;

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
    const { id, markAllRead, idnumber, recipient_id, recipient_role } = body;

    if (markAllRead && idnumber) {
      const { error } = await admin
        .from("notifications")
        .update({ is_read: true })
        .eq("idnumber", idnumber)
        .eq("is_read", false);
        
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (markAllRead && recipient_id && recipient_role) {
      const { error } = await admin
        .from("notifications")
        .update({ is_read: true })
        .eq("recipient_id", recipient_id)
        .eq("recipient_role", recipient_role)
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
