import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { getActiveSchoolYearId } from "../../../lib/school-year";

export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
  }
  const sy = await getActiveSchoolYearId(admin);

  const { data, error } = await admin
    .from("instructor_approval_status")
    .select(`
      allowed,
      updated_at,
      users_instructors!inner (
        idnumber
      )
    `)
    .eq("school_year_id", sy);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const statuses = (data || []).map((item: any) => ({
    idnumber: item.users_instructors?.idnumber,
    allowed: item.allowed,
    updated_at: item.updated_at
  }));

  return NextResponse.json({ statuses });
}

export async function POST(req: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
  }
  const sy = await getActiveSchoolYearId(admin);

  const body = await req.json();
  const { idnumber, allowed } = body || {};

  if (!idnumber) {
    return NextResponse.json({ error: "idnumber required" }, { status: 400 });
  }

  // Find instructor
  const { data: instructor, error: instructorError } = await admin
    .from("users_instructors")
    .select("id")
    .eq("idnumber", idnumber)
    .single();

  if (instructorError || !instructor) {
    return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
  }

  const { data, error } = await admin
    .from("instructor_approval_status")
    .upsert({ 
      instructor_id: instructor.id, 
      allowed, 
      updated_at: new Date().toISOString(),
      school_year_id: sy
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: { ...data, idnumber } });
}
