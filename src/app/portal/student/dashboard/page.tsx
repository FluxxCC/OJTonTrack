"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardView, StudentHeader, StudentBottomNav } from "../ui";
import type { ReportEntry } from "../ui";

import { calculateSessionDuration, determineShift, ShiftSchedule, normalizeTimeString, timeStringToMinutes, formatHours, buildSchedule, calculateShiftDurations } from "@/lib/attendance";

type AttendanceEntry = { id?: number; type: "in" | "out"; timestamp: number; photoDataUrl: string; status?: "Pending" | "Approved" | "Rejected"; validatedAt?: number };
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
        const res = await fetch(`/api/attendance?idnumber=${encodeURIComponent(idnumber)}&limit=1000`, { cache: "no-store" });
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
      try {
        const res = await fetch("/api/users");
        const json = await res.json();
        if (Array.isArray(json.users)) {
          const me = json.users.find((u: User) => String(u.idnumber) === String(idnumber) && String(u.role).toLowerCase() === "student");
          if (me) {
            setStudent(me);
            if (me.supervisorid) {
              // supervisorid refers to the User.id (PK), not idnumber
              const sup = json.users.find((u: User) => String(u.role).toLowerCase() === "supervisor" && String(u.id) === String(me.supervisorid));
              if (sup) setSupervisor(sup);
            }
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
    const seen = new Set<string>();
    const uniqueAttendance = attendance.filter(a => {
      const key = a.id ? String(a.id) : `${a.timestamp}-${a.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const grouped = new Map<string, { date: Date; logs: AttendanceEntry[] }>();
    uniqueAttendance.forEach(log => {
      const d = new Date(log.timestamp);
      const key = d.toLocaleDateString();
      if (!grouped.has(key)) grouped.set(key, { date: d, logs: [] });
      grouped.get(key)!.logs.push(log);
    });

    let totalMsAll = 0;
    let totalValidatedMsAll = 0;

    Array.from(grouped.values()).forEach(day => {
      const dayLogs = day.logs.slice().sort((a, b) => a.timestamp - b.timestamp);

      const effectiveSchedule = schedule;

      if (!effectiveSchedule || (!effectiveSchedule.amIn && !effectiveSchedule.pmIn && !effectiveSchedule.otIn)) {
        let dayRawMs = 0;
        let dayValidatedRawMs = 0;
        let inTs: number | null = null;
        let approvedInTs: number | null = null;

        dayLogs.forEach(log => {
          if (log.type === "in") {
            inTs = log.timestamp;
            if (log.status === "Approved") {
              approvedInTs = log.timestamp;
            }
          } else if (log.type === "out" && inTs !== null) {
            if (log.timestamp > inTs) {
              dayRawMs += log.timestamp - inTs;
            }
            if (approvedInTs !== null && log.status === "Approved" && log.timestamp > approvedInTs) {
              dayValidatedRawMs += log.timestamp - approvedInTs;
            }
            inTs = null;
            approvedInTs = null;
          }
        });

        if (inTs !== null) {
          const liveDuration = now - inTs;
          if (liveDuration > 0) {
            dayRawMs += liveDuration;
          }
        }
        if (approvedInTs !== null) {
          const liveValidatedDuration = now - approvedInTs;
          if (liveValidatedDuration > 0) {
            dayValidatedRawMs += liveValidatedDuration;
          }
        }

        totalMsAll += dayRawMs;
        totalValidatedMsAll += dayValidatedRawMs;
        return;
      }

      const baseDate = new Date(day.date);
      baseDate.setHours(0, 0, 0, 0);

      // Check for dynamic overtime shift
      const dateKey = day.date.toLocaleDateString('en-CA');
      const dynamicOt = overtimeShifts.find(s => s.effective_date === dateKey);
      
      // Use centralized buildSchedule
      const dailySchedule = buildSchedule(
        day.date,
        effectiveSchedule,
        dynamicOt ? { start: dynamicOt.overtime_start, end: dynamicOt.overtime_end } : undefined
      );

      type Session = { in: AttendanceEntry; out: AttendanceEntry | null };
      const sessions: Session[] = [];
      let currentIn: AttendanceEntry | null = null;

      dayLogs.forEach(log => {
          if (log.status === "Rejected") return;

          if (log.type === "in") {
              if (currentIn) {
                   sessions.push({ in: currentIn, out: null });
              }
              currentIn = log;
          } else if (log.type === "out") {
              if (currentIn) {
                  sessions.push({ in: currentIn, out: log });
                  currentIn = null;
              }
          }
      });
      if (currentIn) {
          sessions.push({ in: currentIn, out: null });
      }

      let dayTotalMs = 0;
      let dayValidatedMs = 0;

      sessions.forEach(session => {
          if (!session.out) return;

          const { am, pm, ot } = calculateShiftDurations(session.in.timestamp, session.out.timestamp, dailySchedule);
          
          const sessionDuration = am + pm + ot;
          dayTotalMs += sessionDuration;

          const isInApproved = session.in.status === "Approved";
          const isOutApproved = session.out.status === "Approved";
          if (isInApproved && isOutApproved) {
              dayValidatedMs += sessionDuration;
          }
      });

      // Uniform rounding for the day total
      dayTotalMs = Math.round(dayTotalMs / 60000) * 60000;
      dayValidatedMs = Math.round(dayValidatedMs / 60000) * 60000;

      totalMsAll += dayTotalMs;
      totalValidatedMsAll += dayValidatedMs;
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
            onTimeIn={() => router.push("/portal/student/attendance")}
            onTimeOut={() => router.push("/portal/student/attendance")}
            onViewAttendance={() => router.push("/portal/student/attendance")}
            companyText={student?.company || supervisor?.company || "N/A"}
            supervisorText={
              supervisor ? `${supervisor.firstname || ""} ${supervisor.lastname || ""}`.trim() || supervisor.idnumber : "N/A"
            }
            locationText={student?.location || supervisor?.location || "N/A"}
          />
        </div>
      </main>
      <StudentBottomNav />
    </div>
  );
}
