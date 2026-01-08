import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabaseClient";

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  // Fetch users with related course/section data
  // We use the table names for the joins. 
  // user_courses -> courses
  // user_sections -> sections
  const { data, error } = await admin
    .from("users")
    .select(`
      id, idnumber, role, name, firstname, middlename, lastname, course, section, company, location, supervisorid, email, email_verified,
      user_courses (
        courses (id, name)
      ),
      user_sections (
        sections (id, name)
      )
    `)
    .order("id", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Process data to flatten course/section names
  const users = (data || []).map((u) => {
    // If direct course column is present, use it. 
    // Otherwise, join course names from user_courses.
    let course = u.course;
    const courseIds: number[] = [];
    if (u.user_courses && Array.isArray(u.user_courses)) {
      const names: string[] = [];
      u.user_courses.forEach((uc: unknown) => {
        if (uc && typeof uc === "object") {
          const maybeCourses = (uc as { courses?: unknown }).courses;
          if (Array.isArray(maybeCourses)) {
            maybeCourses.forEach((ci: unknown) => {
              if (ci && typeof ci === "object") {
                const obj = ci as { id?: unknown; name?: unknown };
                if (obj.id !== undefined) courseIds.push(Number(obj.id));
                if (typeof obj.name === "string") names.push(obj.name);
              }
            });
          } else if (maybeCourses && typeof maybeCourses === "object") {
            const cobj = maybeCourses as { id?: unknown; name?: unknown };
            if (cobj.id !== undefined) courseIds.push(Number(cobj.id));
            if (typeof cobj.name === "string") names.push(cobj.name);
          }
        }
      });
      if (names.length > 0) {
        course = names.join(", ");
      }
    }

    // Same for section
    let section = u.section;
    const sectionIds: number[] = [];
    if (u.user_sections && Array.isArray(u.user_sections)) {
      const names: string[] = [];
      u.user_sections.forEach((us: unknown) => {
        if (us && typeof us === "object") {
          const maybeSections = (us as { sections?: unknown }).sections;
          if (Array.isArray(maybeSections)) {
            maybeSections.forEach((si: unknown) => {
              if (si && typeof si === "object") {
                const obj = si as { id?: unknown; name?: unknown };
                if (obj.id !== undefined) sectionIds.push(Number(obj.id));
                if (typeof obj.name === "string") names.push(obj.name);
              }
            });
          } else if (maybeSections && typeof maybeSections === "object") {
            const sobj = maybeSections as { id?: unknown; name?: unknown };
            if (sobj.id !== undefined) sectionIds.push(Number(sobj.id));
            if (typeof sobj.name === "string") names.push(sobj.name);
          }
        }
      });
      if (names.length > 0) {
        section = names.join(", ");
      }
    }

    return {
      id: u.id,
      idnumber: u.idnumber,
      role: u.role,
      name: u.name,
      firstname: u.firstname,
      middlename: u.middlename,
      lastname: u.lastname,
      course,
      section,
      courseIds,
      sectionIds,
      company: u.company,
      location: u.location,
      supervisorid: u.supervisorid,
      email: u.email,
      email_verified: u.email_verified
    };
  });

  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    const body = await req.json();
    const { 
      idnumber, password, role, firstname, lastname, middlename, 
      course, section, company, location, supervisorid,
      courseIds, sectionIds 
    } = body;

    if (!idnumber || !password || !role || !firstname || !lastname) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Insert user
    const { data: user, error } = await admin.from("users").insert({
      idnumber,
      password,
      role,
      firstname,
      lastname,
      middlename,
      course,
      section,
      company,
      location,
      supervisorid
    }).select().single();

    if (error) {
      // Check for duplicate key error (likely idnumber)
      if (error.code === '23505') {
        return NextResponse.json({ error: "User with this ID number already exists" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Handle relations
    if (courseIds && Array.isArray(courseIds) && courseIds.length > 0) {
      const inserts = courseIds.map((cid: number) => ({ user_id: user.id, course_id: cid }));
      await admin.from("user_courses").insert(inserts);
    }

    if (sectionIds && Array.isArray(sectionIds) && sectionIds.length > 0) {
      const inserts = sectionIds.map((sid: number) => ({ user_id: user.id, section_id: sid }));
      await admin.from("user_sections").insert(inserts);
    }

    return NextResponse.json({ user });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal Error" }, { status: 500 });
  }
}
