import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

type AttendanceEvent = {
  type: string;
  ts: number;
  status: string;
  validated_by?: string | null;
  validated_at?: number | null;
};

export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

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

  Object.keys(grouped).forEach(id => {
    const events: AttendanceEvent[] = grouped[id];
    let totalMs = 0;

    const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

    const isApproved = (e: AttendanceEvent) => {
      const st = String(e.status || "").toUpperCase();
      return st === "APPROVED" || st === "VALIDATED" || !!e.validated_by;
    };

    const floorToMin = (ms: number) => Math.floor(ms / 60000) * 60000;

    const findPairDuration = (logs: AttendanceEvent[], windowStart: number, windowEnd: number) => {
      let currentIn: number | null = null;
      let duration = 0;

      // Use a buffer window to catch early logins/late logouts
      // 30 mins buffer for start, 4 hours for end (clamped)
      const BUFFER_START_MS = 30 * 60 * 1000;
      const BUFFER_END_MS = 4 * 60 * 60 * 1000;
      const searchStart = windowStart - BUFFER_START_MS;
      const searchEnd = windowEnd + BUFFER_END_MS;

      logs.forEach(log => {
        if (log.ts < searchStart || log.ts > searchEnd) return;
        if (!isApproved(log)) return;
        
        // Floor timestamp to minute (exclude seconds/ms) BEFORE calculation
        const flooredTs = floorToMin(log.ts);

        if (log.type === "in") {
          if (flooredTs > windowEnd) {
             currentIn = null;
             return;
          }
          currentIn = clamp(flooredTs, windowStart, windowEnd);
        } else if (log.type === "out") {
          if (currentIn === null) return;
          const effectiveOut = clamp(flooredTs, windowStart, windowEnd);
          if (effectiveOut > currentIn) {
            duration += effectiveOut - currentIn;
          }
          currentIn = null;
        }
      });

      return duration;
    };

    const byDay: { [dayKey: string]: { date: Date; logs: AttendanceEvent[] } } = {};
    events.forEach(ev => {
      const date = new Date(ev.ts);
      const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const key = day.toISOString();
      if (!byDay[key]) byDay[key] = { date: day, logs: [] as typeof events };
      byDay[key].logs.push(ev);
    });

    // Helper to parse "HH:MM"
    const parseTime = (t: string | undefined, defaultH: number, defaultM: number) => {
      if (!t) return { h: defaultH, m: defaultM };
      const [h, m] = t.split(':').map(Number);
      return { h: isNaN(h) ? defaultH : h, m: isNaN(m) ? defaultM : m };
    };

    // Parse configured shifts or use defaults
    const amCfg = shiftConfig["Morning Shift"];
    const pmCfg = shiftConfig["Afternoon Shift"];
    const otCfg = shiftConfig["Overtime Shift"];

    const amStartT = parseTime(amCfg?.start, 8, 0);
    const amEndT = parseTime(amCfg?.end, 12, 0);
    const pmStartT = parseTime(pmCfg?.start, 13, 0);
    const pmEndT = parseTime(pmCfg?.end, 17, 0);
    // Default OT is 17:00 - 20:00 if not configured
    const otStartT = parseTime(otCfg?.start, 17, 0);
    const otEndT = parseTime(otCfg?.end, 20, 0);

    Object.values(byDay).forEach(day => {
      const baseDate = new Date(day.date.getTime());
      baseDate.setHours(0, 0, 0, 0);

      const buildShift = (t: { h: number, m: number }) => {
        const d = new Date(baseDate.getTime());
        d.setHours(t.h, t.m, 0, 0);
        return d.getTime();
      };

      const amIn = buildShift(amStartT);
      const amOut = buildShift(amEndT);
      const pmIn = buildShift(pmStartT);
      const pmOut = buildShift(pmEndT);
      const otStartStatic = buildShift(otStartT);
      const otEndStatic = buildShift(otEndT);

      // Determine correct OT window for this day/student
      const dateStr = day.date.toLocaleDateString('en-CA'); // YYYY-MM-DD
      let otStart = 0;
      let otEnd = 0;
      
      const dynamicOt = otLookup[id]?.[dateStr];
      if (dynamicOt) {
          otStart = dynamicOt.start;
          otEnd = dynamicOt.end;
      }
      
      const dayLogs = day.logs.slice().sort((a, b) => a.ts - b.ts);

      const dayValidatedAm = findPairDuration(dayLogs, amIn, amOut);
      const dayValidatedPm = findPairDuration(dayLogs, pmIn, pmOut);
      
      // Only calculate OT if dynamic authorization exists (Strict)
      let dayValidatedOt = 0;
      if (otStart > 0 && otEnd > 0) {
          dayValidatedOt = findPairDuration(dayLogs, otStart, otEnd);
      }

      totalMs += dayValidatedAm + dayValidatedPm + dayValidatedOt;
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

  return NextResponse.json({ summary, activeSessions, recentAttendance, recentReports, overtimeShifts });
}
