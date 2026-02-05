import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { calculateHoursWithinOfficialTime, timeStringToMinutes, normalizeTimeString } from "@/lib/attendance";

export async function GET(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    const { data: students, error: studentError } = await admin
      .from("users_students")
      .select("id, section_id, school_year_id");
    
    if (studentError || !students) return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });

    let processedCount = 0;
    const results = [];

    for (const student of students) {
        // Fetch all attendance logs
        const { data: logs } = await admin
            .from("attendance")
            .select("*")
            .eq("student_id", student.id)
            .order("logged_at", { ascending: true });

        if (!logs || logs.length === 0) continue;

        // Fetch Section Shifts
        let sectionShifts: any[] = [];
        if (student.section_id) {
            const { data: shifts } = await admin
                .from("shifts")
                .select("*")
                .eq("section_id", student.section_id)
                .order("official_start", { ascending: true });
            sectionShifts = shifts || [];
        }

        // Identify AM, PM, OT shifts from sectionShifts
        // Simple heuristic: AM starts < 12:00, PM >= 12:00
        // OT is explicitly named or via overtime_shifts table (we'll skip dynamic OT for this basic migration for now, or handle if possible)
        
        let amShift = sectionShifts.find(s => {
            const start = timeStringToMinutes(s.official_start);
            return start < 720; // Before 12:00
        });
        let pmShift = sectionShifts.find(s => {
            const start = timeStringToMinutes(s.official_start);
            return start >= 720 && start < 1080; // 12:00 - 18:00
        });

        // Group logs by Date
        const byDate = new Map<string, any[]>();
        logs.forEach(l => {
            const d = new Date(l.logged_at).toLocaleDateString('en-CA');
            if (!byDate.has(d)) byDate.set(d, []);
            byDate.get(d)!.push(l);
        });

        for (const [dateStr, dayLogs] of byDate.entries()) {
            // Sort
            dayLogs.sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());

            // Simple Pairing Logic (First IN, First OUT after IN)
            // We will attempt to fill AM and PM slots
            
            const usedIds = new Set();
            
            const findPair = (startRange: number, endRange: number) => {
                const inLog = dayLogs.find(l => {
                    if (l.type !== 'in' || usedIds.has(l.id)) return false;
                    const h = new Date(l.logged_at).getHours();
                    return h >= startRange && h < endRange;
                });

                if (inLog) {
                    usedIds.add(inLog.id);
                    // Find corresponding OUT
                    const outLog = dayLogs.find(l => {
                        return l.type === 'out' && !usedIds.has(l.id) && new Date(l.logged_at).getTime() > new Date(inLog.logged_at).getTime();
                    });
                    
                    if (outLog) {
                        usedIds.add(outLog.id);
                        return { inLog, outLog };
                    }
                }
                return null;
            };

            // AM Slot (e.g., 6 AM to 12 PM)
            if (amShift) {
                const pair = findPair(0, 13); // Wide range for safety
                if (pair) {
                    const { inLog, outLog } = pair;
                    // Calculate Hours using Golden Rule
                    const hours = calculateHoursWithinOfficialTime(
                        new Date(inLog.logged_at),
                        new Date(outLog.logged_at),
                        amShift.official_start,
                        amShift.official_end
                    );

                    if (hours > 0) {
                        // Upsert into validated_hours
                        const { error } = await admin.from("validated_hours").upsert({
                            student_id: student.id,
                            date: dateStr,
                            shift_id: amShift.id,
                            school_year_id: student.school_year_id,
                            hours: Number(hours.toFixed(2)),
                            official_time_in: amShift.official_start,
                            official_time_out: amShift.official_end,
                            validated_at: new Date().toISOString(),
                            slot: 'AM'
                        }, { onConflict: 'student_id, date, slot' });
                        
                        if (error) console.error("Upsert error AM:", error);
                        else results.push({ student: student.id, date: dateStr, shift: 'AM', hours });
                    }
                }
            }

            // PM Slot (e.g., 12 PM to 6 PM)
            if (pmShift) {
                const pair = findPair(12, 19);
                if (pair) {
                    const { inLog, outLog } = pair;
                    const hours = calculateHoursWithinOfficialTime(
                        new Date(inLog.logged_at),
                        new Date(outLog.logged_at),
                        pmShift.official_start,
                        pmShift.official_end
                    );

                    if (hours > 0) {
                         const { error } = await admin.from("validated_hours").upsert({
                            student_id: student.id,
                            date: dateStr,
                            shift_id: pmShift.id,
                            school_year_id: student.school_year_id,
                            hours: Number(hours.toFixed(2)),
                            official_time_in: pmShift.official_start,
                            official_time_out: pmShift.official_end,
                            validated_at: new Date().toISOString(),
                            slot: 'PM'
                        }, { onConflict: 'student_id, date, slot' });

                        if (error) console.error("Upsert error PM:", error);
                        else results.push({ student: student.id, date: dateStr, shift: 'PM', hours });
                    }
                }
            }
        }
        processedCount++;
    }

    return NextResponse.json({ message: "Migration completed", processed: processedCount, entries: results.length, details: results });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
