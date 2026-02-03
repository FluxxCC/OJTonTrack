import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
    
    const schedules: Record<string, any> = {};

    // 1. Try to fetch from student_shift_schedules (Specific Overrides)
    // This table might not exist in some environments, so we handle the error gracefully.
    const { data: specificData, error: specificError } = await admin
      .from("student_shift_schedules")
      .select("*");

    if (!specificError && specificData) {
        specificData.forEach((row: any) => {
            const idnumber = (row.student_id || "").trim();
            if (!idnumber) return;
            
            schedules[idnumber] = {
                student_id: idnumber,
                am_in: row.am_in,
                am_out: row.am_out,
                pm_in: row.pm_in,
                pm_out: row.pm_out,
                ot_in: row.ot_in,
                ot_out: row.ot_out
            };
        });
    }

    // 2. Fetch Supervisor Shifts (The main source of truth for most students)
    const { data: shiftsData, error: shiftsError } = await admin
        .from("shifts")
        .select("supervisor_id, shift_name, official_start, official_end");
    
    const supervisorSchedules: Record<string, any> = {}; // supervisor_id -> { amIn, amOut, pmIn, pmOut }

    if (!shiftsError && shiftsData) {
        shiftsData.forEach((s: any) => {
            if (!s.supervisor_id) return;
            const supId = String(s.supervisor_id);
            
            if (!supervisorSchedules[supId]) {
                supervisorSchedules[supId] = {
                    am_in: null, am_out: null,
                    pm_in: null, pm_out: null
                };
            }

            const name = (s.shift_name || "").toUpperCase();
            if (name.includes("MORNING") || name.includes("AM")) {
                supervisorSchedules[supId].am_in = s.official_start;
                supervisorSchedules[supId].am_out = s.official_end;
            } else if (name.includes("AFTERNOON") || name.includes("PM")) {
                supervisorSchedules[supId].pm_in = s.official_start;
                supervisorSchedules[supId].pm_out = s.official_end;
            }
        });
    }

    // 3. Fetch Students to link them to Supervisors
    // We need 'idnumber' and 'supervisor_id'
    const { data: studentsData, error: studentsError } = await admin
        .from("users_students")
        .select("idnumber, supervisor_id");

    if (!studentsError && studentsData) {
        studentsData.forEach((student: any) => {
            const idnumber = (student.idnumber || "").trim();
            if (!idnumber) return;

            // If we already have a specific schedule, we normally skip. 
            // BUT: User requires Supervisor Schedule to be the source of truth if available.
            // So we will MERGE/OVERWRITE specific schedule with Supervisor Schedule.
            
            const supId = String(student.supervisor_id || "");
            if (supId && supervisorSchedules[supId]) {
                // Apply supervisor schedule (Priority: Supervisor > Student Local)
                const supSched = supervisorSchedules[supId];
                const existing = schedules[idnumber] || {};

                schedules[idnumber] = {
                    student_id: idnumber,
                    // Supervisor determines the official AM/PM windows.
                    // If Supervisor has no entry for AM/PM (null), it means NO shift (so we overwrite existing with null too, or keep it?)
                    // "Use the one that the supervisor sets" implies strict adherence.
                    // However, to be safe against partial definition, we'll use Supervisor if set, else existing?
                    // No, usually Supervisor Schedule is complete. Let's assume strict for AM/PM.
                    am_in: supSched.am_in || existing.am_in, 
                    am_out: supSched.am_out || existing.am_out,
                    pm_in: supSched.pm_in || existing.pm_in,
                    pm_out: supSched.pm_out || existing.pm_out,
                    
                    // OT is usually not in Supervisor Shifts (unless explicitly added), so we keep existing OT if any.
                    ot_in: supSched.ot_in || existing.ot_in,
                    ot_out: supSched.ot_out || existing.ot_out
                };
            }
        });
    }

    return NextResponse.json({ schedules });

  } catch (error: any) {
    console.error("Error fetching student schedules:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
