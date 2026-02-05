import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { getActiveSchoolYearId } from "../../../../lib/school-year";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "System configuration error" }, { status: 500 });

    const body = await req.json();
    const { 
      idnumber, email, password, firstname, lastname, 
      courseId, sectionId 
    } = body;

    if (!idnumber || !email || !password || !firstname || !lastname || !courseId || !sectionId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const activeSyId = await getActiveSchoolYearId(admin);

    // Hash the password (kept for potential future immediate account creation)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Block if already approved
    const { data: existing } = await admin
      .from("users_students")
      .select("id, signup_status")
      .or(`idnumber.eq.${idnumber},email.eq.${email}`)
      .maybeSingle();

    if (existing) {
      if (existing.signup_status === 'APPROVED') {
        return NextResponse.json({ error: "Account already exists and is approved." }, { status: 409 });
      }
    }

    // Check latest pending request
    const { data: latestReq } = await admin
      .from("student_approval_requests")
      .select("*")
      .or(`email.eq.${String(email).toLowerCase()},school_id.eq.${idnumber}`)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestReq && latestReq.status === "pending") {
      return NextResponse.json({ error: "Application already pending review." }, { status: 409 });
    }

    const fullName = `${firstname} ${lastname}`.trim();
    const { data: reqRow, error: reqErr } = await admin
      .from("student_approval_requests")
      .insert({
        email: String(email).toLowerCase(),
        full_name: fullName,
        school_id: idnumber,
        course_id: Number(courseId),
        section_id: Number(sectionId),
        status: "pending",
      })
      .select()
      .single();

    if (reqErr) {
      return NextResponse.json({ error: reqErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Application submitted", request: { id: reqRow.id } });

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
