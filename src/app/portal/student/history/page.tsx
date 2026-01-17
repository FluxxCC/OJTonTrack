"use client";
import React, { useEffect, useMemo, useState } from "react";
import { StudentBottomNav, StudentHeader } from "../ui";

type AttendanceEntry = { type: "in" | "out"; timestamp: number; photoDataUrl: string; status?: "Pending" | "Approved" | "Rejected" };
type ServerAttendanceEntry = { type: "in" | "out"; ts: number; photourl: string; status?: string; validated_by?: string | null };

export default function StudentHistoryPage() {
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
        const res = await fetch(`/api/attendance?idnumber=${encodeURIComponent(idnumber)}&limit=200`, { cache: "no-store" });
        const json = await res.json();
        if (active && res.ok && Array.isArray(json.entries)) {
          const mapped = json.entries.map((e: ServerAttendanceEntry) => {
            const sStr = String(e.status || "").trim().toLowerCase();
            const isRejected = sStr === "rejected";
            const isApproved = sStr === "approved" || (!!e.validated_by && !isRejected);
            const status = isRejected ? "Rejected" : isApproved ? "Approved" : "Pending";
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
          <div className="rounded-3xl bg-white border border-gray-200 shadow-sm p-4 sm:p-6">
            <div className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Attendance History</div>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              {attendance.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">No attendance records found.</div>
              ) : (
                attendance.slice().sort((a,b) => Number(b.timestamp) - Number(a.timestamp)).map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="h-12 w-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200">
                      {entry.photoDataUrl && (
                        <img src={entry.photoDataUrl} alt="Log" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${entry.type === "in" ? "bg-green-500" : "bg-gray-500"}`} />
                        <span className="font-semibold text-gray-900 capitalize">{entry.type === "in" ? "Time In" : "Time Out"}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {new Date(entry.timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                      entry.status === "Approved" ? "bg-green-100 text-green-700" : 
                      entry.status === "Rejected" ? "bg-red-100 text-red-700" : 
                      "bg-yellow-100 text-yellow-700"
                    }`}>
                      {entry.status || "Pending"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
      <StudentBottomNav />
    </div>
  );
}
