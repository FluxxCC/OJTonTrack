
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { buildSchedule, calculateShiftDurations, timeStringToMinutes } from "@/lib/attendance";

export async function GET(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    // 1. Fetch all 'out' attendance records with null rendered_hours
    // We process in batches to avoid timeouts
    const { data: logs, error } = await admin
      .from("attendance")
      .select("id, student_id, logged_at, attendance_date")
      .eq("type", "out")
      .is("rendered_hours", null)
      .limit(500); // Process 500 at a time

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!logs || logs.length === 0) return NextResponse.json({ message: "No records to update" });

    let updatedCount = 0;
    const errors: any[] = [];

    // Pre-fetch all students and their schedules to minimize queries
    const studentIds = Array.from(new Set(logs.map(l => l.student_id)));
    
    // Fetch students with their section/schedule info
    const { data: students } = await admin
      .from("users_students")
      .select("id, section_id")
      .in("id", studentIds);
      
    const studentMap = new Map(students?.map(s => [s.id, s]));

    // Fetch shifts for all relevant sections
    const sectionIds = students?.map(s => s.section_id).filter(Boolean) || [];
    const { data: shifts } = await admin
      .from("shifts")
      .select("*")
      .in("section_id", sectionIds);
      
    const shiftsMap = new Map<string, any[]>(); // section_id -> shifts[]
    shifts?.forEach(s => {
        const sid = String(s.section_id);
        if (!shiftsMap.has(sid)) shiftsMap.set(sid, []);
        shiftsMap.get(sid)!.push(s);
    });

    for (const log of logs) {
      try {
        const student = studentMap.get(log.student_id);
        if (!student || !student.section_id) continue;

        const sectionShifts = shiftsMap.get(String(student.section_id));
        if (!sectionShifts) continue;

        // Fetch the paired IN log
        // We need the IN log for this specific OUT log (same date, earlier time)
        const { data: inLog } = await admin
            .from("attendance")
            .select("logged_at")
            .eq("student_id", log.student_id)
            .eq("type", "in")
            .eq("attendance_date", log.attendance_date)
            .lt("logged_at", log.logged_at)
            .order("logged_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!inLog) continue;

        const inTime = new Date(inLog.logged_at).getTime();
        const outTime = new Date(log.logged_at).getTime();

        // Build Schedule
        const amShift = sectionShifts.find((s: any) => s.shift_name?.toLowerCase().includes('morning') || s.shift_name?.toLowerCase().includes('am'));
        const pmShift = sectionShifts.find((s: any) => s.shift_name?.toLowerCase().includes('afternoon') || s.shift_name?.toLowerCase().includes('pm'));

        const normalize = (t: string) => t ? t.substring(0, 5) : "";
        const scheduleConfig = {
            amIn: normalize(amShift?.official_start),
            amOut: normalize(amShift?.official_end),
            pmIn: normalize(pmShift?.official_start),
            pmOut: normalize(pmShift?.official_end),
            otIn: "",
            otOut: ""
        };

        // Note: We are ignoring dynamic overtime shifts for this backfill for simplicity/performance 
        // unless strictly required, but for "official schedule" adjustments, the base schedule is key.
        // If needed, we could fetch overtime_shifts too.

        const dailySchedule = buildSchedule(new Date(outTime), scheduleConfig);
        const durations = calculateShiftDurations(inTime, outTime, dailySchedule);
        const total = durations.am + durations.pm + durations.ot;

        // Update the record
        await admin
            .from("attendance")
            .update({ rendered_hours: total })
            .eq("id", log.id);

        updatedCount++;
      } catch (e) {
        console.error(`Error updating log ${log.id}`, e);
        errors.push({ id: log.id, error: String(e) });
      }
    }

    return NextResponse.json({ 
        success: true, 
        processed: logs.length, 
        updated: updatedCount, 
        remaining: logs.length < 500 ? 0 : "Unknown (run again)",
        errors 
    });

  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
