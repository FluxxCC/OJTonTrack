"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardView, StudentHeader, StudentBottomNav } from "../ui";
import type { ReportEntry } from "../ui";

type AttendanceEntry = { type: "in" | "out"; timestamp: number; photoDataUrl: string; status?: "Pending" | "Approved"; approvedAt?: number };
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

type ServerAttendanceEntry = { type: "in" | "out"; ts: number; photourl: string; status?: string; approvedby?: string | null };

export default function StudentDashboardPage() {
  const router = useRouter();
  const [student, setStudent] = useState<User | null>(null);
  const [supervisor, setSupervisor] = useState<User | null>(null);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [targetHours, setTargetHours] = useState<number>(486);
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
            const status = String(e.status || "").trim().toLowerCase() === "approved" || !!e.approvedby ? "Approved" : "Pending";
            const approvedAtNum = e.approvedat ? Number(new Date(e.approvedat).getTime()) : undefined;
            return {
              type: e.type,
              timestamp: e.ts,
              photoDataUrl: e.photourl,
              status,
              approvedAt: approvedAtNum,
            };
          }) as AttendanceEntry[];
          setAttendance(mapped);
        }
      } catch {}
    };
    const loadReportsAndTarget = async () => {
      try {
        const res = await fetch(`/api/reports?idnumber=${encodeURIComponent(idnumber)}`);
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

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const totalHours = useMemo(() => {
    const sorted = [...attendance].sort((a, b) => a.timestamp - b.timestamp);
    const approved = sorted.filter(e => e.status === "Approved");
    let sumMs = 0;
    let activeStart = null;

    for (let i = 0; i < approved.length; i++) {
      if (approved[i].type === "in") {
        let outIndex = -1;
        for (let j = i + 1; j < approved.length; j++) {
          if (approved[j].type === "out") {
            outIndex = j;
            break;
          }
        }

        if (outIndex !== -1) {
          const inTs = approved[i].approvedAt ?? approved[i].timestamp;
          const outTs = approved[outIndex].approvedAt ?? approved[outIndex].timestamp;
          sumMs += outTs - inTs;
          i = outIndex;
        } else {
          activeStart = approved[i].approvedAt ?? approved[i].timestamp;
        }
      }
    }

    if (activeStart) {
      sumMs += Math.max(0, now - activeStart);
    }

    const totalSeconds = Math.floor(sumMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  }, [attendance, now]);

  return (
    <div className="min-h-screen bg-[#F6F7F9] flex flex-col">
      <StudentHeader />
      <main className="flex-1 p-4 pb-16 md:pb-0" style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}>
        <div className="mx-auto w-full max-w-7xl">
          <DashboardView
            attendance={attendance}
            reports={reports}
            totalHours={totalHours}
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
