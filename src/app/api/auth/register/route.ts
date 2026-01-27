import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

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

    // Get course and section names first (needed for both new insert and reuse update)
    const { data: courseData } = await admin.from("courses").select("name").eq("id", courseId).single();
    const { data: sectionData } = await admin.from("sections").select("name").eq("id", sectionId).single();

    const courseName = courseData?.name || "";
    const sectionName = sectionData?.name || "";

    // Check if user exists
    const { data: existing } = await admin
      .from("users")
      .select("id, signup_status")
      .or(`idnumber.eq.${idnumber},email.eq.${email}`)
      .single();

    if (existing) {
      // Logic for existing users
      if (existing.signup_status === 'APPROVED') {
        return NextResponse.json({ error: "Account already exists and is approved." }, { status: 409 });
      } else if (existing.signup_status === 'PENDING') {
        return NextResponse.json({ error: "Account application is still under review." }, { status: 409 });
      } else if (existing.signup_status === 'REJECTED') {
        // Reuse rejected account
        const { error: updateError } = await admin.from("users").update({
          signup_status: 'PENDING',
          // rejection_reason: null, // Column removed/not in schema
          // rejected_at: null,      // Column removed/not in schema
          password: password,
          firstname: firstname,
          lastname: lastname,
          course: courseName,
          section: sectionName,
          updated_at: new Date().toISOString()
        }).eq('id', existing.id);

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // Reset relations
        await admin.from("user_courses").delete().eq('user_id', existing.id);
        await admin.from("user_sections").delete().eq('user_id', existing.id);

        if (courseId) {
          await admin.from("user_courses").insert({ user_id: existing.id, course_id: courseId });
        }
        if (sectionId) {
          await admin.from("user_sections").insert({ user_id: existing.id, section_id: sectionId });
        }

        return NextResponse.json({ success: true, message: "Application resubmitted successfully.", user: { id: existing.id, idnumber } });
      } else {
        // Default fall-through for unknown status (treat as exists)
        return NextResponse.json({ error: "User with this ID number or Email already exists" }, { status: 409 });
      }
    }

    // Insert new user
    // forcing role='student' and signup_status='PENDING'
    const { data: user, error } = await admin.from("users").insert({
      idnumber,
      email,
      password, 
      role: 'student',
      firstname,
      lastname,
      course: courseName,
      section: sectionName,
      signup_status: 'PENDING'
    }).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Create relations
    if (user && courseId) {
      await admin.from("user_courses").insert({ user_id: user.id, course_id: courseId });
    }
    if (user && sectionId) {
      await admin.from("user_sections").insert({ user_id: user.id, section_id: sectionId });
    }

    return NextResponse.json({ success: true, user: { id: user.id, idnumber: user.idnumber } });

  } catch (e) {
    console.error("Registration error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
