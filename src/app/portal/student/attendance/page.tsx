"use client";
import React, { useEffect, useMemo, useState } from "react";
import { AttendanceView, StudentHeader, StudentBottomNav } from "../ui";

type AttendanceEntry = { type: "in" | "out"; timestamp: number; photoDataUrl: string; status?: "Pending" | "Approved" };
type ServerAttendanceEntry = { type: "in" | "out"; ts: number; photourl: string; status?: string; approvedby?: string | null };

export default function StudentAttendancePage() {
  const idnumber = useMemo(() => {
    if (typeof window === "undefined") return "";
    try { return localStorage.getItem("idnumber") || ""; } catch { return ""; }
  }, []);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);

  useEffect(() => {
    if (!idnumber) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/attendance?idnumber=${encodeURIComponent(idnumber)}&limit=50`);
        const json = await res.json();
        if (active && res.ok && Array.isArray(json.entries)) {
          const mapped = json.entries.map((e: ServerAttendanceEntry) => {
            const status = String(e.status || "").trim().toLowerCase() === "approved" || !!e.approvedby ? "Approved" : "Pending";
            return {
              type: e.type,
              timestamp: e.ts,
              photoDataUrl: e.photourl,
              status,
            };
          }) as AttendanceEntry[];
          setAttendance(mapped);
        }
      } catch {}
    };
    load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    const iv = setInterval(load, 10000);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(iv);
    };
  }, [idnumber]);

  return (
    <div className="min-h-screen bg-[#F6F7F9] flex flex-col">
      <StudentHeader />
      <main className="flex-1 p-4 pb-16 md:pb-0" style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}>
        <div className="mx-auto w-full max-w-7xl">
          <AttendanceView
            idnumber={idnumber}
            attendance={attendance}
            onUpdate={(next) => {
              setAttendance(next);
            }}
          />
        </div>
      </main>
      <StudentBottomNav />
    </div>
  );
}
