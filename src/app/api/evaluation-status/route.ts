import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export async function GET(req: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  const { data, error } = await admin.from("evaluation_status").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  return NextResponse.json({ statuses: data || [] });
}

export async function POST(req: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
  
  const body = await req.json();
  const { idnumber, enabled } = body;
  if (!idnumber) return NextResponse.json({ error: "idnumber required" }, { status: 400 });

  // Upsert
  const { data, error } = await admin
    .from("evaluation_status")
    .upsert({ idnumber, enabled, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: data });
}
