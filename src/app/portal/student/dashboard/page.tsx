"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardView, StudentHeader, StudentBottomNav } from "../ui";
import type { ReportEntry } from "../ui";

import { calculateSessionDuration, determineShift, ShiftSchedule, normalizeTimeString, timeStringToMinutes, formatHours, buildSchedule, calculateShiftDurations, calculateHoursWithinOfficialTime } from "@/lib/attendance";

type AttendanceEntry = { id?: number; type: "in" | "out"; timestamp: number; photoDataUrl: string; status?: "Pending" | "Approved" | "Rejected"; validatedAt?: number; rendered_hours?: number; validated_hours?: number; official_time_in?: string; official_time_out?: string; validated_by?: string };
type ReportEntryLegacy = { text: string; fileName?: string; fileType?: string; submittedAt: number; timestamp?: number };

type User = {
  id: number;
  idnumber: string;
  role: string;
  firstname?: string;
  middlename?: string;
  lastname?: string;
  course?: string;
  section?: string;
  supervisorid?: string;
  company?: string;
  location?: string;
};

type AttendanceEntryRaw = {
  id: string | number;
  type: "in" | "out";
  ts: number;
  photourl: string;
  status?: string;
  validated_by?: string;
  validated_at?: string;
  rendered_hours?: number;
  validated_hours?: number;
  official_time_in?: string | null;
  official_time_out?: string | null;
};

type ShiftRaw = {
  official_start?: string;
  official_end?: string;
  shift_name?: string;
};

