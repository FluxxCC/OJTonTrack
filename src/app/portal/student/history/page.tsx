"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import * as XLSX from "xlsx-js-style";
import { StudentBottomNav, StudentHeader, User } from "../ui";
import { formatHours, calculateSessionDuration, calculateShiftDurations } from "@/lib/attendance";

type AttendanceEntry = { id?: number; type: "in" | "out"; timestamp: number; photoDataUrl: string; status?: "Pending" | "Approved" | "Rejected"; is_overtime?: boolean; validated_by?: string };
type ServerAttendanceEntry = { id?: number; type: "in" | "out"; ts: number; photourl: string; status?: string; validated_by?: string | null };

export default function StudentHistoryPage() {
  const idnumber = useMemo(() => {
    if (typeof window === "undefined") return "";
    try { return localStorage.getItem("idnumber") || ""; } catch { return ""; }
  }, []);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);
  const [user, setUser] = useState<User | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const json = await res.json();
      if (Array.isArray(json.users)) {
        const me = json.users.find((u: User) => String(u.idnumber) === String(idnumber) && String(u.role).toLowerCase() === "student");
        if (me) setUser(me);
      }
    } catch {}
  }, [idnumber]);

  useEffect(() => {
    if (idnumber) fetchUser();
  }, [fetchUser, idnumber]);

  const uniqueAttendance = useMemo(() => {
    const seen = new Set<string>();
    return attendance.filter(a => {
      const key = a.id ? String(a.id) : `${a.timestamp}-${a.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [attendance]);

  useEffect(() => {
    if (!idnumber) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/attendance?idnumber=${encodeURIComponent(idnumber)}&limit=1000`, { cache: "no-store" });
        const json = await res.json();
        if (active && res.ok && Array.isArray(json.entries)) {
          const mapped = json.entries.map((e: ServerAttendanceEntry) => {
            const sStr = String(e.status || "").trim().toLowerCase();
            const isRejected = sStr === "rejected";
            const isApproved = sStr === "approved" || (!!e.validated_by && !isRejected);
            const status = isRejected ? "Rejected" : isApproved ? "Approved" : "Pending";
            return {
              id: e.id,
              type: e.type,
              timestamp: e.ts,
              photoDataUrl: e.photourl,
              status,
              validated_by: e.validated_by || undefined,
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

  const handleDownloadExcel = () => {
    if (uniqueAttendance.length === 0) return;

    // Pre-process data to calculate totals
    const dayGroups = new Map<string, AttendanceEntry[]>();
    uniqueAttendance.forEach(log => {
      const d = new Date(log.timestamp);
      const key = d.toDateString();
      if (!dayGroups.has(key)) dayGroups.set(key, []);
      dayGroups.get(key)!.push(log);
    });

    const fallbackSchedule = {
      amIn: 9*60, amOut: 12*60,
      pmIn: 13*60, pmOut: 17*60,
      otStart: 17*60, otEnd: 18*60
    };

    let overallTotal = 0;
    let overallValidated = 0;

    const processedDays = Array.from(dayGroups.values())
      .sort((a, b) => b[0].timestamp - a[0].timestamp)
      .map(dayLogs => {
        const dayDate = new Date(dayLogs[0].timestamp);
        dayDate.setHours(0, 0, 0, 0);
        const sorted = [...dayLogs].sort((a, b) => a.timestamp - b.timestamp);
        const noonCutoff = new Date(dayDate).setHours(12, 30, 0, 0);
        
        const s1 = sorted.find(l => l.type === "in" && l.timestamp < noonCutoff && !l.is_overtime) || null;
        const s2 = sorted.find(l => l.type === "out" && l.timestamp < noonCutoff && !l.is_overtime) || null;
        const s3 = sorted.find(l => l.type === "in" && l.timestamp >= noonCutoff && !l.is_overtime) || null;
        const s4 = sorted.find(l => l.type === "out" && l.timestamp >= noonCutoff && !l.is_overtime) || null;
        const s5 = sorted.find(l => l.type === "in" && l.is_overtime) || null;
        const s6 = sorted.find(l => l.type === "out" && l.is_overtime) || null;

        const calcSession = (inEntry: AttendanceEntry | null, outEntry: AttendanceEntry | null, shift: 'am' | 'pm' | 'ot') => {
          if (!inEntry || !outEntry) return 0;
          const { am, pm, ot } = calculateShiftDurations(inEntry.timestamp, outEntry.timestamp, fallbackSchedule);
          // Return the specific shift duration requested (for breakdown) or total?
          // The caller sums them up.
          // But wait, the original code called calculateSessionDuration for 'am', 'pm', 'ot' separately.
          // calculateShiftDurations returns all 3.
          // We can just return the specific component.
          if (shift === 'am') return am;
          if (shift === 'pm') return pm;
          if (shift === 'ot') return ot;
          return 0;
        };

        const dayTotalMs = calcSession(s1, s2, 'am') + calcSession(s3, s4, 'pm') + calcSession(s5, s6, 'ot');
        overallTotal += dayTotalMs;
        
        const isAmValidated = (s1?.status === 'Approved' || s2?.status === 'Approved');
        const isPmValidated = (s3?.status === 'Approved' || s4?.status === 'Approved');
        const isOtValidated = (s5?.status === 'Approved' || s6?.status === 'Approved');
        
        let dayValidatedMs = 0;
        if (isAmValidated) dayValidatedMs += calcSession(s1, s2, 'am');
        if (isPmValidated) dayValidatedMs += calcSession(s3, s4, 'pm');
        if (isOtValidated) dayValidatedMs += calcSession(s5, s6, 'ot');
        
        overallValidated += dayValidatedMs;

        return {
           date: dayDate,
           s1, s2, s3, s4, s5, s6,
           dayTotalMs
        };
      });

    // Helper for formatting time
    const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Define Headers
    const headerRows = [
      [`NAME: ${user?.lastname || ""}, ${user?.firstname || ""}`, "", "", `COURSE: ${user?.course || ""}-${user?.section || ""}`, "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", "", "", ""],
      [`TOTAL HOURS: ${formatHours(overallTotal)}`, "", `TOTAL VALIDATED HOURS: ${formatHours(overallValidated)}`, "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", "", "", ""],
      ["DATE", "MORNING", "", "STATUS", "AFTERNOON", "", "OVERTIME", "", "STATUS", "TOTAL HOURS"], 
      ["", "TIME IN", "TIME OUT", "", "TIME IN", "TIME OUT", "TIME IN", "TIME OUT", "", ""] 
    ];

    // 2. Map Data
    const dataRows = processedDays.map(day => {
        const fmt = (slot: AttendanceEntry | null | undefined) => slot ? fmtTime(slot.timestamp) : "-";
        const fmtOut = (slot: AttendanceEntry | null | undefined) => {
          if (!slot) return "-";
          if (slot.validated_by === "SYSTEM_AUTO_CLOSE" || slot.validated_by === "AUTO TIME OUT") {
              return "AUTO TIME OUT";
          }
          return fmtTime(slot.timestamp);
        };

        const getStatus = (inSlot?: AttendanceEntry | null, outSlot?: AttendanceEntry | null) => {
            const s1 = inSlot?.status?.toLowerCase();
            const s2 = outSlot?.status?.toLowerCase();
            const v1 = inSlot?.validated_by;
            const v2 = outSlot?.validated_by;
  
            // If any part is rejected -> unvalidated
            if (s1 === "rejected" || s2 === "rejected") {
              return "unvalidated";
            }
  
            // If any part is approved/validated or has validator -> validated
            if (s1 === "approved" || s1 === "validated" || 
                s2 === "approved" || s2 === "validated" ||
                v1 || v2) {
              return "validated";
            }
  
            // If slots exist -> pending
            if (inSlot || outSlot) {
              return "pending";
            }
  
            return "-";
        };
        
        // AM Status: s1 or s2
        const amStatus = getStatus(day.s1, day.s2);
        
        // PM/OT Status: s3, s4, s5, s6
        let pmStatus = "-";
        if (day.s3 || day.s4) {
            pmStatus = getStatus(day.s3, day.s4);
        } else if (day.s5 || day.s6) {
            pmStatus = getStatus(day.s5, day.s6);
        }

        return [
            day.date.toLocaleDateString(),
            fmt(day.s1), fmtOut(day.s2), amStatus,
            fmt(day.s3), fmtOut(day.s4),
            fmt(day.s5), fmtOut(day.s6), pmStatus,
            formatHours(day.dayTotalMs)
        ];
    });

    // 3. Combine
    const wsData = [...headerRows, ...dataRows];

    // 4. Create Worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(wsData);

    // Apply styles
    const headerStyle = {
      font: { bold: true },
      alignment: { horizontal: "center", vertical: "center" }
    };
    const boldLeftStyle = {
      font: { bold: true },
      alignment: { horizontal: "left", vertical: "center" }
    };

    const boldCells = ["A1", "D1", "A3", "C3"];
    boldCells.forEach(ref => {
      if (worksheet[ref]) worksheet[ref].s = boldLeftStyle;
    });

    const range = XLSX.utils.decode_range(worksheet['!ref'] || "A1:J100");
    for (let R = 4; R <= 5; ++R) { 
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
        if (cell) cell.s = headerStyle;
      }
    }

    // 5. Define Merges
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, // NAME
      { s: { r: 0, c: 3 }, e: { r: 0, c: 9 } }, // COURSE
      { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } }, // TOTAL HOURS
      { s: { r: 2, c: 2 }, e: { r: 2, c: 5 } }, // TOTAL VALIDATED

      { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } }, // DATE
      { s: { r: 4, c: 1 }, e: { r: 4, c: 2 } }, // MORNING
      { s: { r: 4, c: 3 }, e: { r: 5, c: 3 } }, // STATUS
      { s: { r: 4, c: 4 }, e: { r: 4, c: 5 } }, // AFTERNOON
      { s: { r: 4, c: 6 }, e: { r: 4, c: 7 } }, // OVERTIME
      { s: { r: 4, c: 8 }, e: { r: 5, c: 8 } }, // STATUS
      { s: { r: 4, c: 9 }, e: { r: 5, c: 9 } }, // TOTAL HOURS
    ];

    // 6. Set Column Widths
    worksheet['!cols'] = [
      { wch: 15 }, // Date
      { wch: 12 }, // Morning In
      { wch: 18 }, // Morning Out
      { wch: 12 }, // Status (AM)
      { wch: 12 }, // Afternoon In
      { wch: 18 }, // Afternoon Out
      { wch: 12 }, // Overtime In
      { wch: 18 }, // Overtime Out
      { wch: 12 }, // Status (PM)
      { wch: 15 }, // Total Hours
    ];

    // 7. Create Workbook and Download
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
    XLSX.writeFile(workbook, `Attendance_${user?.firstname || "Report"}_${user?.lastname || ""}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-[#F6F7F9] flex flex-col">
      <StudentHeader />
      <main className="flex-1 p-4 pb-16 md:pb-0" style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}>
        <div className="mx-auto w-full max-w-7xl">
          <div className="rounded-3xl bg-white border border-gray-200 shadow-sm p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Attendance History</div>
              <button
                onClick={handleDownloadExcel}
                disabled={uniqueAttendance.length === 0}
                className="px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                Download As Excel
              </button>
            </div>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              {uniqueAttendance.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">No attendance records found.</div>
              ) : (
                uniqueAttendance.slice().sort((a,b) => Number(b.timestamp) - Number(a.timestamp)).map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    {entry.photoDataUrl ? (
                      <div className="h-12 w-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200 border border-gray-200 flex items-center justify-center">
                        <img src={entry.photoDataUrl} alt="Log" className="h-full w-full object-cover" />
                      </div>
                    ) : (entry.validated_by === "SYSTEM_AUTO_CLOSE" || entry.validated_by === "AUTO TIME OUT") ? (
                            <div className="h-12 w-20 flex-shrink-0 flex items-center justify-center">
                              <span className="text-[10px] font-bold text-red-500">AUTO TIME OUT</span>
                            </div>
                          ) : (
                      <div className="h-12 w-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200 border border-gray-200 flex items-center justify-center" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${entry.type === "in" ? "bg-green-500" : "bg-gray-500"}`} />
                        <span className={`font-semibold capitalize text-gray-900`}>
                          {entry.type === "in" ? "Time In" : "Time Out"}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {(entry.validated_by === "SYSTEM_AUTO_CLOSE" || entry.validated_by === "AUTO TIME OUT") ? (
                            <span className="text-red-600 font-bold">AUTO TIME OUT</span>
                        ) : (
                            new Date(entry.timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                        )}
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                      entry.status === "Approved" ? "bg-green-100 text-green-700" : 
                      entry.status === "Rejected" ? "bg-red-100 text-red-700" : 
                      "bg-yellow-100 text-yellow-700"
                    }`}>
                      {entry.status === "Approved" ? "Validated" : entry.status === "Rejected" ? "Unvalidated" : "Pending"}
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
