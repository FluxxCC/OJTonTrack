import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { getActiveSchoolYearId } from "../../../lib/school-year";

export async function POST(req: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const { idnumber, supervisor_id, score, comments, submitted_at, criteria, interpretation, overallScore } = body;
    
    if (!idnumber || !score) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Lookup student ID from idnumber
    const { data: student, error: studentErr } = await admin
      .from("users_students")
      .select("id")
      .eq("idnumber", idnumber)
      .single();

    if (studentErr || !student) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Insert into 'evaluation_forms' table
    const { data, error } = await admin
      .from("evaluation_forms")
      .insert({
        student_id: student.id,
        supervisor_id,
        scores_json: { overall: score, criteria: criteria || null, interpretation: interpretation || null, overallScore: overallScore ?? null },
        comment: comments,
        created_at: submitted_at || new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
  try {
    const url = new URL(req.url);
    const supervisorId = String(url.searchParams.get("supervisor_id") || "").trim();
    const activeSyId = await getActiveSchoolYearId(admin);

    if (supervisorId) {
      // First, get list of students belonging to the active school year
      const { data: activeStudents, error: syError } = await admin
        .from("users_students")
        .select("id")
        .eq("school_year_id", activeSyId);

      if (syError) {
        console.error("Error fetching active students:", syError);
        return NextResponse.json({ error: syError.message }, { status: 500 });
      }

      const activeStudentIds = (activeStudents || []).map((s: any) => s.id);

      if (activeStudentIds.length === 0) {
        return NextResponse.json({ completedIds: [] });
      }

      const { data, error } = await admin
        .from("evaluation_forms")
        .select("student_id")
        .eq("supervisor_id", supervisorId)
        .in("student_id", activeStudentIds);
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      const completedStudentIds = (data || []).map((d: any) => d.student_id);
      
      if (completedStudentIds.length === 0) return NextResponse.json({ completedIds: [] });

      const { data: studentsWithId } = await admin
        .from("users_students")
        .select("idnumber")
        .in("id", completedStudentIds);
        
      return NextResponse.json({ 
        completedIds: (studentsWithId || []).map((s: any) => s.idnumber) 
      });
    }

    const idnumber = String(url.searchParams.get("idnumber") || "").trim();
    if (!idnumber) {
      return NextResponse.json({ error: "idnumber or supervisor_id is required" }, { status: 400 });
    }

    // Also verify the requested student belongs to the active school year (optional but good for strictness)
    // Actually, if we are viewing a specific student, we might want to allow it if we are looking at a specific profile?
    // But per "folder" logic, if the student is not in the active folder, we shouldn't see their evaluation.
    // Let's enforce it.
    
    const { data: studentCheck, error: studentError } = await admin
        .from("users_students")
        .select("id, school_year_id")
        .eq("idnumber", idnumber)
        .maybeSingle();
        
    if (studentError) console.warn("Error checking student SY:", studentError);
    
    // If student exists but is not in active SY, return null (empty evaluation)
    if (!studentCheck || studentCheck.school_year_id !== activeSyId) {
        return NextResponse.json({ evaluation: null });
    }

    const { data, error } = await admin
      .from("evaluation_forms")
      .select("student_id, supervisor_id, scores_json, comment, created_at")
      .eq("student_id", studentCheck.id) // Use internal ID
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    if (!row) return NextResponse.json({ evaluation: null });
    const scores = row.scores_json || {};
    const evaluation = {
      studentId: row.student_id,
      supervisorId: row.supervisor_id,
      createdAt: row.created_at,
      comment: row.comment || "",
      interpretation: scores.interpretation || "",
      criteria: scores.criteria || {},
      overall: scores.overallScore ?? scores.overall ?? null
    };
    return NextResponse.json({ evaluation });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
