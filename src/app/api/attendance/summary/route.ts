import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { buildSchedule, calculateSessionDuration, determineShift, calculateHoursWithinOfficialTime } from "@/lib/attendance";
import { getActiveSchoolYearId } from "../../../../lib/school-year";

type AttendanceEvent = {
  type: string;
  ts: number;
  status: string;
  validated_by?: string | null;
  validated_at?: number | null;
  validated_hours?: number;
  rendered_hours?: number;
  official_time_in?: string | null;
  official_time_out?: string | null;
};

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const syParam = searchParams.get("school_year_id");

    let targetSyId: number | null = null;
    if (syParam) {
      targetSyId = parseInt(syParam);
    } else {
      targetSyId = await getActiveSchoolYearId(admin);
    }

    let query = admin
      .from("attendance")
      .select(`
        student_id, type, logged_at, status, validated_by, validated_at, attendance_date, shift_id,
        users_students!inner (idnumber)
      `)
      .order("logged_at", { ascending: true });

    if (targetSyId) {
      query = query.eq("school_year_id", targetSyId);
    }

    const { data, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // ---------------------------------------------------------
    // NEW: Merge with validated_hours Ledger
    // ---------------------------------------------------------
    if (data && data.length > 0) {
        const studentIds = Array.from(new Set(data.map((d: any) => d.student_id)));
        
        // Fetch validated hours for these students
        // Note: For large datasets, this might be heavy. Ideally we filter by school year if validated_hours has it.
        // But validated_hours doesn't seem to have school_year_id. We rely on student_id matching.
        const { data: ledgerData } = await admin
          .from('validated_hours')
          .select('*')
          .in('student_id', studentIds);
        
        if (ledgerData && ledgerData.length > 0) {
            const ledgerMap = new Map<string, any>();
            ledgerData.forEach((l: any) => {
                ledgerMap.set(`${l.student_id}-${l.date}-${l.shift_id}`, l);
            });

            data.forEach((row: any) => {
                if (row.type === 'out' && row.shift_id) {
                    const key = `${row.student_id}-${row.attendance_date}-${row.shift_id}`;
                    if (ledgerMap.has(key)) {
                        const ledgerEntry = ledgerMap.get(key);
                        // row.rendered_hours = Number(ledgerEntry.hours); // Don't overwrite legacy
                        row.validated_hours = Number(ledgerEntry.hours);
                        row.official_time_in = ledgerEntry.official_time_in;
                        row.official_time_out = ledgerEntry.official_time_out;
                    }
                }
            });
        }
    }

    const summary: Record<string, number> = {};
  const totalSummary: Record<string, number> = {}; // All logs (validated + pending)
  const activeSessions: Record<string, number> = {};
  const recentAttendance: { idnumber: string; type: string; ts: number }[] = [];

  const grouped: Record<string, AttendanceEvent[]> = {};
  (data || []).forEach((row: any) => {
    let idnumber = row.users_students?.idnumber;
    if (!idnumber && Array.isArray(row.users_students) && row.users_students.length > 0) {
        idnumber = row.users_students[0].idnumber;
    }
    
    if (!idnumber) return;
    idnumber = String(idnumber).trim();

    const ts = new Date(row.logged_at).getTime();

    if (!grouped[idnumber]) grouped[idnumber] = [];
    grouped[idnumber].push({ 
      type: row.type, 
      ts: ts,
      status: row.status,
      validated_by: row.validated_by,
      validated_at: row.validated_at ? Number(new Date(row.validated_at).getTime()) : null,
      rendered_hours: row.rendered_hours,
      validated_hours: row.validated_hours,
      official_time_in: row.official_time_in,
      official_time_out: row.official_time_out
    });
    // Collect recent attendance (last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    if (ts >= sevenDaysAgo) {
      recentAttendance.push({ idnumber: idnumber, type: row.type, ts: ts });
    }
  });

  const { data: otShiftsData } = await admin
    .from("overtime_shifts")
    .select("student_id, effective_date, overtime_start, overtime_end");

  // Fetch Coordinator Events
  let eventsQuery = admin
    .from("coordinator_events")
    .select("*");
    
  if (targetSyId) {
    eventsQuery = eventsQuery.eq("school_year_id", targetSyId);
  }
  const { data: coordinatorEvents } = await eventsQuery;

  const coordinatorEventsMap: Record<string, any[]> = {};
  (coordinatorEvents || []).forEach((e: any) => {
      const d = e.event_date;
      if (!coordinatorEventsMap[d]) coordinatorEventsMap[d] = [];
      coordinatorEventsMap[d].push(e);
  });

  // Fetch users to map students to supervisors and get required hours
  const { data: usersData } = await admin
    .from("users_students")
    .select("idnumber, supervisor_id, course_id, courses(required_ojt_hours)");
  
  const userSupervisorMap: Record<string, string> = {};
  const userCourseMap: Record<string, number> = {};
  const requiredHoursMap: Record<string, number> = {};
  const supervisorIds = new Set<string>();
  
  (usersData || []).forEach((u: any) => {
      if (u.idnumber) {
          const idNum = String(u.idnumber).trim();
          if (u.supervisor_id) {
            userSupervisorMap[idNum] = String(u.supervisor_id);
            supervisorIds.add(String(u.supervisor_id));
          }
          if (u.course_id) {
            userCourseMap[idNum] = u.course_id;
          }
          if (u.courses?.required_ojt_hours) {
              requiredHoursMap[idNum] = u.courses.required_ojt_hours;
          }
      }
  });

  // Fetch Supervisor Shifts (Both Overrides and Base)
  const overridesMap: Record<string, Record<string, any>> = {}; // supervisorId -> date -> override
  const supervisorBaseMap: Record<string, { amIn: string, amOut: string, pmIn: string, pmOut: string, otIn?: string, otOut?: string }> = {};

  if (supervisorIds.size > 0) {
      const { data: shiftsData } = await admin
        .from("shifts")
        .select("shift_name, official_start, official_end, supervisor_id")
        .in("supervisor_id", Array.from(supervisorIds));
      
      (shiftsData || []).forEach((s: any) => {
           const supId = String(s.supervisor_id);
           
           if (s.shift_name.startsWith("OVERRIDE:::")) {
               const parts = s.shift_name.split(':::');
               if (parts.length === 3) {
                   const date = parts[1];
                   const type = parts[2]; // AM or PM
                   
                   if (!overridesMap[supId]) overridesMap[supId] = {};
                   if (!overridesMap[supId][date]) overridesMap[supId][date] = {};
                   
                   if (type === 'AM') {
                       overridesMap[supId][date].amIn = s.official_start;
                       overridesMap[supId][date].amOut = s.official_end;
                   } else if (type === 'PM') {
                       overridesMap[supId][date].pmIn = s.official_start;
                       overridesMap[supId][date].pmOut = s.official_end;
                   }
               }
           } else {
               // Base Schedule
               if (!supervisorBaseMap[supId]) {
                   supervisorBaseMap[supId] = { amIn: "", amOut: "", pmIn: "", pmOut: "" };
               }
               if (s.shift_name === "Morning Shift") {
                   supervisorBaseMap[supId].amIn = s.official_start;
                   supervisorBaseMap[supId].amOut = s.official_end;
               } else if (s.shift_name === "Afternoon Shift") {
                   supervisorBaseMap[supId].pmIn = s.official_start;
                   supervisorBaseMap[supId].pmOut = s.official_end;
               } else if (s.shift_name === "Overtime Shift") {
                   supervisorBaseMap[supId].otIn = s.official_start;
                   supervisorBaseMap[supId].otOut = s.official_end;
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
    let totalMs = 0; // Validated only
    let allMs = 0;   // All logs

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
      const supBase = supervisorBaseMap[supervisorId];

      // Coordinator Override Logic
      const coordEvents = coordinatorEventsMap[dayKey];
      let coordOverride = null;
      if (coordEvents) {
          const studentCourseId = userCourseMap[id];
          // Priority: Course-specific > Institution-wide
          const specific = coordEvents.find((e: any) => e.courses_id && e.courses_id.includes(studentCourseId));
          const general = coordEvents.find((e: any) => !e.courses_id || e.courses_id.length === 0);
          coordOverride = specific || general;
      }

      // Priority: Coordinator > Override > Supervisor Config > Global Config > Default
      let amInVal, amOutVal, pmInVal, pmOutVal, otInVal, otOutVal;

      if (coordOverride) {
        amInVal = coordOverride.am_in || "";
        amOutVal = coordOverride.am_out || "";
        pmInVal = coordOverride.pm_in || "";
        pmOutVal = coordOverride.pm_out || "";
        otInVal = coordOverride.overtime_in || "";
        otOutVal = coordOverride.overtime_out || "";
      } else {
        amInVal = override?.amIn || supBase?.amIn || amCfg?.start || "08:00";
        amOutVal = override?.amOut || supBase?.amOut || amCfg?.end || "12:00";
        pmInVal = override?.pmIn || supBase?.pmIn || pmCfg?.start || "13:00";
        pmOutVal = override?.pmOut || supBase?.pmOut || pmCfg?.end || "17:00";
        otInVal = supBase?.otIn || otCfg?.start || "17:00";
        otOutVal = supBase?.otOut || otCfg?.end || "20:00";
      }
      
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

      // 1. Validated Logs
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
                if (log.rendered_hours != null && Number(log.rendered_hours) >= 0) {
                    totalMs += Number(log.rendered_hours) * 3600000;
                } else if (log.official_time_in && log.official_time_out) {
                     try {
                         const dateBase = new Date(currentIn.ts);
                         const parseTime = (t: string) => {
                             const [h, m, s] = t.split(':').map(Number);
                             const d = new Date(dateBase);
                             d.setHours(h, m, s || 0, 0);
                             return d;
                         };
                         const offIn = parseTime(log.official_time_in);
                         const offOut = parseTime(log.official_time_out);
                         if (offOut.getTime() < offIn.getTime()) offOut.setDate(offOut.getDate() + 1);
                         
                         totalMs += calculateHoursWithinOfficialTime(
                             new Date(currentIn.ts), 
                             new Date(log.ts), 
                             offIn, 
                             offOut
                         );
                     } catch (e) {
                        totalMs += calculateSessionDuration(currentIn.ts, log.ts, 'am', schedule);
                        totalMs += calculateSessionDuration(currentIn.ts, log.ts, 'pm', schedule);
                        totalMs += calculateSessionDuration(currentIn.ts, log.ts, 'ot', schedule);
                     }
                } else {
                    totalMs += calculateSessionDuration(currentIn.ts, log.ts, 'am', schedule);
                    totalMs += calculateSessionDuration(currentIn.ts, log.ts, 'pm', schedule);
                    totalMs += calculateSessionDuration(currentIn.ts, log.ts, 'ot', schedule);
                }
                currentIn = null;
            }
        }
      }

      // Handle trailing IN (Validated)
      if (currentIn && isPastDate) {
           const shift = determineShift(currentIn.ts, schedule);
           const outTs = shift === 'am' ? schedule.amOut : shift === 'pm' ? schedule.pmOut : schedule.otEnd;
           
           totalMs += calculateSessionDuration(currentIn.ts, outTs, 'am', schedule);
           totalMs += calculateSessionDuration(currentIn.ts, outTs, 'pm', schedule);
           totalMs += calculateSessionDuration(currentIn.ts, outTs, 'ot', schedule);
      }

      // 2. All Logs (Including Pending)
      let currentInAll: AttendanceEvent | null = null;
      for (const log of sortedLogs) {
        // No isApproved check
        if (log.type === 'in') {
            if (currentInAll) {
                if (isPastDate) {
                    const shift = determineShift(currentInAll.ts, schedule);
                    const outTs = shift === 'am' ? schedule.amOut : shift === 'pm' ? schedule.pmOut : schedule.otEnd;
                    allMs += calculateSessionDuration(currentInAll.ts, outTs, 'am', schedule);
                    allMs += calculateSessionDuration(currentInAll.ts, outTs, 'pm', schedule);
                    allMs += calculateSessionDuration(currentInAll.ts, outTs, 'ot', schedule);
                }
            }
            currentInAll = log;
        } else if (log.type === 'out') {
            if (currentInAll) {
                if (log.validated_hours != null && Number(log.validated_hours) >= 0) {
                    allMs += Number(log.validated_hours) * 3600000;
                } else if (log.rendered_hours != null && Number(log.rendered_hours) >= 0) {
                    allMs += Number(log.rendered_hours) * 3600000;
                } else if (log.official_time_in && log.official_time_out) {
                     try {
                         const dateBase = new Date(currentInAll.ts);
                         const parseTime = (t: string) => {
                             const [h, m, s] = t.split(':').map(Number);
                             const d = new Date(dateBase);
                             d.setHours(h, m, s || 0, 0);
                             return d;
                         };
                         const offIn = parseTime(log.official_time_in);
                         const offOut = parseTime(log.official_time_out);
                         if (offOut.getTime() < offIn.getTime()) offOut.setDate(offOut.getDate() + 1);
                         
                         allMs += calculateHoursWithinOfficialTime(
                             new Date(currentInAll.ts), 
                             new Date(log.ts), 
                             offIn, 
                             offOut
                         );
                     } catch (e) {
                        allMs += calculateSessionDuration(currentInAll.ts, log.ts, 'am', schedule);
                        allMs += calculateSessionDuration(currentInAll.ts, log.ts, 'pm', schedule);
                        allMs += calculateSessionDuration(currentInAll.ts, log.ts, 'ot', schedule);
                     }
                } else {
                    allMs += calculateSessionDuration(currentInAll.ts, log.ts, 'am', schedule);
                    allMs += calculateSessionDuration(currentInAll.ts, log.ts, 'pm', schedule);
                    allMs += calculateSessionDuration(currentInAll.ts, log.ts, 'ot', schedule);
                }
                currentInAll = null;
            }
        }
      }
      
      // Handle trailing IN (All)
      if (currentInAll && isPastDate) {
           const shift = determineShift(currentInAll.ts, schedule);
           const outTs = shift === 'am' ? schedule.amOut : shift === 'pm' ? schedule.pmOut : schedule.otEnd;
           allMs += calculateSessionDuration(currentInAll.ts, outTs, 'am', schedule);
           allMs += calculateSessionDuration(currentInAll.ts, outTs, 'pm', schedule);
           allMs += calculateSessionDuration(currentInAll.ts, outTs, 'ot', schedule);
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
    totalSummary[id] = allMs;
  });

  // Recent reports (last 7 days, exclude drafts)
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const { data: reportsData } = await admin
    .from("reports")
    .select(`
      id, title, content, created_at, status,
      students (idnumber)
    `)
    .gte("created_at", new Date(sevenDaysAgo).toISOString())
    .neq("status", "draft")
    .order("created_at", { ascending: false });

  const recentReports = (reportsData || []).map((r: any) => ({
    id: r.id,
    idnumber: r.students?.idnumber,
    title: r.title || "(Untitled)",
    body: r.content || "",
    ts: r.created_at ? new Date(r.created_at).getTime() : 0,
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
    totalSummary,
    requiredHoursMap,
    activeSessions, 
    recentAttendance, 
    recentReports, 
    overtimeShifts,
    studentSchedules: scheduleLookup,
    overrides: overridesMap,
    userSupervisorMap,
    debug: {
        recordCount: (data || []).length,
        schoolYearId: targetSyId,
        groupedKeys: Object.keys(grouped),
        sampleRow: (data || []).length > 0 ? data[0] : null,
    }
  });
  } catch (e) {
    console.error("Summary API Error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
