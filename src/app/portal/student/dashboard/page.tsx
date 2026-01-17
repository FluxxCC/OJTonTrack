"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardView, StudentHeader, StudentBottomNav } from "../ui";
import type { ReportEntry } from "../ui";
function normalizeTimeString(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parts = String(raw).split(":");
  if (parts.length < 2) return null;
  const h = parts[0]?.padStart(2, "0");
  const m = parts[1]?.padStart(2, "0");
  if (!h || !m) return null;
  return `${h}:${m}`;
}

function timeStringToMinutes(raw: string | null | undefined): number {
  const t = normalizeTimeString(raw);
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

type AttendanceEntry = { type: "in" | "out"; timestamp: number; photoDataUrl: string; status?: "Pending" | "Approved"; validatedAt?: number };
type ReportEntryLegacy = { text: string; fileName?: string; fileType?: string; submittedAt: number; timestamp?: number };
type StoredSchedule = {
  amIn?: string;
  amOut?: string;
  pmIn?: string;
  pmOut?: string;
  overtimeIn?: string;
  overtimeOut?: string;
};
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

type ServerAttendanceEntry = { type: "in" | "out"; ts: number; photourl: string; status?: string; validated_by?: string | null };

export default function StudentDashboardPage() {
  const router = useRouter();
  const [student, setStudent] = useState<User | null>(null);
  const [supervisor, setSupervisor] = useState<User | null>(null);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [targetHours, setTargetHours] = useState<number>(486);
  const [dbSchedule, setDbSchedule] = useState<{ amIn: string; amOut: string; pmIn: string; pmOut: string; otIn?: string; otOut?: string } | null>(null);
  const [schedule, setSchedule] = useState<{ amIn: string; amOut: string; pmIn: string; pmOut: string; otIn?: string; otOut?: string } | null>(null);
  const idnumber = useMemo(() => {
    if (typeof window === "undefined") return "";
    try { return localStorage.getItem("idnumber") || ""; } catch { return ""; }
  }, []);

  useEffect(() => {
    if (!idnumber) return;
    let active = true;
    const loadAttendance = async () => {
      try {
        const res = await fetch(`/api/attendance?idnumber=${encodeURIComponent(idnumber)}&limit=50`);
        const json = await res.json();
        if (active && res.ok && Array.isArray(json.entries)) {
          const mapped = json.entries.map((e: any) => {
            const sStr = String(e.status || "").trim().toLowerCase();
            const isRejected = sStr === "rejected";
            const isApproved = sStr === "approved" || (!!e.validated_by && !isRejected);
            const status = isRejected ? "Rejected" : isApproved ? "Approved" : "Pending";
            const validatedAtNum = e.validated_at ? Number(new Date(e.validated_at).getTime()) : undefined;
            return {
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

  const formatHours = (ms: number) => {
    if (!ms) return "0h 0m 0s";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/shifts", { cache: "no-store" });
        const json = await res.json();
        const data = json.shifts;
        if (!Array.isArray(data) || data.length === 0) return;
        const rows = data.filter((r: any) => r && (r.official_start || r.official_end));
        if (rows.length === 0) return;
        const sorted = rows
          .slice()
          .sort(
            (a: any, b: any) =>
              timeStringToMinutes(a.official_start || "") -
              timeStringToMinutes(b.official_start || "")
          );
        let amRow = sorted[0];
        let pmRow = sorted[1] || sorted[0];
        const findByName = (match: (name: string) => boolean) =>
          rows.find((r: any) => {
            const n = String(r.shift_name || "").toLowerCase().trim();
            return match(n);
          });
        const amCandidate = findByName((n) => n.includes("am") || n.includes("morning"));
        const pmCandidate = findByName((n) => n.includes("pm") || n.includes("afternoon"));
        const otCandidate = findByName((n) => n === "overtime shift" || n === "overtime");
        if (amCandidate && pmCandidate) {
          amRow = amCandidate;
          pmRow = pmCandidate;
        }
        let finalOtRow = otCandidate;
        if (finalOtRow && (finalOtRow === amRow || finalOtRow === pmRow)) {
          finalOtRow = undefined;
        }
        const amInNorm = normalizeTimeString(amRow.official_start || "");
        const amOutNorm = normalizeTimeString(amRow.official_end || "");
        const pmInNorm = normalizeTimeString(pmRow.official_start || "");
        const pmOutNorm = normalizeTimeString(pmRow.official_end || "");
        const otInNorm = normalizeTimeString(finalOtRow?.official_start || "");
        const otOutNorm = normalizeTimeString(finalOtRow?.official_end || "");
        if (!amInNorm || !amOutNorm || !pmInNorm || !pmOutNorm) return;
        const next = {
          amIn: amInNorm,
          amOut: amOutNorm,
          pmIn: pmInNorm,
          pmOut: pmOutNorm,
          otIn: otInNorm || undefined,
          otOut: otOutNorm || undefined,
        };
        if (!cancelled) {
          setDbSchedule(next);
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let fromLocal: StoredSchedule | null = null;

        if (typeof window !== "undefined") {
          const key = idnumber ? `schedule_${idnumber}` : "schedule_default";
          const saved = localStorage.getItem(key) || localStorage.getItem("schedule_default");
          if (saved) {
            const parsed = JSON.parse(saved) as StoredSchedule;
            fromLocal = parsed;
          }
        }

        if (fromLocal) {
          const next = {
            amIn: fromLocal.amIn || "",
            amOut: fromLocal.amOut || "",
            pmIn: fromLocal.pmIn || "",
            pmOut: fromLocal.pmOut || "",
            otIn: fromLocal.overtimeIn,
            otOut: fromLocal.overtimeOut,
          };
          if (!cancelled) setSchedule(next);
          return;
        }

        const res = await fetch("/api/shifts", { cache: "no-store" });
        const json = await res.json();
        const rows = Array.isArray(json.shifts)
          ? json.shifts.filter((r: any) => r && (r.official_start || r.official_end))
          : [];
        if (!rows.length) return;

        const sorted = rows
          .slice()
          .sort(
            (a: any, b: any) =>
              timeStringToMinutes(a.official_start || "") -
              timeStringToMinutes(b.official_start || "")
          );

        let amRow = sorted[0];
        let pmRow = sorted[1] || sorted[0];

        const findByName = (match: (name: string) => boolean) =>
          rows.find((r: any) => {
            const n = String(r.shift_name || "").toLowerCase().trim();
            return match(n);
          });

        const amCandidate = findByName((n) => n.includes("am") || n.includes("morning"));
        const pmCandidate = findByName((n) => n.includes("pm") || n.includes("afternoon"));
        const otCandidate = findByName((n) => n === "overtime shift" || n === "overtime");

        if (amCandidate && pmCandidate) {
          amRow = amCandidate;
          pmRow = pmCandidate;
        }

        let finalOtRow = otCandidate;
        if (finalOtRow && (finalOtRow === amRow || finalOtRow === pmRow)) {
          finalOtRow = undefined;
        }

        const amInNorm = normalizeTimeString(amRow.official_start || "");
        const amOutNorm = normalizeTimeString(amRow.official_end || "");
        const pmInNorm = normalizeTimeString(pmRow.official_start || "");
        const pmOutNorm = normalizeTimeString(pmRow.official_end || "");
        const otInNorm = normalizeTimeString(finalOtRow?.official_start || "");
        const otOutNorm = normalizeTimeString(finalOtRow?.official_end || "");
        if (!amInNorm || !amOutNorm || !pmInNorm || !pmOutNorm) return;

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
          if (typeof window !== "undefined") {
            const key = idnumber ? `schedule_${idnumber}` : "schedule_default";
            const payload = {
              amIn: next.amIn,
              amOut: next.amOut,
              pmIn: next.pmIn,
              pmOut: next.pmOut,
              overtimeIn: next.otIn,
              overtimeOut: next.otOut,
            };
            try {
              localStorage.setItem(key, JSON.stringify(payload));
            } catch {}
          }
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [idnumber]);

  const aggregateHours = useMemo(() => {
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
      const dayLogs = day.logs.slice().sort((a, b) => a.timestamp - b.timestamp);

      const effectiveSchedule = dbSchedule || schedule;

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

        totalMsAll += dayRawMs;
        totalValidatedMsAll += dayValidatedRawMs;
        return;
      }

      const baseDate = new Date(day.date);
      baseDate.setHours(0, 0, 0, 0);

      const buildShift = (timeStr: string | undefined) => {
        if (!timeStr) return null;
        const [h, m] = timeStr.split(":").map(Number);
        const d = new Date(baseDate.getTime());
        d.setHours(h || 0, m || 0, 0, 0);
        return d.getTime();
      };

      const amInMs = buildShift(effectiveSchedule.amIn);
      const amOutMs = buildShift(effectiveSchedule.amOut);
      const pmInMs = buildShift(effectiveSchedule.pmIn);
      const pmOutMs = buildShift(effectiveSchedule.pmOut);
      const otInMs = buildShift(effectiveSchedule.otIn);
      const otOutMs = buildShift(effectiveSchedule.otOut);

      const computeShiftDuration = (
        logs: AttendanceEntry[],
        windowStart: number | null,
        windowEnd: number | null,
        requireApproved: boolean
      ) => {
        if (windowStart === null || windowEnd === null) return 0;
        const earlyWindowStart = windowStart - 30 * 60 * 1000;
        let currentIn: number | null = null;
        let duration = 0;

        logs.forEach(log => {
          if (requireApproved && log.status !== "Approved") {
            return;
          }
          if (log.type === "in") {
            if (log.timestamp > windowEnd) return;
            if (log.timestamp < earlyWindowStart) return;
            const effectiveIn = Math.min(Math.max(log.timestamp, windowStart), windowEnd);
            currentIn = effectiveIn;
          } else if (log.type === "out") {
            if (currentIn === null) return;
            const effectiveOut = Math.min(Math.max(log.timestamp, windowStart), windowEnd);
            if (effectiveOut > currentIn) {
              duration += effectiveOut - currentIn;
            }
            currentIn = null;
          }
        });

        return duration;
      };

      const dayTotalMs =
        (amInMs && amOutMs ? computeShiftDuration(dayLogs, amInMs, amOutMs, false) : 0) +
        (pmInMs && pmOutMs ? computeShiftDuration(dayLogs, pmInMs, pmOutMs, false) : 0) +
        (otInMs && otOutMs ? computeShiftDuration(dayLogs, otInMs, otOutMs, false) : 0);

      const dayValidatedMs =
        (amInMs && amOutMs ? computeShiftDuration(dayLogs, amInMs, amOutMs, true) : 0) +
        (pmInMs && pmOutMs ? computeShiftDuration(dayLogs, pmInMs, pmOutMs, true) : 0) +
        (otInMs && otOutMs ? computeShiftDuration(dayLogs, otInMs, otOutMs, true) : 0);

      totalMsAll += dayTotalMs;
      totalValidatedMsAll += dayValidatedMs;
    });

    return {
      totalMs: totalMsAll,
      validatedMs: totalValidatedMsAll,
    };
  }, [attendance, idnumber, schedule, dbSchedule]);

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