export default function StudentDashboardPage() {
  const router = useRouter();
  const [student, setStudent] = useState<User | null>(null);
  const [supervisor, setSupervisor] = useState<User | null>(null);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [targetHours, setTargetHours] = useState<number>(486);
  const [schedule, setSchedule] = useState<{ amIn: string; amOut: string; pmIn: string; pmOut: string; otIn?: string; otOut?: string } | null>(null);
  const [overtimeShifts, setOvertimeShifts] = useState<{ effective_date: string; overtime_start: number; overtime_end: number }[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const idnumber = useMemo(() => {
    if (typeof window === "undefined") return "";
    try { return localStorage.getItem("idnumber") || ""; } catch { return ""; }
  }, []);

  /*
  useEffect(() => {
    setInterval(() => {
      setNow(Date.now());
    }, 60000);
  }, []);
  */

  useEffect(() => {
    if (!idnumber) return;
    let active = true;
    const loadAttendance = async () => {
      try {
        // Use exclude_photo=true to speed up fetching for dashboard stats
        const res = await fetch(`/api/attendance?idnumber=${encodeURIComponent(idnumber)}&limit=1000&exclude_photo=true`, { cache: "no-store" });
        const json = await res.json();
        if (active && res.ok && Array.isArray(json.entries)) {
          const mapped = json.entries.map((e: AttendanceEntryRaw) => {
            const sStr = String(e.status || "").trim().toLowerCase();
            const isRejected = sStr === "rejected";
            const isApproved = sStr === "approved" || (!!e.validated_by && !isRejected);
            const status = isRejected ? "Rejected" : isApproved ? "Approved" : "Pending";
            const validatedAtNum = e.validated_at ? Number(new Date(e.validated_at).getTime()) : undefined;
            return {
              id: Number(e.id),
              type: e.type,
              timestamp: e.ts,
              photoDataUrl: e.photourl,
              status,
              validatedAt: validatedAtNum,
              rendered_hours: e.rendered_hours,
              validated_hours: e.validated_hours,
              official_time_in: e.official_time_in || undefined,
              official_time_out: e.official_time_out || undefined,
              validated_by: e.validated_by || undefined,
            };
          }) as AttendanceEntry[];
          setAttendance(mapped);
        }
      } catch {}
    };
    const loadReportsAndTarget = async () => {
      try {
        const res = await fetch(`/api/reports?idnumber=${encodeURIComponent(idnumber)}`, { cache: "no-store" });
        const json = await res.json();
        if (active && res.ok && Array.isArray(json.reports)) {
          setReports(json.reports);
        }
      } catch {}
      try {
        const t = Number(localStorage.getItem("targetHours") || "");
        if (!Number.isNaN(t) && t > 0) setTargetHours(t);
      } catch {}
      try {
          const res = await fetch(`/api/overtime?student_id=${encodeURIComponent(idnumber)}`, { cache: "no-store" });
          const json = await res.json();
          if (active && res.ok && Array.isArray(json.overtime_shifts)) {
             setOvertimeShifts(json.overtime_shifts.map((s: any) => ({
                 ...s,
                 overtime_start: Number(s.overtime_start),
                 overtime_end: Number(s.overtime_end)
             })));
           }
      } catch {}
    };
    loadAttendance();
    loadReportsAndTarget();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        loadAttendance();
        loadReportsAndTarget();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    const iv = setInterval(loadAttendance, 10000);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(iv);
    };
  }, [idnumber]);

  useEffect(() => {
    (async () => {
      if (!idnumber) return;
      try {
        const res = await fetch(`/api/users?idnumber=${encodeURIComponent(idnumber)}`);
        const json = await res.json();
        if (Array.isArray(json.users) && json.users.length > 0) {
          const me = json.users[0];
          setStudent(me);
          if (me && typeof (me as any).target_hours === "number" && (me as any).target_hours > 0) {
            setTargetHours(Number((me as any).target_hours));
            try { localStorage.setItem("targetHours", String((me as any).target_hours)); } catch {}
          }
          if ((me as any).users_supervisors) {
              const joinedSup = (me as any).users_supervisors;
              setSupervisor({
                  id: Number(me.supervisorid) || 0,
                  idnumber: joinedSup.idnumber,
                  role: 'supervisor',
                  firstname: joinedSup.firstname,
                  lastname: joinedSup.lastname,
                  company: joinedSup.company,
                  location: joinedSup.location
              } as User);
          }
        }
      } catch {}
    })();
  }, [idnumber]);





  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Wait for student profile to be loaded to get supervisor ID
        if (!student && idnumber) {
           // If student data isn't loaded yet, we can't determine supervisor_id
           // The effect will re-run when student state updates
           return;
        }

        const res = await fetch(`/api/shifts${student?.supervisorid ? `?supervisor_id=${encodeURIComponent(student.supervisorid)}` : ''}`, { cache: "no-store" });
        const json = await res.json();
        const rows = Array.isArray(json.shifts)
          ? json.shifts.filter((r: ShiftRaw) => r && (r.official_start || r.official_end))
          : [];
        
        if (!rows.length) {
          if (!cancelled) setSchedule(null);
          return;
        }

        const sorted = rows
          .slice()
          .sort(
            (a: ShiftRaw, b: ShiftRaw) =>
              timeStringToMinutes(a.official_start || "") -
              timeStringToMinutes(b.official_start || "")
          );

        let amRow = sorted[0];
        let pmRow = sorted[1] || sorted[0];

        const findByName = (match: (name: string) => boolean) =>
          sorted.find((r: ShiftRaw) => {
            const n = String(r.shift_name || "").toLowerCase().trim();
            return match(n);
          });

        const amCandidate = findByName((n) => n.includes("am") || n.includes("morning"));
        const pmCandidate = findByName((n) => n.includes("pm") || n.includes("afternoon"));
        const otCandidate = findByName((n) => n === "overtime shift" || n === "overtime");

        let finalOtRow = otCandidate;
        if (finalOtRow && (finalOtRow === amCandidate || finalOtRow === pmCandidate)) {
          finalOtRow = undefined;
        }

        // Use defaults if not found or empty
        const amInNorm = normalizeTimeString(amCandidate?.official_start) || "";
        const amOutNorm = normalizeTimeString(amCandidate?.official_end) || "";
        const pmInNorm = normalizeTimeString(pmCandidate?.official_start) || "";
        const pmOutNorm = normalizeTimeString(pmCandidate?.official_end) || "";
        const otInNorm = normalizeTimeString(finalOtRow?.official_start);
        const otOutNorm = normalizeTimeString(finalOtRow?.official_end);

        const next = {
          amIn: amInNorm,
          amOut: amOutNorm,
          pmIn: pmInNorm,
          pmOut: pmOutNorm,
          otIn: otInNorm || undefined,
          otOut: otOutNorm || undefined,
        };

        if (!cancelled) {
          setSchedule(next);
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [idnumber, student]);

  const aggregateHours = useMemo(() => {
    // Group by date
    const grouped = new Map<string, { date: Date; logs: AttendanceEntry[] }>();
    attendance.forEach(log => {
      const d = new Date(log.timestamp);
      const key = d.toLocaleDateString();
      if (!grouped.has(key)) grouped.set(key, { date: d, logs: [] });
      grouped.get(key)!.logs.push(log);
    });

    let totalMsAll = 0;
    let totalValidatedMsAll = 0;

    Array.from(grouped.values()).forEach(day => {
        // Deduplicate logs
        const uniqueMap = new Map<string, AttendanceEntry>();
        day.logs.forEach(l => {
            const key = l.id ? String(l.id) : `${l.timestamp}-${l.type}`;
            if (!uniqueMap.has(key)) uniqueMap.set(key, l);
        });
        const sorted = Array.from(uniqueMap.values()).sort((a, b) => a.timestamp - b.timestamp);

        const baseDate = new Date(day.date);
        baseDate.setHours(0, 0, 0, 0);

        // Build Schedule
        const effectiveSchedule = (() => {
             const dateKey = day.date.toLocaleDateString('en-CA');
             const dynamicOt = overtimeShifts.find(s => s.effective_date === dateKey);
             
             return buildSchedule(
                baseDate,
                {
                    amIn: schedule?.amIn || "08:00",
                    amOut: schedule?.amOut || "12:00",
                    pmIn: schedule?.pmIn || "13:00",
                    pmOut: schedule?.pmOut || "17:00",
                    otIn: schedule?.otIn,
                    otOut: schedule?.otOut
                },
                dynamicOt ? { start: Number(dynamicOt.overtime_start), end: Number(dynamicOt.overtime_end) } : undefined
             );
        })();

        // Slot Logic (Copied from Supervisor/Student UI)
        const usedIds = new Set<string>();
        const isAvailable = (l: AttendanceEntry) => {
            const key = l.id ? String(l.id) : `${l.timestamp}-${l.type}`;
            return !usedIds.has(key);
        };
        const markUsed = (l: AttendanceEntry) => {
            const key = l.id ? String(l.id) : `${l.timestamp}-${l.type}`;
            usedIds.add(key);
        };

        let s1: AttendanceEntry | null = null;
        let s3: AttendanceEntry | null = null;
        let s5: AttendanceEntry | null = null;

        const amOutTs = effectiveSchedule.amOut || new Date(baseDate).setHours(12, 0, 0, 0);
        const pmInTs = effectiveSchedule.pmIn || new Date(baseDate).setHours(13, 0, 0, 0);
        const midDayCutoff = (amOutTs + pmInTs) / 2;
        const pmOutTs = effectiveSchedule.pmOut || new Date(baseDate).setHours(17, 0, 0, 0);
        const otCutoff = effectiveSchedule.otStart ? effectiveSchedule.otStart - (30 * 60000) : pmOutTs + (30 * 60000);

        // 1. Identify Start Points (INs)
        sorted.filter(l => l.type === 'in' && isAvailable(l)).forEach(l => {
             if (!s1 && l.timestamp < midDayCutoff) { s1 = l; markUsed(l); return; }
             if (!s3 && l.timestamp >= midDayCutoff && l.timestamp < otCutoff) { s3 = l; markUsed(l); return; }
             if (!s5 && l.timestamp >= otCutoff) { s5 = l; markUsed(l); return; }
        });
        // Fallback fill
        sorted.filter(l => l.type === 'in' && isAvailable(l)).forEach(l => {
             if (!s1) { s1 = l; markUsed(l); }
             else if (!s3) { s3 = l; markUsed(l); }
             else if (!s5) { s5 = l; markUsed(l); }
        });

        // Helper for virtual auto-out
        const today = new Date();
        today.setHours(0,0,0,0);
        const isPastDate = baseDate < today;
        const createVirtualOut = (inEntry: AttendanceEntry, shift: 'am' | 'pm' | 'ot'): AttendanceEntry => {
             const outTs = shift === 'am' ? effectiveSchedule.amOut : (shift === 'pm' ? effectiveSchedule.pmOut : effectiveSchedule.otEnd);
             const finalOutTs = outTs > inEntry.timestamp ? outTs : inEntry.timestamp + 60000;
             return {
                  id: inEntry.id ? -inEntry.id : -Math.floor(Math.random() * 1000000),
                  type: 'out',
                  timestamp: finalOutTs,
                  photoDataUrl: '',
                  status: 'Pending'
             } as any;
        };

        // 2. Identify End Points (OUTs)
        let s2: AttendanceEntry | null = null;
        if (s1) {
            const searchEnd = s3 ? (s3 as AttendanceEntry).timestamp : (new Date(baseDate).setHours(23, 59, 59, 999));
            const candidates = sorted.filter(l => l.type === "out" && l.timestamp > (s1 as AttendanceEntry).timestamp && l.timestamp < searchEnd && isAvailable(l));
            s2 = candidates.pop() || null;
            if (s2) markUsed(s2);
            else if (isPastDate) s2 = createVirtualOut(s1, 'am');
        }

        let s4: AttendanceEntry | null = null;
        if (s3) {
            const searchEnd = s5 ? (s5 as AttendanceEntry).timestamp : (new Date(baseDate).setHours(23, 59, 59, 999));
            const candidates = sorted.filter(l => l.type === "out" && l.timestamp > (s3 as AttendanceEntry).timestamp && l.timestamp < searchEnd && isAvailable(l));
            s4 = candidates.pop() || null;
            if (s4) markUsed(s4);
            else if (isPastDate) s4 = createVirtualOut(s3, 'pm');
        }

        let s6: AttendanceEntry | null = null;
        if (s5) {
            const candidates = sorted.filter(l => l.type === "out" && l.timestamp > (s5 as AttendanceEntry).timestamp && isAvailable(l));
            s6 = candidates.pop() || null;
            if (s6) markUsed(s6);
            else if (isPastDate) s6 = createVirtualOut(s5, 'ot');
        }

        // 3. Calculate Hours
        // We compute two totals:
        // - rawMs: simple sum of (out.timestamp - in.timestamp) for each pair (tracked)
        // - validatedMs: follows the Golden Rule and snapshot precedence (validated)
        const calcValidated = (requireApproved: boolean) => {
           const calc = (inLog: AttendanceEntry | null, outLog: AttendanceEntry | null, shift: 'am' | 'pm' | 'ot') => {
              if (!inLog || !outLog) return 0;
              if (inLog.status === 'Rejected' || outLog.status === 'Rejected') return 0;

              if (requireApproved) {
                const inOk = ["Approved", "Validated", "VALIDATED", "OFFICIAL", "ADJUSTED", "Official"].includes(inLog.status || "");
                const outOk = ["Approved", "Validated", "VALIDATED", "OFFICIAL", "ADJUSTED", "Official"].includes(outLog.status || "");
                if (!inOk || !outOk) return 0;
              }

              // After approval gate, only use ledger validated_hours
              if (outLog.validated_hours !== undefined && outLog.validated_hours !== null && Number(outLog.validated_hours) >= 0) {
                return Number(outLog.validated_hours) * 3600000;
              }
              return 0;
           };

           let t = 0;
           t += calc(s1, s2, 'am');
           t += calc(s3, s4, 'pm');
           t += calc(s5, s6, 'ot');
           return t;
        };

        // Total tracked time with ledger-first precedence and Golden Rule clamping
        const dayTotalMs = (() => {
          const calc = (inLog: AttendanceEntry | null, outLog: AttendanceEntry | null, shift: 'am' | 'pm' | 'ot') => {
            if (!inLog || !outLog) return 0;
            if (inLog.status === 'Rejected' || outLog.status === 'Rejected') return 0;
            const vh = (outLog as any).validated_hours;
            // Use ledger hours only if the pair is approved/validated
            const inOk = ["Approved", "Validated", "VALIDATED", "OFFICIAL", "ADJUSTED", "Official"].includes(inLog.status || "");
            const outOk = ["Approved", "Validated", "VALIDATED", "OFFICIAL", "ADJUSTED", "Official"].includes(outLog.status || "");
            if (inOk && outOk && vh !== undefined && vh !== null && Number(vh) >= 0) {
              if (shift === 'pm' && s2 && outLog.id === s2.id) return 0;
              if (shift === 'ot' && ((s2 && outLog.id === s2.id) || (s4 && outLog.id === s4.id))) return 0;
              return Number(vh) * 3600000;
            }
            // Do not use rendered_hours for totals
            // Use frozen official snapshot ONLY if the pair is approved/validated
            if (inOk && outOk && (outLog as any).official_time_in && (outLog as any).official_time_out) {
              try {
                const dateBase = new Date(inLog.timestamp);
                const parseTime = (t: string) => {
                  const parts = t.split(':').map(Number);
                  const d = new Date(dateBase);
                  d.setHours(parts[0] || 0, parts[1] || 0, parts[2] || 0, 0);
                  return d;
                };
                let offIn = parseTime((outLog as any).official_time_in);
                let offOut = parseTime((outLog as any).official_time_out);
                if (offOut.getTime() < offIn.getTime()) {
                  offOut.setDate(offOut.getDate() + 1);
                }
                return calculateHoursWithinOfficialTime(
                  new Date(inLog.timestamp),
                  new Date(outLog.timestamp),
                  offIn,
                  offOut
                );
              } catch {}
            }
            return calculateSessionDuration(inLog.timestamp, outLog.timestamp, shift, effectiveSchedule);
          };
          let t = 0;
          t += calc(s1, s2, 'am');
          t += calc(s3, s4, 'pm');
          t += calc(s5, s6, 'ot');
          return t;
        })();

        totalMsAll += dayTotalMs;
        totalValidatedMsAll += calcValidated(true);
        // Note: `calcValidated(true)` returns validated-only (requires approved statuses).
        // `calcValidated(false)` returns tracked-by-rules (pending + validated); we prefer validated-only for the validated total above.
    });

    return {
      totalMs: totalMsAll,
      validatedMs: totalValidatedMsAll,
    };
  }, [attendance, schedule, now, overtimeShifts]);

  const totalHours = useMemo(() => {
    return formatHours(aggregateHours.totalMs);
  }, [aggregateHours]);

  const totalValidatedHours = useMemo(() => {
    return formatHours(aggregateHours.validatedMs);
  }, [aggregateHours]);

  return (
    <div className="min-h-screen bg-[#F6F7F9] flex flex-col">
      <StudentHeader />
      <main className="flex-1 p-4 pb-16 md:pb-0" style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}>
        <div className="mx-auto w-full max-w-7xl">
          <DashboardView
            attendance={attendance}
            reports={reports}
            totalHours={totalHours}
            totalValidatedHours={totalValidatedHours}
            targetHours={targetHours}
            onTimeIn={() => router.push("/portal/student")}
            onTimeOut={() => router.push("/portal/student")}
            onViewAttendance={() => router.push("/portal/student")}
            onViewReports={() => router.push("/portal/student")}
            companyText={student?.company || supervisor?.company || "N/A"}
            supervisorText={
              supervisor ? `${supervisor.firstname || ""} ${supervisor.lastname || ""}`.trim() || supervisor.idnumber : "N/A"
            }
            locationText={student?.location || supervisor?.location || "N/A"}
            schedule={schedule}
            overtimeShifts={overtimeShifts}
          />
        </div>
      </main>
      <StudentBottomNav />
    </div>
  );
}
