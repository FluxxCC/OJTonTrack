import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const { idnumber, supervisor_id, score, comments, submitted_at, criteria, interpretation, overallScore } = body;
    
    if (!idnumber || !score) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Insert into 'evaluation_forms' table
    const { data, error } = await admin
      .from("evaluation_forms")
      .insert({
        student_id: idnumber,
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
    const idnumber = String(url.searchParams.get("idnumber") || "").trim();
    if (!idnumber) {
      return NextResponse.json({ error: "idnumber is required" }, { status: 400 });
    }
    const { data, error } = await admin
      .from("evaluation_forms")
      .select("student_id, supervisor_id, scores_json, comment, created_at")
      .eq("student_id", idnumber)
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
