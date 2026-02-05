import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { getActiveSchoolYearId } from "@/lib/school-year";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  const statusFilter = (searchParams.get("status") || "").toLowerCase(); // pending|approved|rejected|''(all)
  const courseName = searchParams.get("course") || "";
  const sectionName = searchParams.get("section") || "";
  const search = searchParams.get("search") || "";

  const activeSyId = await getActiveSchoolYearId(admin);

  // Instructor gating
  const instructorIdParam = searchParams.get("instructorId") || "";
  const instructorIdnumberParam = searchParams.get("instructorIdnumber") || "";
  let allowedSectionIds: number[] = [];
  let allowedCourseIds: number[] = [];
  if (instructorIdParam || instructorIdnumberParam) {
    let instructorId: number | null = null;
    if (instructorIdParam && !Number.isNaN(Number(instructorIdParam))) {
      instructorId = Number(instructorIdParam);
    } else if (instructorIdnumberParam) {
      const { data: inst } = await admin
        .from("users_instructors")
        .select("id")
        .eq("idnumber", instructorIdnumberParam)
        .maybeSingle();
      if (inst?.id) instructorId = Number(inst.id);
    }
    if (instructorId) {
      const { data: secRows } = await admin
        .from("instructor_sections")
        .select("section_id, school_year_id")
        .eq("instructor_id", instructorId);
      const { data: courseRows } = await admin
        .from("instructor_courses")
        .select("course_id, school_year_id")
        .eq("instructor_id", instructorId);
      const secIds = (secRows || [])
        .filter(r => !activeSyId || r.school_year_id === activeSyId)
        .map(r => Number(r.section_id))
        .filter(id => !Number.isNaN(id));
      const cIds = (courseRows || [])
        .filter(r => !activeSyId || r.school_year_id === activeSyId)
        .map(r => Number(r.course_id))
        .filter(id => !Number.isNaN(id));
      allowedSectionIds = Array.from(new Set(secIds));
      allowedCourseIds = Array.from(new Set(cIds));
    }
  }

  let courseIdFilter: number | null = null;
  let sectionIdFilter: number | null = null;
  if (courseName) {
    const { data: c } = await admin.from("courses").select("id,name").ilike("name", courseName).maybeSingle();
    if (c?.id) courseIdFilter = Number(c.id);
  }
  if (sectionName) {
    const { data: s } = await admin.from("sections").select("id,name").ilike("name", sectionName).maybeSingle();
    if (s?.id) sectionIdFilter = Number(s.id);
  }

  let query = admin
    .from("student_approval_requests")
    .select(
      `
      *,
      courses:course_id (id, name),
      sections:section_id (id, name)
      `,
      { count: "exact" }
    );

  if (statusFilter === "pending" || statusFilter === "approved" || statusFilter === "rejected") {
    query = query.eq("status", statusFilter);
  }

  // Enforce instructor gating first
  if (allowedSectionIds.length > 0) {
    query = query.in("section_id", allowedSectionIds);
  } else if (allowedCourseIds.length > 0) {
    query = query.in("course_id", allowedCourseIds);
  } else if (instructorIdParam || instructorIdnumberParam) {
    // Instructor context present but no assignments: return empty
    return NextResponse.json({
      requests: [],
      total: 0,
      page,
      totalPages: 0,
      activeSyId: activeSyId || null,
    });
  }

  if (courseIdFilter) query = query.eq("course_id", courseIdFilter);
  if (sectionIdFilter) query = query.eq("section_id", sectionIdFilter);
  if (search) {
    query = query.or(
      `full_name.ilike.%${search}%,email.ilike.%${search}%,school_id.ilike.%${search}%`
    );
  }

  const { data, error, count } = await query
    .order("requested_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []) as any[];
  const needCourseLookup = rows.some(r => !r.courses?.name) && rows.some(r => !!r.course_id);
  const needSectionLookup = rows.some(r => !r.sections?.name) && rows.some(r => !!r.section_id);
  let courseMap: Record<string, string> = {};
  let sectionMap: Record<string, string> = {};
  if (needCourseLookup) {
    const ids = Array.from(new Set(rows.map(r => r.course_id).filter(Boolean)));
    if (ids.length > 0) {
      const { data: cs } = await admin.from("courses").select("id,name").in("id", ids);
      (cs || []).forEach((c: any) => { courseMap[String(c.id)] = c.name; });
    }
  }
  if (needSectionLookup) {
    const ids = Array.from(new Set(rows.map(r => r.section_id).filter(Boolean)));
    if (ids.length > 0) {
      const { data: ss } = await admin.from("sections").select("id,name").in("id", ids);
      (ss || []).forEach((s: any) => { sectionMap[String(s.id)] = s.name; });
    }
  }

  const requests = rows.map((r: any) => ({
    id: r.id,
    full_name: r.full_name,
    email: r.email,
    school_id: r.school_id,
    course: r.courses?.name || courseMap[String(r.course_id)] || "",
    section: r.sections?.name || sectionMap[String(r.section_id)] || "",
    course_id: r.course_id || r.courses?.id || null,
    section_id: r.section_id || r.sections?.id || null,
    status: r.status,
    requested_at: r.requested_at,
  }));

  return NextResponse.json({
    requests,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
    activeSyId: activeSyId || null,
  });
}
