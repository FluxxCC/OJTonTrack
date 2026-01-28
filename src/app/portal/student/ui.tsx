"use client";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AttendanceDetailsModal } from "@/components/AttendanceDetailsModal";
import { supabase } from "@/lib/supabaseClient";
import { buildSchedule, calculateSessionDuration, checkSessionFlags, ShiftSchedule, formatHours, formatDisplayTime, normalizeTimeString, timeStringToMinutes, calculateShiftDurations } from "@/lib/attendance";
import Cropper from "react-easy-crop";
import getCroppedImg from "@/lib/cropImage";
import { Move, ZoomIn, ZoomOut, X } from "lucide-react";


export type AttendanceEntry = { 
  id?: number; 
  type: "in" | "out"; 
  timestamp: number; 
  photoDataUrl: string; 
  status?: "Pending" | "Approved" | "Rejected"; 
  approvedAt?: number;
  validated_by?: string | null;
  is_overtime?: boolean;
};
export type ReportEntry = { id?: number; title: string; body?: string; fileName?: string; fileType?: string; fileUrl?: string; submittedAt: number; instructorComment?: string; isViewedByInstructor?: boolean; week?: number; };
type ServerAttendanceEntry = { 
  type: "in" | "out"; 
  ts: number; 
  photourl: string; 
  status?: string; 
  validated_by?: string | null;
  validated_at?: string | null;
};
const DUE_DATE_TEXT = new Date(Date.now() + 86400000).toLocaleDateString();

function getAttendanceStatus(entry?: AttendanceEntry | null): "Pending" | "Approved" | "Rejected" {
  if (!entry || !entry.status) return "Pending";
  if (entry.status === "Approved") return "Approved";
  if (entry.status === "Rejected") return "Rejected";
  return "Pending";
}

function formatStatusLabel(entry: AttendanceEntry): string {
  const status = getAttendanceStatus(entry);
  if (status === "Approved") return "Validated";
  if (status === "Rejected") return "Unvalidated";
  return "Pending";
}

function getStatusColorClass(entry?: AttendanceEntry | null): string {
  const status = getAttendanceStatus(entry);
  if (status === "Approved") return "text-green-600";
  if (status === "Rejected") return "text-red-600";
  return "text-yellow-600";
}

const toBase64 = (file: File) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});

export type User = {
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
  email?: string;
  email_verified?: boolean;
  target_hours?: number;
  supervisor_name?: string;
  avatar_url?: string;
};

export function StudentHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const nameRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    try {
      const fname = localStorage.getItem("firstname") || "";
      const lname = localStorage.getItem("lastname") || "";
      const txt = `${fname} ${lname}`.trim();
      if (nameRef.current) nameRef.current.textContent = txt ? `• ${txt}` : "";
    } catch {}
  }, []);


  return (
    <header className="flex-shrink-0 w-full bg-gradient-to-b from-[#F97316] to-[#EA580C] text-white shadow-lg z-10">
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 md:px-8 pt-3 pb-3 md:pt-4 md:pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/icons-512.png" alt="CITE" width={40} height={40} className="h-10 w-10 rounded-md object-cover" />
            <div>
              <div className="text-white font-extrabold text-base md:text-[1.25rem] tracking-wide leading-tight">
                OJTonTrack <span ref={nameRef} className="font-semibold text-white/90"></span>
              </div>
              <div className="text-white/80 text-xs font-medium">Student Portal</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.replace("/")}
              className="inline-flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white font-semibold px-3 py-1 md:px-4 md:py-1.5 text-sm transition-colors"
            >
              Log Out
            </button>
          </div>
        </div>
        <div className="mt-4 md:mt-8 hidden md:flex justify-center gap-6 overflow-x-auto pb-2">
          {[
            { key: "dashboard", href: "/portal/student/dashboard" },
            { key: "attendance", href: "/portal/student/attendance" },
            { key: "reports", href: "/portal/student/reports" },
            { key: "profile", href: "/portal/student/profile" },
          ].map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`relative pb-2 text-sm font-semibold tracking-wide uppercase transition-colors whitespace-nowrap ${
                  isActive ? "text-white" : "text-white/60 hover:text-white/90"
                }`}
              >
                {item.key}
                {isActive && <span className="absolute bottom-0 left-0 h-1 w-full rounded-full bg-white" />}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}

