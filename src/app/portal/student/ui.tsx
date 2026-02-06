"use client";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AttendanceDetailsModal } from "@/components/AttendanceDetailsModal";
import { supabase } from "@/lib/supabaseClient";
import { buildSchedule, calculateSessionDuration, checkSessionFlags, ShiftSchedule, formatHours, formatDisplayTime, normalizeTimeString, timeStringToMinutes, calculateShiftDurations, isLate, calculateHoursWithinOfficialTime, determineShift } from "@/lib/attendance";
import Cropper from "react-easy-crop";
import getCroppedImg from "@/lib/cropImage";
import { Move, ZoomIn, ZoomOut, X, Eye, EyeOff } from "lucide-react";


export type AttendanceEntry = { 
  id?: number; 
  type: "in" | "out"; 
  timestamp: number; 
  photoDataUrl: string; 
  status?: "Pending" | "Approved" | "Rejected" | "Validated" | "VALIDATED" | "OFFICIAL" | "ADJUSTED" | "Official" | "REJECTED"; 
  approvedAt?: number;
  validated_by?: string | null;
  is_overtime?: boolean;
  rendered_hours?: number;
  validated_hours?: number;
  official_time_in?: string;
  official_time_out?: string;
};
export type ReportEntry = { 
  id?: number; 
  title: string; 
  body?: string; 
  fileName?: string; 
  fileType?: string; 
  fileUrl?: string; 
  photoName?: string;
  photoUrl?: string;
  photos?: { name: string; url: string; type?: string }[];
  submittedAt: number; 
  instructorComment?: string; 
  isViewedByInstructor?: boolean; 
  week?: number; 
};
type ServerAttendanceEntry = { 
  type: "in" | "out"; 
  ts: number; 
  photourl: string; 
  status?: string; 
  validated_by?: string | null;
  validated_at?: string | null;
};
const DUE_DATE_TEXT = new Date(Date.now() + 86400000).toLocaleDateString();

function getAttendanceStatus(entry?: AttendanceEntry | null): "Pending" | "Approved" | "Rejected" | "Official" {
  if (!entry || !entry.status) return "Pending";
  if (entry.status === "Approved") return "Approved";
  if (entry.status === "Rejected") return "Rejected";
  if (entry.status === "Official") return "Official";
  return "Pending";
}

function formatStatusLabel(entry: AttendanceEntry): string {
  const status = getAttendanceStatus(entry);
  if (status === "Approved") return "Validated";
  if (status === "Rejected") return "Unvalidated";
  if (status === "Official") return "Official";
  return "Pending";
}

function getStatusColorClass(entry?: AttendanceEntry | null): string {
  const status = getAttendanceStatus(entry);
  if (status === "Approved") return "text-green-600";
  if (status === "Rejected") return "text-red-600";
  if (status === "Official") return "text-blue-600";
  return "text-yellow-600";
}

function getEntryPhoto(entry?: AttendanceEntry | null): string {
  if (!entry) return "";
  return entry.photoDataUrl || (entry as any)?.photourl || (entry as any)?.photoUrl || "";
}

