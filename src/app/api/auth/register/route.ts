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

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if user exists in students table
    const { data: existing } = await admin
      .from("users_students")
      .select("id, signup_status")
      .or(`idnumber.eq.${idnumber},email.eq.${email}`)
      .maybeSingle();

    if (existing) {
      if (existing.signup_status === 'APPROVED') {
        return NextResponse.json({ error: "Account already exists and is approved." }, { status: 409 });
      } else if (existing.signup_status === 'PENDING') {
        return NextResponse.json({ error: "Account application is still under review." }, { status: 409 });
      } else if (existing.signup_status === 'REJECTED') {
        // Reuse rejected account
        const { error: updateError } = await admin.from("users_students").update({
          signup_status: 'PENDING',
          password: hashedPassword,
          firstname: firstname,
          lastname: lastname,
          course_id: courseId,
          section_id: sectionId,
          school_year_id: activeSyId,
          updated_at: new Date().toISOString()
        }).eq('id', existing.id);

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Application resubmitted successfully.", user: { id: existing.id, idnumber } });
      } else {
        return NextResponse.json({ error: "User with this ID number or Email already exists" }, { status: 409 });
      }
    }

    // Insert new student
    const { data: user, error } = await admin.from("users_students").insert({
      idnumber,
      email,
      password: hashedPassword, 
      role: 'student',
      firstname,
      lastname,
      course_id: courseId,
      section_id: sectionId,
      signup_status: 'PENDING',
      school_year_id: activeSyId
    }).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Registration successful", user: { id: user.id, idnumber: user.idnumber } });

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