export function StudentBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 md:hidden bg-white border-t border-gray-200 shadow-sm z-20" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} aria-label="Bottom navigation">
      <div className="flex justify-around items-center py-2">
        {[
          { key: "dashboard", label: "Home", href: "/portal/student/dashboard", icon: (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-6 9 6v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>) },
          { key: "attendance", label: "Attendance", href: "/portal/student/attendance", icon: (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>) },
          { key: "reports", label: "Reports", href: "/portal/student/reports", icon: (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16l4-4h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>) },
          { key: "profile", label: "Profile", href: "/portal/student/profile", icon: (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/></svg>) },
        ].map(item => (
          <Link
            key={item.key}
            href={item.href}
            className={`flex flex-col items-center gap-1 px-3 ${pathname?.startsWith(item.href) ? "text-[#F97316]" : "text-gray-500"}`}
            aria-current={pathname?.startsWith(item.href) ? "page" : undefined}
          >
            {item.icon}
            <span className="text-xs">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

function SubmittedReportsModal({ reports, onClose, onViewReport }: { reports: ReportEntry[]; onClose: () => void; onViewReport?: (report: ReportEntry) => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-white sticky top-0 z-10">
          <h2 className="text-xl font-bold text-gray-900">Submitted Reports</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="overflow-y-auto p-6 space-y-4">
          {reports.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No reports submitted yet.</div>
          ) : (
            reports.slice().sort((a, b) => b.submittedAt - a.submittedAt).map((report, idx) => (
              <button 
                key={idx} 
                onClick={() => onViewReport?.(report)}
                disabled={!onViewReport}
                className={`w-full text-left bg-gray-50 rounded-xl p-4 border border-gray-100 transition-colors ${onViewReport ? "hover:bg-gray-100 cursor-pointer" : "cursor-default"}`}
              >
                <div className="flex items-center justify-between mb-2">
                   <div className="font-bold text-gray-900">{report.title}</div>
                   <div className="text-xs text-gray-500">{new Date(report.submittedAt).toLocaleDateString()}</div>
                </div>
                {report.body && <p className="text-sm text-gray-600 line-clamp-2 mb-2">{report.body}</p>}
                <div className="flex flex-col gap-2 mt-2">
                    <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${report.isViewedByInstructor || report.instructorComment ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                            {report.isViewedByInstructor || report.instructorComment ? "Reviewed" : "Pending Review"}
                        </span>
                        {report.fileName && (
                            <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16l4-4h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>
                                File
                            </span>
                        )}
                        {report.instructorComment && (
                            <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse" title="Instructor Comment">
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                                Comment
                            </span>
                        )}
                    </div>
                    {report.instructorComment && (
                         <div className="bg-red-50/50 border border-red-100 rounded-lg p-3 text-xs text-gray-700">
                             <div className="font-bold text-red-700 mb-1 flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                                Instructor Comment
                             </div>
                             {report.instructorComment}
                         </div>
                    )}
                </div>
              </button>
            ))
          )}
        </div>
        <div className="p-6 border-t border-gray-100 bg-gray-50 sticky bottom-0 z-10">
            <button onClick={onClose} className="w-full py-3 bg-white border border-gray-200 rounded-xl text-gray-700 font-bold hover:bg-gray-50 transition-colors">
                Close
            </button>
        </div>
      </div>
    </div>
  );
}

import * as XLSX from "xlsx-js-style";

export function DashboardView({
  attendance,
  reports,
  totalHours,
  totalValidatedHours,
  targetHours,
  onTimeIn,
  onTimeOut,
  onViewAttendance,
  companyText,
  supervisorText,
  locationText,
  recentRows,
  nextDeadline,
  now,
}: { 
  attendance: AttendanceEntry[]; 
  reports: ReportEntry[]; 
  totalHours: string; 
  totalValidatedHours: string;
  targetHours: number;
  onTimeIn: () => void;
  onTimeOut: () => void;
  onViewAttendance: () => void;
  companyText: string;
  supervisorText: string;
  locationText: string;
  recentRows?: {
    labelDate: string;
    inLabel: string;
    outLabel: string;
    inEntry?: AttendanceEntry;
    outEntry?: AttendanceEntry;
    duration: string;
    status: "Pending" | "Approved";
  }[];
  nextDeadline?: { week: number; date: string; status: "submitted" | "pending" };
  now?: number;
}): React.ReactElement {
  const [selectedAttendanceEntry, setSelectedAttendanceEntry] = useState<AttendanceEntry | null>(null);
  const [showAllReportsModal, setShowAllReportsModal] = useState(false);

  const [hoursText, remainingText, progressPct] = useMemo(() => {
    const parts = totalHours.split("h");
    const h = Number(parts[0] || 0);
    const pct = Math.max(0, Math.min(100, Math.round((h/targetHours)*100)));
    const remaining = Math.max(0, targetHours - h);
    return [totalHours, `${remaining} hrs left`, pct];
  }, [totalHours, targetHours]);

  const lastReport = reports[0];
  // Format the deadline date nicely (e.g., "Jan 25")
  const deadlineText = useMemo(() => {
    if (!nextDeadline?.date) return "TBA";
    try {
      return new Date(nextDeadline.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return nextDeadline.date;
    }
  }, [nextDeadline]);

  const isCheckedIn = useMemo(() => {
    const sorted = attendance.slice().sort((a,b) => a.timestamp - b.timestamp);
    const last = sorted[sorted.length - 1];
    if (!last || last.type === "out") return false;

    // Check if the last IN entry is from today
    // We use the passed 'now' prop or fallback to client Date
    const currentNow = now || Date.now();
    const logDate = new Date(last.timestamp).toDateString();
    const todayDate = new Date(currentNow).toDateString();
    
    // Only return true if the IN entry is from TODAY
    // If it's from yesterday, we return false so the button shows "Time In".
    // The "Time In" handler will then take care of auto-closing the stale entry.
    return logDate === todayDate;
  }, [attendance, now]);

  const recentLogs = useMemo(() => {
    const logs = attendance.slice().sort((a, b) => b.timestamp - a.timestamp).slice(0, 4);
    return logs.map(log => ({
      type: log.type,
      date: new Date(log.timestamp).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
      time: new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      validated_by: log.validated_by
    }));
  }, [attendance]);

  const isReportSubmitted = reports.length > 0;



  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      {/* Top Row: Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {/* Card 1: Total Hours (Orange) */}
         <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 relative overflow-hidden flex flex-col justify-between min-h-[160px]">
            <div className="flex items-start gap-4">
               {/* Icon */}
               <div className="w-14 h-14 rounded-2xl bg-[#F97316] flex items-center justify-center flex-shrink-0 text-white shadow-sm shadow-orange-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
               </div>
               {/* Text Content */}
               <div className="flex flex-col">
                  <div className="text-sm font-bold text-gray-500">Total Hours</div>
                  <div className="text-3xl font-bold text-gray-900 tracking-tight leading-none mt-1">{hoursText}</div>
                  <div className="text-xs font-medium text-gray-400 mt-1">Target: {targetHours}h</div>
               </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mt-6">
               <div className="bg-[#F97316] h-full rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${progressPct}%` }}>
                  {/* Optional: Add a dot at the end if desired, but standard bar is clean */}
               </div>
            </div>
         </div>

         {/* Card 2: Validated Hours (Green) */}
         <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 relative overflow-hidden flex flex-col justify-center min-h-[160px]">
            <div className="flex items-center gap-4">
               {/* Icon */}
               <div className="w-14 h-14 rounded-2xl bg-[#16A34A] flex items-center justify-center flex-shrink-0 text-white shadow-sm shadow-green-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
               </div>
               {/* Text Content */}
               <div className="flex flex-col">
                  <div className="text-sm font-bold text-gray-500">Total Validated Hours</div>
                  <div className="text-3xl font-bold text-gray-900 tracking-tight leading-none mt-1">{totalValidatedHours}</div>
               </div>
            </div>
         </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Recent Activity (Left Column) */}
         <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-6">
               <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">Recent Activity</h3>
                  <div className="flex items-center gap-4 text-sm font-medium">
                     <Link href="/portal/student/attendance" className="text-[#F97316] hover:text-[#EA580C]">Attendance</Link>
                     <Link href="/portal/student/reports" className="text-[#F97316] hover:text-[#EA580C]">Reports</Link>
                  </div>
               </div>
               
               <div className="space-y-4">
                  {recentLogs.length === 0 ? (
                      <div className="bg-gray-50 rounded-xl border border-gray-100 p-8 text-center text-gray-400 italic">No recent activity</div>
                  ) : recentLogs.map((log, i) => {
                      const isAutoTimeOut = log.type === 'out' && (log.validated_by === 'SYSTEM_AUTO_CLOSE' || log.validated_by === 'AUTO TIME OUT');
                      return (
                      <div key={i} className="bg-gray-50 rounded-2xl border border-gray-100 p-5 flex items-center justify-between hover:border-gray-200 transition-colors">
                         <div className="flex items-center gap-5">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${log.type === 'in' ? 'bg-white text-green-600 border border-green-100 shadow-sm' : 'bg-white text-red-600 border border-red-100 shadow-sm'}`}>
                               {log.type === 'in' ? (
                                   // External Link Icon for Time In
                                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                               ) : (
                                   // Log Out Icon for Time Out
                                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                               )}
                            </div>
                            <div className="flex flex-col">
                               <div className={`font-bold text-base ${isAutoTimeOut ? 'text-red-600' : 'text-gray-900'}`}>
                                 {log.type === 'in' ? 'Time In' : isAutoTimeOut ? 'AUTO TIME OUT' : 'Time Out'}
                               </div>
                               <div className="text-xs font-medium text-gray-400 mt-0.5">{log.date}</div>
                            </div>
                         </div>
                         {!isAutoTimeOut && (
                           <div className="font-bold text-gray-900 text-lg">{log.time}</div>
                         )}
                      </div>
                      );
                  })}
               </div>
            </div>
         </div>

         {/* Sidebar (Right Column) */}
         <div className="flex flex-col gap-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
               <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F97316]"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                  Quick Actions
               </div>
               <div className="space-y-3">

                  <button 
                    onClick={isCheckedIn ? onTimeOut : onTimeIn}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all shadow-sm border-2 ${isCheckedIn ? 'bg-white border-red-100 text-red-600 hover:border-red-200 hover:bg-red-50' : 'bg-white border-green-100 text-green-600 hover:border-green-200 hover:bg-green-50'}`}
                  >
                     {isCheckedIn ? (
                        <>
                           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><rect x="9" y="9" width="6" height="6"/></svg>
                           Time Out
                        </>
                     ) : (
                        <>
                           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                           Time In
                        </>
                     )}
                  </button>

                  <Link href="/portal/student/reports" className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-[#F97316] text-white hover:bg-[#EA580C] transition-all shadow-md shadow-orange-200">
                     Submit Report
                  </Link>
               </div>
            </div>

            {/* Weekly Report Deadlines */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
               <div className="flex items-center justify-between mb-4">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                     Weekly Report Deadlines
                  </div>
                  <button 
                    onClick={() => setShowAllReportsModal(true)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    View All
                  </button>
               </div>
               
               <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className="h-8 w-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                        W1
                     </div>
                     <div>
                        <div className="text-sm font-bold text-gray-900">Week 1</div>
                        {isReportSubmitted ? (
                            <div className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full inline-block mt-1">Submitted</div>
                        ) : (
                            <div className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full inline-block mt-1">Not submitted yet</div>
                        )}
                     </div>
                  </div>
                  <div className="text-xs font-medium text-gray-500">
                     Due {deadlineText}
                  </div>
               </div>
            </div>
         </div>
      </div>

      {/* Attendance Details Modal */}
      {selectedAttendanceEntry && (
        <AttendanceDetailsModal
          entry={selectedAttendanceEntry}
          onClose={() => setSelectedAttendanceEntry(null)}
        />
      )}

      {/* Submitted Reports Modal */}
      {showAllReportsModal && (
        <SubmittedReportsModal
          reports={reports}
          onClose={() => setShowAllReportsModal(false)}
        />
      )}
    </div>
  );
}

export type CameraAnalysis = {
  faceDetected: boolean;
  faceSize?: "small" | "medium" | "large";
  facePosition?: "centered" | "partially_out";
  lighting: "too_dark" | "too_bright" | "okay";
  numFaces?: number;
};

export function getCameraAssistantMessage(input: CameraAnalysis): string {
  const { faceDetected, faceSize, facePosition, lighting, numFaces } = input;
  if (!faceDetected || (numFaces !== undefined && numFaces === 0)) {
    return "Put your face in the frame.";
  }
  const msgs: string[] = [];
  if (facePosition === "partially_out") msgs.push("Center your face in the frame.");
  if (faceSize === "small") msgs.push("Move closer to the camera.");
  else if (faceSize === "large") msgs.push("Move back a little.");
  if (lighting === "too_dark") msgs.push("Too dark, try moving to a brighter spot.");
  else if (lighting === "too_bright") msgs.push("Too light, adjust your lighting.");

  if (msgs.length === 0) return "Perfect! Hold still.";
  if (msgs.length === 1) return msgs[0];
  if (msgs.length === 2) return `${msgs[0].replace(/\.$/, "")} and ${msgs[1].toLowerCase()}`;
  return `${msgs[0].replace(/\.$/, "")}, ${msgs[1].toLowerCase()}, and ${msgs[2].toLowerCase()}`;
}

export function AttendanceView({ idnumber, attendance, onUpdate, supervisorId, studentName }: { idnumber: string; attendance: AttendanceEntry[]; onUpdate: (next: AttendanceEntry[]) => void; supervisorId?: string; studentName?: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [dbSchedule, setDbSchedule] = useState<{ amIn: string; amOut: string; pmIn: string; pmOut: string; otIn?: string; otOut?: string } | null>(null);
  const [nowText, setNowText] = useState<string>("");
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [selectedAttendanceEntry, setSelectedAttendanceEntry] = useState<AttendanceEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasDesktopCamera, setHasDesktopCamera] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [videoReady, setVideoReady] = useState<boolean>(false);
  const readinessIntervalRef = useRef<number | null>(null);
  const [isFrontCam, setIsFrontCam] = useState<boolean>(false);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [breakPmInText, setBreakPmInText] = useState<string>("");
  const [showLateInModal, setShowLateInModal] = useState(false);
  const [lateInPmOutText, setLateInPmOutText] = useState<string>("");
  const [showEarlyOutModal, setShowEarlyOutModal] = useState(false);
  const [earlyOutShiftEndText, setEarlyOutShiftEndText] = useState<string>("");
  const [showNoScheduleModal, setShowNoScheduleModal] = useState(false);
  const [showCooldownModal, setShowCooldownModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateModalMessage, setDuplicateModalMessage] = useState("");
  const [showHistoryMode, setShowHistoryMode] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; timestamp: number } | null>(null);
  const [cameraFeedback, setCameraFeedback] = useState<string>("");
  const [authorizedOvertime, setAuthorizedOvertime] = useState<{ start: number; end: number } | null>(null);
  const [allOvertimeShifts, setAllOvertimeShifts] = useState<{ effective_date: string; overtime_start: number; overtime_end: number }[]>([]);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        // Fetch specific user by ID to bypass pagination limits and ensure fresh data
        const res = await fetch(`/api/users?idnumber=${encodeURIComponent(idnumber)}`, { cache: "no-store" });
        const json = await res.json();
        if (Array.isArray(json.users) && json.users.length > 0) {
          const me = json.users[0];
          // Ensure the fetched user is actually a student
          if (String(me.role).toLowerCase() === "student") {
            setUser(me);
          }
        }
      } catch (e) {
        console.error("Failed to fetch user profile:", e);
      }
    };
    if (idnumber) fetchUser();
  }, [idnumber]);

  useEffect(() => {
    const fetchOvertime = async () => {
        try {
            if (!idnumber) return;
            const res = await fetch(`/api/overtime?student_id=${encodeURIComponent(idnumber)}`);
            const json = await res.json();
            
            if (json.overtime_shifts) {
                const shifts = json.overtime_shifts.map((s: any) => ({
                    ...s,
                    overtime_start: Number(s.overtime_start),
                    overtime_end: Number(s.overtime_end)
                }));
                setAllOvertimeShifts(shifts);

                // Find today's shift for authorization
                const today = new Date().toLocaleDateString('en-CA');
                const todayShift = shifts.find((s: any) => s.effective_date === today);
                
                if (todayShift) {
                    setAuthorizedOvertime({
                        start: todayShift.overtime_start,
                        end: todayShift.overtime_end
                    });
                } else {
                    setAuthorizedOvertime(null);
                }
            }
        } catch (e) {
            console.error("Failed to fetch overtime", e);
        }
    };
    fetchOvertime();
    const interval = setInterval(fetchOvertime, 60000);
    return () => clearInterval(interval);
  }, [idnumber]);

   useEffect(() => {
     if (authorizedOvertime && dbSchedule) {
       const otIn = new Date(authorizedOvertime.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
       const otOut = new Date(authorizedOvertime.end).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

       if (dbSchedule.otIn !== otIn || dbSchedule.otOut !== otOut) {
         setDbSchedule(prev => ({
           ...prev!,
           otIn,
           otOut
         }));
       }
     }
   }, [authorizedOvertime, dbSchedule]);
  
  const uniqueAttendance = useMemo(() => {
    const seen = new Set<string>();
    return attendance.filter(a => {
      const key = a.id ? String(a.id) : `${a.timestamp}-${a.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [attendance]);

  const monthOptions = useMemo(() => {
    const map = new Map<string, string>();
    uniqueAttendance.forEach(a => {
      const d = new Date(a.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      if (!map.has(key)) {
        map.set(key, label);
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, label]) => ({ value, label }));
  }, [uniqueAttendance]);

  const filteredAttendance = useMemo(() => {
    let result = uniqueAttendance;

    if (filterDate) {
      result = result.filter(a => new Date(a.timestamp).toLocaleDateString() === new Date(filterDate).toLocaleDateString());
    }

    if (monthFilter) {
      result = result.filter(a => {
        const d = new Date(a.timestamp);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return key === monthFilter;
      });
    }

    if (attendanceSearchQuery) {
      const q = attendanceSearchQuery.toLowerCase();
      result = result.filter(a => {
        const typeStr = a.type === "in" ? "time in" : "time out";
        const dateStr = new Date(a.timestamp).toLocaleString().toLowerCase();
        return typeStr.includes(q) || dateStr.includes(q);
      });
    }

    return result;
  }, [attendance, filterDate, monthFilter, attendanceSearchQuery]);

  const schedule = useMemo(() => {
    try {
      const key = idnumber ? `schedule_${idnumber}` : "schedule_default";
      const saved = localStorage.getItem(key);
      if (!saved) return null;
      const parsed = JSON.parse(saved) as {
        amIn?: string;
        amOut?: string;
        pmIn?: string;
        pmOut?: string;
        overtimeIn?: string;
        overtimeOut?: string;
      };
      return {
        amIn: parsed.amIn,
        amOut: parsed.amOut,
        pmIn: parsed.pmIn,
        pmOut: parsed.pmOut,
        otIn: parsed.overtimeIn,
        otOut: parsed.overtimeOut
      };
    } catch {
      return null;
    }
  }, [idnumber]);

  const officialScheduleText = useMemo(() => {
    const s = dbSchedule || schedule;
    if (!s) return "";
    const parts: string[] = [];
    if (s.amIn && s.amOut) {
      parts.push(`AM ${formatDisplayTime(s.amIn)} - ${formatDisplayTime(s.amOut)}`);
    }
    if (s.pmIn && s.pmOut) {
      parts.push(`PM ${formatDisplayTime(s.pmIn)} - ${formatDisplayTime(s.pmOut)}`);
    }
    if (s.otIn && s.otOut) {
      parts.push(`OT ${formatDisplayTime(s.otIn)} - ${formatDisplayTime(s.otOut)}`);
    }
    return parts.join(" • ");
  }, [dbSchedule, schedule]);

  const refreshScheduleFromServer = useCallback(async () => {
    try {
      // 1. Try fetching specific student schedule first
      if (supabase && idnumber) {
        const { data: studentSched, error: schedError } = await supabase
          .from("student_shift_schedules")
          .select("*")
          .eq("student_id", idnumber)
          .maybeSingle();

        if (!schedError && studentSched) {
            const next = {
                amIn: normalizeTimeString(studentSched.am_in) || "",
                amOut: normalizeTimeString(studentSched.am_out) || "",
                pmIn: normalizeTimeString(studentSched.pm_in) || "",
                pmOut: normalizeTimeString(studentSched.pm_out) || "",
                otIn: normalizeTimeString(studentSched.ot_in) || undefined,
                otOut: normalizeTimeString(studentSched.ot_out) || undefined,
            };
            setDbSchedule(next);
            return next;
        }
      }

      // 2. Fallback to Supervisor Default
      let rows: any[] | null = null;
      if (supabase) {
        let query = supabase
          .from("shifts")
          .select("shift_name, official_start, official_end")
          .order("official_start", { ascending: true });

        if (supervisorId) {
          query = query.eq("supervisor_id", supervisorId);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          rows = data.filter(r => r && (r.official_start || r.official_end));
        }
      }
      if (!rows) {
        const res = await fetch(`/api/shifts${supervisorId ? `?supervisor_id=${encodeURIComponent(supervisorId)}` : ''}`, { cache: "no-store" });
        const json = await res.json();
        const data = json.shifts;
        if (Array.isArray(data)) {
          rows = data.filter((r: any) => r && (r.official_start || r.official_end));
        }
      }
      if (!rows || rows.length === 0) {
        setDbSchedule(null);
        if (idnumber) {
          localStorage.removeItem(`schedule_${idnumber}`);
        }
        return null;
      }
      const sorted = rows
        .slice()
        .sort(
          (a, b) =>
            timeStringToMinutes(a.official_start || "") -
            timeStringToMinutes(b.official_start || "")
        );
      let amRow = sorted[0];
      let pmRow = sorted[1] || sorted[0];
      const findByName = (match: (name: string) => boolean) =>
        sorted.find((r) => {
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
      
      // Relaxed validation: allow partial schedules
      if (!amInNorm && !amOutNorm && !pmInNorm && !pmOutNorm) return null;

      const next = {
        amIn: amInNorm || "",
        amOut: amOutNorm || "",
        pmIn: pmInNorm || "",
        pmOut: pmOutNorm || "",
        otIn: otInNorm || undefined,
        otOut: otOutNorm || undefined,
      };
      setDbSchedule(next);
      return next;
    } catch {
      return null;
    }
  }, [supervisorId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let rows: any[] | null = null;

        if (supabase) {
          let query = supabase
            .from("shifts")
            .select("shift_name, official_start, official_end")
            .order("official_start", { ascending: true });

          if (supervisorId) {
            query = query.eq("supervisor_id", supervisorId);
          }

          const { data, error } = await query;
          if (!error && Array.isArray(data)) {
            rows = data.filter(r => r && (r.official_start || r.official_end));
          }
        }

        if (!rows) {
          const res = await fetch(`/api/shifts${supervisorId ? `?supervisor_id=${encodeURIComponent(supervisorId)}` : ''}`, { cache: "no-store" });
          const json = await res.json();
          const data = json.shifts;
          if (Array.isArray(data)) {
            rows = data.filter((r: any) => r && (r.official_start || r.official_end));
          }
        }

        if (!rows || rows.length === 0) return;

        const sorted = rows
          .slice()
          .sort(
            (a, b) =>
              timeStringToMinutes(a.official_start || "") -
              timeStringToMinutes(b.official_start || "")
          );
        let amRow = sorted[0];
        let pmRow = sorted[1] || sorted[0];
        const findByName = (match: (name: string) => boolean) =>
          rows!.find((r) => {
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

        // Relaxed validation: allow partial schedules
        if (!amInNorm && !amOutNorm && !pmInNorm && !pmOutNorm) return;

        if (!cancelled) {
          setDbSchedule({ 
            amIn: amInNorm || "",
            amOut: amOutNorm || "", 
            pmIn: pmInNorm || "", 
            pmOut: pmOutNorm || "",
            otIn: otInNorm || undefined,
            otOut: otOutNorm || undefined
          });
        }
      } catch {
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supervisorId]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("global-shift-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shifts" },
        () => {
          refreshScheduleFromServer();
        }
      )
      .subscribe();
    return () => {
      if (!supabase) return;
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [refreshScheduleFromServer]);

  const isCheckedIn = useMemo(() => {
    const sorted = attendance.slice().sort((a,b) => a.timestamp - b.timestamp);
    const last = sorted[sorted.length - 1];
    if (!last || last.type === "out") return false;

    // Check if the last IN entry is from today
    const logDate = new Date(last.timestamp).toDateString();
    const todayDate = new Date().toDateString();
    return logDate === todayDate;
  }, [attendance]);

  useEffect(() => {
    setTimeout(() => setNowText(new Date().toLocaleString()), 0);
    const t = setInterval(() => setNowText(new Date().toLocaleString()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    try {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(mobile);
    } catch {}
    (async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideoInput = devices.some(d => d.kind === 'videoinput');
        setHasDesktopCamera(hasVideoInput);
      } catch {
        setHasDesktopCamera(false);
      }
    })();
    return () => {
      stream?.getTracks()?.forEach(t => t.stop());
    };
  }, [stream]);

  useEffect(() => {
    if (!stream) return;
    const v = videoRef.current;
    if (!v) return;
    try {
      v.srcObject = stream;
    } catch {}
    setVideoReady(false);
    const onLoadedMetadata = async () => {
      setVideoReady(true);
      try { await v.play(); } catch {}
    };
    const onCanPlay = () => setVideoReady(true);
    v.onloadedmetadata = onLoadedMetadata;
    v.oncanplay = onCanPlay;
    try { v.play(); setVideoReady(true); } catch {}
    if (readinessIntervalRef.current) { clearInterval(readinessIntervalRef.current); readinessIntervalRef.current = null; }
    readinessIntervalRef.current = window.setInterval(() => {
      const track = stream.getVideoTracks()[0];
      const live = track && track.readyState === "live";
      if (v.videoWidth > 0 && v.videoHeight > 0 && live) {
        setVideoReady(true);
        if (readinessIntervalRef.current) { clearInterval(readinessIntervalRef.current); readinessIntervalRef.current = null; }
      }
    }, 200);
    return () => {
      if (readinessIntervalRef.current) { clearInterval(readinessIntervalRef.current); readinessIntervalRef.current = null; }
    };
  }, [stream]);

  // Camera Analysis Loop
  useEffect(() => {
    if (!stream || !videoReady || !videoRef.current) return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended) return;
      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 120;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, 120, 120);

      const img = ctx.getImageData(0, 0, 120, 120);
      const d = img.data;
      const cx = 60, cy = 70, rx = 48, ry = 64;

      let ellipsePixels = 0;
      let skinEllipse = 0;
      let luminanceSumEllipse = 0;
      let darkEllipse = 0;
      let brightEllipse = 0;

      let outsidePixels = 0;
      let skinOutside = 0;

      for (let y = 0; y < 120; y++) {
        for (let x = 0; x < 120; x++) {
          const idx = (y * 120 + x) * 4;
          const r = d[idx], g = d[idx + 1], b = d[idx + 2];
          const normX = (x - cx) / rx;
          const normY = (y - cy) / ry;
          const inEllipse = (normX * normX + normY * normY) <= 1;
          const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const maxc = Math.max(r, g, b);
          const minc = Math.min(r, g, b);
          const isSkin = r > 95 && g > 40 && b > 20 && (maxc - minc) > 15 && Math.abs(r - g) > 15 && r > g && r > b;

          if (inEllipse) {
            ellipsePixels++;
            luminanceSumEllipse += luminance;
            if (isSkin) skinEllipse++;
            if (luminance < 80) darkEllipse++;
            if (luminance > 220) brightEllipse++;
          } else {
            outsidePixels++;
            if (isSkin) skinOutside++;
          }
        }
      }

      const avgLum = ellipsePixels ? (luminanceSumEllipse / ellipsePixels) : 0;
      const darkFrac = ellipsePixels ? (darkEllipse / ellipsePixels) : 0;
      const brightFrac = ellipsePixels ? (brightEllipse / ellipsePixels) : 0;
      const skinRatioEllipse = ellipsePixels ? (skinEllipse / ellipsePixels) : 0;
      const skinRatioOutside = outsidePixels ? (skinOutside / outsidePixels) : 0;

      let lighting: "too_dark" | "too_bright" | "okay" = "okay";
      if (avgLum < 95 || darkFrac > 0.4) lighting = "too_dark";
      else if (avgLum > 205 || brightFrac > 0.4) lighting = "too_bright";

      const analysis: CameraAnalysis = {
        faceDetected: skinRatioEllipse > 0.1,
        faceSize: skinRatioEllipse < 0.2 ? "small" : skinRatioEllipse > 0.6 ? "large" : "medium",
        facePosition: skinRatioEllipse < 0.12 && skinRatioOutside > 0.06 ? "partially_out" : "centered",
        lighting,
        numFaces: 1
      };
      setCameraFeedback(getCameraAssistantMessage(analysis));
    }, 300);
    return () => clearInterval(interval);
  }, [stream, videoReady]);

  // Camera starts only when user taps "Start Camera"

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error("Failed to get canvas context"));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const resized = await resizeImage(file);
        setPhoto(resized);
      } catch (err) {
        console.error("Image resize failed, falling back to original", err);
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhoto(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError("Camera API not supported");
        return;
      }
      if (location.protocol !== "https:" && location.hostname !== "localhost") {
        setCameraError("Camera requires a secure connection");
        return;
      }
      let s: MediaStream | null = null;
      try {
        s = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: "user", 
            width: { ideal: isMobile ? 640 : 1280, max: isMobile ? 640 : 1280 }, 
            height: { ideal: isMobile ? 480 : 720, max: isMobile ? 480 : 720 } 
          },
          audio: false 
        });
      } catch {
        s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      if (!s) throw new Error("Unable to start camera");
      setStream(s);
      try {
        const track = s.getVideoTracks()[0];
        const settings = track.getSettings();
        setIsFrontCam(String(settings.facingMode).toLowerCase() === "user");
      } catch { setIsFrontCam(true); }
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        setVideoReady(false);
        videoRef.current.onloadedmetadata = async () => {
          setVideoReady(true);
          try { await videoRef.current?.play(); } catch {}
        };
        videoRef.current.oncanplay = () => setVideoReady(true);
        try { await videoRef.current.play(); setVideoReady(true); } catch {}
        if (readinessIntervalRef.current) { clearInterval(readinessIntervalRef.current); readinessIntervalRef.current = null; }
        readinessIntervalRef.current = window.setInterval(() => {
          const v = videoRef.current;
          const track = s.getVideoTracks()[0];
          const live = track && track.readyState === "live";
          if (v && v.videoWidth > 0 && v.videoHeight > 0 && live) {
            setVideoReady(true);
            if (readinessIntervalRef.current) { clearInterval(readinessIntervalRef.current); readinessIntervalRef.current = null; }
          }
        }, 200);
        // Fallback: mark ready after 1500ms if stream is active
        window.setTimeout(() => {
          const track = s.getVideoTracks()[0];
          if (track && track.readyState === "live") setVideoReady(true);
        }, 1500);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unable to access camera";
      setCameraError(msg);
      setStream(null);
    }
  };

  const stopCamera = () => {
    try {
      stream?.getTracks()?.forEach(t => t.stop());
    } catch {}
    setStream(null);
    setVideoReady(false);
    if (readinessIntervalRef.current) { clearInterval(readinessIntervalRef.current); readinessIntervalRef.current = null; }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const takePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (isFrontCam) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    setPhoto(dataUrl);
    stopCamera();
  };

  // Mobile uses file input capture via startCamera()

  const addEntry = async (type: "in" | "out") => {
    if (!photo || submitting) return;

    // 15-minute cooldown check
    const COOLDOWN_MS = 15 * 60 * 1000;
    const sortedEntries = attendance.slice().sort((a, b) => b.timestamp - a.timestamp);
    const lastEntry = sortedEntries[0];

    if (lastEntry) {
      const diff = Date.now() - lastEntry.timestamp;
      if (diff < COOLDOWN_MS) {
        setShowCooldownModal(true);
        return;
      }
    }

    setSubmitting(true);
    try {
      setCameraError(null);
      let effectiveSchedule = dbSchedule || schedule;
      const now = new Date();

      if (type === "in") {
        const latest = await refreshScheduleFromServer();
        if (latest) {
          effectiveSchedule = latest;
        } else if (!effectiveSchedule) {
          setShowNoScheduleModal(true);
          setSubmitting(false);
          return;
        }

        // AUTO-CLOSE LOGIC: Check for stale open sessions (from previous days)
        const sortedHistory = attendance
          .filter(l => !l.photoDataUrl || !l.photoDataUrl.startsWith("OT_AUTH:"))
          .sort((a, b) => a.timestamp - b.timestamp);
        const lastLog = sortedHistory[sortedHistory.length - 1];

        if (lastLog?.type === "in") {
          const logDate = new Date(lastLog.timestamp);
          const nowCheck = new Date();
          // If the last IN was on a different day
          if (logDate.toDateString() !== nowCheck.toDateString()) {
            // Determine closure time (use PM Out from schedule if available, else 5:00 PM)
            let closeTime = new Date(logDate);
            if (effectiveSchedule.pmOut) {
               const [h, m] = effectiveSchedule.pmOut.split(":").map(Number);
               closeTime.setHours(h, m, 0, 0);
            } else {
               closeTime.setHours(17, 0, 0, 0); // Default to 5:00 PM
            }

            // Ensure closeTime is after logDate (Time In) to prevent sorting issues
            // If Time In was late (after 5PM), close it 1 minute after Time In
            if (closeTime.getTime() <= logDate.getTime()) {
                closeTime = new Date(logDate.getTime() + 60000);
            }

            // Send Auto-Close Request
            try {
              await fetch("/api/attendance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                  idnumber, 
                  type: "out", 
                  timestamp: closeTime.getTime(),
                  validated_by: "SYSTEM_AUTO_CLOSE" // Bypass photo requirement
                }),
              });
              
              // Notify user
              alert(`Your previous attendance from ${logDate.toLocaleDateString()} was automatically closed at ${closeTime.toLocaleTimeString()} because you forgot to time out.`);
              
              // We don't return here; we proceed to allow the NEW Time In to happen immediately.
            } catch (err) {
              console.error("Failed to auto-close previous session", err);
              // Optionally warn user but try to proceed? 
              // If we fail to close, the backend might still accept the new IN depending on logic, 
              // but purely logically we should probably continue or warn.
              // Let's continue to avoid blocking.
            }
          }
        }
      }

      if (effectiveSchedule) {
        const baseDate = new Date(now);
        baseDate.setHours(0, 0, 0, 0);

        const buildTs = (timeStr: string | undefined | null) => {
          if (!timeStr) return null;
          const [h, m] = timeStr.split(":").map(Number);
          const d = new Date(baseDate.getTime());
          d.setHours(h || 0, m || 0, 0, 0);
          return d;
        };

        const amIn = buildTs(effectiveSchedule.amIn || null);
        const amOut = buildTs(effectiveSchedule.amOut || null);
        const pmIn = buildTs(effectiveSchedule.pmIn || null);
        const pmOut = buildTs(effectiveSchedule.pmOut || null);
        const otIn = buildTs(dbSchedule?.otIn);
        const otOut = buildTs(dbSchedule?.otOut);

        const nowMs = now.getTime();

        // ---------------------------------------------------------
        // Shift-based Duplicate Entry & Session Completion Validation
        // ---------------------------------------------------------
        let isOvertime = false;
        if (authorizedOvertime) {
             if (nowMs >= authorizedOvertime.start && nowMs <= authorizedOvertime.end) {
                 isOvertime = true;
             }
        }

        if (!isOvertime) {
            const amOutTime = timeStringToMinutes(effectiveSchedule.amOut || "12:00");
            const pmInTime = timeStringToMinutes(effectiveSchedule.pmIn || "13:00");
            const midpointMinutes = (amOutTime + pmInTime) / 2;

            const getMinutes = (ts: number) => {
                const d = new Date(ts);
                return d.getHours() * 60 + d.getMinutes();
            };
            const isAm = (ts: number) => getMinutes(ts) < midpointMinutes;

            const currentIsAm = isAm(nowMs);

            const todayEntries = attendance.filter(l => {
                const d = new Date(l.timestamp);
                return (
                    d.getFullYear() === now.getFullYear() && 
                    d.getMonth() === now.getMonth() && 
                    d.getDate() === now.getDate() &&
                    !l.is_overtime
                );
            });

            let hasIn = false;
            let hasOut = false;
            for (const entry of todayEntries) {
                if (isAm(entry.timestamp) === currentIsAm) {
                    if (entry.type === 'in') hasIn = true;
                    if (entry.type === 'out') hasOut = true;
                }
            }
            const isSessionComplete = hasIn && hasOut;

            let count = 0;
            for (const entry of todayEntries) {
                if (entry.type === type && isAm(entry.timestamp) === currentIsAm) {
                    count++;
                }
            }

            if (count >= 1 || (type === 'in' && isSessionComplete)) {
                 let msg = "Duplicate entry for this session is not allowed.";
                 
                 if (type === 'in' && isSessionComplete) {
                      if (currentIsAm) {
                          msg = "Morning session already completed. You may time in again for the afternoon session starting at 12:30 PM.";
                      } else {
                          msg = "You have completed your attendance sessions for today. You may time in again tomorrow.";
                      }
                 } else if (count >= 1) {
                      if (type === 'in') msg = "You have already timed in for this session.";
                      else msg = "You have already timed out for this session.";
                 }

                 setDuplicateModalMessage(msg);
                 setShowDuplicateModal(true);
                 setSubmitting(false);
                 return;
            }
        }
        // ---------------------------------------------------------

        if (type === "in") {
          if (!amIn || !amOut || !pmIn || !pmOut) {
            setShowNoScheduleModal(true);
            setSubmitting(false);
            return;
          }

          const morningWindowStart = amIn.getTime() - 30 * 60 * 1000;
          const morningWindowEnd = amOut.getTime();
          const afternoonWindowStart = pmIn.getTime() - 30 * 60 * 1000;
          const afternoonWindowEnd = pmOut.getTime();

          // Allow early time-in for PM session (gap between AM Out and PM In - 30m)
          // The "Golden Rule" will clamp the hours anyway, so no need to block.
          /* 
          if (nowMs >= amOut.getTime() && nowMs < afternoonWindowStart) {
            setBreakPmInText(formatDisplayTime(effectiveSchedule.pmIn));
            setShowBreakModal(true);
            setSubmitting(false);
            return;
          }
          */

          const pmOutMs = pmOut.getTime();
          const otInMs = otIn ? otIn.getTime() : null;
          const otOutMs = otOut ? otOut.getTime() : null;
          const hasOvertime = otInMs !== null && otOutMs !== null;

          // Check for dynamic overtime authorization
          let isOvertimeAuthorized = !!authorizedOvertime;
          
          // If not authorized yet, and we are in a potential overtime scenario, try one last fetch
          if (!isOvertimeAuthorized && nowMs >= pmOutMs && idnumber) {
             try {
                 const res = await fetch(`/api/overtime?student_id=${encodeURIComponent(idnumber)}`);
                 const json = await res.json();
                 if (json.overtime_shifts) {
                     const today = new Date().toLocaleDateString('en-CA');
                     const todayShift = json.overtime_shifts.find((s: any) => s.effective_date === today);
                     if (todayShift) {
                         setAuthorizedOvertime({
                             start: Number(todayShift.overtime_start),
                             end: Number(todayShift.overtime_end)
                         });
                         isOvertimeAuthorized = true;
                     }
                 }
             } catch {}
          }

          if (isOvertimeAuthorized) {
            const otStart = authorizedOvertime!.start;
            const otEnd = authorizedOvertime!.end;
            const allowedStart = otStart - 30 * 60 * 1000;
            
            // If strictly within OT window (plus buffer), we allow it.
            // But we should check if we are TOO early or TOO late relative to that specific window.
            if (nowMs < allowedStart) {
                setCameraError(`Overtime authorized from ${new Date(otStart).toLocaleTimeString()}. Too early.`);
                setSubmitting(false);
                return;
            }
            if (nowMs > otEnd) {
                 setCameraError(`Overtime authorization expired at ${new Date(otEnd).toLocaleTimeString()}.`);
                 setSubmitting(false);
                 return;
            }
          }

          if (!isOvertimeAuthorized) {
            if (nowMs >= pmOutMs) {
                if (!hasOvertime) {
                setLateInPmOutText(`You cannot time in beyond ${formatDisplayTime(effectiveSchedule.pmOut || "")}.`);
                setShowLateInModal(true);
                setSubmitting(false);
                return;
                }
                const overtimeWindowStart = otInMs! - 30 * 60 * 1000;
                const overtimeWindowEnd = otOutMs!;
                if (nowMs < overtimeWindowStart || nowMs >= overtimeWindowEnd) {
                setLateInPmOutText(`You cannot time in beyond ${formatDisplayTime(effectiveSchedule.pmOut || "")}.`);
                setShowLateInModal(true);
                setSubmitting(false);
                return;
                }
            } else {
                if (nowMs >= morningWindowStart && nowMs < morningWindowEnd) {
                } else if (nowMs >= afternoonWindowStart && nowMs < afternoonWindowEnd) {
                } else {
                    setLateInPmOutText("You can time in 30 minutes before your official time in.");
                    setShowLateInModal(true);
                    setSubmitting(false);
                    return;
                }
            }
          }
        } else {
          const todayLogs = attendance.filter(l => {
            if (l.photoDataUrl && l.photoDataUrl.startsWith("OT_AUTH:")) return false;
            const d = new Date(l.timestamp);
            return (
              d.getFullYear() === now.getFullYear() &&
              d.getMonth() === now.getMonth() &&
              d.getDate() === now.getDate()
            );
          }).sort((a, b) => a.timestamp - b.timestamp);

          let hasOpenIn = false;
          let lastType: "in" | "out" | null = null;
          todayLogs.forEach(l => {
            if (l.type === "in") {
              if (lastType !== "in") {
                hasOpenIn = true;
              }
              lastType = "in";
            } else {
              lastType = "out";
              hasOpenIn = false;
            }
          });

          if (!hasOpenIn) {
            setCameraError("You cannot time out without a confirmed time in.");
            setSubmitting(false);
            return;
          }
        }
      }
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idnumber, type, photoDataUrl: photo }),
      });
      const json = await res.json();
      console.log("Submit response:", json);

      if (!res.ok) throw new Error(json?.error || "Failed to submit attendance");
      
      const entry: AttendanceEntry = { type, timestamp: json.ts, photoDataUrl: json.photourl };
      onUpdate([entry, ...attendance]);
      try {
        const refresh = await fetch(`/api/attendance?idnumber=${encodeURIComponent(idnumber)}&limit=50`);
        const rjson = await refresh.json();
        if (refresh.ok && Array.isArray(rjson.entries)) {
          const mapped = rjson.entries.map((e: any) => {
            const sStr = String(e.status || "").trim().toLowerCase();
            const isRejected = sStr === "rejected";
            const isApproved = sStr === "approved" || (!!e.validated_by && !isRejected);
            const status = isRejected ? "Rejected" : isApproved ? "Approved" : "Pending";
            const approvedAtNum = e.validated_at ? Number(new Date(e.validated_at).getTime()) : undefined;
            return {
              id: e.id,
              type: e.type,
              timestamp: e.ts,
              photoDataUrl: e.photourl,
              status,
              approvedAt: approvedAtNum,
              validated_by: e.validated_by,
              is_overtime: e.is_overtime,
            };
          }) as AttendanceEntry[];
          onUpdate(mapped);
        }
      } catch {}
      setPhoto(null);
      try { if (fileInputRef.current) fileInputRef.current.value = ""; } catch {}
      stopCamera();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to submit attendance";
      setCameraError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBeforeSubmit = async (type: "in" | "out") => {
    if (type === "in") {
      await addEntry("in");
      return;
    }

    const now = new Date();
    const effectiveSchedule = dbSchedule || schedule;
    if (!effectiveSchedule) {
      await addEntry("out");
      return;
    }

    const baseDate = new Date(now);
    baseDate.setHours(0, 0, 0, 0);

    const buildTs = (timeStr: string | undefined | null) => {
      if (!timeStr) return null;
      const [h, m] = timeStr.split(":").map(Number);
      const d = new Date(baseDate.getTime());
      d.setHours(h || 0, m || 0, 0, 0);
      return d;
    };

    const amIn = buildTs(effectiveSchedule.amIn || null);
    const amOut = buildTs(effectiveSchedule.amOut || null);
    const pmIn = buildTs(effectiveSchedule.pmIn || null);
    const pmOut = buildTs(effectiveSchedule.pmOut || null);
    const otIn = buildTs(effectiveSchedule.otIn);
    const otOut = buildTs(effectiveSchedule.otOut);

    const nowMs = now.getTime();

    let officialOut: Date | null = null;

    if (amIn && amOut) {
      const start = amIn.getTime() - 30 * 60 * 1000;
      const end = amOut.getTime();
      if (nowMs >= start && nowMs < end) {
        officialOut = amOut;
      }
    }

    if (!officialOut && pmIn && pmOut) {
      const start = pmIn.getTime() - 30 * 60 * 1000;
      const end = pmOut.getTime();
      if (nowMs >= start && nowMs < end) {
        officialOut = pmOut;
      }
    }

    if (!officialOut && otIn && otOut) {
      const start = otIn.getTime() - 30 * 60 * 1000;
      const end = otOut.getTime();
      if (nowMs >= start && nowMs < end) {
        officialOut = otOut;
      }
    }

    if (officialOut && nowMs < officialOut.getTime()) {
      let display = "";
      if (officialOut && amOut && officialOut.getTime() === amOut.getTime()) {
        display = formatDisplayTime(effectiveSchedule.amOut);
      } else if (officialOut && pmOut && officialOut.getTime() === pmOut.getTime()) {
        display = formatDisplayTime(effectiveSchedule.pmOut);
      } else if (effectiveSchedule.otOut) {
        display = formatDisplayTime(effectiveSchedule.otOut);
      }
      setEarlyOutShiftEndText(display);
      setShowEarlyOutModal(true);
      return;
    }

    await addEntry("out");
  };

  // const formatHours = (ms: number) => ... imported from lib

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };

  const statusCounts = useMemo(() => {
    const counts = { Pending: 0, Approved: 0, Rejected: 0 };
    filteredAttendance.forEach(a => {
      const s = a.status || "Pending";
      if (s === "Approved") counts.Approved += 1;
      else if (s === "Rejected") counts.Rejected += 1;
      else counts.Pending += 1;
    });
    return counts;
  }, [filteredAttendance]);

  const processedDays = useMemo(() => {
    const grouped = new Map<string, { date: Date; logs: AttendanceEntry[] }>();
    filteredAttendance.forEach(log => {
      const d = new Date(log.timestamp);
      const key = d.toLocaleDateString();
      if (!grouped.has(key)) grouped.set(key, { date: d, logs: [] });
      grouped.get(key)!.logs.push(log);
    });

    return Array.from(grouped.values())
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map(day => {
        // Deduplicate logs to prevent double-counting
        const uniqueMap = new Map<string, AttendanceEntry>();
        day.logs.forEach(l => {
            const key = l.id ? String(l.id) : `${l.timestamp}-${l.type}`;
            if (!uniqueMap.has(key)) uniqueMap.set(key, l);
        });

        const sorted = Array.from(uniqueMap.values()).sort((a, b) => a.timestamp - b.timestamp);

        const baseDate = new Date(day.date);
        baseDate.setHours(0, 0, 0, 0);

        const src = dbSchedule || schedule;

        // Use centralized schedule builder
        const dateKey = day.date.toLocaleDateString('en-CA');
        const dynamicOt = allOvertimeShifts.find(s => s.effective_date === dateKey);
        
        const effectiveSchedule = buildSchedule(
            baseDate,
            {
                amIn: src?.amIn || "08:00",
                amOut: src?.amOut || "12:00",
                pmIn: src?.pmIn || "13:00",
                pmOut: src?.pmOut || "17:00",
                otIn: src?.otIn,
                otOut: src?.otOut
            },
            dynamicOt ? { start: Number(dynamicOt.overtime_start), end: Number(dynamicOt.overtime_end) } : undefined
        );

        // Smart Pairing Logic
        const noonCutoff = new Date(baseDate).setHours(12, 30, 0, 0);

        const usedIds = new Set<string>();
        const isAvailable = (l: AttendanceEntry) => {
            const key = l.id ? String(l.id) : `${l.timestamp}-${l.type}`;
            return !usedIds.has(key);
        };
        const markUsed = (l: AttendanceEntry) => {
            const key = l.id ? String(l.id) : `${l.timestamp}-${l.type}`;
            usedIds.add(key);
        };

        // 1. Identify Start Points (INs)
        let s1 = sorted.find(l => l.type === "in" && l.timestamp < noonCutoff && isAvailable(l)) || null;
        if (s1) markUsed(s1);

        let s3 = sorted.find(l => l.type === "in" && l.timestamp >= noonCutoff && isAvailable(l)) || null;
        if (s3) markUsed(s3);
        
        // OT IN: strictly after PM IN (if exists), else just after OT Start
        let s5: AttendanceEntry | null = null;
        
        const hasOtConfig = !!dynamicOt || !!src?.otIn;
        const otStartTs = hasOtConfig ? effectiveSchedule.otStart : null;

        if (otStartTs !== null) {
            s5 = sorted.find(l => 
                l.type === "in" && 
                l.timestamp >= otStartTs && 
                (!s3 || l.timestamp > s3.timestamp) &&
                isAvailable(l)
            ) || null;
        }
        if (s5) markUsed(s5);

        // Helper for virtual auto-out
        const today = new Date();
        today.setHours(0,0,0,0);
        const isPastDate = baseDate < today;

        const createVirtualOut = (inEntry: AttendanceEntry, shift: 'am' | 'pm' | 'ot'): AttendanceEntry => {
             const outTs = shift === 'am' ? effectiveSchedule.amOut : (shift === 'pm' ? effectiveSchedule.pmOut : effectiveSchedule.otEnd);
             // Ensure outTs > inEntry.timestamp
             const finalOutTs = outTs > inEntry.timestamp ? outTs : inEntry.timestamp + 60000;
             
             return {
                  id: inEntry.id ? -inEntry.id : -Math.floor(Math.random() * 1000000), // Negative ID for virtual
                  type: 'out',
                  timestamp: finalOutTs,
                  photoDataUrl: '',
                  status: 'Pending',
                  validated_by: 'AUTO TIME OUT'
             };
        };

        // 2. Identify End Points (OUTs) based on Pairs
        
        // s2 (AM OUT): Last OUT after s1 but before s3 (if s3 exists)
        let s2: AttendanceEntry | null = null;
        let crossShiftOut: AttendanceEntry | null = null;

        if (s1) {
            const searchEnd = s3 ? s3.timestamp : (new Date(baseDate).setHours(23, 59, 59, 999));
            const candidates = sorted.filter(l => l.type === "out" && l.timestamp > s1.timestamp && l.timestamp < searchEnd && isAvailable(l));
            const candidate = candidates.pop() || null;
            
            if (candidate) {
                // If the OUT is in the afternoon (cross-shift), and we don't have a separate PM session (s3),
                // we treat it as the Morning OUT (s2) visually because the user wants to see it closed in the morning
                // since they forgot to clock out for lunch.
                s2 = candidate;
                markUsed(s2);

                if (!s3 && candidate.timestamp > noonCutoff) {
                    crossShiftOut = candidate; // Keep track for calculation logic if needed
                }
            } else if (isPastDate) {
                s2 = createVirtualOut(s1, 'am');
            }
        }

        // s4 (PM OUT): Last OUT after s3 but before s5 (if s5 exists)
        let s4: AttendanceEntry | null = null;
        if (s3) {
            const searchEnd = s5 ? s5.timestamp : (new Date(baseDate).setHours(23, 59, 59, 999));
            const candidates = sorted.filter(l => l.type === "out" && l.timestamp > s3.timestamp && l.timestamp < searchEnd && isAvailable(l));
            s4 = candidates.pop() || null;
            if (s4) {
                markUsed(s4);
            } else if (isPastDate) {
                s4 = createVirtualOut(s3, 'pm');
            }
        }

        // s6 (OT OUT): Last OUT after s5
        let s6: AttendanceEntry | null = null;
        if (s5) {
            const candidates = sorted.filter(l => l.type === "out" && l.timestamp > s5.timestamp && isAvailable(l));
            s6 = candidates.pop() || null;
            if (s6) {
                markUsed(s6);
            } else if (isPastDate) {
                s6 = createVirtualOut(s5, 'ot');
            }
        }

        const hasSchedule =
          !!src &&
          typeof src.amIn === "string" &&
          typeof src.amOut === "string" &&
          typeof src.pmIn === "string" &&
          typeof src.pmOut === "string";

        let total = 0;
        const dailyFlags = new Set<string>();

        if (hasSchedule && src) {

        // --- Session Grouping ---
        type Session = { in: AttendanceEntry; out: AttendanceEntry | null };
        const sessions: Session[] = [];
        let currentIn: AttendanceEntry | null = null;
        
        sorted.forEach(log => {
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

        // Calculate Hours using centralized logic
        total = 0;
        
        sessions.forEach(session => {
            if (!session.out) return;

            const { am, pm, ot } = calculateShiftDurations(session.in.timestamp, session.out.timestamp, effectiveSchedule);
            
            const f = checkSessionFlags(session.in.timestamp, session.out.timestamp, effectiveSchedule);
            f.forEach(flag => dailyFlags.add(flag));

            total += am + pm + ot;
        });
        
        // Final round to ensure minute precision - REDUNDANT with centralized logic
        // total = Math.floor(total / 60000) * 60000;

        } else {
            // Fallback: Use centralized logic with defaults if schedule is missing
             // --- Session Grouping ---
            type Session = { in: AttendanceEntry; out: AttendanceEntry | null };
            const sessions: Session[] = [];
            let currentIn: AttendanceEntry | null = null;
            
            sorted.forEach(log => {
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

            total = 0;

            sessions.forEach(session => {
                if (!session.out) return;
                // Use effectiveSchedule which has defaults
                const { am, pm, ot } = calculateShiftDurations(session.in.timestamp, session.out.timestamp, effectiveSchedule);
                
                const f = checkSessionFlags(session.in.timestamp, session.out.timestamp, effectiveSchedule);
                f.forEach(flag => dailyFlags.add(flag));

                total += am + pm + ot;
            });
             // total = Math.floor(total / 60000) * 60000;
        }

        return { date: day.date, s1, s2, s3, s4, s5, s6, total, flags: Array.from(dailyFlags) };
      });
  }, [filteredAttendance, dbSchedule, schedule, allOvertimeShifts]);

  const handleDownloadExcel = () => {
    if (processedDays.length === 0) return;

    let overallTotal = 0;
    let overallValidated = 0;

    processedDays.forEach(day => {
        overallTotal += day.total;
        
        const sched = dbSchedule || schedule;
        if (sched) {
             const isAmValidated = (day.s1?.status === 'Approved' || day.s2?.status === 'Approved');
             const isPmValidated = (day.s3?.status === 'Approved' || day.s4?.status === 'Approved');
             const isOtValidated = (day.s5?.status === 'Approved' || day.s6?.status === 'Approved');
             
             // Build ShiftSchedule object
             const dateObj = new Date(day.date);
             const dateKey = dateObj.toLocaleDateString('en-CA');
             const dynamicOt = allOvertimeShifts.find(s => s.effective_date === dateKey);
             
             const scheduleObj = buildSchedule(
                dateObj,
                {
                    amIn: sched.amIn || "08:00",
                    amOut: sched.amOut || "12:00",
                    pmIn: sched.pmIn || "13:00",
                    pmOut: sched.pmOut || "17:00",
                    otIn: sched.otIn,
                    otOut: sched.otOut
                },
                dynamicOt ? { start: Number(dynamicOt.overtime_start), end: Number(dynamicOt.overtime_end) } : undefined
             );

             if (isAmValidated) {
                 const d = calculateShiftDurations(day.s1?.timestamp || 0, day.s2?.timestamp || 0, scheduleObj);
                 overallValidated += d.am + d.pm + d.ot;
             }
             if (isPmValidated) {
                 const d = calculateShiftDurations(day.s3?.timestamp || 0, day.s4?.timestamp || 0, scheduleObj);
                 overallValidated += d.am + d.pm + d.ot;
             }
             if (isOtValidated) {
                 const d = calculateShiftDurations(day.s5?.timestamp || 0, day.s6?.timestamp || 0, scheduleObj);
                 overallValidated += d.am + d.pm + d.ot;
             }
        }
    });

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
      const fmt = (slot: typeof day.s1) => slot ? formatTime(slot.timestamp) : "-";
      const fmtOut = (slot: typeof day.s1) => {
        if (!slot) return "-";
        if (slot.validated_by === "SYSTEM_AUTO_CLOSE" || slot.validated_by === "AUTO TIME OUT") {
            return "AUTO TIME OUT";
        }
        return formatTime(slot.timestamp);
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

      const amStatus = getStatus(day.s1, day.s2);
      let pmStatus = "-";
      if (day.s3 || day.s4) {
          pmStatus = getStatus(day.s3, day.s4);
      } else if (day.s5 || day.s6) {
          pmStatus = getStatus(day.s5, day.s6);
      }

      return [
        day.date.toLocaleDateString(), // DATE
        fmt(day.s1),                   // MORNING IN
        fmtOut(day.s2),                // MORNING OUT
        amStatus,                      // STATUS
        fmt(day.s3),                   // AFTERNOON IN
        fmtOut(day.s4),                // AFTERNOON OUT
        fmt(day.s5),                   // OVERTIME IN
        fmtOut(day.s6),                // OVERTIME OUT
        pmStatus,                      // STATUS
        formatHours(day.total)         // TOTAL HOURS
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
      { wch: 12 }, // Status
      { wch: 12 }, // Afternoon In
      { wch: 18 }, // Afternoon Out
      { wch: 12 }, // Overtime In
      { wch: 18 }, // Overtime Out
      { wch: 12 }, // Status
      { wch: 15 }  // Total
    ];

    // 7. Create Workbook and Download
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
    XLSX.writeFile(workbook, `Attendance_${user?.firstname || "Report"}_${user?.lastname || ""}.xlsx`);
  };

  return (
    <div className="w-full space-y-6">
      {cameraError && (
        <div className="rounded-xl bg-red-50 border border-red-100 p-4 flex items-center gap-3 text-red-700 animate-in fade-in slide-in-from-top-2 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <span className="text-sm font-medium">{cameraError}</span>
        </div>
      )}

      {/* Overtime Indicator */}
      {authorizedOvertime && (
        <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4 flex items-center gap-3 text-indigo-700 animate-in fade-in slide-in-from-top-2 shadow-sm">
           <div className="bg-indigo-100 p-2 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
           </div>
           <div className="flex flex-col">
              <span className="text-sm font-bold">Overtime Authorized</span>
              <span className="text-xs opacity-90">
                You can time in from {new Date(authorizedOvertime.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} to {new Date(authorizedOvertime.end).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}.
              </span>
           </div>
        </div>
      )}

      {showDuplicateModal && <DuplicateEntryModal onClose={() => setShowDuplicateModal(false)} message={duplicateModalMessage} />}

      {showBreakModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Cannot Time In</h2>
            <p className="text-gray-700 mb-4">
              You cant time in until {breakPmInText || "the afternoon shift starts"}.
            </p>
            <button
              onClick={() => setShowBreakModal(false)}
              className="w-full px-4 py-2 bg-[#F97316] text-white rounded-xl font-bold"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {showNoScheduleModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Cannot Time In</h2>
            <p className="text-gray-700 mb-4">
              Official Time is not set by the supervisor. You cannot time in.
            </p>
            <button
              onClick={() => setShowNoScheduleModal(false)}
              className="w-full px-4 py-2 bg-[#F97316] text-white rounded-xl font-bold"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {showLateInModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Cannot Time In</h2>
            <p className="text-gray-700 mb-4">
              {lateInPmOutText || "You cannot time in beyond your official time."}
            </p>
            <button
              onClick={() => setShowLateInModal(false)}
              className="w-full px-4 py-2 bg-[#F97316] text-white rounded-xl font-bold"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {showEarlyOutModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Time Out Early?</h2>
            <p className="text-gray-700 mb-4">
              Are you sure you want to time out early? Any remaining time until{" "}
              {earlyOutShiftEndText || "your official time out"} will not be counted toward your OJT hours.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEarlyOutModal(false)}
                className="flex-1 px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowEarlyOutModal(false);
                  await addEntry("out");
                }}
                className="flex-1 px-4 py-2 bg-[#F97316] text-white rounded-xl font-bold hover:bg-[#EA580C]"
              >
                Yes, Time Out
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistoryMode ? (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Attendance History</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Full attendance records for {studentName || idnumber}.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadExcel}
                  disabled={processedDays.length === 0}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-green-700 hover:bg-green-50 hover:border-green-200 transition-colors gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                  Export Attendance
                </button>
                <button
                  onClick={() => setShowHistoryMode(false)}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Back to Recent View
                </button>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1 block">Search</label>
                  <input 
                    type="text" 
                    value={attendanceSearchQuery}
                    onChange={(e) => setAttendanceSearchQuery(e.target.value)}
                    placeholder="Search by type or date..." 
                    className="w-full rounded-lg border border-gray-400 px-4 py-2.5 text-sm font-medium text-gray-900 placeholder:text-gray-500 focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all"
                  />
                </div>
                <div className="w-full sm:w-40">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1 block">Filter by Month</label>
                  <select
                    value={monthFilter}
                    onChange={e => setMonthFilter(e.target.value)}
                    className="w-full rounded-lg border border-gray-400 px-3 py-2.5 text-sm font-medium text-gray-900 bg-white focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all"
                  >
                    <option value="">All months</option>
                    {monthOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-full sm:w-auto">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1 block">Filter by Date</label>
                  <input 
                    type="date" 
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full sm:w-48 rounded-lg border border-gray-400 px-4 py-2.5 text-sm font-medium text-gray-900 placeholder:text-gray-500 focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all bg-white"
                  />
                </div>
                {(attendanceSearchQuery || filterDate || monthFilter) && (
                  <div className="flex items-end">
                    <button 
                      onClick={() => { setAttendanceSearchQuery(""); setFilterDate(""); setMonthFilter(""); }}
                      className="mb-[1px] px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="px-3 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-700 font-medium">
                  Pending: {statusCounts.Pending}
                </span>
                <span className="px-3 py-1 rounded-full border border-green-100 bg-green-50 text-green-700 font-medium">
                  Validated: {statusCounts.Approved}
                </span>
                <span className="px-3 py-1 rounded-full border border-red-100 bg-red-50 text-red-700 font-medium">
                  Unvalidated: {statusCounts.Rejected}
                </span>
              </div>

              <div className="mt-4 border-t border-gray-100 pt-4">
                {processedDays.length > 0 ? (
                  <>
                    <div className="hidden md:block overflow-x-auto custom-scrollbar">
                      <table className="w-full text-[11px] text-left">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
                          <tr>
                            <th rowSpan={2} className="px-4 py-3 border-r border-gray-100 min-w-[110px] text-left align-bottom pb-4">Date</th>
                            <th colSpan={2} className="px-2 py-2 text-center border-r border-gray-100 border-b bg-gray-100/50">Morning</th>
                            <th colSpan={2} className="px-2 py-2 text-center border-r border-gray-100 border-b bg-gray-100/50">Afternoon</th>
                            <th colSpan={2} className="px-2 py-2 text-center border-r border-gray-100 border-b bg-gray-100/50">Overtime</th>
                            <th rowSpan={2} className="px-4 py-3 text-right align-bottom pb-4">Total Hours</th>
                          </tr>
                          <tr>
                            <th className="px-2 py-2 text-center border-r border-gray-100 min-w-[80px] text-[10px] tracking-wider">Time In</th>
                            <th className="px-2 py-2 text-center border-r border-gray-100 min-w-[80px] text-[10px] tracking-wider">Time Out</th>
                            <th className="px-2 py-2 text-center border-r border-gray-100 min-w-[80px] text-[10px] tracking-wider">Time In</th>
                            <th className="px-2 py-2 text-center border-r border-gray-100 min-w-[80px] text-[10px] tracking-wider">Time Out</th>
                            <th className="px-2 py-2 text-center border-r border-gray-100 min-w-[80px] text-[10px] tracking-wider">Time In</th>
                            <th className="px-2 py-2 text-center border-r border-gray-100 min-w-[80px] text-[10px] tracking-wider">Time Out</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {processedDays.map((day, i) => (
                            <tr key={i} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap border-r border-gray-100">
                                {day.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                              </td>
                              {[day.s1, day.s2, day.s3, day.s4, day.s5, day.s6].map((slot, idx) => {
                                const pairOut = (idx === 0 || idx === 1) ? day.s2 : (idx === 2 || idx === 3) ? day.s4 : day.s6;
                                const isSessionAutoTimeOut = pairOut?.validated_by === "SYSTEM_AUTO_CLOSE" || pairOut?.validated_by === "AUTO TIME OUT";

                                return (
                                <td key={idx} className={`px-1.5 py-2 border-r border-gray-100 text-center min-w-[100px] ${isSessionAutoTimeOut && slot?.type === 'out' ? 'align-middle' : 'align-top'}`}>
                                  {slot ? (
                                    <div className={`flex flex-col items-center gap-1 ${isSessionAutoTimeOut && slot.type === 'out' ? 'justify-center h-full' : ''}`}>
                                          {isSessionAutoTimeOut && slot.type === 'out' ? (
                                            <span className="text-[10px] font-bold text-red-500 py-1 text-center w-full block">AUTO TIME OUT</span>
                                          ) : (
                                            <span className="text-[11px] font-medium text-gray-800">
                                              {formatTime(slot.timestamp)}
                                            </span>
                                          )}
                                          {!(isSessionAutoTimeOut && slot.type === 'out') && (
                                            slot.photoDataUrl ? (
                                              <div
                                                className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100 cursor-zoom-in"
                                                onClick={() => setSelectedImage({ url: slot.photoDataUrl, timestamp: slot.timestamp })}
                                              >
                                                <img src={slot.photoDataUrl} alt="Log" className="w-full h-full object-cover" />
                                              </div>
                                            ) : (
                                              <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-50 flex flex-col items-center justify-center text-gray-400">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                <span className="text-[9px] mt-1">System</span>
                                              </div>
                                            )
                                          )}
                                          <span className={`text-[10px] font-medium ${getStatusColorClass(slot)}`}>
                                            {formatStatusLabel(slot)}
                                          </span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-300 block py-4">-</span>
                                  )}
                                </td>
                                );
                              })}
                              <td className="px-6 py-4 text-right font-bold text-gray-900">
                                <div className="flex flex-col items-end gap-1">
                                  <span>{formatHours(day.total)}</span>
                                  {day.flags && day.flags.includes("MISSED_LUNCH_PUNCH") && (
                                    <div className="flex items-center gap-1 text-amber-600" title="Missed Lunch Punch: Session spans across lunch break">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                      <span className="text-[10px] font-medium uppercase">Lunch Policy</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="md:hidden space-y-3">
                      {processedDays.map((day, i) => (
                        <div key={i} className="p-4 rounded-2xl border border-gray-200 bg-white">
                          <div className="text-sm font-semibold text-gray-900">
                            {day.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-3">
                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Morning</div>
                              <div className="grid grid-cols-2 gap-3">
                                {[day.s1, day.s2].map((slot, idx) => {
                                  const pairOut = day.s2;
                                  const isSessionAutoTimeOut = pairOut?.validated_by === "SYSTEM_AUTO_CLOSE" || pairOut?.validated_by === "AUTO TIME OUT";

                                  return (
                                  <div key={idx} className="flex flex-col items-center gap-1">
                                    {slot ? (
                                      <>
                                          {isSessionAutoTimeOut && slot.type === 'out' ? (
                                            <span className="text-[10px] font-bold text-red-500 py-1 text-center w-full block">AUTO TIME OUT</span>
                                          ) : (
                                            <span className="text-[11px] font-medium text-gray-800">
                                              {formatTime(slot.timestamp)}
                                            </span>
                                          )}
                                          {!(isSessionAutoTimeOut && slot.type === 'out') && (
                                            slot.photoDataUrl ? (
                                              <div
                                                className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100 cursor-zoom-in"
                                                onClick={() => setSelectedImage({ url: slot.photoDataUrl, timestamp: slot.timestamp })}
                                              >
                                                <img src={slot.photoDataUrl} alt="Log" className="w-full h-full object-cover" />
                                              </div>
                                            ) : (
                                              <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-50 flex flex-col items-center justify-center text-gray-400">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                <span className="text-[9px] mt-1">System</span>
                                              </div>
                                            )
                                          )}
                                            <span className={`text-[10px] font-medium ${getStatusColorClass(slot)}`}>
                                              {formatStatusLabel(slot)}
                                            </span>
                                      </>
                                    ) : (
                                      <span className="text-gray-300">-</span>
                                    )}
                                  </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Afternoon</div>
                              <div className="grid grid-cols-2 gap-3">
                                {[day.s3, day.s4].map((slot, idx) => {
                                  const pairOut = day.s4;
                                  const isSessionAutoTimeOut = pairOut?.validated_by === "SYSTEM_AUTO_CLOSE" || pairOut?.validated_by === "AUTO TIME OUT";

                                  return (
                                  <div key={idx} className="flex flex-col items-center gap-1">
                                    {slot ? (
                                      <>
                                          {isSessionAutoTimeOut && slot.type === 'out' ? (
                                            <span className="text-[10px] font-bold text-red-500 py-1 text-center w-full block">AUTO TIME OUT</span>
                                          ) : (
                                            <span className="text-[11px] font-medium text-gray-800">
                                              {formatTime(slot.timestamp)}
                                            </span>
                                          )}
                                          {!(isSessionAutoTimeOut && slot.type === 'out') && (
                                            slot.photoDataUrl ? (
                                              <div
                                                className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100 cursor-zoom-in"
                                                onClick={() => setSelectedImage({ url: slot.photoDataUrl, timestamp: slot.timestamp })}
                                              >
                                                <img src={slot.photoDataUrl} alt="Log" className="w-full h-full object-cover" />
                                              </div>
                                            ) : (
                                              <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-50 flex flex-col items-center justify-center text-gray-400">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                <span className="text-[9px] mt-1">System</span>
                                              </div>
                                            )
                                          )}
                                            <span className={`text-[10px] font-medium ${getStatusColorClass(slot)}`}>
                                              {formatStatusLabel(slot)}
                                            </span>
                                      </>
                                    ) : (
                                      <span className="text-gray-300">-</span>
                                    )}
                                  </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Overtime</div>
                              <div className="grid grid-cols-2 gap-3">
                                {[day.s5, day.s6].map((slot, idx) => {
                                  const pairOut = day.s6;
                                  const isSessionAutoTimeOut = pairOut?.validated_by === "SYSTEM_AUTO_CLOSE" || pairOut?.validated_by === "AUTO TIME OUT";

                                  return (
                                  <div key={idx} className="flex flex-col items-center gap-1">
                                    {slot ? (
                                      <>
                                          {isSessionAutoTimeOut && slot.type === 'out' ? (
                                            <span className="text-[10px] font-bold text-red-500 py-1 text-center w-full block">AUTO TIME OUT</span>
                                          ) : (
                                            <span className="text-[11px] font-medium text-gray-800">
                                              {formatTime(slot.timestamp)}
                                            </span>
                                          )}
                                          {!(isSessionAutoTimeOut && slot.type === 'out') && (
                                            slot.photoDataUrl ? (
                                              <div
                                                className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100 cursor-zoom-in"
                                                onClick={() => setSelectedImage({ url: slot.photoDataUrl, timestamp: slot.timestamp })}
                                              >
                                                <img src={slot.photoDataUrl} alt="Log" className="w-full h-full object-cover" />
                                              </div>
                                            ) : (
                                              <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-50 flex flex-col items-center justify-center text-gray-400">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                <span className="text-[9px] mt-1">System</span>
                                              </div>
                                            )
                                          )}
                                            <span className={`text-[10px] font-medium ${getStatusColorClass(slot)}`}>
                                              {formatStatusLabel(slot)}
                                            </span>
                                      </>
                                    ) : (
                                      <span className="text-gray-300">-</span>
                                    )}
                                  </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Total Hours</div>
                              <div className="text-sm font-bold text-gray-900 mt-1 text-right">
                                {formatHours(day.total)}
                              </div>
                              {day.flags && day.flags.includes("MISSED_LUNCH_PUNCH") && (
                                <div className="mt-2 flex items-center justify-end gap-1 text-amber-600">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                  <span className="text-[10px] font-medium uppercase">Lunch Policy Violation</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-50"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <p>No attendance records found.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#F97316]"></div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Time Entry</div>
                </div>
                <div className={`px-3 py-1 rounded-lg text-xs font-bold border ${isCheckedIn ? "bg-green-50 text-green-700 border-green-100" : "bg-gray-50 text-gray-600 border-gray-100"}`}>
                  {isCheckedIn ? "CURRENTLY TIMED IN" : "READY TO TIME IN"}
                </div>
              </div>

              <div className="p-6 sm:p-8 flex flex-col items-center">
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="user"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden" 
                />
                
                {(() => {
                    const todayAuth = attendance.find(l => {
                        if (!l.photoDataUrl?.startsWith("OT_AUTH:")) return false;
                        const d = new Date(l.timestamp);
                        return d.toDateString() === new Date().toDateString();
                    });
                    if (todayAuth) {
                        return (
                          <div className="w-full max-w-md mb-4">
                            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-center">
                              <div className="text-[11px] font-semibold text-green-700 uppercase tracking-wide flex items-center justify-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                Overtime Authorized
                              </div>
                              <div className="mt-1 text-xs text-green-600">
                                You have been authorized for overtime today. You can now Time In.
                              </div>
                            </div>
                          </div>
                        );
                    }
                    return null;
                })()}

                {officialScheduleText ? (
                  <div className="w-full max-w-md mb-4">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center">
                      <div className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
                        Official Schedule
                      </div>
                      <div className="mt-1 text-sm font-bold text-gray-900">
                        {officialScheduleText}
                      </div>
                      <div className="mt-1 text-[11px] text-gray-500">
                        You can time in 30 minutes before your official time in.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full max-w-md mb-4">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
                      <div className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide">
                        Official Schedule
                      </div>
                      <div className="mt-1 text-sm font-bold text-amber-900">
                        Official Time is not set by the supervisor
                      </div>
                    </div>
                  </div>
                )}

                <div className="relative w-full rounded-2xl bg-slate-900 border border-gray-200 shadow-inner flex items-center justify-center group h-[60vh] max-h-[700px] min-h-[280px] overflow-hidden">
                  {!photo && !stream && (
                    <div className="flex flex-col items-center gap-3 text-gray-500">
                      <div className="p-4 rounded-full bg-slate-800 text-slate-400 group-hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                      </div>
                      <span className="text-sm font-medium">Tap Start Camera to take a photo</span>
                    </div>
                  )}
                  {!photo && stream && (
                   <>
                     <video 
                       ref={videoRef} 
                       autoPlay 
                       playsInline 
                       muted 
                       className={`w-full h-full object-contain ${isFrontCam ? "transform scale-x-[-1]" : ""}`} 
                     />
                     <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                       <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10">
                         <span className="inline-block px-4 py-2 rounded-full bg-blue-600/90 text-white font-semibold text-sm shadow-lg">
                           {cameraFeedback || "Frame Your Face"}
                         </span>
                       </div>
                       <svg width="280" height="360" viewBox="0 0 280 360" className="opacity-90">
                         <ellipse cx="140" cy="190" rx="115" ry="155" fill="none" stroke="#2563eb" strokeWidth="6" />
                       </svg>
                     </div>
                   </>
                 )}
                  {photo && (
                    <img src={photo} alt="Captured photo" className="w-full h-full object-contain" />
                  )}
                </div>

                <div className="mt-8 w-full max-w-md flex flex-col items-center gap-4">
                  {!photo && (
                    <>
                      {(!stream) && (
                        <button
                          onClick={startCamera}
                          className="w-full rounded-xl px-8 py-4 text-white font-bold text-lg bg-[#F97316] hover:bg-[#EA580C] transition-all active:scale-95 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                          Start Camera
                        </button>
                      )}
                      {stream && (
                        <div className="flex gap-3 w-full">
                          <button
                            onClick={takePhoto}
                            disabled={!videoReady}
                            className={`flex-1 rounded-xl px-6 py-3 text-white font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 ${videoReady ? "bg-[#F97316] hover:bg-[#EA580C]" : "bg-gray-400 cursor-not-allowed"}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
                            Take Photo
                          </button>
                          <button
                            onClick={stopCamera}
                            className="flex-1 rounded-xl px-6 py-3 text-gray-700 font-bold bg-gray-100 hover:bg-gray-200 transition-all active:scale-95 shadow-md"
                          >
                            Stop Camera
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {photo && (
                    <div className="flex flex-col gap-3 w-full animate-in fade-in slide-in-from-bottom-4">
                      <button
                        onClick={() => handleBeforeSubmit(isCheckedIn ? "out" : "in")}
                        disabled={submitting}
                        className={`w-full rounded-xl px-6 py-4 text-white font-bold text-lg transition-all active:scale-95 shadow-md flex items-center justify-center gap-3 ${isCheckedIn ? "bg-gray-900 hover:bg-black" : "bg-[#F97316] hover:bg-[#EA580C]"} ${submitting ? "opacity-70 cursor-wait" : ""}`}
                      >
                        {submitting ? (
                          <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                          </>
                        ) : (
                          isCheckedIn ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                              Confirm Time Out
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
                              Confirm Time In
                            </>
                          )
                        )}
                      </button>
                      <button
                        onClick={() => { setPhoto(null); try { if (fileInputRef.current) fileInputRef.current.value = ""; } catch {} }}
                        disabled={submitting}
                        className={`w-full rounded-xl px-4 py-3 text-gray-600 font-semibold bg-gray-100 hover:bg-gray-200 transition-all active:scale-95 ${submitting ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        Retake Photo
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[600px] overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recent Logs</div>
                <button
                  onClick={() => setShowHistoryMode(true)}
                  className="text-xs font-bold text-[#F97316] hover:text-[#EA580C] transition-colors hover:underline"
                >
                  View All
                </button>
              </div>
              <div className="p-3 overflow-y-auto custom-scrollbar flex-1 space-y-2">
                {uniqueAttendance.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                    <div className="p-3 rounded-full bg-gray-50 mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </div>
                    <p className="text-sm font-medium">No records yet</p>
                  </div>
                ) : (
                  uniqueAttendance
                    .slice()
                    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
                    .map((entry, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => setSelectedAttendanceEntry(entry)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 hover:border-orange-200 hover:shadow-md transition-all group text-left"
                      >
                          {entry.photoDataUrl ? (
                            <div className="h-9 w-9 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200 border border-gray-100 relative flex items-center justify-center">
                              <img src={entry.photoDataUrl} alt="Log" className="h-full w-full object-cover" />
                            </div>
                          ) : (entry.validated_by === "SYSTEM_AUTO_CLOSE" || entry.validated_by === "AUTO TIME OUT") ? (
                            <div className="h-9 w-9 flex-shrink-0 flex items-center justify-center">
                            </div>
                          ) : (
                            <div className="h-9 w-9 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200 border border-gray-100 relative flex items-center justify-center"></div>
                          )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={`text-[11px] font-semibold uppercase ${(entry.validated_by === "SYSTEM_AUTO_CLOSE" || entry.validated_by === "AUTO TIME OUT") ? "text-red-600" : "text-gray-700"}`}>
                              {(entry.validated_by === "SYSTEM_AUTO_CLOSE" || entry.validated_by === "AUTO TIME OUT") ? "AUTO TIME OUT" : (entry.type === "in" ? "Time In" : "Time Out")}
                            </span>
                            {!(entry.validated_by === "SYSTEM_AUTO_CLOSE" || entry.validated_by === "AUTO TIME OUT") && (
                            <span className={`text-[10px] font-medium ${getStatusColorClass(entry)}`}>
                              {formatStatusLabel(entry)}
                            </span>
                            )}
                          </div>
                          {!(entry.validated_by === "SYSTEM_AUTO_CLOSE" || entry.validated_by === "AUTO TIME OUT") ? (
                          <div className="text-xs font-medium text-gray-900 mt-0.5">
                            {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                          ) : (
                            <div className="text-xs font-medium text-gray-400 mt-0.5">--:--</div>
                          )}
                          <div className="text-[10px] text-gray-400">
                            {new Date(entry.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </div>
                        </div>
                      </button>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors z-[110]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div
            className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center justify-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-black w-auto h-auto flex flex-col">
              <img
                src={selectedImage.url}
                alt="Attendance Log"
                className="max-w-full max-h-[80vh] object-contain"
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 pt-20 text-center">
                <p className="text-white font-mono text-xl font-bold drop-shadow-md">
                  {new Date(selectedImage.timestamp).toLocaleString(undefined, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Details Modal */}
      {selectedAttendanceEntry && (
        <AttendanceDetailsModal
          entry={selectedAttendanceEntry}
          onClose={() => setSelectedAttendanceEntry(null)}
        />
      )}

      {/* Cooldown Modal */}
      {showCooldownModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 text-orange-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Please Wait</h2>
            <p className="text-gray-600 mb-6">
              You can only time in/out after 15mins.
            </p>
            <button
              onClick={() => setShowCooldownModal(false)}
              className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors"
            >
              Okay, I understand
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportDetailsModal({ report, onClose }: { report: ReportEntry; onClose: () => void }) {
  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
           <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Report Details</h2>
                <p className="text-xs text-gray-500 font-medium">Week {report.week}</p>
              </div>
           </div>
           <button 
             onClick={onClose}
             className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
           >
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
           </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
           {/* Header Info */}
           <div className="flex items-start justify-between">
              <div>
                 <h3 className="text-xl font-bold text-gray-900">{report.title}</h3>
                 <p className="text-sm text-gray-500 mt-1">Submitted on {new Date(report.submittedAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-bold uppercase tracking-wide border border-green-100">
                Submitted
              </span>
           </div>

           {/* Instructor Feedback */}
           {report.instructorComment && (
              <div className="mt-6 animate-in slide-in-from-top-2">
                 <div className="bg-red-50 rounded-xl p-5 border border-red-100 text-gray-800 shadow-sm relative">
                    <div className="flex items-center gap-2 mb-2 text-red-700">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                        <h3 className="font-bold">Instructor Feedback</h3>
                    </div>
                    {report.instructorComment}
                 </div>
              </div>
           )}

           {/* Attachment */}
           {report.fileName && (
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between group hover:border-[#F97316] hover:bg-orange-50/10 transition-all">
                <div className="flex items-center gap-3">
                   <div className="h-10 w-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-[#F97316]">
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                   </div>
                   <div>
                     <p className="text-sm font-bold text-gray-900 group-hover:text-[#F97316] transition-colors">{report.fileName}</p>
                     <p className="text-xs text-gray-500">Attachment</p>
                   </div>
                </div>
                <a href={report.fileUrl || "#"} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-white border border-gray-200 text-[#F97316] rounded-lg text-sm font-semibold hover:bg-[#F97316] hover:text-white transition-colors shadow-sm">
                   Download
                </a>
              </div>
           )}

           {/* Content */}
           <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Report Content</h4>
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 min-h-[150px] text-gray-700 whitespace-pre-wrap leading-relaxed">
                {report.body || "No text content."}
              </div>
           </div>
        </div>
        
        <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
           <button 
             onClick={onClose}
             className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
           >
             Close
           </button>
        </div>
      </div>
    </div>
  );
}

function DuplicateEntryModal({ onClose, message }: { onClose: () => void; message: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col items-center text-center">
        <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Attention</h3>
        <p className="text-gray-600 mb-6 leading-relaxed">
          {message}
        </p>
        <button 
          onClick={onClose}
          className="w-full py-3 bg-[#F97316] text-white font-bold rounded-xl hover:bg-[#EA580C] transition-colors shadow-lg shadow-orange-200"
        >
          I Understand
        </button>
      </div>
    </div>
  );
}

export function ReportsView({ 
  idnumber, 
  reports, 
  drafts = [], 
  deadlines = [],
  onUpdate, 
  onDraftUpdate 
}: { 
  idnumber: string; 
  reports: ReportEntry[]; 
  drafts?: ReportEntry[]; 
  deadlines?: { week: number; date: string }[];
  onUpdate: (next: ReportEntry[]) => void; 
  onDraftUpdate: (drafts: ReportEntry[]) => void 
}) {
  const [showAllReportsModal, setShowAllReportsModal] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [viewingReport, setViewingReport] = useState<ReportEntry | null>(null);
  const [draftToDelete, setDraftToDelete] = useState<ReportEntry | null>(null);
  
  // Editor State
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [existingFile, setExistingFile] = useState<{name: string, type: string} | null>(null);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);

  const allowedTypes = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);

  // Helper to determine week status
  const slots = useMemo(() => {
    const sortedReports = [...reports].sort((a, b) => a.submittedAt - b.submittedAt);
    const sortedDeadlines = [...(deadlines || [])].sort((a, b) => a.week - b.week);
    
    const result = sortedDeadlines.map((d, index) => {
      // Determine date range
      const deadlineDate = new Date(d.date);
      deadlineDate.setHours(23, 59, 59, 999);

      let startDate: Date;
      if (index === 0) {
        startDate = new Date(deadlineDate);
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
      } else {
        const prev = new Date(sortedDeadlines[index - 1].date);
        startDate = new Date(prev);
        startDate.setDate(startDate.getDate() + 1);
        startDate.setHours(0, 0, 0, 0);
      }
      
      // Find report for this week
      const report = sortedReports.find(r => r.week === d.week) || 
                     sortedReports.find(r => !r.week && r.submittedAt >= startDate.getTime() && r.submittedAt <= deadlineDate.getTime());

      const isSubmitted = !!report;
      
      // Check locks - sequential flow
      let isPrevSubmitted = true;
      if (index > 0) {
          const prevD = sortedDeadlines[index - 1];
          const prevEndDate = new Date(prevD.date);
          prevEndDate.setHours(23, 59, 59, 999);
          const prevStartDate = new Date(prevEndDate);
          prevStartDate.setDate(prevStartDate.getDate() - 6);
          prevStartDate.setHours(0, 0, 0, 0);
          
          const prevReport = sortedReports.find(r => r.week === prevD.week) || 
                             sortedReports.find(r => !r.week && r.submittedAt >= prevStartDate.getTime() && r.submittedAt <= prevEndDate.getTime());
          isPrevSubmitted = !!prevReport;
      }
      
      const isLocked = index > 0 && !isPrevSubmitted;
      
      const now = new Date();
      const isFuture = now < startDate;
      
      let status: "Submitted" | "Pending" | "Overdue" | "Locked" | "Future" | "Under Review" | "Reviewed" = "Pending";
      if (isSubmitted) {
          if (report && (report.isViewedByInstructor || report.instructorComment)) {
              status = "Reviewed";
          } else {
              status = "Under Review";
          }
      }
      else if (isLocked) status = "Locked";
      else if (isFuture) status = "Future";
      else if (now > deadlineDate) status = "Overdue";
      
      return {
        week: d.week,
        start: startDate,
        end: deadlineDate,
        report,
        status,
        isLocked: status === "Locked"
      };
    });

    // If the last slot is Submitted, append a synthetic "Next Week" slot so the user has a place to land
    const lastSlot = result[result.length - 1];
    if (lastSlot && (lastSlot.status === "Reviewed" || lastSlot.status === "Under Review")) {
        const nextWeek = lastSlot.week + 1;
        
        // Calculate dates for next week
        const nextStart = new Date(lastSlot.end);
        nextStart.setDate(nextStart.getDate() + 1); // Start next day
        nextStart.setHours(0, 0, 0, 0);
        
        const nextEnd = new Date(nextStart);
        nextEnd.setDate(nextEnd.getDate() + 6); // 7 days duration
        nextEnd.setHours(23, 59, 59, 999);
        
        // Check if report already exists for this future week
        const report = sortedReports.find(r => r.week === nextWeek);
        const isSubmitted = !!report;
        
        result.push({
           week: nextWeek,
           start: nextStart,
           end: nextEnd,
           report,
           status: isSubmitted ? (report && (report.isViewedByInstructor || report.instructorComment) ? "Reviewed" : "Under Review") : "Future",
           isLocked: false // Always unlocked if previous is submitted
        });
    }

    return result;
  }, [reports, deadlines]);

  // Auto-select logic
  useEffect(() => {
    // 1. If currently selected week has a report (Submitted), move away from it.
    // We strictly prevent the editor from showing submitted reports.
    if (selectedWeek !== null) {
      const current = slots.find(s => s.week === selectedWeek);
      // Check if report exists (regardless of status label)
      if (current && current.report) {
         // Try to find ANY non-submitted week (Pending, Overdue, Future, Locked)
         // We treat Locked as actionable now since we unlocked them in UI for drafting.
         const nextActionable = slots.find(s => !s.report);
         
         if (nextActionable) {
            setSelectedWeek(nextActionable.week);
         } else {
            // If all have reports, deselect. This triggers the fallback "Future" slot.
            setSelectedWeek(null);
         }
         return;
      }
    }

    // 2. Initial selection if nothing selected
    if (selectedWeek === null && slots.length > 0) {
      // Priority: First without report (Pending/Overdue/Future/Locked)
      const firstActionable = slots.find(s => !s.report);
      
      if (firstActionable) {
        setSelectedWeek(firstActionable.week);
      }
      // If all have reports, do nothing (selectedWeek remains null, showing dummy Future slot).
    }
  }, [slots, selectedWeek]);

  // Editor Handlers
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const f = e.target.files?.[0] || null;
    if (!f) { setFile(null); return; }
    const lower = f.name.toLowerCase();
    const ok = allowedTypes.has(f.type) || lower.endsWith(".pdf") || lower.endsWith(".doc") || lower.endsWith(".docx");
    if (!ok) {
      setError("Only Word (.doc/.docx) and PDF files are allowed.");
      setFile(null);
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("File must be 10MB or smaller.");
      setFile(null);
      return;
    }
    setFile(f);
  };

  const clearForm = () => {
    setTitle("");
    setBody("");
    setFile(null);
    setExistingFile(null);
    setDraftId(null);
    setDraftSavedAt(null);
    setError(null);
  };

  const loadDraft = (d: ReportEntry) => {
    setTitle(d.title || "");
    setBody(d.body || "");
    setFile(null);
    setExistingFile(d.fileName ? {name: d.fileName, type: d.fileType || ""} : null);
    setDraftId(d.id || null);
    setDraftSavedAt(d.submittedAt);
    setError(null);
    setSelectedWeek(d.week || null);
  };

  const prevSelectedWeek = useRef<number | null>(null);

  // Auto-load content (Draft) whenever selectedWeek changes
  // NOTE: We intentionally DO NOT load submitted reports into the editor anymore.
  // The editor is strictly for drafting/submitting. Submitted reports are viewed in Modals.
  useEffect(() => {
    if (!selectedWeek) return;

    const slot = slots.find(s => s.week === selectedWeek);
    if (!slot) return;

    const weekChanged = selectedWeek !== prevSelectedWeek.current;
    prevSelectedWeek.current = selectedWeek;

    // If it's a submitted slot, we don't want to show it in the editor.
    // The auto-select logic should have redirected us away, but if we are here, clear the form.
    if (slot.report) {
       clearForm();
    } else {
       if (weekChanged) {
          // If we switched weeks, check if we are already viewing a valid draft for this week (e.g. via loadDraft)
          // If not, clear the form to start fresh. This allows creating multiple drafts for the same week.
          // We NO LONGER auto-load the first draft found, to avoid "locking" the week to a specific draft.
          const currentDraft = drafts.find(d => d.id === draftId);
          const isViewingValidDraft = currentDraft && currentDraft.week === selectedWeek;
          
          if (!isViewingValidDraft) {
             clearForm();
          }
       }
    }
  }, [selectedWeek, drafts, slots, draftId]);


  const saveDraft = async () => {
    if (!selectedWeek) return;
    setSubmitting(true);
    try {
      const payload: any = {
        idnumber,
        title: (file || existingFile) ? (file?.name || existingFile?.name) : title.trim(),
        body: body.trim(),
        fileName: file?.name || existingFile?.name,
        fileType: file?.type || existingFile?.type,
        isDraft: true,
        week: selectedWeek
      };
      if (draftId) payload.id = draftId;

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save draft");
      
      const savedReport = json.report;
      
      const existingIndex = drafts.findIndex(d => d.id === savedReport.id);
      let newDrafts = [...drafts];
      if (existingIndex >= 0) {
        newDrafts[existingIndex] = savedReport;
      } else {
        newDrafts = [savedReport, ...newDrafts];
      }
      onDraftUpdate(newDrafts);
      setError(null);
      // Clear form after saving to allow creating new drafts immediately
      clearForm();
    } catch (e) {
      setError("Failed to save draft.");
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async () => {
    if (!selectedWeek) return;
    setError(null);
    const t = title.trim();
    const b = body.trim();
    if (!t && !file && !existingFile) {
      setError("Provide a title or attach a file.");
      return;
    }
    
    setSubmitting(true);
    try {
      let fileData = null;
      if (file) {
        fileData = await toBase64(file);
      }

      const payload: any = {
        idnumber,
        title: (file || existingFile) ? (file?.name || existingFile?.name) : t,
        body: b,
        fileName: file?.name || existingFile?.name,
        fileType: file?.type || existingFile?.type,
        fileData: fileData,
        isDraft: false,
        week: selectedWeek
      };
      if (draftId) payload.id = draftId;

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to submit report");
      
      onUpdate([json.report, ...reports]);
      if (draftId) {
        onDraftUpdate(drafts.filter(d => d.id !== draftId));
      }
      clearForm();
    } catch (e) {
       const msg = e instanceof Error ? e.message : "Failed to submit report";
       setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteDraft = (draft: ReportEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!draft.id) return;
    setDraftToDelete(draft);
  };

  const confirmDeleteDraft = async () => {
    if (!draftToDelete?.id) return;
    
    try {
      const res = await fetch(`/api/reports?id=${draftToDelete.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete draft");

      const newDrafts = drafts.filter(d => d.id !== draftToDelete.id);
      onDraftUpdate(newDrafts);
      
      // If we are currently editing this draft, clear the form
      if (draftId === draftToDelete.id) {
        clearForm();
      }
      setDraftToDelete(null);
    } catch (e) {
      console.error("Failed to delete draft:", e);
      setError("Failed to delete draft");
    }
  };

  const currentSlot = useMemo(() => slots.find(s => s.week === selectedWeek), [slots, selectedWeek]);
  
  // FALLBACK: If no slot is selected, simulate a "Next Week" slot so the editor is ALWAYS visible.
  // This removes the "No Week Selected" state entirely.
  const activeSlot = currentSlot || {
      week: (slots[slots.length-1]?.week || 0) + 1,
      status: "Future" as const,
      start: new Date(), // Dummy dates, won't be critical for just showing the editor
      end: new Date(),
      report: null,
      isLocked: false
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
      
      {/* Left Column - Main Editor / Viewer */}
      <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <div className={`h-2.5 w-2.5 rounded-full ${
                    (activeSlot.status === "Reviewed" || activeSlot.status === "Under Review") ? "bg-green-500" :
                    activeSlot.status === "Overdue" ? "bg-red-500" :
                    activeSlot.status === "Pending" ? "bg-[#F97316]" : "bg-gray-400"
                 }`}></div>
                 <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">
                   {activeSlot.report ? "Report Details" : "Compose Report"}
                 </h2>
               </div>
               <span className="text-sm font-semibold text-gray-500">Week {activeSlot.week}</span>
            </div>

            <div className="p-6 flex-1 flex flex-col">
               {/* LOCKED STATE - BYPASSED for Drafting */}
               {activeSlot.isLocked && false ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                     <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                     </div>
                     <h3 className="text-xl font-bold text-gray-900 mb-2">Report Locked</h3>
                     <p className="text-gray-500 max-w-md">
                        This report is currently locked. Please submit your report for the previous week to unlock this one.
                     </p>
                  </div>
               ) : (
                  /* EDIT / VIEW-IN-EDITOR MODE */
                  <div className="space-y-6 flex-1 flex flex-col">
                     {activeSlot.report && (
                        <div className={`border rounded-xl p-4 flex items-center gap-3 ${
                           activeSlot.status === "Reviewed" ? "bg-green-50 border-green-200 text-green-800" :
                           "bg-orange-50 border-orange-200 text-orange-800"
                        }`}>
                           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                           <div className="text-sm font-medium">
                              {activeSlot.status === "Reviewed" ? "Report Reviewed." : "Report Under Review."} <button onClick={() => setViewingReport(activeSlot.report!)} className={`underline font-bold ${activeSlot.status === "Reviewed" ? "hover:text-green-900" : "hover:text-orange-900"}`}>View Details</button>
                           </div>
                        </div>
                     )}

                     {error && (
                        <div className="rounded-xl bg-red-50 border border-red-100 p-4 flex items-center gap-3 text-red-700">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                          <span className="text-sm font-medium">{error}</span>
                        </div>
                     )}

                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1.5">Report Title</label>
                       <input 
                         value={title} 
                         onChange={e => setTitle(e.target.value)}
                         disabled={!!file || !!activeSlot.report}
                         placeholder={!!file ? "Title will be the filename" : "e.g. Week " + activeSlot.week + " Accomplishment Report"}
                         className={`w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all shadow-sm ${!!file || !!activeSlot.report ? "bg-gray-100 cursor-not-allowed opacity-70" : ""}`}
                       />
                     </div>
                     
                     <div className="flex-1">
                       <label className="block text-sm font-bold text-gray-700 mb-1.5">Content</label>
                       <textarea 
                        value={body}
                        onChange={e => setBody(e.target.value)}
                        disabled={!!file || !!activeSlot.report}
                        placeholder={!!file ? "Text editing is disabled when a file is attached." : "Describe your activities, learnings, and accomplishments this week..."}
                        className={`w-full h-full min-h-[250px] rounded-xl border border-gray-200 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all resize-none shadow-sm ${!!file || !!activeSlot.report ? "bg-gray-100 cursor-not-allowed opacity-70" : ""}`}
                      />
                     </div>

                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1.5">Attachment (Optional)</label>
                       {!file && !existingFile ? (
                          activeSlot.report ? (
                             <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 text-gray-400 text-sm text-center">
                                No attachment
                             </div>
                          ) : (
                             <div className="relative group">
                               <input 
                                 type="file" 
                                 onChange={onFileChange}
                                 accept=".pdf,.doc,.docx"
                                 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                               />
                               <div className="w-full rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-6 flex flex-col items-center justify-center text-center group-hover:border-[#F97316] group-hover:bg-orange-50/30 transition-all">
                                 <div className="p-2 rounded-full bg-white shadow-sm mb-2 text-gray-400 group-hover:text-[#F97316] transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                 </div>
                                 <p className="text-sm font-semibold text-gray-700">Click to upload or drag and drop</p>
                                 <p className="text-xs text-gray-400 mt-1">PDF or Word documents up to 10MB</p>
                               </div>
                             </div>
                          )
                       ) : (
                          <div className="flex items-center justify-between p-4 rounded-xl border border-blue-100 bg-blue-50/50">
                             <div className="flex items-center gap-3 min-w-0">
                                <div className="p-2 rounded-lg bg-white border border-blue-100 shadow-sm text-blue-600">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 truncate">{file ? file.name : existingFile?.name}</p>
                                </div>
                             </div>
                             {!activeSlot.report && (
                                <button onClick={() => { setFile(null); setExistingFile(null); }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                             )}
                          </div>
                       )}
                     </div>

                     <div className="pt-6 border-t border-gray-100 flex justify-between items-center mt-auto">
                        {!activeSlot.report ? (
                           <>
                              <div className="flex items-center gap-2">
                                 <button onClick={saveDraft} disabled={submitting} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 hover:text-[#F97316] transition-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                                    Save Draft
                                 </button>
                                 <button onClick={clearForm} className="px-4 py-2.5 rounded-xl text-gray-400 font-bold text-sm hover:bg-gray-50 hover:text-gray-600 transition-all">
                                    Clear
                                 </button>
                              </div>
                              <button onClick={submit} disabled={submitting} className="px-6 py-2.5 rounded-xl bg-[#F97316] text-white font-bold text-sm hover:bg-[#EA580C] transition-all shadow-sm disabled:opacity-70 flex items-center gap-2">
                                {submitting && <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                                Submit Report
                              </button>
                           </>
                        ) : (
                           <div className="text-sm text-gray-500 italic w-full text-center">
                              This report has been submitted and cannot be edited.
                           </div>
                        )}
                     </div>
                  </div>
               )}
            </div>
          </div>
      </div>

      {/* Right Column - Sidebar */}
      <div className="space-y-6">
         
         {/* My Drafts */}
         <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
             <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
               <div className="flex items-center gap-2">
                 <div className="h-2 w-2 rounded-full bg-[#F97316]"></div>
                 <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">My Drafts</span>
               </div>
               <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold">{drafts.length}</span>
             </div>
             <div className="p-4">
                {drafts.length === 0 ? (
                  <div className="text-center py-8">
                     <div className="h-10 w-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mx-auto mb-3">
                       <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                     </div>
                     <p className="text-sm font-medium text-gray-900">No drafts saved</p>
                     <p className="text-xs text-gray-500 mt-1">Your unfinished reports will be saved here automatically</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {drafts.map(draft => (
                       <div 
                         key={draft.id} 
                         onClick={() => loadDraft(draft)}
                         className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50 transition-all group cursor-pointer relative"
                       >
                         <div className="flex justify-between items-start mb-1 pr-6">
                            <span className="text-xs font-bold text-[#F97316]">Week {draft.week}</span>
                            <span className="text-[10px] text-gray-400">{new Date(draft.submittedAt).toLocaleDateString()}</span>
                         </div>
                         <p className="text-sm font-bold text-gray-900 truncate pr-6">{draft.title || "Untitled Report"}</p>
                         
                         <button 
                           onClick={(e) => deleteDraft(draft, e)}
                           className="absolute top-2 right-2 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                           title="Delete Draft"
                         >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                         </button>
                       </div>
                    ))}
                  </div>
                )}
             </div>
         </div>

         {/* Weekly Reports List */}
         <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
             <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
               <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Weekly Reports</span>
               <button 
                 onClick={() => setShowAllReportsModal(true)}
                 className="text-xs font-bold text-[#F97316] hover:text-[#EA580C] hover:underline transition-colors"
               >
                 View All
               </button>
             </div>
             <div className="max-h-[600px] overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {slots.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p>No deadlines set</p>
                  </div>
                ) : (
                  slots.map(slot => (
                     <button
                       key={slot.week}
                       onClick={() => {
                        if ((slot.status === "Reviewed" || slot.status === "Under Review") && slot.report) {
                          setViewingReport(slot.report);
                        } else {
                          setSelectedWeek(slot.week);
                        }
                      }}
                       className={`w-full text-left p-4 rounded-xl border transition-all duration-200 relative overflow-hidden ${
                         selectedWeek === slot.week 
                           ? "border-[#F97316] ring-1 ring-[#F97316] bg-orange-50/30" 
                           : "border-gray-100 hover:border-orange-200 hover:shadow-sm bg-white"
                       }`}
                     >
                       <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                             <span className={`text-xs font-bold uppercase ${selectedWeek === slot.week ? "text-[#F97316]" : "text-gray-500"}`}>Week {slot.week}</span>
                             {slot.report?.instructorComment && (
                                <div className="flex items-center gap-1 text-red-600 animate-pulse" title="Instructor Comment">
                                   <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                                   </svg>
                                </div>
                             )}
                          </div>
                          
                          {slot.status === "Reviewed" ? (
                             <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wide">Reviewed</span>
                          ) : slot.status === "Under Review" ? (
                             <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold uppercase tracking-wide">Under Review</span>
                          ) : slot.status === "Overdue" ? (
                             <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wide">Overdue</span>
                          ) : slot.status === "Pending" ? (
                             <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold uppercase tracking-wide">Action Required</span>
                          ) : (
                             <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wide">Locked</span>
                          )}
                       </div>
                       
                       <div className={`text-sm font-bold mb-1 ${slot.isLocked ? "text-gray-400" : "text-gray-900"}`}>
                          {slot.start.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} - {slot.end.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                       </div>
                       
                       <div className="text-xs text-gray-500 mb-3">
                          Deadline: {slot.end.toLocaleDateString(undefined, {weekday: 'long', month: 'long', day: 'numeric'})}
                       </div>
                       
                       <div className={`text-xs font-bold flex items-center gap-1 ${
                          (slot.status === "Reviewed") ? "text-green-600" : 
                          slot.status === "Under Review" ? "text-orange-600" :
                          slot.isLocked ? "text-gray-400" : "text-[#F97316]"
                       }`}>
                          {(slot.status === "Reviewed" || slot.status === "Under Review") ? (
                             <>
                               <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                               View Report
                             </>
                          ) : slot.isLocked ? (
                             <>
                               <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                               Locked
                             </>
                          ) : null}
                       </div>

                     </button>
                  ))
                )}
             </div>
         </div>
      </div>

      {viewingReport && (
        <ReportDetailsModal 
          report={viewingReport} 
          onClose={() => setViewingReport(null)} 
        />
      )}

      {showAllReportsModal && (
        <SubmittedReportsModal 
          reports={reports} 
          onClose={() => setShowAllReportsModal(false)}
          onViewReport={(report) => {
            setShowAllReportsModal(false);
            setViewingReport(report);
          }}
        />
      )}

      {draftToDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete Draft?</h2>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete this draft? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDraftToDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold bg-white hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteDraft}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
              >
                Delete Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProfileView({ student, supervisor, onUpdate }: { student: User | null, supervisor?: User | null, onUpdate?: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cropper State
  const [showCropModal, setShowCropModal] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const fullname = student ? `${student.firstname || ""} ${student.middlename ? student.middlename + " " : ""}${student.lastname || ""}`.trim() : "";
  
  // Use supervisor's company/location
  const company = supervisor?.company || "N/A";
  const location = supervisor?.location || "N/A";

  const handleAvatarDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!student?.idnumber) return;
    if (!confirm("Are you sure you want to remove your profile picture?")) return;

    setIsDeleting(true);
    try {
        const res = await fetch(`/api/profile/avatar?idnumber=${student.idnumber}`, {
            method: "DELETE",
        });
        
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to remove avatar");
        
        if (onUpdate) onUpdate();
        setMessage("Profile picture removed successfully.");
    } catch (e) {
        console.error(e);
        setMessage(e instanceof Error ? e.message : "Failed to remove avatar");
    } finally {
        setIsDeleting(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !student?.idnumber) return;
    
    // Validate file type
    if (!file.type.startsWith("image/")) {
        setMessage("Please select an image file.");
        return;
    }
    
    // Validate file size (e.g., 5MB)
    if (file.size > 5 * 1024 * 1024) {
        setMessage("Image size must be less than 5MB.");
        return;
    }

    try {
        const fileData = await toBase64(file) as string;
        setAvatarPreview(fileData);
        setZoom(1);
        setCrop({ x: 0, y: 0 });
        setShowCropModal(true);
        // Clear input so same file can be selected again if cancelled
        if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
        console.error("Error reading file:", e);
        setMessage("Failed to read file.");
    }
  };

  const handleCropConfirm = async () => {
    if (!avatarPreview || !student?.idnumber) return;

    setIsUploading(true);
    try {
        let finalImageBase64 = avatarPreview;
        if (croppedAreaPixels) {
            try {
                const cropped = await getCroppedImg(avatarPreview, croppedAreaPixels);
                if (cropped) finalImageBase64 = cropped;
            } catch (e) {
                console.error("Cropping failed:", e);
            }
        }

        const res = await fetch("/api/profile/avatar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                idnumber: student.idnumber,
                fileData: finalImageBase64
            })
        });
        
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to upload avatar");
        
        if (onUpdate) onUpdate();
        setMessage("Profile picture updated successfully.");
        setShowCropModal(false);
        setAvatarPreview(null);
    } catch (e) {
        console.error(e);
        setMessage(e instanceof Error ? e.message : "Failed to upload avatar");
    } finally {
        setIsUploading(false);
    }
  };

  const changePassword = async () => {
    setMessage(null);
    if (!student?.idnumber) { setMessage("Unable to identify user."); return; }
    if (!currentPassword) { setMessage("Current password is required."); return; }
    if (!newPassword || newPassword.length < 6) { setMessage("Password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { setMessage("Passwords do not match."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          idnumber: student.idnumber, 
          currentPassword, 
          newPassword 
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update password");
      setMessage("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update password";
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
      {/* Main Profile Section */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="h-40 bg-gradient-to-r from-orange-400 to-orange-600 relative">
             <div className="absolute inset-0 bg-black/10"></div>
          </div>
          <div className="px-8 pb-8 relative">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 -mt-16 mb-6">
              <div 
                className="relative group h-32 w-32 rounded-2xl border-4 border-white bg-white shadow-md flex items-center justify-center text-4xl font-bold text-gray-800 shrink-0 overflow-hidden cursor-pointer"
                onClick={() => !isUploading && fileInputRef.current?.click()}
              >
                {student?.avatar_url ? (
                  <img src={student.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  (fullname?.[0] || student?.firstname?.[0] || student?.lastname?.[0] || "?").toUpperCase()
                )}
                
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    {isUploading ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    ) : (
                        <span className="text-white text-xs font-medium">Change</span>
                    )}
                </div>
                
                {/* Action Buttons */}
                <div className="absolute bottom-2 right-2 flex gap-2 z-20">
                    {student?.avatar_url && (
                        <button 
                            onClick={handleAvatarDelete}
                            disabled={isDeleting || isUploading}
                            className="h-8 w-8 bg-red-500 text-white rounded-full shadow-lg border-2 border-white flex items-center justify-center transition-transform hover:scale-110"
                            title="Remove photo"
                        >
                             {isDeleting ? (
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                             ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                             )}
                        </button>
                    )}
                    <div className="h-8 w-8 bg-[#F97316] text-white rounded-full shadow-lg border-2 border-white flex items-center justify-center transition-transform group-hover:scale-110">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                        </svg>
                    </div>
                </div>

                <input 
                    type="file" 
                    ref={fileInputRef} 
                    hidden 
                    accept="image/*" 
                    onChange={handleAvatarUpload}
                    disabled={isUploading}
                />
              </div>
              <div className="text-center sm:text-left mb-2">
                 <h1 className="text-2xl font-bold text-gray-900">{fullname || "Unknown User"}</h1>
                 <p className="text-gray-500 font-medium">{student?.idnumber || "No ID"}</p>
              </div>
            </div>
            
            <div className="border-t border-gray-100 pt-8">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-6 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F97316]"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                Personal Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">First Name</label>
                  <div className="text-gray-900 font-semibold">{student?.firstname || "-"}</div>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Last Name</label>
                  <div className="text-gray-900 font-semibold">{student?.lastname || "-"}</div>
                </div>

                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                   <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Role</label>
                   <div className="text-gray-900 font-semibold capitalize">Student</div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-8 mt-8">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-6 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F97316]"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>
                Academic Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                 <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Course</label>
                  <div className="text-gray-900 font-semibold">{student?.course || "N/A"}</div>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Section</label>
                  <div className="text-gray-900 font-semibold">{student?.section || "N/A"}</div>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Supervisor</label>
                  <div className="text-gray-900 font-semibold">
                    {supervisor ? `${(supervisor.firstname || "").trim()} ${(supervisor.lastname || "").trim()}`.trim() || supervisor.idnumber : "N/A"}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-8 mt-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F97316]"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                  OJT Placement
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Company</label>
                  <div className="text-gray-900 font-semibold">{company}</div>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Location</label>
                  <div className="text-gray-900 font-semibold">{location}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar / Security Section */}
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden sticky top-8">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
             <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
               <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F97316]"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
               Security
             </h3>
             <p className="text-xs text-gray-500 mt-1">Manage your account password.</p>
          </div>
          
          <div className="p-6 space-y-5">
            {message && (
              <div className={`text-sm rounded-xl p-4 border flex items-start gap-3 ${message.includes("success") ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                 <div className="shrink-0 mt-0.5">
                   {message.includes("success") ? 
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> : 
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                   }
                 </div>
                 <span>{message}</span>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-[#F97316] focus:ring-4 focus:ring-orange-500/10 outline-none transition-all placeholder:text-gray-400"
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-[#F97316] focus:ring-4 focus:ring-orange-500/10 outline-none transition-all placeholder:text-gray-400"
                   placeholder="Enter new password"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-[#F97316] focus:ring-4 focus:ring-orange-500/10 outline-none transition-all placeholder:text-gray-400"
                   placeholder="Confirm new password"
                />
              </div>
            </div>

            <button
              disabled={loading}
              onClick={changePassword}
              className="w-full rounded-xl bg-gray-900 text-white font-bold py-3 hover:bg-black transition-all active:scale-95 touch-manipulation disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-gray-900/10 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Updating...</span>
                </>
              ) : (
                "Update Password"
              )}
            </button>
          </div>
        </div>
      </div>

      {showCropModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Adjust Photo</h3>
              <button 
                onClick={() => {
                  setShowCropModal(false);
                  setAvatarPreview(null);
                }}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="relative h-64 w-full bg-gray-900 overflow-hidden">
              {avatarPreview && (
                <Cropper
                  image={avatarPreview}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                  cropShape="round"
                  showGrid={false}
                  style={{
                    containerStyle: { background: '#111827' },
                    cropAreaStyle: { border: '2px solid rgba(255, 255, 255, 0.5)' }
                  }}
                />
              )}
              
              <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
                <div className="bg-black/50 backdrop-blur-md text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-2">
                  <Move size={12} />
                  <span>Drag to Reposition</span>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-medium text-gray-500">
                  <span className="flex items-center gap-1.5"><ZoomOut size={14}/> Zoom Out</span>
                  <span className="flex items-center gap-1.5">Zoom In <ZoomIn size={14}/></span>
                </div>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600 hover:accent-orange-700 transition-all"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCropModal(false);
                    setAvatarPreview(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCropConfirm}
                  disabled={isUploading}
                  className="flex-1 py-2.5 rounded-xl bg-orange-600 text-white font-semibold text-sm hover:bg-orange-700 transition-colors shadow-lg shadow-orange-600/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    "Save Photo"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
