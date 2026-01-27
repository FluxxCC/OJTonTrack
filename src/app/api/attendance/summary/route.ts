import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { buildSchedule, calculateSessionDuration, determineShift } from "@/lib/attendance";

type AttendanceEvent = {
  type: string;
  ts: number;
  status: string;
  validated_by?: string | null;
  validated_at?: number | null;
};

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

    const { searchParams } = new URL(req.url);

  const { data, error } = await admin
    .from("attendance")
    .select("idnumber, type, ts, status, validated_by, validated_at")
    .order("ts", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const summary: Record<string, number> = {};
  const activeSessions: Record<string, number> = {};
  const recentAttendance: { idnumber: string; type: string; ts: number }[] = [];

  const grouped: Record<string, AttendanceEvent[]> = {};
  (data || []).forEach((row: { idnumber: string; type: string; ts: number | string; status: string; validated_by?: string | null; validated_at?: string | null }) => {
    if (!grouped[row.idnumber]) grouped[row.idnumber] = [];
    grouped[row.idnumber].push({ 
      type: row.type, 
      ts: Number(row.ts),
      status: row.status,
      validated_by: row.validated_by,
      validated_at: row.validated_at ? Number(new Date(row.validated_at).getTime()) : null
    });
    // Collect recent attendance (last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    if (Number(row.ts) >= sevenDaysAgo) {
      recentAttendance.push({ idnumber: row.idnumber, type: row.type, ts: Number(row.ts) });
    }
  });

  const { data: otShiftsData } = await admin
    .from("overtime_shifts")
    .select("student_id, effective_date, overtime_start, overtime_end");

  // Fetch users to map students to supervisors
  const { data: usersData } = await admin
    .from("users")
    .select("idnumber, supervisorid");
  
  const userSupervisorMap: Record<string, string> = {};
  const supervisorIds = new Set<string>();
  (usersData || []).forEach((u: any) => {
      if (u.idnumber && u.supervisorid) {
          userSupervisorMap[u.idnumber] = u.supervisorid;
          supervisorIds.add(u.supervisorid);
      }
  });

  // Fetch Overrides
  const overridesMap: Record<string, Record<string, any>> = {}; // supervisorId -> date -> override
  if (supervisorIds.size > 0) {
      const { data: overridesData } = await admin
        .from("shifts")
        .select("shift_name, official_start, official_end, supervisor_id")
        .like("shift_name", "OVERRIDE:::%")
        .in("supervisor_id", Array.from(supervisorIds));
      
      (overridesData || []).forEach((o: any) => {
           const parts = o.shift_name.split(':::');
           if (parts.length === 3) {
               const date = parts[1];
               const type = parts[2]; // AM or PM
               const supId = o.supervisor_id;
               
               if (!overridesMap[supId]) overridesMap[supId] = {};
               if (!overridesMap[supId][date]) overridesMap[supId][date] = {};
               
               if (type === 'AM') {
                   overridesMap[supId][date].amIn = o.official_start;
                   overridesMap[supId][date].amOut = o.official_end;
               } else if (type === 'PM') {
                   overridesMap[supId][date].pmIn = o.official_start;
                   overridesMap[supId][date].pmOut = o.official_end;
               }
           }
      });
  }

  // Fetch individual student schedules
  const { data: studentSchedules } = await admin
    .from("student_shift_schedules")
    .select("*");
  
  const scheduleLookup: Record<string, any> = {};
  (studentSchedules || []).forEach((s: any) => {
      scheduleLookup[s.student_id] = s;
  });

  // Build lookup: student_id -> date (YYYY-MM-DD) -> { start, end }
  const otLookup: Record<string, Record<string, { start: number, end: number }>> = {};
  (otShiftsData || []).forEach((s: any) => {
      if (!otLookup[s.student_id]) otLookup[s.student_id] = {};
      otLookup[s.student_id][s.effective_date] = {
          start: Number(s.overtime_start),
          end: Number(s.overtime_end)
      };
  });

  const shiftConfig: Record<string, { start: string; end: string }> = {};
  try {
    const { data: shiftRows } = await admin
      .from("shifts")
      .select("shift_name, official_start, official_end");

    (shiftRows || []).forEach((row: { shift_name?: string | null; official_start?: string | null; official_end?: string | null }) => {
      const name = row.shift_name || "";
      if (!name) return;
      shiftConfig[name] = {
        start: row.official_start || "",
        end: row.official_end || "",
      };
    });
  } catch {}

  const isApproved = (e: AttendanceEvent) => {
    const st = String(e.status || "").toUpperCase();
    return st === "APPROVED" || st === "VALIDATED" || !!e.validated_by;
  };

  // PH Timezone Offset (UTC+8)
  const PH_OFFSET = 8 * 60 * 60 * 1000;
  
  // Current Date in PH Time (YYYY-MM-DD) for "Today" comparison
  const nowPh = new Date(Date.now() + PH_OFFSET);
  const todayStrPh = nowPh.toISOString().split('T')[0];

  Object.keys(grouped).forEach(id => {
    const events: AttendanceEvent[] = grouped[id];
    let totalMs = 0;

    const byDay: { [dayKey: string]: { date: Date; logs: AttendanceEvent[] } } = {};
    events.forEach(ev => {
      // Bucket by PH Time
      const datePh = new Date(ev.ts + PH_OFFSET);
      const day = new Date(datePh.getUTCFullYear(), datePh.getUTCMonth(), datePh.getUTCDate());
      // Use toISOString() logic carefully. Since 'day' is constructed with UTC components of PH time, 
      // we can treat it as a UTC date for key generation to avoid local timezone interference.
      // But simpler: just string key.
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      
      if (!byDay[key]) byDay[key] = { date: day, logs: [] as typeof events };
      byDay[key].logs.push(ev);
    });

    // Parse configured shifts or use defaults
    const amCfg = shiftConfig["Morning Shift"];
    const pmCfg = shiftConfig["Afternoon Shift"];
    const otCfg = shiftConfig["Overtime Shift"];

    Object.entries(byDay).forEach(([dayKey, day]) => {
      const dynamicOt = otLookup[id]?.[dayKey];
      const studentSched = scheduleLookup[id];
      const supervisorId = userSupervisorMap[id];
      const override = overridesMap[supervisorId]?.[dayKey];

      // Priority: Override > Student Schedule > Global Config > Default
      const amInVal = override?.amIn || studentSched?.am_in || amCfg?.start || "08:00";
      const amOutVal = override?.amOut || studentSched?.am_out || amCfg?.end || "12:00";
      const pmInVal = override?.pmIn || studentSched?.pm_in || pmCfg?.start || "13:00";
      const pmOutVal = override?.pmOut || studentSched?.pm_out || pmCfg?.end || "17:00";
      const otInVal = studentSched?.ot_in || otCfg?.start || "17:00";
      const otOutVal = studentSched?.ot_out || otCfg?.end || "20:00";
      
      // Pass the date object (which is 00:00 of that day)
      // Note: buildSchedule expects a Date object. 
      // If we pass 'day.date' constructed above, it has local time 00:00 components.
      const schedule = buildSchedule(day.date, {
          amIn: amInVal,
          amOut: amOutVal,
          pmIn: pmInVal,
          pmOut: pmOutVal,
          otIn: otInVal,
          otOut: otOutVal
      }, dynamicOt ? { start: dynamicOt.start, end: dynamicOt.end } : undefined);

      const sortedLogs = day.logs.slice().sort((a, b) => a.ts - b.ts);
      let currentIn: AttendanceEvent | null = null;
      const isPastDate = dayKey < todayStrPh;

      for (const log of sortedLogs) {
        if (!isApproved(log)) continue;

        if (log.type === 'in') {
            if (currentIn) {
                // Previous session incomplete
                if (isPastDate) {
                    const shift = determineShift(currentIn.ts, schedule);
                    // Virtual Auto-Close Logic matching Frontend
                    const outTs = shift === 'am' ? schedule.amOut : shift === 'pm' ? schedule.pmOut : schedule.otEnd;
                    
                    // Validated for calculation
                    totalMs += calculateSessionDuration(currentIn.ts, outTs, 'am', schedule);
                    totalMs += calculateSessionDuration(currentIn.ts, outTs, 'pm', schedule);
                    totalMs += calculateSessionDuration(currentIn.ts, outTs, 'ot', schedule);
                }
            }
            currentIn = log;
        } else if (log.type === 'out') {
            if (currentIn) {
                // Pair found
                totalMs += calculateSessionDuration(currentIn.ts, log.ts, 'am', schedule);
                totalMs += calculateSessionDuration(currentIn.ts, log.ts, 'pm', schedule);
                totalMs += calculateSessionDuration(currentIn.ts, log.ts, 'ot', schedule);
                currentIn = null;
            }
        }
      }

      // Handle trailing IN
      if (currentIn && isPastDate) {
           const shift = determineShift(currentIn.ts, schedule);
           const outTs = shift === 'am' ? schedule.amOut : shift === 'pm' ? schedule.pmOut : schedule.otEnd;
           
           totalMs += calculateSessionDuration(currentIn.ts, outTs, 'am', schedule);
           totalMs += calculateSessionDuration(currentIn.ts, outTs, 'pm', schedule);
           totalMs += calculateSessionDuration(currentIn.ts, outTs, 'ot', schedule);
      }
    });

    const approvedEvents = events.filter(e => isApproved(e));

    for (let i = 0; i < approvedEvents.length; i++) {
      if (approvedEvents[i].type === 'in') {
        let outIndex = -1;
        for (let j = i + 1; j < approvedEvents.length; j++) {
          if (approvedEvents[j].type === 'out') {
            outIndex = j;
            break;
          }
        }

        if (outIndex === -1) {
          activeSessions[id] = approvedEvents[i].validated_at ?? approvedEvents[i].ts;
        } else {
          i = outIndex;
        }
      }
    }

    summary[id] = totalMs;
  });

  // Recent reports (last 7 days, exclude drafts)
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const { data: reportsData } = await admin
    .from("reports")
    .select("id, idnumber, title, text, ts, status")
    .gte("ts", sevenDaysAgo)
    .neq("status", "draft")
    .order("ts", { ascending: false });

  const recentReports = (reportsData || []).map((r: { id: number; idnumber: string; title?: string | null; text?: string | null; ts?: number | string | null; status?: string | null }) => ({
    id: r.id,
    idnumber: r.idnumber,
    title: r.title || "(Untitled)",
    body: r.text || "",
    ts: Number(r.ts || 0),
    status: r.status || "submitted"
  }));

  // Sort recent attendance by latest first (no limit to ensure badges work for all students)
  recentAttendance.sort((a, b) => b.ts - a.ts);

  // Transform otLookup to array for frontend
  const overtimeShifts: { student_id: string; date: string; start: number; end: number }[] = [];
  Object.keys(otLookup).forEach(sid => {
      Object.keys(otLookup[sid]).forEach(date => {
          overtimeShifts.push({
              student_id: sid,
              date: date,
              start: otLookup[sid][date].start,
              end: otLookup[sid][date].end
          });
      });
  });

  return NextResponse.json({ 
    summary, 
    activeSessions, 
    recentAttendance, 
    recentReports, 
    overtimeShifts,
    studentSchedules: scheduleLookup,
    overrides: overridesMap,
    userSupervisorMap
  });
  } catch (e) {
    console.error("Summary API Error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