const toBase64 = (file: File) => new Promise((resolve, reject) => {
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = document.createElement("img");
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        // Resize to max 1280px width/height to save space
        const MAX_SIZE = 1280;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Compress to JPEG quality 0.7
            const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
            resolve(dataUrl);
        } else {
            // Fallback if canvas fails
            resolve(event.target?.result);
        }
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  } else {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
  }
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
  courseIds?: number[];
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
              onClick={async () => {
                try {
                  const id = typeof window !== "undefined" ? (localStorage.getItem("idnumber") || "") : "";
                  if (!id) {
                    alert("No account detected");
                    return;
                  }
                  const res = await fetch("/api/push/test", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ idnumber: id, role: "student", message: "Student test push" })
                  });
                  const json = await res.json().catch(() => ({}));
                  if (json && json.success) {
                    alert(`Test notification sent (${json.sent}/${json.subs_found})`);
                  } else {
                    let msg = "Failed";
                    if (json?.error) msg += `: ${json.error}`;
                    if (json?.env && (!json.env.has_public || !json.env.has_private)) {
                      msg += "\nMissing server VAPID keys";
                    }
                    if (json?.subs_found === 0) {
                      msg += "\nNo subscribed devices found";
                    }
                    alert(msg);
                  }
                } catch (e: any) {
                  alert(e?.message || "Error sending test push");
                }
              }}
              className="inline-flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white font-semibold px-3 py-1 md:px-4 md:py-1.5 text-sm transition-colors"
            >
              Test Push
            </button>
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
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
          <h2 className="text-lg font-bold text-gray-900">Submitted Reports</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {reports.length === 0 ? (
            <div className="text-center text-gray-500 py-8 text-sm">No reports submitted yet.</div>
          ) : (
            reports.slice().sort((a, b) => b.submittedAt - a.submittedAt).map((report, idx) => (
              <button 
                key={idx} 
                onClick={() => onViewReport?.(report)}
                disabled={!onViewReport}
                className={`w-full text-left bg-gray-50 rounded-xl p-3 border border-gray-100 transition-colors ${onViewReport ? "hover:bg-gray-100 cursor-pointer" : "cursor-default"}`}
              >
                <div className="flex items-center justify-between mb-1">
                   <div className="font-bold text-gray-900 text-sm">{report.title}</div>
                   <div className="text-[10px] text-gray-500">{new Date(report.submittedAt).toLocaleDateString()}</div>
                </div>
                {report.body && <p className="text-xs text-gray-600 line-clamp-2 mb-2">{report.body}</p>}
                <div className="flex flex-col gap-2 mt-1">
                    <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${report.isViewedByInstructor || report.instructorComment ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                            {report.isViewedByInstructor || report.instructorComment ? "Reviewed" : "Under Review"}
                        </span>
                        {report.fileName && (
                            <span className="text-[9px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16l4-4h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>
                                File
                            </span>
                        )}
                        {report.instructorComment && (
                            <span className="text-[9px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse" title="Instructor Comment">
                                <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                                Comment
                            </span>
                        )}
                    </div>
                    {report.instructorComment && (
                         <div className="bg-red-50/50 border border-red-100 rounded-lg p-2 text-[10px] text-gray-700">
                             <div className="font-bold text-red-700 mb-0.5 flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
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
        <div className="p-3 border-t border-gray-100 bg-gray-50 sticky bottom-0 z-10">
            <button onClick={onClose} className="w-full py-2 bg-white border border-gray-200 rounded-xl text-gray-700 font-bold hover:bg-gray-50 transition-colors text-sm shadow-sm">
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
  validatedProgress,
  onTimeIn,
  onTimeOut,
  onViewAttendance,
  onViewReports,
  companyText,
  supervisorText,
  locationText,
  recentRows,
  deadlines,
  nextDeadline,
  now,
  schedule,
  overtimeShifts = [],
}: { 
  attendance: AttendanceEntry[]; 
  reports: ReportEntry[]; 
  totalHours: string; 
  totalValidatedHours: string;
  targetHours: number;
  validatedProgress?: number;
  onTimeIn: () => void;
  onTimeOut: () => void;
  onViewAttendance: () => void;
  onViewReports: () => void;
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
  deadlines?: { week: number; date: string; status: "submitted" | "pending" }[];
  nextDeadline?: { week: number; date: string; status: "submitted" | "pending" };
  now?: number;
  schedule?: { amIn: string; amOut: string; pmIn: string; pmOut: string; otIn?: string; otOut?: string } | null;
  overtimeShifts?: { effective_date: string; overtime_start: number; overtime_end: number }[];
}): React.ReactElement {
  const [selectedAttendanceEntry, setSelectedAttendanceEntry] = useState<AttendanceEntry | null>(null);
  const [showAllReportsModal, setShowAllReportsModal] = useState(false);
  const [showAllDeadlinesModal, setShowAllDeadlinesModal] = useState(false);

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
      validated_by: log.validated_by,
      status: log.status
    }));
  }, [attendance]);

  const isReportSubmitted = nextDeadline?.status === "submitted";



  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      {/* Top Row: Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         {/* Card 1: Total Hours (Orange) */}
         <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 relative overflow-hidden flex flex-col justify-between min-h-[120px]">
            <div className="flex items-center gap-4">
               {/* Icon */}
               <div className="w-12 h-12 rounded-xl bg-[#F97316] flex items-center justify-center flex-shrink-0 text-white shadow-sm shadow-orange-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
               </div>
               {/* Text Content */}
               <div className="flex flex-col">
                  <div className="text-sm font-bold text-gray-500">Total Hours</div>
                  <div className="text-2xl font-bold text-gray-900 tracking-tight leading-none mt-1">{hoursText}</div>
               </div>
            </div>
         </div>

         {/* Card 2: Validated Hours (Green) */}
         <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 relative overflow-hidden flex flex-col justify-center min-h-[120px]">
            <div className="flex items-center gap-4">
               {/* Icon */}
               <div className="w-12 h-12 rounded-xl bg-[#16A34A] flex items-center justify-center flex-shrink-0 text-white shadow-sm shadow-green-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
               </div>
               {/* Text Content */}
               <div className="flex flex-col">
                  <div className="text-sm font-bold text-gray-500">Total Validated Hours</div>
                  <div className="text-2xl font-bold text-gray-900 tracking-tight leading-none mt-1">{totalValidatedHours}</div>
               </div>
            </div>
             
             {/* Progress Bar */}
             <div className="mt-4">
                <div className="flex flex-col items-end mb-1.5">
                   <div className="text-xs font-medium text-gray-500">Goal: {targetHours} hrs</div>
                   <div className="text-base font-bold text-gray-900">{(validatedProgress || 0).toFixed(1)}%</div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                   <div className="bg-[#16A34A] h-full rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${validatedProgress || 0}%` }}>
                   </div>
                </div>
             </div>
          </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
         {/* Recent Activity (Left Column) */}
         <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-6 h-full">
               <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">Recent Activity</h3>
               </div>
               
               <div className="space-y-4">
                  {recentLogs.length === 0 ? (
                      <div className="bg-gray-50 rounded-xl border border-gray-100 p-8 text-center text-gray-400 italic">No recent activity</div>
                  ) : recentLogs.map((log, i) => {
                      const isAutoTimeOut = log.type === 'out' && (log.validated_by === 'SYSTEM_AUTO_CLOSE' || log.validated_by === 'AUTO TIME OUT');
                      // Hide auto time-out entries unless they are official (edited by admin)
                      if (isAutoTimeOut && log.status !== 'Official') {
                          return null;
                      }

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
                               <div className={`font-bold text-base ${isAutoTimeOut ? 'text-gray-900' : 'text-gray-900'}`}>
                                 {log.type === 'in' ? 'Time In' : 'Time Out'}
                               </div>
                               <div className="text-xs font-medium text-gray-400 mt-0.5">{log.date}</div>
                            </div>
                         </div>
                         <div className="font-bold text-gray-900 text-lg">
                             {log.time}
                             {log.status === 'Official' && (
                                 <span className="block text-[10px] font-normal text-gray-500">(Official Time-Out)</span>
                             )}
                         </div>
                      </div>
                      );
                  })}
               </div>
            </div>
         </div>

         {/* Sidebar (Right Column) */}
         <div className="flex flex-col gap-6 h-full">
            {/* Weekly Report Deadlines */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col h-full">
               <div className="flex items-center justify-between mb-4">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                     Weekly Report Deadlines
                  </div>
                  <button 
                onClick={() => setShowAllDeadlinesModal(true)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline whitespace-nowrap flex-shrink-0"
                  >
                    View All
                  </button>
               </div>
               
               <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center justify-between">
                  {nextDeadline ? (
                    <>
                      <div className="flex items-center gap-3">
                         <div>
                            <div className="text-sm font-bold text-gray-900">Week {nextDeadline.week}</div>
                            {isReportSubmitted ? (
                                <div className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full inline-block mt-1">Submitted</div>
                            ) : (
                                <div className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full inline-block mt-1">Not submitted yet</div>
                            )}
                         </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm font-bold text-gray-700">
                         <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                         {deadlineText}
                      </div>
                    </>
                  ) : (
                      <div className="text-sm text-gray-500 italic w-full text-center py-2">No upcoming deadlines</div>
                  )}
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
      {/* Modals */}
      
      {showAllReportsModal && (
        <SubmittedReportsModal
          reports={reports}
          onClose={() => setShowAllReportsModal(false)}
        />
      )}
      {showAllDeadlinesModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
              <h2 className="text-lg font-bold text-gray-900">Weekly Report Deadlines</h2>
              <button onClick={() => setShowAllDeadlinesModal(false)} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {(deadlines || []).map((d) => {
                let endDate: Date;
                try { endDate = new Date(d.date); } catch { endDate = new Date(); }
                endDate.setHours(23, 59, 59, 999);
                const startDate = new Date(endDate);
                startDate.setDate(startDate.getDate() - 6);
                startDate.setHours(0, 0, 0, 0);
                const rangeLabel = `${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
                const deadlineLabel = `Deadline: ${endDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`;
                const isSubmitted = d.status === "submitted";
                return (
                  <button
                    key={d.week}
                    onClick={() => {
                      setShowAllDeadlinesModal(false);
                      onViewReports();
                    }}
                    className="w-full text-left bg-gray-50 rounded-xl p-3 border border-gray-100 hover:bg-gray-100"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold text-gray-900 text-sm">Week {d.week}</div>
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${isSubmitted ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {isSubmitted ? "Submitted" : "Not submitted yet"}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-gray-900 mb-0.5">{rangeLabel}</div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      {deadlineLabel}
                    </div>
                    {isSubmitted ? (
                      <div className="text-[9px] font-bold text-green-600 flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        View Report
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
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

export function AttendanceView({ idnumber, attendance, onUpdate, supervisorId, studentName, schedule }: { idnumber: string; attendance: AttendanceEntry[]; onUpdate: (next: AttendanceEntry[]) => void; supervisorId?: string; studentName?: string, schedule?: { amIn: string; amOut: string; pmIn: string; pmOut: string; otIn?: string; otOut?: string } | null }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [dbSchedule, setDbSchedule] = useState<{ amIn: string; amOut: string; pmIn: string; pmOut: string; otIn?: string; otOut?: string } | null>(schedule || null);
  
  useEffect(() => {
    if (schedule) {
      setDbSchedule(schedule);
    }
  }, [schedule]);
  const [nowText, setNowText] = useState<string>("");
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterOvertime, setFilterOvertime] = useState(false);
  const [selectedAttendanceEntry, setSelectedAttendanceEntry] = useState<AttendanceEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const isClickingRef = useRef(false);
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
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [showCooldownModal, setShowCooldownModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateModalMessage, setDuplicateModalMessage] = useState("");
  const [showHistoryMode, setShowHistoryMode] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; timestamp: number } | null>(null);
  const [cameraFeedback, setCameraFeedback] = useState<string>("");
  const [authorizedOvertime, setAuthorizedOvertime] = useState<{ start: number; end: number } | null>(null);
  const [allOvertimeShifts, setAllOvertimeShifts] = useState<{ effective_date: string; overtime_start: number; overtime_end: number }[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<any[]>([]);

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
            console.log("Overtime Fetch Response:", json);
            
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

    if (filterStatus) {
      result = result.filter(a => {
        const s = a.status || "Pending";
        if (filterStatus === "Validated") return s === "Approved";
        if (filterStatus === "Unvalidated") return s === "Rejected";
        if (filterStatus === "Pending") return s !== "Approved" && s !== "Rejected";
        return true;
      });
    }

    if (filterOvertime) {
      result = result.filter(a => !!a.is_overtime);
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
  }, [uniqueAttendance, filterDate, monthFilter, attendanceSearchQuery, filterStatus, filterOvertime]);

  const localSchedule = useMemo(() => {
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
    const s = dbSchedule || localSchedule;
    if (!s) return "";
    const parts: string[] = [];
    if (s.amIn && s.amOut) {
      parts.push(`Morning ${formatDisplayTime(s.amIn)} - ${formatDisplayTime(s.amOut)}`);
    }
    if (s.pmIn && s.pmOut) {
      parts.push(`Afternoon ${formatDisplayTime(s.pmIn)} - ${formatDisplayTime(s.pmOut)}`);
    }
    if (s.otIn && s.otOut && !authorizedOvertime) {
      parts.push(`OT ${formatDisplayTime(s.otIn)} - ${formatDisplayTime(s.otOut)}`);
    }
    return parts.join(" • ");
  }, [dbSchedule, localSchedule, authorizedOvertime]);

  const refreshScheduleFromServer = useCallback(async () => {
    try {
      // 0. Check for Coordinator Events (Highest Priority)
      try {
        const eventsRes = await fetch('/api/events', { cache: "no-store" });
        const eventsData = await eventsRes.json();
        if (eventsData.events && Array.isArray(eventsData.events)) {
          setEvents(eventsData.events);
          const now = new Date();
          const offset = now.getTimezoneOffset();
          const localDate = new Date(now.getTime() - (offset * 60 * 1000));
          const todayStr = localDate.toISOString().split('T')[0];
          
          // Find events for today
          const todayEvents = eventsData.events.filter((e: any) => e.event_date === todayStr);
          
          let applicableEvent = null;

          // Priority 1: Course-specific event
          if (user && user.courseIds && user.courseIds.length > 0) {
            applicableEvent = todayEvents.find((e: any) => 
              e.courses_id && Array.isArray(e.courses_id) && e.courses_id.length > 0 &&
              user.courseIds!.some(id => e.courses_id.map(String).includes(String(id)))
            );
          }

          // Priority 2: General event (no specific courses)
          if (!applicableEvent) {
            applicableEvent = todayEvents.find((e: any) => 
              !e.courses_id || !Array.isArray(e.courses_id) || e.courses_id.length === 0
            );
          }
          
          if (applicableEvent) {
            const next = {
              amIn: normalizeTimeString(applicableEvent.am_in) || "",
              amOut: normalizeTimeString(applicableEvent.am_out) || "",
              pmIn: normalizeTimeString(applicableEvent.pm_in) || "",
              pmOut: normalizeTimeString(applicableEvent.pm_out) || "",
              otIn: normalizeTimeString(applicableEvent.overtime_in) || undefined,
              otOut: normalizeTimeString(applicableEvent.overtime_out) || undefined,
            };
            setDbSchedule(next);
            return next;
          }
        }
      } catch (e) {
        console.error("Failed to fetch events", e);
      }

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
      
      // Use prop or internal user state for supervisor ID
      const effectiveSupervisorId = supervisorId || user?.supervisorid;
      
      console.log("[DEBUG] refreshScheduleFromServer", { supervisorId, userSupId: user?.supervisorid, effectiveSupervisorId });

      // Skip direct Supabase query for shifts because supervisorId is a string (ID Number) 
      // but the DB expects an integer ID. The API handles this resolution.
      
      if (!rows) {
        const res = await fetch(`/api/shifts${effectiveSupervisorId ? `?supervisor_id=${encodeURIComponent(effectiveSupervisorId)}` : ''}`, { cache: "no-store" });
        const json = await res.json();
        const data = json.shifts;
        console.log("[DEBUG] Fetched shifts", data);
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
  }, [supervisorId, user]);

  useEffect(() => {
    refreshScheduleFromServer();
  }, [refreshScheduleFromServer]);

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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "coordinator_events" },
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
    const MAX_WIDTH = 800;
    let w = video.videoWidth || 640;
    let h = video.videoHeight || 480;
    
    // Resize if too large to speed up upload
    if (w > MAX_WIDTH) {
      const ratio = h / w;
      w = MAX_WIDTH;
      h = w * ratio;
    }

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
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // 60% quality for faster upload
    setPhoto(dataUrl);
    stopCamera();
  };

  // Mobile uses file input capture via startCamera()

  const addEntry = async (type: "in" | "out") => {
    if (!photo || submitting || isSubmittingRef.current) return;

    // Lock immediately
    isSubmittingRef.current = true;
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
          isSubmittingRef.current = false;
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
              // alert(`Your previous attendance from ${logDate.toLocaleDateString()} was automatically closed at ${closeTime.toLocaleTimeString()} because you forgot to time out.`);
              
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
            // Deprecated AM/PM counting logic removed.
            // Duplicate checks are now handled by Shift Window logic in handleBeforeSubmit.
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
              rendered_hours: e.rendered_hours,
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
      isSubmittingRef.current = false;
    }
  };

  const handleBeforeSubmit = async (type: "in" | "out") => {
    const now = new Date();
    const nowMs = now.getTime();
    const effectiveSchedule = dbSchedule || schedule;

    if (!effectiveSchedule) {
      await addEntry(type);
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

    // 1. Define Shifts with Windows
    const shifts = [
      { id: 'am', start: buildTs(effectiveSchedule.amIn), end: buildTs(effectiveSchedule.amOut), rawEnd: effectiveSchedule.amOut },
      { id: 'pm', start: buildTs(effectiveSchedule.pmIn), end: buildTs(effectiveSchedule.pmOut), rawEnd: effectiveSchedule.pmOut },
      { id: 'ot', start: buildTs(effectiveSchedule.otIn), end: buildTs(effectiveSchedule.otOut), rawEnd: effectiveSchedule.otOut }
    ].filter(s => s.start && s.end);

    // Helper: Is timestamp within shift window (Start-30m to End)
    const isWithinWindow = (ts: number, shift: any) => {
      if (!shift.start || !shift.end) return false;
      const startWindow = shift.start.getTime() - 30 * 60000;
      const endWindow = shift.end.getTime();
      return ts >= startWindow && ts <= endWindow;
    };

    if (type === "in") {
      // Find Active Shift: Must be in window AND not already taken
      const todayInLogs = attendance.filter(l => {
        const d = new Date(l.timestamp);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate() &&
          l.type === 'in' &&
          l.status !== 'Rejected'
        );
      }).sort((a, b) => a.timestamp - b.timestamp);

      // Determine which shifts are already consumed by past logs
      const consumedShiftIds = new Set<string>();
      
      // Greedily assign past logs to shifts to see what's taken
      todayInLogs.forEach(log => {
          // Find the first shift this log fits into that hasn't been consumed yet
          const match = shifts.find(s => 
              !consumedShiftIds.has(s.id) && 
              isWithinWindow(log.timestamp, s)
          );
          if (match) {
              consumedShiftIds.add(match.id);
          }
      });

      // Now check if the current time fits into a shift that is NOT consumed
      const activeShift = shifts.find(shift => {
        if (!isWithinWindow(nowMs, shift)) return false;
        return !consumedShiftIds.has(shift.id);
      });

      if (!activeShift) {
        setDuplicateModalMessage("You are outside any allowed shift time or you have already timed in for this shift.");
        setShowDuplicateModal(true);
        return;
      }

      await addEntry("in");
      return;
    }

    // Type OUT
    // Find shift of the open session (Last IN)
    const sorted = [...attendance].sort((a, b) => a.timestamp - b.timestamp);
    const lastIn = sorted.reverse().find(l => l.type === 'in'); 

    let targetShift = null;
    if (lastIn) {
      targetShift = shifts.find(shift => isWithinWindow(lastIn.timestamp, shift));
    }

    if (targetShift && targetShift.end) {
      const shiftEnd = targetShift.end.getTime();
      if (nowMs < shiftEnd) {
        const display = formatDisplayTime(targetShift.rawEnd);
        setEarlyOutShiftEndText(display);
        setShowEarlyOutModal(true);
        return;
      }
    }

    await addEntry("out");
  };

  const handleConfirmClick = async () => {
    if (isClickingRef.current || submitting || isSubmittingRef.current) return;
    isClickingRef.current = true;
    try {
      await handleBeforeSubmit(isCheckedIn ? "out" : "in");
    } finally {
      // Small delay to prevent accidental double-taps even after logic finishes
      setTimeout(() => {
        isClickingRef.current = false;
      }, 500);
    }
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

        const nonOtLogs = sorted.filter(l => !l.is_overtime);
        const otLogs = sorted.filter(l => !!l.is_overtime);

        let s1: AttendanceEntry | null = null;
        let s2: AttendanceEntry | null = null;
        let s3: AttendanceEntry | null = null;
        let s4: AttendanceEntry | null = null;
        let s5: AttendanceEntry | null = null;
        let s6: AttendanceEntry | null = null;

        const today = new Date();
        today.setHours(0,0,0,0);
        const isPastDate = baseDate < today;

        const createVirtualOut = (inEntry: AttendanceEntry): AttendanceEntry => {
             const shift = determineShift(inEntry.timestamp, effectiveSchedule);
             const outTs = shift === 'am' ? effectiveSchedule.amOut : effectiveSchedule.pmOut;
             const finalOutTs = outTs > inEntry.timestamp ? outTs : inEntry.timestamp + 60000;
             return {
                  id: inEntry.id ? -inEntry.id : -Math.floor(Math.random() * 1000000),
                  type: 'out',
                  timestamp: finalOutTs,
                  photoDataUrl: '',
                  status: 'Pending',
                  validated_by: 'AUTO TIME OUT'
             };
        };

        const sessions: { in: AttendanceEntry; out: AttendanceEntry }[] = [];
        let currentIn: AttendanceEntry | null = null;
        for (const log of nonOtLogs) {
            if (log.type === 'in') {
                if (!currentIn) currentIn = log;
            } else if (log.type === 'out') {
                if (currentIn && log.timestamp > currentIn.timestamp) {
                    sessions.push({ in: currentIn, out: log });
                    currentIn = null;
                }
            }
        }
        if (currentIn && isPastDate) {
            sessions.push({ in: currentIn, out: createVirtualOut(currentIn) });
        }

        const amSessions = sessions.filter(s => {
            const slot = (s.out as any)?.slot;
            if (slot === 'AM') return true;
            if (slot === 'PM' || slot === 'OT') return false;
            return determineShift(s.in.timestamp, effectiveSchedule) === 'am';
        });
        const pmSessions = sessions.filter(s => {
            const slot = (s.out as any)?.slot;
            if (slot === 'PM') return true;
            if (slot === 'AM' || slot === 'OT') return false;
            return determineShift(s.in.timestamp, effectiveSchedule) === 'pm';
        });

        const resolvePhoto = (entries: AttendanceEntry[]) => {
          for (const e of entries) {
            const p = getEntryPhoto(e);
            if (p) return p;
          }
          return "";
        };
        const photoAmUrl = resolvePhoto(amSessions.flatMap(s => [s.in, s.out]));
        const photoPmUrl = resolvePhoto(pmSessions.flatMap(s => [s.in, s.out]));
        const photoOtUrl = resolvePhoto(otLogs);

        if (amSessions.length > 0) {
            s1 = amSessions[0].in;
            s2 = amSessions[0].out;
        }
        if (pmSessions.length > 0) {
            s3 = pmSessions[0].in;
            s4 = pmSessions[0].out;
        }

        s5 = otLogs.find(l => l.type === 'in') || null;
        if (s5) {
          s6 = otLogs.find(l => l.type === 'out' && l.timestamp > s5!.timestamp) || null;
          if (!s6 && isPastDate) {
            const outTs = effectiveSchedule.otEnd;
            const finalOutTs = outTs > (s5 as AttendanceEntry).timestamp ? outTs : (s5 as AttendanceEntry).timestamp + 60000;
            s6 = { id: (s5 as AttendanceEntry).id ? -(s5 as AttendanceEntry).id! : -Math.floor(Math.random() * 1000000), type: 'out', timestamp: finalOutTs, photoDataUrl: '', status: 'Pending', validated_by: 'AUTO TIME OUT' };
          }
        }

        let total = 0;
        const dailyFlags = new Set<string>();

        // 3. Calculate Hours (Ledger-first, frozen when available)
        const calcFrozen = (inLog: AttendanceEntry | null, outLog: AttendanceEntry | null, shift: 'am' | 'pm' | 'ot') => {
            if (!inLog || !outLog) return 0;
            if ((inLog.status || "") === 'Rejected' || (outLog.status || "") === 'Rejected') return 0;

            const vh = (outLog as any)?.validated_hours;
            if (vh !== undefined && vh !== null && !isNaN(Number(vh)) && Number(vh) >= 0) {
                return Number(vh) * 3600000;
            }

            const offInStr = (outLog as any)?.official_time_in;
            const offOutStr = (outLog as any)?.official_time_out;
            if (offInStr && offOutStr) {
                const base = new Date(inLog.timestamp);
                const toDate = (t: string) => {
                    const parts = t.split(":").map(Number);
                    const d = new Date(base);
                    d.setHours(parts[0] || 0, parts[1] || 0, parts[2] || 0, 0);
                    return d;
                };
                const offIn = toDate(offInStr);
                const offOut = toDate(offOutStr);
                if (offOut.getTime() < offIn.getTime()) offOut.setDate(offOut.getDate() + 1);
                return calculateHoursWithinOfficialTime(new Date(inLog.timestamp), new Date(outLog.timestamp), offIn, offOut);
            }

            return calculateSessionDuration(inLog.timestamp, outLog.timestamp, shift, effectiveSchedule);
        };

        total = calcFrozen(s1, s2, 'am') + calcFrozen(s3, s4, 'pm') + calcFrozen(s5, s6, 'ot');

        return { date: day.date, s1, s2, s3, s4, s5, s6, total, flags: Array.from(dailyFlags), schedule: effectiveSchedule, photoAmUrl, photoPmUrl, photoOtUrl };
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
             const isAmValidated = ((day.s1 as any)?.status === 'Approved' || (day.s2 as any)?.status === 'Approved');
             const isPmValidated = ((day.s3 as any)?.status === 'Approved' || (day.s4 as any)?.status === 'Approved');
             const isOtValidated = ((day.s5 as any)?.status === 'Approved' || (day.s6 as any)?.status === 'Approved');
             
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
                 if ((day.s2 as any)?.validated_hours != null && Number((day.s2 as any).validated_hours) > 0) {
                     overallValidated += (day.s2 as any).validated_hours * 3600000;
                 } else if ((day.s2 as any)?.rendered_hours != null && Number((day.s2 as any).rendered_hours) > 0) {
                     overallValidated += (day.s2 as any).rendered_hours * 3600000;
                 } else {
                     const d = calculateShiftDurations((day.s1 as any)?.timestamp || 0, (day.s2 as any)?.timestamp || 0, scheduleObj);
                     overallValidated += d.am + d.pm + d.ot;
                 }
             }
             if (isPmValidated) {
                 if ((day.s4 as any)?.validated_hours != null && Number((day.s4 as any).validated_hours) > 0) {
                     overallValidated += (day.s4 as any).validated_hours * 3600000;
                 } else if ((day.s4 as any)?.rendered_hours != null && Number((day.s4 as any).rendered_hours) > 0) {
                     overallValidated += (day.s4 as any).rendered_hours * 3600000;
                 } else {
                     const d = calculateShiftDurations((day.s3 as any)?.timestamp || 0, (day.s4 as any)?.timestamp || 0, scheduleObj);
                     overallValidated += d.am + d.pm + d.ot;
                 }
             }
             if (isOtValidated) {
                 if ((day.s6 as any)?.validated_hours != null && Number((day.s6 as any).validated_hours) > 0) {
                     overallValidated += (day.s6 as any).validated_hours * 3600000;
                 } else if ((day.s6 as any)?.rendered_hours != null && Number((day.s6 as any).rendered_hours) > 0) {
                     overallValidated += (day.s6 as any).rendered_hours * 3600000;
                 } else {
                     const d = calculateShiftDurations((day.s5 as any)?.timestamp || 0, (day.s6 as any)?.timestamp || 0, scheduleObj);
                     overallValidated += d.am + d.pm + d.ot;
                 }
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
      const fmt = (slot: any) => slot ? formatTime(slot.timestamp) : "-";
      const fmtOut = (slot: any) => {
        if (!slot) return "-";
        if (slot.status === 'Official') {
            return `${formatTime(slot.timestamp)} (Official Time-Out)`;
        }
        if (slot.validated_by === "SYSTEM_AUTO_CLOSE" || slot.validated_by === "AUTO TIME OUT") {
            return "";
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

      const amStatus = getStatus(day.s1 as any, day.s2 as any);
      let pmStatus = "-";
      if (day.s3 || day.s4) {
          pmStatus = getStatus(day.s3 as any, day.s4 as any);
      } else if (day.s5 || day.s6) {
          pmStatus = getStatus(day.s5 as any, day.s6 as any);
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
    <div className="w-full space-y-4">
      {cameraError && (
        <div className="rounded-xl bg-red-50 border border-red-100 p-4 flex items-center gap-3 text-red-700 animate-in fade-in slide-in-from-top-2 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <span className="text-sm font-medium">{cameraError}</span>
        </div>
      )}

      {/* Overtime Indicator */}
      {authorizedOvertime && (
        <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 flex items-center gap-2 text-indigo-700 animate-in fade-in slide-in-from-top-2 shadow-sm">
           <div className="bg-indigo-100 p-1.5 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
           </div>
           <div className="flex flex-col">
              <span className="text-xs font-bold">Overtime Authorized</span>
              <span className="text-[10px] opacity-90">
                You can time in from {new Date(authorizedOvertime.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} to {new Date(authorizedOvertime.end).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}.
              </span>
           </div>
        </div>
      )}

      {showDuplicateModal && <DuplicateEntryModal onClose={() => setShowDuplicateModal(false)} message={duplicateModalMessage} />}

      {showBreakModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-4">
            <h2 className="text-base font-bold text-gray-900 mb-2">Cannot Time In</h2>
            <p className="text-gray-700 text-xs mb-3">
              You cant time in until {breakPmInText || "the afternoon shift starts"}.
            </p>
            <button
              onClick={() => setShowBreakModal(false)}
              className="w-full px-3 py-1.5 bg-[#F97316] text-white rounded-lg font-bold text-xs"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {showNoScheduleModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-4">
            <h2 className="text-base font-bold text-gray-900 mb-2">Cannot Time In</h2>
            <p className="text-gray-700 text-xs mb-3">
              Official Time is not set by the supervisor. You cannot time in.
            </p>
            <button
              onClick={() => setShowNoScheduleModal(false)}
              className="w-full px-3 py-1.5 bg-[#F97316] text-white rounded-lg font-bold text-xs"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {showLateInModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-4">
            <h2 className="text-base font-bold text-gray-900 mb-2">Cannot Time In</h2>
            <p className="text-gray-700 text-xs mb-3">
              {lateInPmOutText || "You cannot time in beyond your official time."}
            </p>
            <button
              onClick={() => setShowLateInModal(false)}
              className="w-full px-3 py-1.5 bg-[#F97316] text-white rounded-lg font-bold text-xs"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {showEarlyOutModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-4">
            <h2 className="text-base font-bold text-gray-900 mb-2">Time Out Early?</h2>
            <p className="text-gray-700 text-xs mb-3">
              Are you sure you want to time out early? Any remaining time until{" "}
              {earlyOutShiftEndText || "your official time out"} will not be counted toward your OJT hours.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowEarlyOutModal(false)}
                className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 font-semibold bg-white hover:bg-gray-50 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowEarlyOutModal(false);
                  await addEntry("out");
                }}
                className="flex-1 px-3 py-1.5 bg-[#F97316] text-white rounded-lg font-bold hover:bg-[#EA580C] text-xs"
              >
                Yes, Time Out
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistoryMode ? (
        <div className="space-y-2">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-3 py-1.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-gray-900">Attendance History</h2>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Full attendance records for {studentName || idnumber}.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadExcel}
                  disabled={processedDays.length === 0}
                  className="inline-flex items-center px-2 py-1 text-[10px] font-semibold rounded-lg border border-gray-200 bg-white text-green-700 hover:bg-green-50 hover:border-green-200 transition-colors gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                  Export Attendance
                </button>
                <button
                  onClick={() => setShowHistoryMode(false)}
                  className="inline-flex items-center px-2 py-1 text-[10px] font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Back
                </button>
              </div>
            </div>

            <div className="p-2 sm:p-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-gray-700 uppercase tracking-wide mb-0.5 block">Search</label>
                  <input 
                    type="text" 
                    value={attendanceSearchQuery}
                    onChange={(e) => setAttendanceSearchQuery(e.target.value)}
                    placeholder="Search by type or date..." 
                    className="w-full rounded-lg border border-gray-400 px-2 py-1 text-[11px] font-medium text-gray-900 placeholder:text-gray-500 focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all"
                  />
                </div>
                <div className="w-full sm:w-36">
                  <label className="text-[10px] font-bold text-gray-700 uppercase tracking-wide mb-0.5 block">Filter by Month</label>
                  <select
                    value={monthFilter}
                    onChange={e => setMonthFilter(e.target.value)}
                    className="w-full rounded-lg border border-gray-400 px-2 py-1 text-[11px] font-medium text-gray-900 bg-white focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all"
                  >
                    <option value="">All months</option>
                    {monthOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-full sm:w-36">
                  <label className="text-[10px] font-bold text-gray-700 uppercase tracking-wide mb-0.5 block">Filter by Status</label>
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="w-full rounded-lg border border-gray-400 px-2 py-1 text-[11px] font-medium text-gray-900 bg-white focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all"
                  >
                    <option value="">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Validated">Validated</option>
                    <option value="Unvalidated">Unvalidated</option>
                  </select>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                <span className="px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-700 font-medium">
                  Pending: {statusCounts.Pending}
                </span>
                <span className="px-2 py-0.5 rounded-full border border-green-100 bg-green-50 text-green-700 font-medium">
                  Validated: {statusCounts.Approved}
                </span>
                <span className="px-2 py-0.5 rounded-full border border-red-100 bg-red-50 text-red-700 font-medium">
                  Unvalidated: {statusCounts.Rejected}
                </span>
              </div>

              <div className="mt-2 border-t border-gray-100 pt-2">

                {processedDays.length > 0 ? (
                  <>
                    <div className="hidden md:block overflow-x-auto custom-scrollbar">
                      <table className="w-full text-[10px] text-left">
                        <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 font-bold">
                          <tr>
                            <th rowSpan={2} className="px-1 py-0.5 border-r border-gray-100 min-w-[70px] text-left align-bottom pb-1">Date</th>
                            <th colSpan={2} className="px-1 py-0.5 text-center border-r border-gray-100 border-b bg-gray-100/50">Morning</th>
                            <th colSpan={2} className="px-1 py-0.5 text-center border-r border-gray-100 border-b bg-gray-100/50">Afternoon</th>
                            <th colSpan={2} className="px-1 py-0.5 text-center border-r border-gray-100 border-b bg-gray-100/50">Overtime</th>
                            <th rowSpan={2} className="px-1 py-0.5 text-right align-bottom pb-1">Total Hours</th>
                          </tr>
                          <tr>
                            <th className="px-1 py-0.5 text-center border-r border-gray-100 min-w-[50px] text-[9px] tracking-wider">Time In</th>
                            <th className="px-1 py-0.5 text-center border-r border-gray-100 min-w-[50px] text-[9px] tracking-wider">Time Out</th>
                            <th className="px-1 py-0.5 text-center border-r border-gray-100 min-w-[50px] text-[9px] tracking-wider">Time In</th>
                            <th className="px-1 py-0.5 text-center border-r border-gray-100 min-w-[50px] text-[9px] tracking-wider">Time Out</th>
                            <th className="px-1 py-0.5 text-center border-r border-gray-100 min-w-[50px] text-[9px] tracking-wider">Time In</th>
                            <th className="px-1 py-0.5 text-center border-r border-gray-100 min-w-[50px] text-[9px] tracking-wider">Time Out</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {processedDays.map((day, i) => (
                            <tr key={i} className="hover:bg-gray-50 transition-colors">
                              <td className="px-1 py-0.5 font-medium text-gray-900 whitespace-nowrap border-r border-gray-100">
                                {day.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                              </td>
                              {[day.s1, day.s2, day.s3, day.s4, day.s5, day.s6].map((slot, idx) => {
                                const pairOut = (idx === 0 || idx === 1) ? day.s2 : (idx === 2 || idx === 3) ? day.s4 : day.s6;
                                const isSessionAutoTimeOut = pairOut?.validated_by === "SYSTEM_AUTO_CLOSE" || pairOut?.validated_by === "AUTO TIME OUT";
                                
                                let isLateTime = false;
                                if (slot && slot.type === 'in') {
                                    const pairedOut = pairOut;
                                    const toDate = (t: string, baseTs: number) => {
                                        const d = new Date(baseTs);
                                        const parts = t.split(":").map(Number);
                                        d.setHours(parts[0] || 0, parts[1] || 0, parts[2] || 0, 0);
                                        return d.getTime();
                                    };
                                    if (pairedOut && (pairedOut as any).official_time_in) {
                                        const offInTs = toDate((pairedOut as any).official_time_in, slot.timestamp);
                                        isLateTime = isLate(slot.timestamp, offInTs);
                                    }
                                }

                                return (
                                <td key={idx} className={`px-1 py-0.5 border-r border-gray-100 text-center min-w-[60px] ${isSessionAutoTimeOut && slot?.type === 'out' ? 'align-middle' : 'align-top'}`}>
                                  {slot ? (
                                    (isSessionAutoTimeOut && slot.type === 'out' && slot.status !== 'Official') ? null : (
                                    <div className={`flex flex-col items-center gap-0.5 ${isSessionAutoTimeOut && slot.type === 'out' ? 'justify-center h-full' : ''}`}>
                                          {isSessionAutoTimeOut && slot.type === 'out' ? (
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] font-medium text-gray-800">
                                                    {formatTime(slot.timestamp)}
                                                </span>
                                                <span className="text-[8px] font-normal text-gray-500">(Official Time-Out)</span>
                                            </div>
                                          ) : (
                                            <div className="flex flex-col items-center w-full">
                                                <div className={`text-[10px] font-medium whitespace-nowrap text-center ${isLateTime ? 'text-red-600 font-bold' : 'text-gray-800'}`}>
                                                {formatTime(slot.timestamp)}
                                                </div>
                                                {slot.status === 'Official' && <div className="text-[8px] font-normal text-gray-500 leading-none mt-0.5 text-center">(Official Time-Out)</div>}
                                                {isLateTime ? (
                                                    <div className="text-[7px] font-bold text-red-500 leading-none text-center">LATE</div>
                                                ) : (
                                                    <div className="text-[7px] font-bold text-transparent leading-none invisible text-center">LATE</div>
                                                )}
                                            </div>
                                          )}
                                          {!(isSessionAutoTimeOut && slot.type === 'out') && (
                                            (() => {
                                              const paired = idx === 0 ? day.s2 : idx === 1 ? day.s1 : idx === 2 ? day.s4 : idx === 3 ? day.s3 : idx === 4 ? day.s6 : day.s5;
                                              const groupFallback = idx < 2 ? day.photoAmUrl : idx < 4 ? day.photoPmUrl : day.photoOtUrl;
                                              const photoUrl = getEntryPhoto(slot) || getEntryPhoto(paired) || groupFallback;
                                              return photoUrl ? (
                                              <div
                                                className="relative w-8 h-8 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100 cursor-zoom-in"
                                                onClick={() => setSelectedImage({ url: photoUrl, timestamp: slot.timestamp })}
                                              >
                                                <img src={photoUrl} alt="Log" className="w-full h-full object-cover" />
                                              </div>
                                              ) : (
                                              <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-50 flex flex-col items-center justify-center text-gray-400">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                <span className="text-[8px] mt-0.5">System</span>
                                              </div>
                                              );
                                            })()
                                          )}
                                          <span className={`text-[9px] font-medium ${getStatusColorClass(slot)}`}>
                                            {formatStatusLabel(slot)}
                                          </span>
                                    </div>
                                    )
                                  ) : (
                                    <span className="text-gray-300 block py-1">-</span>
                                  )}
                                </td>
                                );
                              })}
                              <td className="px-2 py-1 text-right font-bold text-gray-900">
                                <div className="flex flex-col items-end gap-0.5">
                                  <span>{formatHours(day.total)}</span>
                                  {/* Lunch Policy flag removed per user request */}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="md:hidden space-y-2">
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

                                  let isLateTime = false;
                                  if (slot && slot.type === 'in') {
                                      const pairedOut = pairOut;
                                      const toDate = (t: string, baseTs: number) => {
                                          const d = new Date(baseTs);
                                          const parts = t.split(":").map(Number);
                                          d.setHours(parts[0] || 0, parts[1] || 0, parts[2] || 0, 0);
                                          return d.getTime();
                                      };
                                    if (pairedOut && (pairedOut as any).official_time_in) {
                                          const offInTs = toDate((pairedOut as any).official_time_in, slot.timestamp);
                                          isLateTime = isLate(slot.timestamp, offInTs);
                                    }
                                  }

                                  return (
                                  <div key={idx} className="flex flex-col items-center gap-1">
                                    {slot ? (
                                      <>
                                          {isSessionAutoTimeOut && slot.type === 'out' ? (
                                            <span className="block h-4 w-full"></span>
                                          ) : (
                                            <div className="flex flex-col items-center w-full">
                                                <div className={`text-[11px] font-medium whitespace-nowrap text-center ${isLateTime ? 'text-red-600 font-bold' : 'text-gray-800'}`}>
                                                {formatTime(slot.timestamp)}
                                                </div>
                                                {slot.status === 'Official' && <div className="text-[9px] font-normal text-gray-500 leading-none mt-0.5 text-center">(Official Time-Out)</div>}
                                                {isLateTime ? (
                                                    <div className="text-[7px] font-bold text-red-500 leading-none text-center">LATE</div>
                                                ) : (
                                                    <div className="text-[7px] font-bold text-transparent leading-none invisible text-center">LATE</div>
                                                )}
                                            </div>
                                          )}
                                          {!(isSessionAutoTimeOut && slot.type === 'out') && (
                                            (() => {
                                              const paired = idx === 0 ? day.s2 : day.s1;
                                              const groupFallback = day.photoAmUrl;
                                              const photoUrl = getEntryPhoto(slot) || getEntryPhoto(paired) || groupFallback;
                                              return photoUrl ? (
                                              <div
                                                className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100 cursor-zoom-in"
                                                onClick={() => setSelectedImage({ url: photoUrl, timestamp: slot.timestamp })}
                                              >
                                                <img src={photoUrl} alt="Log" className="w-full h-full object-cover" />
                                              </div>
                                              ) : (
                                              <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-50 flex flex-col items-center justify-center text-gray-400">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                <span className="text-[9px] mt-1">System</span>
                                              </div>
                                              );
                                            })()
                                          )}
                                          {!(isSessionAutoTimeOut && slot.type === 'out') && (
                                            <span className={`text-[10px] font-medium ${getStatusColorClass(slot)}`}>
                                              {formatStatusLabel(slot)}
                                            </span>
                                          )}
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

                                  let isLateTime = false;
                                  if (slot && slot.type === 'in') {
                                      const pairedOut = pairOut;
                                      const toDate = (t: string, baseTs: number) => {
                                          const d = new Date(baseTs);
                                          const parts = t.split(":").map(Number);
                                          d.setHours(parts[0] || 0, parts[1] || 0, parts[2] || 0, 0);
                                          return d.getTime();
                                      };
                                    if (pairedOut && (pairedOut as any).official_time_in) {
                                          const offInTs = toDate((pairedOut as any).official_time_in, slot.timestamp);
                                          isLateTime = isLate(slot.timestamp, offInTs);
                                    }
                                  }

                                  return (
                                  <div key={idx} className="flex flex-col items-center gap-1">
                                    {slot ? (
                                      <>
                                          {isSessionAutoTimeOut && slot.type === 'out' ? (
                                            <span className="block h-4 w-full"></span>
                                          ) : (
                                            <div className="flex flex-col items-center w-full">
                                                <div className={`text-[11px] font-medium whitespace-nowrap text-center ${isLateTime ? 'text-red-600 font-bold' : 'text-gray-800'}`}>
                                                {formatTime(slot.timestamp)}
                                                </div>
                                                {slot.status === 'Official' && <div className="text-[9px] font-normal text-gray-500 leading-none mt-0.5 text-center">(Official Time-Out)</div>}
                                                {isLateTime ? (
                                                    <div className="text-[7px] font-bold text-red-500 leading-none text-center">LATE</div>
                                                ) : (
                                                    <div className="text-[7px] font-bold text-transparent leading-none invisible text-center">LATE</div>
                                                )}
                                            </div>
                                          )}
                                          {!(isSessionAutoTimeOut && slot.type === 'out') && (
                                            (() => {
                                              const paired = idx === 0 ? day.s4 : day.s3;
                                              const groupFallback = day.photoPmUrl;
                                              const photoUrl = getEntryPhoto(slot) || getEntryPhoto(paired) || groupFallback;
                                              return photoUrl ? (
                                              <div
                                                className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100 cursor-zoom-in"
                                                onClick={() => setSelectedImage({ url: photoUrl, timestamp: slot.timestamp })}
                                              >
                                                <img src={photoUrl} alt="Log" className="w-full h-full object-cover" />
                                              </div>
                                              ) : (
                                              <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-50 flex flex-col items-center justify-center text-gray-400">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                <span className="text-[9px] mt-1">System</span>
                                              </div>
                                              );
                                            })()
                                          )}
                                          {!(isSessionAutoTimeOut && slot.type === 'out') && (
                                            <span className={`text-[10px] font-medium ${getStatusColorClass(slot)}`}>
                                              {formatStatusLabel(slot)}
                                            </span>
                                          )}
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

                                  let isLateTime = false;
                                  if (slot && slot.type === 'in') {
                                      const pairedOut = pairOut;
                                      const toDate = (t: string, baseTs: number) => {
                                          const d = new Date(baseTs);
                                          const parts = t.split(":").map(Number);
                                          d.setHours(parts[0] || 0, parts[1] || 0, parts[2] || 0, 0);
                                          return d.getTime();
                                      };
                                    if (pairedOut && (pairedOut as any).official_time_in) {
                                          const offInTs = toDate((pairedOut as any).official_time_in, slot.timestamp);
                                          isLateTime = isLate(slot.timestamp, offInTs);
                                    }
                                  }

                                  return (
                                  <div key={idx} className="flex flex-col items-center gap-1">
                                    {slot ? (
                                      <>
                                          {isSessionAutoTimeOut && slot.type === 'out' ? (
                                            <span className="block h-4 w-full"></span>
                                          ) : (
                                            <div className="flex flex-col items-center w-full">
                                                <div className={`text-[11px] font-medium whitespace-nowrap text-center ${isLateTime ? 'text-red-600 font-bold' : 'text-gray-800'}`}>
                                                {formatTime(slot.timestamp)}
                                                </div>
                                                {slot.status === 'Official' && <div className="text-[9px] font-normal text-gray-500 leading-none mt-0.5 text-center">(Official Time-Out)</div>}
                                                {isLateTime ? (
                                                    <div className="text-[7px] font-bold text-red-500 leading-none text-center">LATE</div>
                                                ) : (
                                                    <div className="text-[7px] font-bold text-transparent leading-none invisible text-center">LATE</div>
                                                )}
                                            </div>
                                          )}
                                          {!(isSessionAutoTimeOut && slot.type === 'out') && (
                                            (() => {
                                              const paired = idx === 0 ? day.s6 : day.s5;
                                              const groupFallback = day.photoOtUrl;
                                              const photoUrl = getEntryPhoto(slot) || getEntryPhoto(paired) || groupFallback;
                                              return photoUrl ? (
                                              <div
                                                className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100 cursor-zoom-in"
                                                onClick={() => setSelectedImage({ url: photoUrl, timestamp: slot.timestamp })}
                                              >
                                                <img src={photoUrl} alt="Log" className="w-full h-full object-cover" />
                                              </div>
                                              ) : (
                                              <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-50 flex flex-col items-center justify-center text-gray-400">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                <span className="text-[9px] mt-1">System</span>
                                              </div>
                                              );
                                            })()
                                          )}
                                          {!(isSessionAutoTimeOut && slot.type === 'out') && (
                                            <span className={`text-[10px] font-medium ${getStatusColorClass(slot)}`}>
                                              {formatStatusLabel(slot)}
                                            </span>
                                          )}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden h-full flex flex-col">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#F97316]"></div>
                  <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Time Entry</div>
                </div>
                <div className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${isCheckedIn ? "bg-green-50 text-green-700 border-green-100" : "bg-gray-50 text-gray-600 border-gray-100"}`}>
                  {isCheckedIn ? "CURRENTLY TIMED IN" : "READY TO TIME IN"}
                </div>
              </div>
              <div className="p-3 flex flex-col items-center flex-1 h-full">
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
                          <div className="w-full max-w-md mb-3">
                            <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-center">
                              <div className="text-[10px] font-semibold text-green-700 uppercase tracking-wide flex items-center justify-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                Overtime Authorized
                              </div>
                              <div className="mt-0.5 text-[11px] text-green-600">
                                You have been authorized for overtime today. You can now Time In.
                              </div>
                            </div>
                          </div>
                        );
                    }
                    return null;
                })()}

                {officialScheduleText ? (
                  <div className="w-full max-w-md mb-3">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-center">
                      <div className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">
                        Official Schedule
                      </div>
                      <div className="mt-0.5 text-xs font-bold text-gray-900">
                        {officialScheduleText}
                      </div>
                      {authorizedOvertime && (
                        <div className="mt-1 pt-1 border-t border-gray-200">
                          <div className="text-[10px] font-semibold text-green-600 uppercase tracking-wide">
                            Overtime
                          </div>
                          <div className="text-xs font-bold text-green-700">
                            {new Date(authorizedOvertime.start).toLocaleTimeString(undefined, {hour: 'numeric', minute:'2-digit'})} - {new Date(authorizedOvertime.end).toLocaleTimeString(undefined, {hour: 'numeric', minute:'2-digit'})}
                          </div>
                        </div>
                      )}
                      <div className="mt-0.5 text-[10px] text-gray-500">
                        You can time in 30 minutes before your official time in.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full max-w-md mb-3">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center">
                      <div className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">
                        Official Schedule
                      </div>
                      <div className="mt-0.5 text-xs font-bold text-amber-900">
                        Official Time is not set by the supervisor
                      </div>
                    </div>
                  </div>
                )}

                <div className="relative w-full rounded-2xl bg-slate-900 border border-gray-200 shadow-inner flex items-center justify-center group flex-1 min-h-[300px] overflow-hidden">
                  {!photo && !stream && (
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                      <div className="p-3 rounded-full bg-slate-800 text-slate-400 group-hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                      </div>
                      <span className="text-xs font-medium">Tap Start Camera to take a photo</span>
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
                       <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
                         <span className="inline-block px-3 py-1.5 rounded-full bg-blue-600/90 text-white font-semibold text-xs shadow-lg">
                           {cameraFeedback || "Frame Your Face"}
                         </span>
                       </div>
                       <svg width="240" height="300" viewBox="0 0 280 360" className="opacity-90">
                         <ellipse cx="140" cy="190" rx="115" ry="155" fill="none" stroke="#2563eb" strokeWidth="6" />
                       </svg>
                     </div>
                   </>
                 )}
                  {photo && (
                    <img src={photo} alt="Captured photo" className="w-full h-full object-contain" />
                  )}
                </div>

                <div className="mt-6 w-full max-w-md flex flex-col items-center gap-3">
                  {!photo && (
                    <>
                      {(!stream) && (
                        <button
                          onClick={startCamera}
                          className="w-full rounded-xl px-4 py-2.5 text-white font-bold text-sm bg-[#F97316] hover:bg-[#EA580C] transition-all active:scale-95 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                          Start Camera
                        </button>
                      )}
                      {stream && (
                        <div className="flex gap-2 w-full">
                          <button
                            onClick={takePhoto}
                            disabled={!videoReady}
                            className={`flex-1 rounded-xl px-3 py-2 text-white font-bold text-sm transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 ${videoReady ? "bg-[#F97316] hover:bg-[#EA580C]" : "bg-gray-400 cursor-not-allowed"}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
                            Take Photo
                          </button>
                          <button
                            onClick={stopCamera}
                            className="flex-1 rounded-xl px-3 py-2 text-gray-700 font-bold text-sm bg-gray-100 hover:bg-gray-200 transition-all active:scale-95 shadow-md"
                          >
                            Stop Camera
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {photo && (
                    <div className="flex flex-col gap-2 w-full animate-in fade-in slide-in-from-bottom-4">
                      <button
                        onClick={handleConfirmClick}
                        disabled={submitting}
                        className={`w-full rounded-xl px-4 py-3 text-white font-bold text-base transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 ${isCheckedIn ? "bg-gray-900 hover:bg-black" : "bg-[#F97316] hover:bg-[#EA580C]"} ${submitting ? "opacity-70 cursor-wait" : ""}`}
                      >
                        {submitting ? (
                          <>
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                          </>
                        ) : (
                          isCheckedIn ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                              Confirm Time Out
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
                              Confirm Time In
                            </>
                          )
                        )}
                      </button>
                      <button
                        onClick={() => { setPhoto(null); try { if (fileInputRef.current) fileInputRef.current.value = ""; } catch {} }}
                        disabled={submitting}
                        className={`w-full rounded-xl px-3 py-2 text-gray-600 font-semibold bg-gray-100 hover:bg-gray-200 transition-all active:scale-95 text-sm ${submitting ? "opacity-50 cursor-not-allowed" : ""}`}
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
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[300px] overflow-hidden">
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
                    .map((entry, idx) => {
                      let isLateEntry = false;
                      if (entry.type === "in" && !(entry.validated_by === "SYSTEM_AUTO_CLOSE" || entry.validated_by === "AUTO TIME OUT")) {
                        const date = new Date(entry.timestamp);
                        date.setHours(0, 0, 0, 0);
                        const dateKey = date.toLocaleDateString('en-CA');
                        const dynamicOt = allOvertimeShifts.find(s => s.effective_date === dateKey);
                        const src = dbSchedule;
                        
                        const sched = buildSchedule(
                            date,
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

                        const noonCutoff = new Date(date).setHours(12, 30, 0, 0);
                        
                        // Ledger-only: do not compute live late flags here
                        isLateEntry = false;
                      }

                      return (
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
                              {/* Blank for auto timeout */}
                            </div>
                          ) : (
                            <div className="h-9 w-9 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200 border border-gray-100 relative flex items-center justify-center"></div>
                          )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={`text-[11px] font-semibold uppercase ${(entry.validated_by === "SYSTEM_AUTO_CLOSE" || entry.validated_by === "AUTO TIME OUT") ? "text-red-600" : "text-gray-700"}`}>
                              {(entry.validated_by === "SYSTEM_AUTO_CLOSE" || entry.validated_by === "AUTO TIME OUT") ? "" : (entry.type === "in" ? "Time In" : "Time Out")}
                            </span>
                            {!(entry.validated_by === "SYSTEM_AUTO_CLOSE" || entry.validated_by === "AUTO TIME OUT") && (
                            <span className={`text-[10px] font-medium ${getStatusColorClass(entry)}`}>
                              {formatStatusLabel(entry)}
                            </span>
                            )}
                          </div>
                          {entry.status === "Official" ? (
                            <div className="text-xs font-medium text-gray-900 mt-0.5 flex items-center gap-2">
                                {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">OFFICIAL</span>
                            </div>
                          ) : !(entry.validated_by === "SYSTEM_AUTO_CLOSE" || entry.validated_by === "AUTO TIME OUT") ? (
                          <div className="flex flex-col items-start mt-0.5">
                            <div className={`text-xs font-medium whitespace-nowrap ${isLateEntry ? 'text-red-600 font-bold' : 'text-gray-900'}`}>
                                {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                            {isLateEntry ? (
                                <div className="text-[7px] font-bold text-red-500 leading-none mt-0.5">LATE</div>
                            ) : (
                                <div className="text-[7px] font-bold text-transparent leading-none mt-0.5 invisible">LATE</div>
                            )}
                          </div>
                          ) : (
                            <div className="text-xs font-medium text-gray-400 mt-0.5"></div>
                          )}
                          <div className="text-[10px] text-gray-400">
                            {new Date(entry.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </div>
                        </div>
                      </button>
                    );
                    })
                )}
              </div>
            </div>

            {/* Events Card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[300px] overflow-hidden">
               <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Events</div>
               </div>
               <div className="p-3 overflow-y-auto custom-scrollbar flex-1 space-y-2">
                  {events.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                        <p className="text-sm font-medium">No upcoming events</p>
                    </div>
                  ) : (
                    events
                    .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime())
                    .map((event: any) => (
                        <button 
                          key={event.id} 
                          onClick={() => setSelectedEvent(event)}
                          className="w-full p-3 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md hover:bg-blue-50/30 transition-all text-left group"
                        >
                            <div className="font-semibold text-gray-800 text-sm group-hover:text-blue-700 transition-colors">{event.title}</div>
                            <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                              {new Date(event.event_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                            {event.description && <div className="text-xs text-gray-600 mt-2 line-clamp-2">{event.description}</div>}
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

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selectedEvent.title}</h3>
                <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  {new Date(selectedEvent.event_date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <button 
                onClick={() => setSelectedEvent(null)}
                className="p-2 rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {selectedEvent.description && (
                <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                  <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">Description</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">{selectedEvent.description}</p>
                </div>
              )}

              <div className="flex flex-col gap-4">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-center">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Morning Session</div>
                  <div className="text-sm font-bold text-gray-900">
                    {selectedEvent.am_in ? formatDisplayTime(selectedEvent.am_in) : "--:--"} - {selectedEvent.am_out ? formatDisplayTime(selectedEvent.am_out) : "--:--"}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-center">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Afternoon Session</div>
                  <div className="text-sm font-bold text-gray-900">
                    {selectedEvent.pm_in ? formatDisplayTime(selectedEvent.pm_in) : "--:--"} - {selectedEvent.pm_out ? formatDisplayTime(selectedEvent.pm_out) : "--:--"}
                  </div>
                </div>
              </div>

              {selectedEvent.overtime_in && selectedEvent.overtime_out && (
                 <div className="bg-green-50 rounded-xl p-4 border border-green-100 text-center">
                   <div className="text-xs font-bold text-green-700 uppercase tracking-wider mb-1">Overtime</div>
                   <div className="text-sm font-bold text-green-900">
                     {formatDisplayTime(selectedEvent.overtime_in)} - {formatDisplayTime(selectedEvent.overtime_out)}
                   </div>
                 </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
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

const REPORT_SECTIONS = [
  { id: "introduction", label: "Introduction", description: "State where you are assigned and your main role this week." },
  { id: "activities", label: "Activities Performed", description: "Narrate the tasks you handled and your participation in each." },
  { id: "tools", label: "Tools and Skills Used", description: "Mention software, equipment, or skills you applied." },
  { id: "challenges", label: "Challenges Encountered", description: "Explain any problems or difficulties faced." },
  { id: "solutions", label: "Solutions and Learning", description: "Describe how the problem was solved and what you learned." },
  { id: "accomplishments", label: "Accomplishments", description: "Highlight completed work or outputs." },
  { id: "reflection", label: "Reflection", description: "Share your insights and improvements." }
];

const INITIAL_REPORT_DATA = {
  introduction: "",
  activities: "",
  tools: "",
  challenges: "",
  solutions: "",
  accomplishments: "",
  reflection: ""
};

function ReportDetailsModal({ report, onClose, onEdit }: { report: ReportEntry; onClose: () => void; onEdit?: () => void }) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const structuredData = useMemo(() => {
    if (!report.body) return null;
    try {
      const data = JSON.parse(report.body);
      if (typeof data === 'object' && data !== null && ('introduction' in data || 'activities' in data)) {
        return data;
      }
      return null;
    } catch (e) {
      return null;
    }
  }, [report.body]);

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
           <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Report Details</h2>
                <p className="text-xs text-gray-500 font-medium">Week {report.week}</p>
              </div>
           </div>
           <button 
             onClick={onClose}
             className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
           >
             <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
           </button>
        </div>
        
        <div className="p-4 overflow-y-auto custom-scrollbar space-y-4">
           {/* Header Info */}
           <div className="flex items-start justify-between">
              <div>
                 <h3 className="text-lg font-bold text-gray-900">{report.title}</h3>
                 <p className="text-xs text-gray-500 mt-0.5">Submitted on {new Date(report.submittedAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide border ${report.isViewedByInstructor || report.instructorComment ? "bg-green-100 text-green-700 border-green-200" : "bg-orange-100 text-orange-700 border-orange-200"}`}>
                {report.isViewedByInstructor || report.instructorComment ? "Reviewed" : "Under Review"}
              </span>
           </div>

           {/* Instructor Feedback */}
           {report.instructorComment && (
              <div className="mt-4 animate-in slide-in-from-top-2">
                 <div className="bg-red-50 rounded-xl p-3 border border-red-100 text-gray-800 shadow-sm relative">
                    <div className="flex items-center gap-2 mb-1 text-red-700">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                        <h3 className="font-bold text-xs">Instructor Feedback</h3>
                    </div>
                    <p className="text-sm">{report.instructorComment}</p>
                 </div>
              </div>
           )}

           {/* Attachment */}
           {report.fileName && (
              <div className="p-3 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between group hover:border-[#F97316] hover:bg-orange-50/10 transition-all">
                <div className="flex items-center gap-3">
                   <div className="h-8 w-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-[#F97316]">
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                   </div>
                   <div>
                     <p className="text-xs font-bold text-gray-900 group-hover:text-[#F97316] transition-colors">{report.fileName}</p>
                     <p className="text-[10px] text-gray-500">Document Attachment</p>
                   </div>
                </div>
                <a href={report.fileUrl || "#"} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-white border border-gray-200 text-[#F97316] rounded-lg text-xs font-semibold hover:bg-[#F97316] hover:text-white transition-colors shadow-sm">
                   Download
                </a>
              </div>
           )}

           {/* Photos Attachment */}
           {((report.photos && report.photos.length > 0) || report.photoName) && (
             <div className="space-y-2">
               <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Photo Evidence</h4>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                 {report.photos && report.photos.length > 0 ? (
                    report.photos.map((photo, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => setSelectedImage(photo.url)}
                        className="group relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50 hover:shadow-md transition-all block w-full text-left"
                      >
                         <img src={photo.url} alt={photo.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                         <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end p-2">
                            <p className="text-[9px] font-medium text-white opacity-0 group-hover:opacity-100 truncate w-full shadow-sm">{photo.name}</p>
                         </div>
                      </button>
                    ))
                 ) : (
                    // Legacy Fallback
                    <button 
                      onClick={() => setSelectedImage(report.photoUrl || null)}
                      className="group relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50 hover:shadow-md transition-all block w-full text-left"
                    >
                       <img src={report.photoUrl} alt={report.photoName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                       <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end p-2">
                          <p className="text-[9px] font-medium text-white opacity-0 group-hover:opacity-100 truncate w-full shadow-sm">{report.photoName}</p>
                       </div>
                    </button>
                 )}
               </div>
             </div>
           )}

           {/* Content */}
           <div className="space-y-4">
              <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Report Content</h4>
              
              {structuredData ? (
                 <div className="space-y-4">
                    {REPORT_SECTIONS.map((section, idx) => (
                       <div key={section.id} className="group">
                          <div className="mb-1.5 border-b border-gray-100 pb-1">
                             <label className="block text-xs font-bold text-gray-900">
                                {idx + 1}. {section.label}
                             </label>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 text-gray-700 whitespace-pre-wrap leading-relaxed text-sm">
                             {structuredData[section.id] || "No response provided."}
                          </div>
                       </div>
                    ))}
                 </div>
              ) : (
                 <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 min-h-[100px] text-gray-700 whitespace-pre-wrap leading-relaxed text-sm">
                   {report.body || "No text content."}
                 </div>
              )}
           </div>
        </div>
        
        <div className="p-3 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
           {onEdit && (
              <button 
                 onClick={onEdit}
                 className="px-4 py-2 bg-[#F97316] text-white font-bold rounded-xl hover:bg-[#EA580C] transition-colors shadow-sm text-sm flex items-center gap-2"
              >
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                 Open in Text Editor
              </button>
           )}
           <button 
             onClick={onClose}
             className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors shadow-sm text-sm"
           >
             Close
           </button>
        </div>
      </div>
      
      {/* Lightbox Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedImage(null);
          }}
        >
          <div className="relative w-full max-w-4xl max-h-[90vh] flex items-center justify-center">
             <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImage(null);
                }}
                className="absolute -top-10 right-0 p-2 text-white hover:text-gray-300 transition-colors"
             >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
             </button>
             <img 
                src={selectedImage} 
                alt="Full View" 
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()} 
             />
          </div>
        </div>
      )}
    </div>
  );
}

function DuplicateEntryModal({ onClose, message }: { onClose: () => void; message: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md p-4 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col items-center text-center">
        <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Attention</h3>
        <p className="text-sm text-gray-600 mb-5 leading-relaxed">
          {message}
        </p>
        <button 
          onClick={onClose}
          className="w-full py-2 bg-[#F97316] text-white font-bold rounded-xl hover:bg-[#EA580C] transition-colors shadow-lg shadow-orange-200 text-sm"
        >
          I Understand
        </button>
      </div>
    </div>
  );
}


export function NoDeadlineModal({ onClose, onConfirm, week }: { onClose: () => void; onConfirm: () => void; week: number }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-12 w-12 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center flex-shrink-0">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">No Deadline Found</h3>
            <p className="text-sm text-gray-500">Week {week}</p>
          </div>
        </div>
        
        <p className="text-gray-600 text-sm leading-relaxed mb-6">
          This report does not have a set deadline. Are you sure you want to submit it now?
          <br/><br/>
          <span className="font-semibold text-gray-900">Note:</span> Once submitted, you cannot edit it unless your instructor returns it.
        </p>

        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors text-sm"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 bg-yellow-500 text-white font-bold rounded-xl hover:bg-yellow-600 transition-colors shadow-lg shadow-yellow-200 text-sm"
          >
            Submit Anyway
          </button>
        </div>
      </div>
    </div>
  );
}


export function ReportsView({ 
  idnumber, 
  studentId,
  reports, 
  drafts = [], 
  deadlines = [],
  onUpdate, 
  onDraftUpdate 
}: { 
  idnumber: string; 
  studentId?: number;
  reports: ReportEntry[]; 
  drafts?: ReportEntry[]; 
  deadlines?: { week: number; date: string }[];
  onUpdate: (next: ReportEntry[]) => void; 
  onDraftUpdate: (drafts: ReportEntry[]) => void 
}) {
  const [showAllReportsModal, setShowAllReportsModal] = useState(false);
  const [showAllCardsModal, setShowAllCardsModal] = useState(false);
  const [showNoDeadlineModal, setShowNoDeadlineModal] = useState(false);
  const [viewAllWeeks, setViewAllWeeks] = useState(false);
  const [monthFilter, setMonthFilter] = useState<string>("");
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [viewingReport, setViewingReport] = useState<ReportEntry | null>(null);
  const [viewingDraft, setViewingDraft] = useState<ReportEntry | null>(null);
  const [draftToDelete, setDraftToDelete] = useState<ReportEntry | null>(null);
  
  // Editor State
  const [title, setTitle] = useState("");
  // const [body, setBody] = useState(NARRATIVE_GUIDE); // Replaced by structured data
  const [reportData, setReportData] = useState<Record<string, string>>(INITIAL_REPORT_DATA);
  const [file, setFile] = useState<File | null>(null);
  const [existingFile, setExistingFile] = useState<{name: string, type: string, url?: string} | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<{name: string, type: string, url: string}[]>([]);
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
    // REMOVED: User requested to show "Up to date" instead of a locked future week.
    /*
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
    */

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
    
    // Clear value to allow re-selection
    e.target.value = "";
    
    if (!f) { setFile(null); return; }
    const lower = f.name.toLowerCase();
    const ok = allowedTypes.has(f.type) || lower.endsWith(".pdf") || lower.endsWith(".doc") || lower.endsWith(".docx");
    if (!ok) {
      const msg = "Only Word (.doc/.docx) and PDF files are allowed.";
      setError(msg);
      alert(msg);
      setFile(null);
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      const msg = "File must be 10MB or smaller.";
      setError(msg);
      alert(msg);
      setFile(null);
      return;
    }
    setFile(f);
  };

  const onPhotosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length === 0) return;

    // Clear the input value to allow re-selecting the same file if needed
    e.target.value = "";

    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const f of newFiles) {
        if (!f.type.startsWith("image/")) {
            errors.push(`File ${f.name} is not an image.`);
            continue;
        }
        if (f.size > 5 * 1024 * 1024) {
            errors.push(`Photo ${f.name} is too large (max 5MB).`);
            continue;
        }
        validFiles.push(f);
    }

    if (errors.length > 0) {
        const msg = errors.join("\n");
        setError(msg);
        alert(msg); // Ensure user sees the error
    }
    
    if (validFiles.length > 0) {
        setPhotos(prev => [...prev, ...validFiles]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingPhoto = (index: number) => {
    setExistingPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const countWords = (data: Record<string, string>) => {
    let total = 0;
    Object.values(data).forEach(str => {
       if (str && str.trim()) {
         total += str.trim().split(/\s+/).filter(w => w.length > 0).length;
       }
    });
    return total;
  };

  const clearForm = () => {
    setTitle("");
    setReportData(INITIAL_REPORT_DATA);
    setFile(null);
    setExistingFile(null);
    setPhotos([]);
    setExistingPhotos([]);
    setDraftId(null);
    setDraftSavedAt(null);
    setError(null);
  };

  const loadDraft = (d: ReportEntry) => {
    setTitle(d.title || "");
    try {
      const parsed = JSON.parse(d.body || "{}");
      // Check if it's our structured data (has at least one matching key)
      if (typeof parsed === 'object' && parsed !== null && Object.keys(INITIAL_REPORT_DATA).some(k => k in parsed)) {
         setReportData({ ...INITIAL_REPORT_DATA, ...parsed });
      } else {
         throw new Error("Legacy content");
      }
    } catch (e) {
      // Legacy text fallback
      // If it's the old guide text, we can ignore it. If it's user text, put in Introduction.
      const isGuide = d.body?.includes("WEEKLY NARRATIVE OJT REPORT");
      setReportData({ 
        ...INITIAL_REPORT_DATA, 
        introduction: isGuide ? "" : (d.body || "") 
      });
    }

    setFile(null);
    setExistingFile(d.fileName ? {name: d.fileName, type: d.fileType || "", url: d.fileUrl} : null);
    
    setPhotos([]);
    if (d.photos && d.photos.length > 0) {
        setExistingPhotos(d.photos.map(p => ({ ...p, type: p.type || "image/jpeg" })));
    } else if (d.photoName && d.photoUrl) {
        setExistingPhotos([{name: d.photoName, type: "image/jpeg", url: d.photoUrl}]);
    } else {
        setExistingPhotos([]);
    }

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
    const targetWeek = selectedWeek || ((slots[slots.length-1]?.week || 0) + 1);
    
    setSubmitting(true);
    try {
      let fileData = null;
      if (file) {
        fileData = await toBase64(file);
      }

      // Process new photos
      const photosPayload = [];
      if (photos.length > 0) {
        for (const p of photos) {
            const data = await toBase64(p);
            photosPayload.push({
                name: p.name,
                type: p.type,
                data: data
            });
        }
      }

      const payload: any = {
        idnumber: (idnumber?.trim() || (typeof window !== "undefined" ? (localStorage.getItem("idnumber") || "") : "")).trim(),
        studentId,
        title: (file || existingFile) ? (file?.name || existingFile?.name) : title.trim(),
        body: JSON.stringify(reportData),
        fileName: file?.name || existingFile?.name,
        fileType: file?.type || existingFile?.type,
        fileData: fileData,
        existingFileUrl: existingFile?.url,
        // Legacy fields for single photo compatibility
        photoName: photos.length > 0 ? photos[0].name : (existingPhotos.length > 0 ? existingPhotos[0].name : null),
        photoType: photos.length > 0 ? photos[0].type : (existingPhotos.length > 0 ? existingPhotos[0].type : null),
        photoData: photosPayload.length > 0 ? photosPayload[0].data : null,
        existingPhotoUrl: existingPhotos.length > 0 ? existingPhotos[0].url : null,
        // New fields
        photos: photosPayload,
        existingPhotos: existingPhotos,
        isDraft: true,
        week: targetWeek
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

  const submit = async (force: boolean = false) => {
    const targetWeek = selectedWeek || ((slots[slots.length-1]?.week || 0) + 1);

    // Check for deadline if not forced
    if (!force) {
       const deadline = deadlines?.find(d => d.week === targetWeek);
       if (!deadline) {
          setShowNoDeadlineModal(true);
          return;
       }
    }

    setError(null);
    const t = title.trim();
    
    // Validation
    if (!t && !file && !existingFile) {
      const msg = "Report title is required.";
      setError(msg);
      alert(msg);
      return;
    }

    // Word count validation (only if no document attachment)
    if (!file && !existingFile) {
      const wordCount = countWords(reportData);
      if (wordCount < 150) {
         const msg = `Report content must be at least 150 words. Current: ${wordCount} words.`;
         setError(msg);
         alert(msg);
         return;
      }
    }

    // Photo validation
    if (photos.length === 0 && existingPhotos.length === 0) {
       const msg = "Photo evidence is required. Please upload at least one work photo/proof of activity.";
       setError(msg);
       alert(msg);
       return;
    }
    
    setSubmitting(true);
    try {
      let fileData = null;
      if (file) {
        fileData = await toBase64(file);
      }

      // Process new photos
      const photosPayload = [];
      if (photos.length > 0) {
        for (const p of photos) {
            const data = await toBase64(p);
            photosPayload.push({
                name: p.name,
                type: p.type,
                data: data
            });
        }
      }

      const payload: any = {
        idnumber: (idnumber?.trim() || (typeof window !== "undefined" ? (localStorage.getItem("idnumber") || "") : "")).trim(),
        studentId,
        title: (file || existingFile) ? (file?.name || existingFile?.name) : t,
        body: JSON.stringify(reportData),
        fileName: file?.name || existingFile?.name,
        fileType: file?.type || existingFile?.type,
        fileData: fileData,
        existingFileUrl: existingFile?.url,
        // Legacy fields for single photo compatibility
        photoName: photos.length > 0 ? photos[0].name : (existingPhotos.length > 0 ? existingPhotos[0].name : null),
        photoType: photos.length > 0 ? photos[0].type : (existingPhotos.length > 0 ? existingPhotos[0].type : null),
        photoData: photosPayload.length > 0 ? photosPayload[0].data : null,
        existingPhotoUrl: existingPhotos.length > 0 ? existingPhotos[0].url : null,
        // New fields
        photos: photosPayload,
        existingPhotos: existingPhotos,
        isDraft: false,
        week: targetWeek
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
       alert(msg);
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

  const getMonthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const monthOptions = Array.from(new Set(slots.map(s => getMonthKey(s.end)))).sort();
  const filteredSlots = monthFilter ? slots.filter(s => getMonthKey(s.end) === monthFilter) : slots;

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const openPrintableReport = async (r: ReportEntry, start?: Date, end?: Date) => {
    const nameParts = (() => {
      try {
        const fn = localStorage.getItem("firstname") || "";
        const ln = localStorage.getItem("lastname") || "";
        return `${fn} ${ln}`.trim();
      } catch { return ""; }
    })();
    let course = (() => { try { return localStorage.getItem("course") || ""; } catch { return ""; } })();
    let section = (() => { try { return localStorage.getItem("section") || ""; } catch { return ""; } })();
    if (!course || !section) {
      try {
        const res = await fetch(`/api/users?idnumber=${encodeURIComponent(idnumber)}`, { cache: "no-store" });
        const json = await res.json();
        if (Array.isArray(json.users) && json.users.length > 0) {
          const me = json.users[0] || {};
          course = me.course || (me.courses?.name) || course || "";
          section = me.section || (me.sections?.name) || section || "";
        }
      } catch {}
    }
    const structured = (() => {
      if (!r.body) return null;
      try {
        const data = JSON.parse(r.body);
        if (data && typeof data === "object") return data;
        return null;
      } catch { return null; }
    })();
    const title = r.title || `Weekly Report ${r.week || ""}`;
    const submittedDate = new Date(r.submittedAt);
    const range = start && end
      ? `${start.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })} - ${end.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`
      : submittedDate.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    const escape = (s: string) => (s || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const S = structured || {};
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
      body { font-family: 'Times New Roman', Times, serif; color: #111827; }
      table { width: 100%; border-collapse: collapse; }
      td { vertical-align: top; font-size: 12px; }
      .label { font-weight: 700; }
      .center { text-align: center; }
      .week { margin: 12px 0 8px; font-size: 16px; font-weight: 700; }
      .section { margin: 10px 0; }
      .section-title { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
      .section-body { font-size: 12px; line-height: 1.7; text-indent: 24px; white-space: pre-wrap; }
    </style></head><body>
      <table>
        <tr>
          <td>
            <div><span class="label">Name:</span> ${escape(nameParts || idnumber)}</div>
            <div><span class="label">ID NO.:</span> ${escape(idnumber)}</div>
          </td>
          <td style="text-align:right;">
            <div><span class="label">Course and Section:</span> ${escape(course || "-")}${section ? `-${escape(section)}` : ""}</div>
            <div><span class="label">Date:</span> ${escape(range || "-")}</div>
          </td>
        </tr>
      </table>
      <div class="center week">WEEK ${r.week || "-"}</div>
      <div class="section"><div class="section-title">1. Introduction</div><div class="section-body">${escape(S.introduction || (structured ? "" : (r.body || "")))}</div></div>
      <div class="section"><div class="section-title">2. Activities Performed</div><div class="section-body">${escape(S.activities || "")}</div></div>
      <div class="section"><div class="section-title">3. Tools and Skills Used</div><div class="section-body">${escape(S.tools || "")}</div></div>
      <div class="section"><div class="section-title">4. Challenges Encountered</div><div class="section-body">${escape(S.challenges || "")}</div></div>
      <div class="section"><div class="section-title">5. Solutions and Learning</div><div class="section-body">${escape(S.solutions || "")}</div></div>
      <div class="section"><div class="section-title">6. Accomplishments</div><div class="section-body">${escape(S.accomplishments || "")}</div></div>
      <div class="section"><div class="section-title">7. Reflection</div><div class="section-body">${escape(S.reflection || "")}</div></div>
    </body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const filename = `Weekly_Report_Week_${r.week || ""}.docx`;
    downloadBlob(blob, filename);
  };

  const exportAllWord = async () => {
    const targets = filteredSlots.filter(s => !!s.report).map(s => s.report!) as ReportEntry[];
    for (const r of targets) {
      try {
        if (r.fileUrl) {
          const res = await fetch(r.fileUrl);
          const blob = await res.blob();
          const name = r.fileName || `Weekly_Report_Week_${r.week || ""}.docx`;
          downloadBlob(blob, name);
        } else {
          const title = r.title || `Weekly Report ${r.week || ""}`;
          const body = (r.body || "").replace(/\n/g, "<br/>");
          const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body><h1 style="font-family:Arial; font-size:20px;">${title}</h1><div style="font-family:Arial; font-size:14px; line-height:1.6;">${body || "<i>No content</i>"}</div></body></html>`;
          const blob = new Blob([html], { type: "application/msword" });
          const name = `Weekly_Report_Week_${r.week || ""}.doc`;
          downloadBlob(blob, name);
        }
      } catch (e) {
        console.error("Export failed for report", r, e);
      }
    }
  };

  if (viewAllWeeks) {
    return (
      <div className="flex flex-col gap-3 animate-in fade-in duration-300">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-gray-900">Weekly Reports</h2>
            <div className="flex items-center gap-2">
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] w-full sm:w-auto"
              >
                <option value="">All Months</option>
                {monthOptions.map(m => {
                  const [year, month] = m.split("-");
                  const label = new Date(Number(year), Number(month)-1, 1).toLocaleString(undefined, { month: "short", year: "numeric" });
                  return <option key={m} value={m}>{label}</option>;
                })}
              </select>
              <button 
                onClick={() => setViewAllWeeks(false)}
                className="text-xs font-semibold text-gray-600 hover:text-gray-900 px-3 py-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
          <div className="p-4 space-y-2">
            {filteredSlots.length === 0 ? (
              <div className="text-center py-6 text-gray-500">No deadlines set</div>
            ) : (
              filteredSlots.map(slot => {
                const rangeLabel = `${slot.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${slot.end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
                const deadlineLabel = `Deadline: ${slot.end.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`;
                const statusChip = (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    slot.status === "Reviewed" ? "bg-green-100 text-green-700" :
                    slot.status === "Under Review" ? "bg-yellow-100 text-yellow-700" :
                    slot.status === "Overdue" ? "bg-red-100 text-red-700" :
                    slot.status === "Locked" ? "bg-gray-200 text-gray-700" :
                    slot.status === "Future" ? "bg-blue-100 text-blue-700" :
                    "bg-orange-100 text-orange-700"
                  }`}>
                    {slot.status}
                  </span>
                );
                return (
                  <button
                    key={slot.week}
                    onClick={() => {
                      if (slot.report) setViewingReport(slot.report);
                      else {
                        setSelectedWeek(slot.week);
                        setViewAllWeeks(false);
                      }
                    }}
                    className="w-full text-left bg-gray-50 rounded-xl p-3 border border-gray-100 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-gray-900 text-sm">Week {slot.week}</div>
                        {statusChip}
                      </div>
                    <div className="flex items-center gap-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                <div className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {deadlineLabel}
                </div>
                {slot.report && (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); openPrintableReport(slot.report!, slot.start, slot.end); }}
                    className="inline-flex items-center justify-center text-[10px] font-bold text-[#F97316] px-2 py-0.5 rounded-lg border border-orange-200 hover:bg-orange-50 hover:text-[#EA580C] transition-colors w-full sm:w-auto"
                    title="Download"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1"><path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    Download
                  </div>
                )}
              </div>
                    </div>
                    </div>
                    <div className="text-sm font-bold text-gray-900">{rangeLabel}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>
        {viewingReport && (
          <ReportDetailsModal 
            report={viewingReport} 
            onClose={() => setViewingReport(null)} 
          />
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 animate-in fade-in duration-500">
      
      {/* Left Column - Main Editor / Viewer */}
      <div className="lg:col-span-2 space-y-2">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-[500px] flex flex-col">
            <div className="px-3 py-1.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <div className={`h-1.5 w-1.5 rounded-full ${
                    (activeSlot.status === "Reviewed" || activeSlot.status === "Under Review") ? "bg-green-500" :
                    activeSlot.status === "Overdue" ? "bg-red-500" :
                    activeSlot.status === "Pending" ? "bg-[#F97316]" : "bg-gray-400"
                 }`}></div>
                 <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                   {activeSlot.report ? "Report Details" : "Compose Report"}
                 </h2>
               </div>
               <span className="text-[10px] font-semibold text-gray-500">Week {activeSlot.week}</span>
            </div>

            <div className="p-2 flex-1 flex flex-col min-h-0">
               {/* LOCKED STATE */}
               {activeSlot.isLocked ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-3">
                     <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                     </div>
                     <h3 className="text-xs font-bold text-gray-900 mb-1">Report Locked</h3>
                     <p className="text-[10px] text-gray-500 max-w-xs">
                        This report is currently locked. Please submit your report for the previous week to unlock this one.
                     </p>
                  </div>
               ) : (
                  /* EDIT / VIEW-IN-EDITOR MODE */
                  <>
                  <div className="space-y-1.5 flex-1 flex flex-col overflow-y-auto custom-scrollbar pr-1 min-h-0">
                     {activeSlot.report && (
                        <div className={`border rounded-lg p-1.5 flex items-center gap-2 ${
                           activeSlot.status === "Reviewed" ? "bg-green-50 border-green-200 text-green-800" :
                           "bg-orange-50 border-orange-200 text-orange-800"
                        }`}>
                           <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                           <div className="text-[10px] font-medium">
                              {activeSlot.status === "Reviewed" ? "Report Reviewed." : "Report Under Review."} <button onClick={() => setViewingReport(activeSlot.report!)} className={`underline font-bold ${activeSlot.status === "Reviewed" ? "hover:text-green-900" : "hover:text-orange-900"}`}>View Details</button>
                           </div>
                        </div>
                     )}

                     {error && (
                        <div className="rounded-lg bg-red-50 border border-red-100 p-1.5 flex items-center gap-2 text-red-700">
                           <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                           <span className="text-[10px] font-medium">{error}</span>
                        </div>
                     )}

                     <div>
                       <label className="block text-[9px] uppercase font-bold text-gray-500 mb-0.5">Report Title</label>
                       <input 
                         value={title} 
                         onChange={e => setTitle(e.target.value)}
                         disabled={!!file || !!activeSlot.report}
                         placeholder={!!file ? "Title will be the filename" : "e.g. Week " + activeSlot.week + " Accomplishment Report"}
                         className={`w-full rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-900 placeholder-gray-400 focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all shadow-sm ${!!file || !!activeSlot.report ? "bg-gray-100 cursor-not-allowed opacity-70" : ""}`}
                       />
                     </div>
                     
                    <div className="flex flex-col">
                      <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-100">
                         <label className="block text-[10px] uppercase font-bold text-gray-800 tracking-wide">Weekly Narrative OJT Report</label>
                         <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${countWords(reportData) < 150 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                            {countWords(reportData)} / 150 words
                         </span>
                      </div>
                      
                      <div className="space-y-4 pb-2">
                        {REPORT_SECTIONS.map((section, idx) => (
                          <div key={section.id} className="group">
                             <div className="mb-1.5">
                                <label className="block text-xs font-bold text-gray-900 mb-0.5">
                                   {idx + 1}. {section.label}
                                </label>
                                <p className="text-[10px] text-gray-500 italic">{section.description}</p>
                             </div>
                             <textarea 
                               value={reportData[section.id] || ""}
                               onChange={e => setReportData({...reportData, [section.id]: e.target.value})}
                               disabled={!!file || !!activeSlot.report}
                               placeholder={`Type your response here...`}
                               className={`w-full rounded-lg border border-gray-200 p-3 text-xs leading-relaxed text-gray-800 placeholder-gray-400 focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all resize-none shadow-sm font-sans ${!!file || !!activeSlot.report ? "bg-gray-50 cursor-not-allowed opacity-80" : "bg-white"}`}
                               rows={section.id === 'introduction' || section.id === 'reflection' ? 3 : 5}
                             />
                          </div>
                        ))}
                      </div>
                    </div>

                     </div>
                     <div className="pt-2 bg-white border-t border-gray-100 mt-2">
                     <div className="grid grid-cols-2 gap-2">
                        {/* Document Attachment */}
                        <div>
                           <label className="block text-[9px] uppercase font-bold text-gray-500 mb-0.5">Document (Optional)</label>
                           {!file && !existingFile ? (
                              activeSlot.report ? (
                                 <div className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-400 text-[10px] text-center h-[50px] flex items-center justify-center">
                                    No attachment
                                 </div>
                              ) : (
                                 <div className="relative group h-[50px]">
                                    <input 
                                       type="file" 
                                       onChange={onFileChange}
                                       accept=".pdf,.doc,.docx"
                                       className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div className="w-full h-full rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-1 flex flex-col items-center justify-center text-center group-hover:border-[#F97316] group-hover:bg-orange-50/30 transition-all">
                                       <div className="flex items-center gap-1">
                                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                          <span className="text-[10px] font-semibold text-gray-700">Upload File</span>
                                       </div>
                                    </div>
                                 </div>
                              )
                           ) : (
                              <div className="flex items-center justify-between p-1.5 rounded-lg border border-blue-100 bg-blue-50/50 h-[50px]">
                                 <div className="flex items-center gap-2 min-w-0">
                                    <div className="p-1 rounded-md bg-white border border-blue-100 shadow-sm text-blue-600">
                                       <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                    </div>
                                    <div className="min-w-0">
                                       <p className="text-[10px] font-semibold text-gray-900 truncate">{file ? file.name : existingFile?.name}</p>
                                    </div>
                                 </div>
                                 {!activeSlot.report && (
                                    <button onClick={() => { setFile(null); setExistingFile(null); }} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                                       <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                 )}
                              </div>
                           )}
                        </div>

                        {/* Photo Attachment */}
                        <div>
                           <label className="block text-[9px] uppercase font-bold text-gray-500 mb-0.5">Photo Evidence (Required)</label>
                           <div className="space-y-1.5">
                              {/* Upload Area */}
                              <div className="relative group h-[50px]">
                                 <input 
                                    type="file" 
                                    onChange={onPhotosChange}
                                    accept="image/*"
                                    multiple
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    disabled={!!activeSlot.report}
                                 />
                                 <div className={`w-full h-full rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-1 flex flex-col items-center justify-center text-center transition-all ${!activeSlot.report ? "group-hover:border-[#F97316] group-hover:bg-orange-50/30" : "opacity-60 cursor-not-allowed"}`}>
                                    <div className="flex items-center gap-1">
                                       <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                       <span className="text-[10px] font-semibold text-gray-700">Upload Photos (Multiple Allowed)</span>
                                    </div>
                                 </div>
                              </div>
                              
                              {/* Photos List */}
                              {(photos.length > 0 || existingPhotos.length > 0) && (
                                 <div className="flex flex-wrap gap-2 mt-2">
                                    {/* New Photos */}
                                    {photos.map((photo, index) => (
                                       <div key={`new-${index}`} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                                          <img 
                                             src={URL.createObjectURL(photo)} 
                                             alt="Preview" 
                                             className="w-full h-full object-cover"
                                          />
                                          {!activeSlot.report && (
                                             <button 
                                                onClick={() => removePhoto(index)}
                                                className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                             >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                             </button>
                                          )}
                                       </div>
                                    ))}
                                    
                                    {/* Existing Photos */}
                                    {existingPhotos.map((photo, index) => (
                                       <div key={`existing-${index}`} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-blue-200 shadow-sm">
                                          <img 
                                             src={photo.url} 
                                             alt="Preview" 
                                             className="w-full h-full object-cover"
                                          />
                                          {!activeSlot.report && (
                                             <button 
                                                onClick={() => removeExistingPhoto(index)}
                                                className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                             >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                             </button>
                                          )}
                                       </div>
                                    ))}
                                 </div>
                              )}
                              
                              {photos.length === 0 && existingPhotos.length === 0 && activeSlot.report && (
                                 <div className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-400 text-[10px] text-center h-[50px] flex items-center justify-center">
                                    No photo evidence
                                 </div>
                              )}
                           </div>
                        </div>
                     </div>

                     <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                        {!activeSlot.report ? (
                           <>
                              <div className="flex items-center gap-2">
                                 <button onClick={saveDraft} disabled={submitting} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 text-gray-600 font-bold text-[10px] hover:bg-gray-50 hover:text-[#F97316] transition-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                                    Save
                                 </button>
                                 <button onClick={clearForm} className="px-2 py-1 rounded-lg text-gray-400 font-bold text-[10px] hover:bg-gray-50 hover:text-gray-600 transition-all">
                                    Clear
                                 </button>
                              </div>
                              <button onClick={() => submit(false)} disabled={submitting} className="px-3 py-1 rounded-lg bg-[#F97316] text-white font-bold text-[10px] hover:bg-[#EA580C] transition-all shadow-sm disabled:opacity-70 flex items-center gap-2">
                                {submitting && <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                                Submit
                              </button>
                           </>
                        ) : (
                           <div className="text-xs text-gray-500 italic w-full text-center">
                              This report has been submitted and cannot be edited.
                           </div>
                        )}
                     </div>
                  </div>
                  </>
               )}
            </div>
          </div>
      </div>

      {/* Right Column - Sidebar */}
      <div className="space-y-2 h-[500px] flex flex-col">
         
         {/* My Drafts */}
         <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col">
             <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
               <div className="flex items-center gap-2">
                 <div className="h-1.5 w-1.5 rounded-full bg-[#F97316]"></div>
                 <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">My Drafts</span>
               </div>
               <span className="px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 text-[9px] font-bold">{drafts.length}</span>
             </div>
             <div className="p-1.5 overflow-y-auto custom-scrollbar">
                {drafts.length === 0 ? (
                  <div className="text-center py-3">
                     <div className="h-6 w-6 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mx-auto mb-1">
                       <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                     </div>
                     <p className="text-[10px] font-medium text-gray-900">No drafts saved</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {drafts.map(draft => (
                       <div 
                         key={draft.id} 
                         onClick={() => setViewingDraft(draft)}
                         className="w-full text-left p-2 rounded-lg border border-gray-100 hover:border-orange-200 hover:bg-orange-50 transition-all group cursor-pointer relative"
                       >
                         <div className="flex justify-between items-center pr-6">
                            <p className="text-[10px] font-bold text-gray-900 truncate flex-1" title={draft.title || "Untitled Report"}>
                               {draft.title || "Untitled Report"}
                            </p>
                            <span className="text-[9px] text-gray-400 whitespace-nowrap ml-2">{new Date(draft.submittedAt).toLocaleDateString()}</span>
                         </div>
                         
                         <button 
                           onClick={(e) => deleteDraft(draft, e)}
                           className="absolute top-1.5 right-1.5 p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                           title="Delete Draft"
                         >
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                         </button>
                       </div>
                    ))}
                  </div>
                )}
             </div>
         </div>

         {/* Weekly Reports List */}
         <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
             <div className="px-3 py-1.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between flex-shrink-0">
               <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">Weekly Reports</span>
               <button 
                onClick={() => setViewAllWeeks(true)}
                 className="text-[10px] font-bold text-[#F97316] hover:text-[#EA580C] hover:underline transition-colors"
               >
                 View All
               </button>
             </div>
             <div className="flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
                {slots.length === 0 ? (
                  <div className="text-center py-3 text-gray-400">
                    <p className="text-[10px]">No deadlines set</p>
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
                       className={`w-full text-left p-1.5 rounded-lg border transition-all duration-200 relative overflow-hidden ${
                         selectedWeek === slot.week 
                           ? "border-[#F97316] ring-1 ring-[#F97316] bg-orange-50/30" 
                           : "border-gray-100 hover:border-orange-200 hover:shadow-sm bg-white"
                       }`}
                     >
                       <div className="flex justify-between items-start mb-0.5">
                          <div className="flex items-center gap-2">
                             <span className={`text-[10px] font-bold uppercase ${selectedWeek === slot.week ? "text-[#F97316]" : "text-gray-500"}`}>Week {slot.week}</span>
                             {slot.report?.instructorComment && (
                                <div className="flex items-center gap-1 text-red-600 animate-pulse" title="Instructor Comment">
                                   <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                                   </svg>
                                </div>
                             )}
                          </div>
                          
                          {slot.status === "Reviewed" ? (
                             <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[9px] font-bold uppercase tracking-wide">Reviewed</span>
                          ) : slot.status === "Under Review" ? (
                             <span className="px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[9px] font-bold uppercase tracking-wide">Under Review</span>
                          ) : slot.status === "Overdue" ? (
                             <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[9px] font-bold uppercase tracking-wide">Overdue</span>
                          ) : slot.status === "Pending" ? (
                             <span className="px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[9px] font-bold uppercase tracking-wide">Pending</span>
                          ) : slot.status === "Future" ? (
                             <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold uppercase tracking-wide">Upcoming</span>
                          ) : (
                             <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[9px] font-bold uppercase tracking-wide">Locked</span>
                          )}
                       </div>
                       
                       <div className={`text-[10px] font-bold mb-0.5 ${slot.isLocked ? "text-gray-400" : "text-gray-900"}`}>
                          {slot.start.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} - {slot.end.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                       </div>
                       
                       <div className="text-[9px] text-gray-500 mb-1">
                          Deadline: {slot.end.toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'})}
                       </div>
                       
                       <div className={`text-[9px] font-bold flex items-center gap-1 ${
                          (slot.status === "Reviewed") ? "text-green-600" : 
                          slot.status === "Under Review" ? "text-orange-600" :
                          slot.isLocked ? "text-gray-400" : "text-[#F97316]"
                       }`}>
                          {(slot.status === "Reviewed" || slot.status === "Under Review") ? (
                             <>
                               <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                               View Report
                             </>
                          ) : slot.isLocked ? (
                             <>
                               <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                               Locked
                             </>
                          ) : null}
                       </div>

                     </button>
                  ))
                )}
                {slots.length > 0 && 
                 (slots[slots.length-1].status === "Reviewed" || slots[slots.length-1].status === "Under Review") && (
                   <div className="p-4 text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="h-10 w-10 bg-green-50 rounded-full flex items-center justify-center text-green-500 mx-auto mb-2">
                         <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                      </div>
                      <p className="text-[11px] font-bold text-gray-800">You are all caught up!</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">No pending reports at the moment.</p>
                   </div>
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

      {viewingDraft && (
        <ReportDetailsModal 
          report={viewingDraft} 
          onClose={() => setViewingDraft(null)} 
          onEdit={() => {
            setViewingDraft(null);
            loadDraft(viewingDraft);
          }}
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
      {showAllCardsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
              <h2 className="text-lg font-bold text-gray-900">Weekly Reports</h2>
              <button onClick={() => setShowAllCardsModal(false)} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {slots.map(slot => {
                const rangeLabel = `${slot.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${slot.end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
                const deadlineLabel = `Deadline: ${slot.end.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`;
                const statusClass =
                  slot.status === "Reviewed" ? "bg-green-100 text-green-700" :
                  slot.status === "Under Review" ? "bg-blue-100 text-blue-700" :
                  slot.status === "Overdue" ? "bg-red-100 text-red-700" :
                  slot.status === "Locked" ? "bg-gray-200 text-gray-700" :
                  slot.status === "Future" ? "bg-gray-100 text-gray-600" :
                  "bg-orange-100 text-orange-700";
                return (
                  <button
                    key={slot.week}
                    onClick={() => {
                      if ((slot.status === "Reviewed" || slot.status === "Under Review") && slot.report) {
                        setShowAllCardsModal(false);
                        setViewingReport(slot.report);
                      } else {
                        setShowAllCardsModal(false);
                        setSelectedWeek(slot.week);
                      }
                    }}
                    className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-green-200 hover:shadow-sm bg-white transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">Week {slot.week}</div>
                        <div className="text-sm font-bold text-gray-900">{rangeLabel}</div>
                        <div className="text-[11px] text-gray-500">{deadlineLabel}</div>
                        <div className="mt-1">
                          {(slot.status === "Reviewed" || slot.status === "Under Review") && slot.report ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                              View Report
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#F97316]">
                              Write Report
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusClass}`}>
                        {slot.status}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
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
      {showNoDeadlineModal && selectedWeek && (
        <NoDeadlineModal 
            onClose={() => setShowNoDeadlineModal(false)}
            onConfirm={() => {
                setShowNoDeadlineModal(false);
                submit(true);
            }}
            week={selectedWeek}
        />
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
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
          newPassword,
          role: "student"
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-in fade-in duration-500">
      {/* Main Profile Section */}
      <div className="lg:col-span-2 space-y-3">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-orange-400 to-orange-600 relative">
             <div className="absolute inset-0 bg-black/10"></div>
          </div>
          <div className="px-4 pb-3 relative">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-3 -mt-10 mb-3">
              <div 
                className="relative group h-20 w-20 rounded-xl border-4 border-white bg-white shadow-md flex items-center justify-center text-xl font-bold text-gray-800 shrink-0 overflow-hidden cursor-pointer"
                onClick={() => !isUploading && fileInputRef.current?.click()}
              >
                {student?.avatar_url ? (
                  <img src={student.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  (fullname?.[0] || student?.firstname?.[0] || student?.lastname?.[0] || "?").toUpperCase()
                )}
                
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    {isUploading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                        <span className="text-white text-[9px] font-medium">Change</span>
                    )}
                </div>
                
                {/* Action Buttons */}
                <div className="absolute bottom-0.5 right-0.5 flex gap-0.5 z-20">
                    {student?.avatar_url && (
                        <button 
                            onClick={handleAvatarDelete}
                            disabled={isDeleting || isUploading}
                            className="h-5 w-5 bg-red-500 text-white rounded-full shadow-lg border border-white flex items-center justify-center transition-transform hover:scale-110"
                            title="Remove photo"
                        >
                             {isDeleting ? (
                                <div className="animate-spin rounded-full h-1.5 w-1.5 border-b-2 border-white"></div>
                             ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                             )}
                        </button>
                    )}
                    <div className="h-5 w-5 bg-[#F97316] text-white rounded-full shadow-lg border border-white flex items-center justify-center transition-transform group-hover:scale-110">
                        <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
              <div className="text-center sm:text-left mb-0.5">
                 <h1 className="text-lg font-bold text-gray-900">{fullname || "Unknown User"}</h1>
                 <p className="text-gray-500 text-[10px] font-medium">{student?.idnumber || "No ID"}</p>
              </div>
            </div>
            
            <div className="border-t border-gray-100 pt-3">
              <h3 className="text-[9px] font-bold text-gray-900 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F97316]"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                Personal Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
                <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                  <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">First Name</label>
                  <div className="text-gray-900 text-xs font-semibold">{student?.firstname || "-"}</div>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                  <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Last Name</label>
                  <div className="text-gray-900 text-xs font-semibold">{student?.lastname || "-"}</div>
                </div>

                <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                   <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Role</label>
                   <div className="text-gray-900 text-xs font-semibold capitalize">Student</div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3 mt-2">
              <h3 className="text-[9px] font-bold text-gray-900 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F97316]"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>
                Academic Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
                 <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                  <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Course</label>
                  <div className="text-gray-900 text-xs font-semibold">{student?.course || "N/A"}</div>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                  <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Section</label>
                  <div className="text-gray-900 text-xs font-semibold">{student?.section || "N/A"}</div>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 border border-gray-100 sm:col-span-2">
                  <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Supervisor</label>
                  <div className="text-gray-900 text-xs font-semibold">
                    {supervisor ? `${(supervisor.firstname || "").trim()} ${(supervisor.lastname || "").trim()}`.trim() || supervisor.idnumber : "N/A"}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3 mt-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[9px] font-bold text-gray-900 uppercase tracking-wide flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F97316]"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                  OJT Placement
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
                <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                  <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Company</label>
                  <div className="text-gray-900 text-xs font-semibold">{company}</div>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                  <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Location</label>
                  <div className="text-gray-900 text-xs font-semibold">{location}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar / Security Section */}
      <div className="space-y-2">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden sticky top-8">
          <div className="p-2 border-b border-gray-100 bg-gray-50/50">
             <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
               <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F97316]"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
               Security
             </h3>
             <p className="text-[9px] text-gray-500 mt-0">Manage your account password.</p>
          </div>
          
          <div className="p-2 space-y-2">
            {message && (
              <div className={`text-[10px] rounded-lg p-1.5 border flex items-start gap-1.5 ${message.includes("success") ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                 <div className="shrink-0 mt-0.5">
                   {message.includes("success") ? 
                     <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> : 
                     <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                   }
                 </div>
                 <span>{message}</span>
              </div>
            )}
            
            <div className="space-y-1.5">
              <div>
                <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white text-black font-medium px-2 py-1 text-[10px] pr-7 focus:border-[#F97316] focus:ring-4 focus:ring-orange-500/10 outline-none transition-all placeholder:text-gray-800 placeholder:opacity-95"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(v => !v)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-0.5 rounded-md hover:bg-gray-100"
                    aria-label="Toggle password visibility"
                  >
                    {showCurrentPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-gray-700 mb-0.5">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white text-black font-medium px-2 py-1 text-[10px] pr-7 focus:border-[#F97316] focus:ring-4 focus:ring-orange-500/10 outline-none transition-all placeholder:text-gray-800 placeholder:opacity-95"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(v => !v)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-0.5 rounded-md hover:bg-gray-100"
                    aria-label="Toggle password visibility"
                  >
                    {showNewPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-gray-700 mb-0.5">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white text-black font-medium px-2 py-1 text-[10px] pr-7 focus:border-[#F97316] focus:ring-4 focus:ring-orange-500/10 outline-none transition-all placeholder:text-gray-800 placeholder:opacity-95"
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(v => !v)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-0.5 rounded-md hover:bg-gray-100"
                    aria-label="Toggle password visibility"
                  >
                    {showConfirmPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </div>
              </div>
            </div>

            <button
              disabled={loading}
              onClick={changePassword}
              className="w-full rounded-lg bg-gray-900 text-white font-bold py-1.5 hover:bg-black transition-all active:scale-95 touch-manipulation disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-gray-900/10 flex items-center justify-center gap-2 text-[10px]"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm">Adjust Photo</h3>
              <button 
                onClick={() => {
                  setShowCropModal(false);
                  setAvatarPreview(null);
                }}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <X size={18} />
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
                <div className="bg-black/50 backdrop-blur-md text-white text-[10px] font-medium px-3 py-1 rounded-full flex items-center gap-2">
                  <Move size={10} />
                  <span>Drag to Reposition</span>
                </div>
              </div>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[10px] font-medium text-gray-500">
                  <span className="flex items-center gap-1.5"><ZoomOut size={12}/> Zoom Out</span>
                  <span className="flex items-center gap-1.5">Zoom In <ZoomIn size={12}/></span>
                </div>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600 hover:accent-orange-700 transition-all"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCropModal(false);
                    setAvatarPreview(null);
                  }}
                  className="flex-1 py-1.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-xs hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCropConfirm}
                  disabled={isUploading}
                  className="flex-1 py-1.5 rounded-xl bg-orange-600 text-white font-semibold text-xs hover:bg-orange-700 transition-colors shadow-lg shadow-orange-600/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
