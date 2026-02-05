import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import bcrypt from "bcryptjs";
import { getActiveSchoolYearId } from "@/lib/school-year";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const { 
        role, idnumber, email, password, firstname, lastname, middlename,
        course, section, company, location, supervisorid,
        courseIds, sectionIds
    } = body;

    if (!role || !idnumber || !email || !password || !firstname || !lastname) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let tableName = "";
    if (role === 'student') tableName = "users_students";
    else if (role === 'coordinator') tableName = "users_coordinators";
    else if (role === 'supervisor') tableName = "users_supervisors";
    else if (role === 'instructor') tableName = "users_instructors";
    else if (role === 'admin' || role === 'superadmin') tableName = "users_super_admins";
    else return NextResponse.json({ error: "Invalid role" }, { status: 400 });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser: any = {
        idnumber,
        email,
        password: hashedPassword,
        firstname,
        lastname,
        middlename,
        role: role === 'admin' ? 'superadmin' : role, // Normalize admin -> superadmin
    };

    // Add role-specific fields
    const activeSyId = await getActiveSchoolYearId(admin);
    if (tableName !== 'users_super_admins') {
       newUser.school_year_id = activeSyId;
    }

    if (tableName === 'users_students') {
        // Prefer courseIds/sectionIds from array if available, as they contain the numeric IDs
        let finalCourseId = (courseIds && Array.isArray(courseIds) && courseIds.length > 0) ? Number(courseIds[0]) : null;
        if (Number.isNaN(finalCourseId)) finalCourseId = null;

        // Fallback to 'course' only if it's a valid number (legacy support)
        if (!finalCourseId && course && !isNaN(Number(course))) {
             finalCourseId = Number(course);
        }

        let finalSectionId = (sectionIds && Array.isArray(sectionIds) && sectionIds.length > 0) ? Number(sectionIds[0]) : null;
        if (Number.isNaN(finalSectionId)) finalSectionId = null;

        // Fallback to 'section' only if it's a valid number (legacy support)
        if (!finalSectionId && section && !isNaN(Number(section))) {
             finalSectionId = Number(section);
        }
        
        if (!finalCourseId) {
             return NextResponse.json({ error: "Course is required. Please select a valid section." }, { status: 400 });
        }
        if (!finalSectionId) {
             return NextResponse.json({ error: "Section is required. Please select a valid section." }, { status: 400 });
        }
        
        newUser.course_id = finalCourseId;
        newUser.section_id = finalSectionId;
        newUser.supervisor_id = supervisorid || null; // Expecting ID, convert empty string to null
        newUser.signup_status = 'APPROVED'; // Admin created users are approved
    } else if (tableName === 'users_instructors') {
        // Only assign course_id if it's a valid number
        let instrCourseId = course && !isNaN(Number(course)) ? Number(course) : null;
        // Check courseIds array too
        if (!instrCourseId && courseIds && Array.isArray(courseIds) && courseIds.length > 0) {
             instrCourseId = Number(courseIds[0]);
        }
        if (instrCourseId && !isNaN(instrCourseId)) {
             newUser.course_id = instrCourseId;
        }
        newUser.signup_status = 'APPROVED';
    } else if (tableName === 'users_supervisors') {
        newUser.company = company;
        newUser.location = location;
        newUser.signup_status = 'APPROVED';
    } else if (tableName === 'users_coordinators') {
        newUser.signup_status = 'APPROVED';
    }

    const { data, error } = await admin.from(tableName).insert(newUser).select().single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Handle courseIds/sectionIds for non-student roles (e.g. coordinators)
    if (tableName !== 'users_students') {
        const { courseIds, sectionIds } = body;
        
        if (tableName === 'users_coordinators' && courseIds && Array.isArray(courseIds) && courseIds.length > 0) {
             const inserts = courseIds.map((cid: number) => ({ coordinator_id: data.id, course_id: cid }));
             await admin.from("coordinator_courses").insert(inserts);
        } else if (tableName === 'users_instructors' && sectionIds && Array.isArray(sectionIds) && sectionIds.length > 0) {
             const inserts = sectionIds.map((sid: number) => ({ instructor_id: data.id, section_id: sid }));
             await admin.from("instructor_sections").insert(inserts);
        }
        
        // Existing logic for other roles or sections if needed (skipped for now as sections usually follow courses)
        // Note: user_sections table also doesn't exist, so we skip section saving for now unless we implement JSON storage for it too.
        // For now, focus on courses.
    }

    return NextResponse.json({ success: true, user: data });

  } catch (e: any) {
      console.error("Error creating user:", e);
      return NextResponse.json({ error: e.message || "An error occurred" }, { status: 500 });
  }
}

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
  const approvedOnly = searchParams.get('approvedOnly') === 'true';

  let tableName = "users_students"; 
  if (role) {
    if (role === 'student') tableName = "users_students";
    else if (role === 'coordinator') tableName = "users_coordinators";
    else if (role === 'supervisor') tableName = "users_supervisors";
    else if (role === 'instructor') tableName = "users_instructors";
    else if (role === 'admin' || role === 'superadmin') tableName = "users_super_admins";
  }

  // Construct Query
  let selectQuery = "*";
  
  if (tableName === "users_students") {
    selectQuery = `
      *,
      courses:course_id (name, required_ojt_hours),
      sections:section_id (name),
      users_supervisors:supervisor_id (idnumber, firstname, lastname, company, location)
    `;
  } else if (tableName === "users_instructors") {
     selectQuery = `
      *,
      courses:course_id (name),
      instructor_sections (
        section_id,
        sections (name)
      )
    `;
  } else if (tableName === "users_coordinators") {
      selectQuery = `
      *,
      coordinator_courses (
        course_id,
        courses (name)
      )
      `;
  }

  let query = admin.from(tableName).select(selectQuery, { count: 'exact' });

  // Filter by Active School Year for students only (Staff accounts persist across years)
  if (tableName === 'users_students') {
      const activeSyId = await getActiveSchoolYearId(admin);
      if (activeSyId) {
          query = query.eq('school_year_id', activeSyId);
      }
      if (approvedOnly) {
          query = query.eq('signup_status', 'APPROVED');
      }
  }

  // Filters
  if (search) {
    query = query.or(`firstname.ilike.%${search}%,lastname.ilike.%${search}%,idnumber.ilike.%${search}%,email.ilike.%${search}%`);
  }

  if (idnumber) {
    query = query.eq('idnumber', idnumber);
  }

  if (tableName === "users_students") {
    if (course) {
       query = query.eq('courses.name', course); 
    }
    if (section) {
       query = query.eq('sections.name', section);
    }
    if (supervisorId) {
      if (!isNaN(Number(supervisorId))) {
        query = query.eq('supervisor_id', supervisorId);
      } else {
         // Resolve ID Number (e.g. "SUP101") to internal ID
         const { data: supData } = await admin
            .from("users_supervisors")
            .select("id")
            .eq("idnumber", supervisorId)
            .maybeSingle();
         
         if (supData) {
            query = query.eq('supervisor_id', supData.id);
         } else {
            // If supervisor not found, return no records
            query = query.eq('id', -1);
         }
      }
    }
  }

  // Pagination
  const { data, error, count } = await query
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Additional fetching for Coordinators (assigned courses)
  let coordinatorCoursesMap: Record<number, string[]> = {};
  let coordinatorCourseIdsMap: Record<number, number[]> = {};

  // Transform Data to Unified User Interface
  const users = (data || []).map((u: any) => {
    let courseName = u.course; 
    let sectionName = u.section; 
    let courseIds: number[] = [];
    let sectionIds: number[] = [];

    if (u.courses && u.courses.name) courseName = u.courses.name;
    if (u.sections && u.sections.name) sectionName = u.sections.name;
    
    if (tableName === "users_students") {
        if (u.course_id) courseIds = [u.course_id];
        if (u.section_id) sectionIds = [u.section_id];
    }
    
    // For coordinators, use the fetched maps
    if (tableName === "users_coordinators") {
        if (u.coordinator_courses && Array.isArray(u.coordinator_courses)) {
            const courses = u.coordinator_courses.map((cc: any) => cc.courses);
            courseName = courses.map((c: any) => c.name).join(", ");
            courseIds = u.coordinator_courses.map((cc: any) => cc.course_id);
        }
    } else if (tableName === "users_instructors") {
        if (u.instructor_sections && Array.isArray(u.instructor_sections)) {
            const sections = u.instructor_sections.map((is: any) => is.sections);
            sectionName = sections.map((s: any) => s.name).join(", ");
            sectionIds = u.instructor_sections.map((is: any) => is.section_id);
        }
    }

    return {
      id: u.id,
      idnumber: u.idnumber,
      role: u.role || role, 
      firstname: u.firstname,
      lastname: u.lastname,
      middlename: u.middlename,
      name: `${u.firstname} ${u.lastname}`,
      course: courseName || "",
      section: sectionName || "",
      courseIds,
      sectionIds,
      company: u.company || "",
      location: u.location || "",
      supervisorid: u.users_supervisors?.idnumber || u.supervisorid || "", 
      users_supervisors: u.users_supervisors,
      email: u.email,
      email_verified: u.email_verified,
      signup_status: u.signup_status,
      avatar_url: u.avatar_url,
      school_year_id: u.school_year_id,
      target_hours: (u.courses && typeof u.courses.required_ojt_hours === 'number') ? Number(u.courses.required_ojt_hours) : undefined
    };
  });

  return NextResponse.json({
    users,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
