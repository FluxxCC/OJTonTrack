import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export async function GET(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    // Join with courses and sections to get names
    const { data, error } = await admin
        .from("report_requirements")
        .select(`
            *,
            courses ( name ),
            sections ( name )
        `);

    if (error) {
       console.error("GET deadlines Supabase error:", error);
       return NextResponse.json({ error: error.message || "Database error" }, { status: 500 });
    }

    // Map to frontend structure: { "BSIT:::4A": { 1: "2023-..." }, "BSIT:::ALL": { ... } }
    // Key format: "COURSE:::SECTION" (use "ALL" for empty/generic)
    const deadlines: Record<string, Record<number, string>> = {};

    (data || []).forEach((row: any) => {
        // Handle course name
        let cName = "ALL";
        if (row.courses && row.courses.name) {
            cName = row.courses.name;
        }

        // Handle section name
        let sName = "ALL";
        if (row.sections && row.sections.name) {
            sName = row.sections.name;
        }

        const key = `${cName}:::${sName}`;
        const w = row.week_number;
        
        if (!deadlines[key]) deadlines[key] = {};
        if (w) deadlines[key][w] = row.due_at;
    });

    return NextResponse.json({ deadlines });
  } catch (e) {
    console.error("GET deadlines error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    const body = await req.json();
    console.log("POST /api/instructor/deadlines body:", body);
    const { course, section, week, date } = body;

    if (!course || !week || !date) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Helper function to upsert a deadline for a specific course/section
    const upsertDeadline = async (courseId: number, sectionId: number | null) => {
        // Check existence
        let query = admin
            .from("report_requirements")
            .select("id")
            .eq("course_id", courseId)
            .eq("week_number", week);

        if (sectionId) {
            query = query.eq("section_id", sectionId);
        } else {
            query = query.is("section_id", null);
        }

        const { data: existing, error: findError } = await query.maybeSingle();

        if (findError) {
            console.error(`Error checking existence (C:${courseId}, S:${sectionId}):`, findError);
            throw new Error(findError.message);
        }

        if (existing) {
            const { error } = await admin
                .from("report_requirements")
                .update({ due_at: date })
                .eq("id", existing.id);
            if (error) throw new Error(error.message);
        } else {
            const { error } = await admin
                .from("report_requirements")
                .insert({
                    course_id: courseId,
                    section_id: sectionId,
                    week_number: week,
                    due_at: date,
                    title: `Week ${week} Report`
                });
            if (error) throw new Error(error.message);
        }
    };

    // CASE 1: "All Courses" -> Apply to ALL courses (and implied no specific section)
    if (course === "All Courses" || course === "ALL") {
        const { data: allCourses, error: cError } = await admin
            .from("courses")
            .select("id");
        
        if (cError) {
            return NextResponse.json({ error: `Failed to fetch courses: ${cError.message}` }, { status: 500 });
        }

        if (!allCourses || allCourses.length === 0) {
            return NextResponse.json({ error: "No courses found in database" }, { status: 400 });
        }

        const results = await Promise.allSettled(
            allCourses.map(c => upsertDeadline(c.id, null))
        );

        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
            console.error("Some deadlines failed to save:", failures);
            // Return success if at least one worked, or 500 if all failed? 
            // Let's return success but log errors, as it's a bulk op.
        }
        
        return NextResponse.json({ success: true, count: allCourses.length, failures: failures.length });
    }

    // CASE 2: Specific Course
    // Resolve Course ID
    let courseId = null;
    const { data: cData, error: cError } = await admin
        .from("courses")
        .select("id")
        .eq("name", course)
        .maybeSingle();
    
    if (cError) {
            return NextResponse.json({ error: `Error resolving course: ${cError.message}` }, { status: 500 });
    }
    if (!cData) {
        return NextResponse.json({ error: `Course not found: ${course}` }, { status: 400 });
    }
    courseId = cData.id;

    // Resolve Section ID (if provided)
    let sectionId = null;
    if (section && section !== "All Sections" && section !== "ALL") {
        const { data: sData, error: sError } = await admin
            .from("sections")
            .select("id")
            .eq("name", section)
            .eq("course_id", courseId)
            .maybeSingle();
        
        if (sError) {
                return NextResponse.json({ error: `Error finding section: ${sError.message}` }, { status: 500 });
        }
        if (!sData) {
                return NextResponse.json({ error: `Section not found: ${section}` }, { status: 400 });
        }
        sectionId = sData.id;
    }

    // Execute upsert for single target
    try {
        await upsertDeadline(courseId, sectionId);
        return NextResponse.json({ success: true });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Update failed";
        return NextResponse.json({ error: msg }, { status: 500 });
    }

  } catch (e) {
    console.error("Unexpected error in POST /api/instructor/deadlines:", e);
    const msg = e instanceof Error ? e.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
