import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  const [coursesRes, sectionsRes] = await Promise.all([
    admin.from("courses").select("id, name, name_key").order("name"),
    admin.from("sections").select("id, name, code, course_id").order("name")
  ]);

  if (coursesRes.error) return NextResponse.json({ error: coursesRes.error.message }, { status: 500 });
  if (sectionsRes.error) return NextResponse.json({ error: sectionsRes.error.message }, { status: 500 });

  return NextResponse.json({
    courses: coursesRes.data || [],
    sections: sectionsRes.data || []
  });
}
