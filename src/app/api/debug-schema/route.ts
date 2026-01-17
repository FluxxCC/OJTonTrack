import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "No admin" }, { status: 500 });
  
  const { data, error } = await admin.from("attendance").select("*").limit(1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  return NextResponse.json({ 
    columns: data && data.length > 0 ? Object.keys(data[0]) : "No data to infer columns" 
  });
}
