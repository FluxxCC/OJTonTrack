import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export async function GET(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") || 50);

    const { data, error } = await admin
      .from("system_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
       // Check for missing table error
       if (error.message.includes("does not exist") || error.message.includes("schema cache")) {
         return NextResponse.json({ 
           error: "Table 'system_audit_logs' not found. Please verify the database schema." 
         }, { status: 404 });
       }
       return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ logs: data || [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
