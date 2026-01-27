import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const offset = (page - 1) * limit;

  const role = searchParams.get('role');
  const search = searchParams.get('search');
  const supervisorId = searchParams.get('supervisor_id');
  const course = searchParams.get('course');
  const section = searchParams.get('section');
  const idnumber = searchParams.get('idnumber');

  let query = admin
    .from("users")
    .select(`
      id, idnumber, role, name, firstname, middlename, lastname, course, section, company, location, supervisorid, email, email_verified, signup_status, avatar_url,
      user_courses (
        courses (id, name)
      ),
      user_sections (
        sections (id, name)
      )
    `, { count: 'exact' });

  if (role) {
    query = query.eq('role', role);
  }

  if (supervisorId) {
    query = query.eq('supervisorid', supervisorId);
  }

  if (course) {
    query = query.eq('course', course);
  }

  if (section) {
    query = query.eq('section', section);
  }

  if (idnumber) {
    query = query.eq('idnumber', idnumber);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,idnumber.ilike.%${search}%`);
  }

  const { data, error, count } = await query
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

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
      email_verified: u.email_verified,
      signup_status: u.signup_status,
      avatar_url: u.avatar_url
    };
  });

  return NextResponse.json({ 
    users,
    total: count || 0,
    page,
    limit,
    totalPages: count ? Math.ceil(count / limit) : 0
  });
}

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    const body = await req.json();
    const { 
      idnumber, email, password, role, firstname, lastname, middlename, 
      course, section, company, location, supervisorid,
      courseIds, sectionIds, signup_status 
    } = body;

    if (!idnumber || !password || !role || !firstname || !lastname) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Insert user
    const { data: user, error } = await admin.from("users").insert({
      idnumber,
      email: email || null, // Allow null if not provided, or require it if DB enforces it. Schema says NOT NULL, so we should probably require it or generate a dummy one? 
                            // Better to let it fail or require it. For now let's pass it if present.
                            // If schema is NOT NULL, we must provide it.
      password,
      role,
      firstname,
      lastname,
      middlename,
      course,
      section,
      company,
      location,
      supervisorid,
      signup_status: signup_status || 'PENDING'
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
