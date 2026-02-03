import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { getActiveSchoolYearId } from "../../../lib/school-year";
import { sendPushNotification } from "@/lib/push-notifications";

export async function GET(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
    const sy = await getActiveSchoolYearId(admin);

    const { data, error } = await admin
      .from("evaluation_status")
      .select(`
        enabled,
        updated_at,
        users_students!inner (
          idnumber
        )
      `)
      .eq("school_year_id", sy);

    if (error) {
        console.error("Supabase Error in /api/evaluation-status:", error);
        return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }
    
    const statuses = (data || []).map((item: any) => ({
      idnumber: item.users_students?.idnumber,
      enabled: item.enabled,
      updated_at: item.updated_at
    }));

    return NextResponse.json({ statuses });
  } catch (e) {
    console.error("Unexpected Error in /api/evaluation-status:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}


export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
    const sy = await getActiveSchoolYearId(admin);
    
    const body = await req.json();
    const { idnumber, enabled } = body;
    if (!idnumber) return NextResponse.json({ error: "idnumber required" }, { status: 400 });

    // Find student
    const { data: student, error: studentError } = await admin
      .from("users_students")
      .select("id, firstname, lastname, supervisor_id")
      .eq("idnumber", idnumber)
      .single();

    if (studentError || !student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Upsert
    const { data, error } = await admin
      .from("evaluation_status")
      .upsert({ 
        student_id: student.id, 
        enabled, 
        updated_at: new Date().toISOString(),
        school_year_id: sy
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Send Push Notification if enabled is true
    if (enabled && student.supervisor_id) {
        try {
            const { data: sup } = await admin
                .from("users_supervisors")
                .select("idnumber")
                .eq("id", student.supervisor_id)
                .single();

            if (sup && sup.idnumber) {
                const name = `${student.firstname || ""} ${student.lastname || ""}`.trim() || idnumber;
                await sendPushNotification(sup.idnumber, {
                    title: "Evaluation Available",
                    body: `Evaluation for ${name} is now available.`,
                    url: "/portal/supervisor?tab=evaluation",
                    tag: `eval-status-${student.id}-${Date.now()}`
                });
            }
        } catch (e) {
            console.error("Failed to send evaluation push notification", e);
        }
    }
    
    return NextResponse.json({ status: { ...data, idnumber } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
