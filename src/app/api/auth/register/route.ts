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

    // Check if user exists
    const { data: existing } = await admin
      .from("users")
      .select("id")
      .or(`idnumber.eq.${idnumber},email.eq.${email}`)
      .single();

    if (existing) {
      return NextResponse.json({ error: "User with this ID number or Email already exists" }, { status: 409 });
    }

    // Get course and section names for the legacy text columns (optional but good for consistency)
    const { data: courseData } = await admin.from("courses").select("name").eq("id", courseId).single();
    const { data: sectionData } = await admin.from("sections").select("name").eq("id", sectionId).single();

    const courseName = courseData?.name || "";
    const sectionName = sectionData?.name || "";

    // Insert user
    // forcing role='student' and signup_status='PENDING'
    const { data: user, error } = await admin.from("users").insert({
      idnumber,
      email,
      password, // In a real app, hash this! But based on api/users, it seems plain text or pre-hashed? 
                // Wait, api/users takes password as is. I'll assume the system handles it or it's plain text for this prototype.
                // Checking login route, it compares directly.
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
