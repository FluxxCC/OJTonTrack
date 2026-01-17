"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import citeLogo from "../../../../assets/CITE.png";
import { AttendanceDetailsModal } from "@/components/AttendanceDetailsModal";
import { supabase } from "@/lib/supabaseClient";

export type AttendanceEntry = { type: "in" | "out"; timestamp: number; photoDataUrl: string; status?: "Pending" | "Approved" | "Rejected"; approvedAt?: number };
export type ReportEntry = { id?: number; title: string; body?: string; fileName?: string; fileType?: string; fileUrl?: string; submittedAt: number; instructorComment?: string; isViewedByInstructor?: boolean };
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

function normalizeTimeString(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parts = raw.split(":");
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

function formatDisplayTime(raw: string | null | undefined): string {
  const t = normalizeTimeString(raw);
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  let h = Number(hStr || 0);
  const m = Number(mStr || 0);
  const suffix = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  const mm = String(m).padStart(2, "0");
  return `${h}:${mm} ${suffix}`;
}

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
            <Image src={citeLogo} alt="CITE" width={40} height={40} className="h-10 w-10 rounded-md object-cover" />
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
}): React.ReactElement {
  const [selectedAttendanceEntry, setSelectedAttendanceEntry] = useState<AttendanceEntry | null>(null);

  const recent = useMemo(() => {
    const byDate = new Map<string, { in?: number; out?: number; inEntry?: AttendanceEntry; outEntry?: AttendanceEntry; durationMs?: number; status: "Pending" | "Approved" }>();
    const sorted = attendance.slice().sort((a,b) => a.timestamp - b.timestamp);
    for (let i=0;i<sorted.length;i++) {
      const e = sorted[i];
      const dateKey = new Date(e.timestamp).toDateString();
      const rec = byDate.get(dateKey) || { status: "Pending" as const };
      if (e.type === "in") {
        rec.in = e.timestamp;
        rec.inEntry = e;
      } else if (e.type === "out") {
        rec.out = e.timestamp;
        rec.outEntry = e;
      }
      if (rec.in && rec.out && !rec.durationMs) {
        rec.durationMs = rec.out - rec.in;
        rec.status = "Approved";
      }
      byDate.set(dateKey, rec);
    }
    const today = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const rows: { labelDate: string; inLabel: string; outLabel: string; inEntry?: AttendanceEntry; outEntry?: AttendanceEntry; duration: string; status: "Pending" | "Approved" }[] = [];
    for (let i = 0; i < 5; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      const key = startOfDay(day).toDateString();
      const v = byDate.get(key);
      const d = startOfDay(day);
      if (v) {
        const duration = v.durationMs ? `${Math.floor(v.durationMs/(1000*60*60))} hrs` : "-";
        rows.push({
          labelDate: d.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" }),
          inLabel: v.in ? new Date(v.in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-",
          outLabel: v.out ? new Date(v.out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-",
          inEntry: v.inEntry,
          outEntry: v.outEntry,
          duration,
          status: v.status,
        });
      }
    }
    return rows;
  }, [attendance]);

  const [hoursText, remainingText, progressPct] = useMemo(() => {
    const parts = totalHours.split("h");
    const h = Number(parts[0] || 0);
    const pct = Math.max(0, Math.min(100, Math.round((h/targetHours)*100)));
    const remaining = Math.max(0, targetHours - h);
    return [totalHours, `${remaining} hrs left`, pct];
  }, [totalHours, targetHours]);

  const lastReport = reports[0];
  const dueDateText = DUE_DATE_TEXT;

  const isCheckedIn = useMemo(() => {
    const sorted = attendance.slice().sort((a,b) => a.timestamp - b.timestamp);
    const last = sorted[sorted.length - 1];
    return last?.type === "in";
  }, [attendance]);

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">
      {/* Welcome & Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         {/* Total Hours Card */}
         <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
               <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F97316]"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total Hours</div>
            <div className="text-2xl font-bold text-[#F97316] tracking-tight mb-1">{hoursText}</div>
            <div className="text-[11px] font-medium text-gray-500">
               Target: {targetHours} hrs
            </div>
         </div>

         <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
               <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><circle cx="12" cy="12" r="10"></circle><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total Validated Hours</div>
            <div className="text-xl font-bold text-green-600 tracking-tight mb-1">{totalValidatedHours}</div>
            <div className="text-[11px] font-medium text-gray-500">
               Only approved logs are counted here.
            </div>
         </div>

         {/* Deployment Status Card */}
         <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 relative overflow-hidden group md:col-span-2">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
               <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F97316]"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
            </div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Deployment Details</div>
            {companyText === "N/A" ? (
               <div className="flex items-center justify-center h-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <span className="text-sm font-medium text-gray-400 italic">No deployment assigned yet</span>
               </div>
            ) : (
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-orange-50 text-[#F97316]">
                       <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M17 21v-8.5a.5.5 0 0 0-.5-.5h-9a.5.5 0 0 0-.5.5V21"/><path d="M9 9h.01"/><path d="M9 13h.01"/><path d="M9 17h.01"/><path d="M15 9h.01"/><path d="M15 13h.01"/><path d="M15 17h.01"/></svg>
                    </div>
                    <div>
                       <div className="text-xs text-gray-500 font-medium">Company</div>
                       <div className="text-sm font-bold text-gray-900 leading-tight">{companyText}</div>
                    </div>
                 </div>
                 <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                       <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    </div>
                    <div>
                       <div className="text-xs text-gray-500 font-medium">Location</div>
                       <div className="text-sm font-bold text-gray-900 leading-tight truncate">{locationText}</div>
                    </div>
                 </div>
                 <div className="flex items-start gap-3 sm:col-span-2">
                    <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                       <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    </div>
                    <div>
                       <div className="text-xs text-gray-500 font-medium">Supervisor</div>
                       <div className="text-sm font-bold text-gray-900 leading-tight">{supervisorText}</div>
                    </div>
                 </div>
               </div>
            )}
         </div>

         {/* Action Card */}
         <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-lg p-6 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
               <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
            <div>
               <div className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Attendance Action</div>
               <div className="text-lg font-bold leading-tight mb-4">
                  {isCheckedIn ? "Currently Clocked In" : "Ready to Start?"}
               </div>
            </div>
            <button 
                onClick={isCheckedIn ? onTimeOut : onTimeIn} 
                className={`w-full rounded-xl font-bold py-2.5 px-4 text-sm transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2 ${isCheckedIn ? "bg-white text-red-600 hover:bg-gray-100" : "bg-[#F97316] text-white hover:bg-[#EA580C]"}`}
              >
                {isCheckedIn ? (
                   <>
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><rect x="9" y="9" width="6" height="6"></rect></svg>
                     Time Out
                   </>
                ) : (
                   <>
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
                     Time In
                   </>
                )}
              </button>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Column: Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
               <div>
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                     <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F97316]"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                     Recent Activity
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">Last 5 days activity</p>
               </div>
               <button onClick={onViewAttendance} className="text-xs font-semibold text-[#F97316] hover:text-[#EA580C] hover:underline transition-all">
                 View All History
               </button>
             </div>
             
             <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-3 w-1/3">Date</th>
                      <th className="px-6 py-3">In / Out</th>
                      <th className="px-6 py-3">Duration</th>
                      <th className="px-6 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recent.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-400 italic">
                           No recent attendance records found.
                        </td>
                      </tr>
                    ) : recent.map((r, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4 font-medium text-gray-900">
                           {r.labelDate}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                           <div className="flex flex-col gap-0.5">
                              {r.inEntry ? (
                                <button 
                                  onClick={() => setSelectedAttendanceEntry(r.inEntry || null)}
                                  className="text-xs text-green-600 font-medium flex items-center gap-1 hover:underline text-left"
                                >
                                   <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>
                                   {r.inLabel}
                                </button>
                              ) : (
                                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                   <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>
                                   {r.inLabel}
                                </span>
                              )}
                              {r.outEntry ? (
                                <button 
                                  onClick={() => setSelectedAttendanceEntry(r.outEntry || null)}
                                  className="text-xs text-red-500 font-medium flex items-center gap-1 hover:underline text-left"
                                >
                                   <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                                   {r.outLabel}
                                </button>
                              ) : (
                                <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                                   <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                                   {r.outLabel}
                                </span>
                              )}
                           </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-800">
                           {r.duration}
                        </td>
                        <td className="px-6 py-4 text-right">
                           <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${r.status === "Approved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                              {r.status === "Approved" && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                              {r.status}
                           </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
           </div>
        </div>

        {/* Sidebar Column: Reports & Notices */}
        <div className="space-y-6">
           {/* Weekly Report Status */}
           <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                 <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F97316]"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Weekly Report
                 </h3>
                 <p className="text-xs text-gray-500 mt-1">Track your submission status.</p>
              </div>
              <div className="p-6">
                 {!lastReport ? (
                    <div className="text-center py-4">
                       <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-red-100 text-red-600 mb-3">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                       </div>
                       <h4 className="text-sm font-bold text-red-700 mb-1">Not submitted yet</h4>
                       <p className="text-xs text-gray-500 mb-4">You haven't submitted a report for this week yet.</p>
                       <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-left mb-4">
                          <div className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-1">Deadline</div>
                          <div className="text-sm font-bold text-red-800">{dueDateText}</div>
                       </div>
                       <Link href="/portal/student/reports" className="block w-full rounded-xl bg-[#F97316] text-white font-semibold py-2.5 hover:bg-[#EA580C] transition-colors text-sm shadow-md shadow-orange-500/20">
                          Submit Now
                       </Link>
                    </div>
                 ) : (
                    <div className="text-center py-4">
                       <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-green-100 text-green-600 mb-3">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                       </div>
                       <h4 className="text-sm font-bold text-green-700 mb-1">Submitted</h4>
                       <p className="text-xs text-gray-500 mb-4">Your last report was submitted successfully.</p>
                       <div className="p-3 bg-green-50 rounded-xl border border-green-100 text-left">
                          <div className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">Last Submission</div>
                          <div className="text-sm font-bold text-green-800">{new Date(lastReport.submittedAt).toLocaleDateString()}</div>
                       </div>
                    </div>
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
  const [showHistoryMode, setShowHistoryMode] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; timestamp: number } | null>(null);
  const [cameraFeedback, setCameraFeedback] = useState<string>("");

  const monthOptions = useMemo(() => {
    const map = new Map<string, string>();
    attendance.forEach(a => {
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
  }, [attendance]);

  const filteredAttendance = useMemo(() => {
    let result = attendance;

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
      const saved = localStorage.getItem(key) || localStorage.getItem("schedule_default");
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

  const refreshScheduleFromServer = async () => {
    try {
      let rows: any[] | null = null;
      if (supabase) {
        const { data, error } = await supabase
          .from("shifts")
          .select("shift_name, official_start, official_end")
          .order("official_start", { ascending: true });
        if (!error && Array.isArray(data)) {
          rows = data.filter(r => r && (r.official_start || r.official_end));
        }
      }
      if (!rows) {
        const res = await fetch("/api/shifts", { cache: "no-store" });
        const json = await res.json();
        const data = json.shifts;
        if (Array.isArray(data)) {
          rows = data.filter((r: any) => r && (r.official_start || r.official_end));
        }
      }
      if (!rows || rows.length === 0) return null;
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
      if (!amInNorm || !amOutNorm || !pmInNorm || !pmOutNorm) return null;
      const next = {
        amIn: amInNorm,
        amOut: amOutNorm,
        pmIn: pmInNorm,
        pmOut: pmOutNorm,
        otIn: otInNorm || undefined,
        otOut: otOutNorm || undefined,
      };
      setDbSchedule(next);
      return next;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let rows: any[] | null = null;

        if (supabase) {
          const { data, error } = await supabase
            .from("shifts")
            .select("shift_name, official_start, official_end")
            .order("official_start", { ascending: true });
          if (!error && Array.isArray(data)) {
            rows = data.filter(r => r && (r.official_start || r.official_end));
          }
        }

        if (!rows) {
          const res = await fetch("/api/shifts", { cache: "no-store" });
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

        if (!amInNorm || !amOutNorm || !pmInNorm || !pmOutNorm) return;
        if (!cancelled) {
          setDbSchedule({ 
            amIn: amInNorm,
            amOut: amOutNorm, 
            pmIn: pmInNorm, 
            pmOut: pmOutNorm,
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
  }, []);

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
  }, []);

  const isCheckedIn = useMemo(() => {
    const sorted = attendance.slice().sort((a,b) => a.timestamp - b.timestamp);
    const last = sorted[sorted.length - 1];
    return last?.type === "in";
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
          setCameraError("Your official schedule is not configured. Please contact your supervisor.");
          setSubmitting(false);
          return;
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

        if (type === "in") {
          if (!amIn || !amOut || !pmIn || !pmOut) {
            setCameraError("Your official schedule is not configured. Please contact your supervisor.");
            setSubmitting(false);
            return;
          }

          const morningWindowStart = amIn.getTime() - 30 * 60 * 1000;
          const morningWindowEnd = amOut.getTime();
          const afternoonWindowStart = pmIn.getTime() - 30 * 60 * 1000;
          const afternoonWindowEnd = pmOut.getTime();

          if (nowMs >= amOut.getTime() && nowMs < afternoonWindowStart) {
            setBreakPmInText(formatDisplayTime(effectiveSchedule.pmIn));
            setShowBreakModal(true);
            setSubmitting(false);
            return;
          }

          const pmOutMs = pmOut.getTime();
          const otInMs = otIn ? otIn.getTime() : null;
          const otOutMs = otOut ? otOut.getTime() : null;
          const hasOvertime = otInMs !== null && otOutMs !== null;

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
            return;
          }

          if (nowMs >= morningWindowStart && nowMs < morningWindowEnd) {
          } else if (nowMs >= afternoonWindowStart && nowMs < afternoonWindowEnd) {
          } else {
            setLateInPmOutText("You can time in 30 minutes before your official time in.");
            setShowLateInModal(true);
            setSubmitting(false);
            return;
          }
        } else {
          const todayLogs = attendance.filter(l => {
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
          const mapped = rjson.entries.map((e: ServerAttendanceEntry) => ({
            type: e.type,
            timestamp: e.ts,
            photoDataUrl: e.photourl,
          })) as AttendanceEntry[];
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
    let effectiveSchedule = dbSchedule || schedule;
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

  const formatHours = (ms: number) => {
    if (!ms) return "-";
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

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
        const sorted = day.logs.slice().sort((a, b) => a.timestamp - b.timestamp);

        const baseDate = new Date(day.date);
        baseDate.setHours(0, 0, 0, 0);

        const buildShift = (timeStr: string) => {
          const [h, m] = timeStr.split(":").map(Number);
          const d = new Date(baseDate.getTime());
          d.setHours(h || 0, m || 0, 0, 0);
          return d.getTime();
        };

        const classifySegment = (ts: number) => {
          const h = new Date(ts).getHours();
          return h < 12 ? "morning" : "afternoon";
        };

        const src = dbSchedule || schedule;

        const morningLogs = sorted.filter(log => classifySegment(log.timestamp) === "morning");
        const afternoonLogs = sorted.filter(log => classifySegment(log.timestamp) === "afternoon");

        let overtimeLogs: AttendanceEntry[] = [];
        if (src && src.otIn && src.otOut) {
          const otStart = buildShift(src.otIn);
          const otEnd = buildShift(src.otOut);
          overtimeLogs = sorted.filter(
            log => log.timestamp >= otStart && log.timestamp <= otEnd
          );
        }

        const pickInOut = (logs: AttendanceEntry[]) => {
          const inEntry = logs.find(l => l.type === "in") || null;
          const outEntry = [...logs].reverse().find(l => l.type === "out") || null;
          return { inEntry, outEntry };
        };

        const morningPair = pickInOut(morningLogs);
        const afternoonPair = pickInOut(afternoonLogs);
        const overtimePair = pickInOut(overtimeLogs);

        const s1 = morningPair.inEntry;
        const s2 = morningPair.outEntry;
        const s3 = afternoonPair.inEntry;
        const s4 = afternoonPair.outEntry;
        const s5 = overtimePair.inEntry;
        const s6 = overtimePair.outEntry;

        const hasSchedule =
          !!src &&
          typeof src.amIn === "string" &&
          typeof src.amOut === "string" &&
          typeof src.pmIn === "string" &&
          typeof src.pmOut === "string";

        let total = 0;

        if (hasSchedule && src) {
          const amInStr = typeof src.amIn === "string" ? src.amIn : "";
          const amOutStr = typeof src.amOut === "string" ? src.amOut : "";
          const pmInStr = typeof src.pmIn === "string" ? src.pmIn : "";
          const pmOutStr = typeof src.pmOut === "string" ? src.pmOut : "";

          const localSchedule = {
            amIn: buildShift(amInStr),
            amOut: buildShift(amOutStr),
            pmIn: buildShift(pmInStr),
            pmOut: buildShift(pmOutStr),
            otStart: src.otIn ? buildShift(src.otIn) : null,
            otEnd: src.otOut ? buildShift(src.otOut) : null,
          };

          const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

          const findPairDuration = (logs: AttendanceEntry[], windowStart: number, windowEnd: number) => {
            const withinWindow = logs.filter(
              log => log.timestamp >= windowStart && log.timestamp <= windowEnd
            );

            let tIn: AttendanceEntry | null = null;
            let duration = 0;

            withinWindow.forEach(log => {
              if (log.type === "in") {
                tIn = log;
              } else if (log.type === "out" && tIn) {
                const rawIn = clamp(tIn.timestamp, windowStart, windowEnd);
                const rawOut = clamp(log.timestamp, windowStart, windowEnd);
                if (rawOut > rawIn) {
                  duration += rawOut - rawIn;
                }
                tIn = null;
              }
            });

            return duration;
          };

          const dayTotalAm = findPairDuration(sorted, localSchedule.amIn, localSchedule.amOut);
          const dayTotalPm = findPairDuration(sorted, localSchedule.pmIn, localSchedule.pmOut);
          const dayTotalOt =
            localSchedule.otStart && localSchedule.otEnd
              ? findPairDuration(sorted, localSchedule.otStart, localSchedule.otEnd)
              : 0;
          total = dayTotalAm + dayTotalPm + dayTotalOt;
        } else {
          const pairs: [AttendanceEntry | null, AttendanceEntry | null][] = [
            [s1, s2],
            [s3, s4],
            [s5, s6],
          ];
          pairs.forEach(([a, b]) => {
            if (a && b && b.timestamp > a.timestamp) {
              total += b.timestamp - a.timestamp;
            }
          });
        }

        return { date: day.date, s1, s2, s3, s4, s5, s6, total };
      });
  }, [filteredAttendance, dbSchedule, schedule]);

  return (
    <div className="w-full space-y-6">
      {cameraError && (
        <div className="rounded-xl bg-red-50 border border-red-100 p-4 flex items-center gap-3 text-red-700 animate-in fade-in slide-in-from-top-2 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <span className="text-sm font-medium">{cameraError}</span>
        </div>
      )}

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
              <button
                onClick={() => setShowHistoryMode(false)}
                className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Back to Recent View
              </button>
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
                              {[day.s1, day.s2, day.s3, day.s4, day.s5, day.s6].map((slot, idx) => (
                                <td key={idx} className="px-1.5 py-2 border-r border-gray-100 text-center align-top min-w-[100px]">
                                  {slot ? (
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="text-[11px] font-medium text-gray-800">
                                        {formatTime(slot.timestamp)}
                                      </span>
                                      {slot.photoDataUrl && (
                                        <>
                                          <div
                                            className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100 cursor-zoom-in"
                                            onClick={() => setSelectedImage({ url: slot.photoDataUrl, timestamp: slot.timestamp })}
                                          >
                                            <img src={slot.photoDataUrl} alt="Log" className="w-full h-full object-cover" />
                                          </div>
                                          <span className={`text-[10px] font-medium ${getStatusColorClass(slot)}`}>
                                            {formatStatusLabel(slot)}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-300 block py-4">-</span>
                                  )}
                                </td>
                              ))}
                              <td className="px-6 py-4 text-right font-bold text-gray-900">
                                {formatHours(day.total)}
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
                                {[day.s1, day.s2].map((slot, idx) => (
                                  <div key={idx} className="flex flex-col items-center gap-1">
                                    {slot ? (
                                      <>
                                        <span className="text-[11px] font-medium text-gray-800">
                                          {formatTime(slot.timestamp)}
                                        </span>
                                        {slot.photoDataUrl && (
                                          <>
                                            <div
                                              className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100 cursor-zoom-in"
                                              onClick={() => setSelectedImage({ url: slot.photoDataUrl, timestamp: slot.timestamp })}
                                            >
                                              <img src={slot.photoDataUrl} alt="Log" className="w-full h-full object-cover" />
                                            </div>
                                            <span className={`text-[10px] font-medium ${getStatusColorClass(slot)}`}>
                                              {formatStatusLabel(slot)}
                                            </span>
                                          </>
                                        )}
                                      </>
                                    ) : (
                                      <span className="text-gray-300">-</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Afternoon</div>
                              <div className="grid grid-cols-2 gap-3">
                                {[day.s3, day.s4].map((slot, idx) => (
                                  <div key={idx} className="flex flex-col items-center gap-1">
                                    {slot ? (
                                      <>
                                        <span className="text-[11px] font-medium text-gray-800">
                                          {formatTime(slot.timestamp)}
                                        </span>
                                        {slot.photoDataUrl && (
                                          <>
                                            <div
                                              className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100 cursor-zoom-in"
                                              onClick={() => setSelectedImage({ url: slot.photoDataUrl, timestamp: slot.timestamp })}
                                            >
                                              <img src={slot.photoDataUrl} alt="Log" className="w-full h-full object-cover" />
                                            </div>
                                            <span className={`text-[10px] font-medium ${getStatusColorClass(slot)}`}>
                                              {formatStatusLabel(slot)}
                                            </span>
                                          </>
                                        )}
                                      </>
                                    ) : (
                                      <span className="text-gray-300">-</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Overtime</div>
                              <div className="grid grid-cols-2 gap-3">
                                {[day.s5, day.s6].map((slot, idx) => (
                                  <div key={idx} className="flex flex-col items-center gap-1">
                                    {slot ? (
                                      <>
                                        <span className="text-[11px] font-medium text-gray-800">
                                          {formatTime(slot.timestamp)}
                                        </span>
                                        {slot.photoDataUrl && (
                                          <>
                                            <div
                                              className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100 cursor-zoom-in"
                                              onClick={() => setSelectedImage({ url: slot.photoDataUrl, timestamp: slot.timestamp })}
                                            >
                                              <img src={slot.photoDataUrl} alt="Log" className="w-full h-full object-cover" />
                                            </div>
                                            <span className={`text-[10px] font-medium ${getStatusColorClass(slot)}`}>
                                              {formatStatusLabel(slot)}
                                            </span>
                                          </>
                                        )}
                                      </>
                                    ) : (
                                      <span className="text-gray-300">-</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Total Hours</div>
                              <div className="text-sm font-bold text-gray-900 mt-1 text-right">
                                {formatHours(day.total)}
                              </div>
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
                
                {officialScheduleText && (
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
                {attendance.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                    <div className="p-3 rounded-full bg-gray-50 mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </div>
                    <p className="text-sm font-medium">No records yet</p>
                  </div>
                ) : (
                  attendance
                    .slice()
                    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
                    .map((entry, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => setSelectedAttendanceEntry(entry)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 hover:border-orange-200 hover:shadow-md transition-all group text-left"
                      >
                        <div className="h-9 w-9 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200 border border-gray-100 relative">
                          {entry.photoDataUrl && (
                            <img src={entry.photoDataUrl} alt="Log" className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold uppercase text-gray-700">
                              {entry.type === "in" ? "Time In" : "Time Out"}
                            </span>
                            <span className={`text-[10px] font-medium ${getStatusColorClass(entry)}`}>
                              {formatStatusLabel(entry)}
                            </span>
                          </div>
                          <div className="text-xs font-medium text-gray-900 mt-0.5">
                            {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
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
    </div>
  );
}

export function ReportsView({ idnumber, reports, drafts = [], onUpdate, onDraftUpdate }: { idnumber: string; reports: ReportEntry[]; drafts?: ReportEntry[]; onUpdate: (next: ReportEntry[]) => void; onDraftUpdate: (drafts: ReportEntry[]) => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const allowedTypes = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);
  const [showEditor, setShowEditor] = useState(false);
  const [viewing, setViewing] = useState<ReportEntry | null>(null);
  const [showAllReports, setShowAllReports] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [draftId, setDraftId] = useState<number | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [existingFile, setExistingFile] = useState<{name: string, type: string} | null>(null);
  const [viewingComment, setViewingComment] = useState<ReportEntry | null>(null);

  const safeReports = Array.isArray(reports) ? reports : [];
  const safeDrafts = Array.isArray(drafts) ? drafts : [];

  const filteredReports = safeReports.filter(r => {
    const matchesSearch = (r.title || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDate = filterDate ? new Date(r.submittedAt).toLocaleDateString() === new Date(filterDate).toLocaleDateString() : true;
    return matchesSearch && matchesDate;
  });

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

  const saveDraft = async () => {
    setSubmitting(true);
    try {
      const payload: any = {
        idnumber,
        title: (file || existingFile) ? (file?.name || existingFile?.name) : title.trim(),
        body: body.trim(),
        fileName: file?.name || existingFile?.name,
        fileType: file?.type || existingFile?.type,
        isDraft: true
      };
      if (draftId) {
        payload.id = draftId;
      }

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save draft");
      
      const savedReport = json.report;
      
      // Update drafts list
      const existingIndex = drafts.findIndex(d => d.id === savedReport.id);
      let newDrafts = [...drafts];
      if (existingIndex >= 0) {
        newDrafts[existingIndex] = savedReport;
      } else {
        newDrafts = [savedReport, ...newDrafts];
      }
      onDraftUpdate(newDrafts);
      
      setError(null);
      clearForm();
      setShowEditor(false);
    } catch (e) {
      setError("Failed to save draft.");
    } finally {
      setSubmitting(false);
    }
  };

  const loadDraft = (d: ReportEntry) => {
    setTitle(d.title || "");
    setBody(d.body || "");
    setFile(null);
    setExistingFile(d.fileName ? {name: d.fileName, type: d.fileType || ""} : null);
    setDraftId(d.id || null);
    setDraftSavedAt(d.submittedAt);
    setError(null);
  };

  const deleteDraft = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if(!confirm("Delete this draft?")) return;
    try {
        await fetch(`/api/reports?id=${id}`, { method: "DELETE" });
        const newDrafts = drafts.filter(d => d.id !== id);
        onDraftUpdate(newDrafts);
        if (draftId === id) {
            clearForm();
        }
    } catch(e) {
        console.error(e);
    }
  };

  const submitDraftDirectly = async (e: React.MouseEvent, d: ReportEntry) => {
    e.stopPropagation();
    if(!confirm("Submit this draft?")) return;
    
    setSubmitting(true);
    try {
        const payload: any = {
            idnumber,
            title: d.title,
            body: d.body,
            fileName: d.fileName,
            fileType: d.fileType,
            isDraft: false,
            id: d.id
        };
        
        const res = await fetch("/api/reports", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to submit draft");
        
        onUpdate([json.report, ...reports]);
        const newDrafts = drafts.filter(x => x.id !== d.id);
        onDraftUpdate(newDrafts);
        
        if (draftId === d.id) clearForm();
        
    } catch(e) {
        setError("Failed to submit draft directly.");
    } finally {
        setSubmitting(false);
    }
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

  const submit = async () => {
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
        fileData: fileData, // Send base64 data
        isDraft: false
      };
      if (draftId) payload.id = draftId;

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      const json = await res.json();
      console.log("Report submit response:", json);
      if (!res.ok) throw new Error(json.error || "Failed to submit report");
      
      onUpdate([json.report, ...reports]);
      if (draftId) {
        onDraftUpdate(safeDrafts.filter(d => d.id !== draftId));
      }
      clearForm();
      setShowEditor(false);
    } catch (e) {
       const msg = e instanceof Error ? e.message : "Failed to submit report";
       setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 p-4 flex items-center gap-3 text-red-700 animate-in fade-in slide-in-from-top-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compose Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
               <div className="flex items-center gap-2">
                 <div className={`h-2 w-2 rounded-full ${draftId ? 'bg-[#F97316] animate-pulse' : 'bg-[#F97316]'}`}></div>
                 <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {draftId ? "Editing Draft" : "Compose Report"}
                 </div>
               </div>
               <div className="flex items-center gap-3">
                 {draftId && (
                    <button 
                       onClick={clearForm}
                       className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-all"
                       title="Cancel Editing"
                    >
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                 )}
                 {draftSavedAt ? (
                   <div className="text-[10px] font-semibold text-gray-500 bg-white px-2 py-1 rounded border border-gray-100">
                     Draft saved {new Date(draftSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                   </div>
                 ) : (
                   <div className="text-[10px] font-semibold text-gray-400 bg-white px-2 py-1 rounded border border-gray-100">
                     No draft saved
                   </div>
                 )}
                 <div className="text-xs text-gray-400 font-mono bg-white px-2 py-1 rounded border border-gray-100">Week {reports.length + 1}</div>
               </div>
            </div>
            <div className="p-6 space-y-6">
               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-1.5">Report Title</label>
                 <input 
                   value={title} 
                   onChange={e => setTitle(e.target.value)}
                   disabled={!!file}
                   placeholder={!!file ? "Title will be the filename" : "e.g. Week 5 Accomplishment Report"}
                   className={`w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all shadow-sm ${!!file ? "bg-gray-100 cursor-not-allowed opacity-70" : ""}`}
                 />
               </div>
               
               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-1.5">Content</label>
                 <textarea 
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  disabled={!!file}
                  placeholder={!!file ? "Text editing is disabled when a file is attached." : "Describe your activities, learnings, and accomplishments this week..."}
                  className={`w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all min-h-[300px] resize-y shadow-sm ${!!file ? "bg-gray-100 cursor-not-allowed opacity-70" : ""}`}
                />
               </div>

               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-1.5">Attachment (Optional)</label>
                 {!file ? (
                    <div className="relative group">
                      <input 
                        type="file" 
                        onChange={onFileChange}
                        accept=".pdf,.doc,.docx"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="w-full rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 flex flex-col items-center justify-center text-center group-hover:border-[#F97316] group-hover:bg-orange-50/30 transition-all">
                        <div className="p-3 rounded-full bg-white shadow-sm mb-3 text-gray-400 group-hover:text-[#F97316] transition-colors">
                           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        </div>
                        <p className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">Click to upload or drag and drop</p>
                        <p className="text-xs text-gray-500 mt-1">PDF or Word documents up to 10MB</p>
                      </div>
                    </div>
                 ) : (
                    <div className="flex items-center justify-between p-4 rounded-xl border border-blue-100 bg-blue-50/50">
                       <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-white border border-blue-100 shadow-sm text-blue-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
                            <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} KB</p>
                          </div>
                       </div>
                       <button onClick={() => setFile(null)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remove file">
                         <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                       </button>
                    </div>
                 )}
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-center">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={saveDraft}
                  disabled={submitting}
                  className="flex-1 sm:flex-none rounded-xl bg-white text-[#F97316] font-semibold text-sm py-2.5 px-5 border border-[#F97316] hover:bg-orange-50 transition-all active:scale-95 disabled:opacity-70 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3v4a1 1 0 0 1-1 1H7l-4 4V5a2 2 0 0 1 2-2z"/><path d="M12 22a8 8 0 0 0 8-8"/></svg>
                  <span>Save Draft</span>
                </button>
                <button
                  onClick={clearForm}
                  disabled={submitting}
                  className="flex-1 sm:flex-none rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm py-2.5 px-5 border border-gray-200 hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-70 shadow-sm flex items-center justify-center gap-2"
                >
                  {draftId ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                      <span>Cancel Edit</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      <span>Clear</span>
                    </>
                  )}
                </button>
              </div>
              <button 
                onClick={submit}
                disabled={submitting}
                className="w-full sm:w-auto rounded-xl bg-[#F97316] text-white font-semibold text-sm py-2.5 px-6 hover:bg-[#EA580C] transition-all active:scale-95 disabled:opacity-70 disabled:cursor-wait shadow-sm hover:shadow-md flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    <span>Submit Report</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Section */}
        <div className="space-y-6">
           {/* Drafts Card */}
           <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                 <div className="flex items-center gap-2">
                   <div className="h-2 w-2 rounded-full bg-yellow-400"></div>
                   <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">My Drafts</div>
                 </div>
                 <span className="text-xs font-bold text-gray-400">{drafts.length}</span>
              </div>
              <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar bg-gray-50/30">
                 {drafts.length === 0 ? (
                    <div className="py-10 text-center flex flex-col items-center">
                       <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-300 mb-3">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                       </div>
                       <p className="text-sm font-semibold text-gray-600">No drafts saved</p>
                       <p className="text-xs text-gray-400 mt-1 max-w-[150px]">Your unfinished reports will be saved here automatically</p>
                    </div>
                 ) : (
                    <div className="space-y-3">
                       {drafts.map((d, idx) => (
                          <div 
                             key={d.id || idx} 
                             className={`group relative rounded-xl border transition-all duration-200 overflow-hidden ${
                                draftId === d.id 
                                ? 'bg-white border-[#F97316] ring-1 ring-[#F97316] shadow-md' 
                                : 'bg-white border-gray-200 hover:border-orange-200 hover:shadow-md'
                             }`}
                          >
                             {/* Active Indicator */}
                             {draftId === d.id && (
                                <div className="absolute top-0 left-0 w-1 h-full bg-[#F97316]"></div>
                             )}

                             <div className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                   <div className="min-w-0 flex-1 mr-3 cursor-pointer" onClick={() => loadDraft(d)}>
                                      <h4 className={`text-sm font-bold truncate mb-1 transition-colors ${draftId === d.id ? 'text-[#F97316]' : 'text-gray-900 group-hover:text-[#F97316]'}`}>
                                         {d.title || "Untitled Draft"}
                                      </h4>
                                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                                         {d.body || "No content preview available."}
                                      </p>
                                   </div>
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-gray-50 mt-2">
                                   <span className="text-[10px] font-medium text-gray-400 flex items-center gap-1.5">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                      {new Date(d.submittedAt).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                                   </span>
                                   
                                   <div className="flex items-center gap-2">
                                      {/* Delete Button */}
                                      {d.id && (
                                          <button 
                                             onClick={(e) => { e.stopPropagation(); deleteDraft(e, d.id!); }}
                                             className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                             title="Delete Draft"
                                          >
                                             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                          </button>
                                      )}

                                      {/* Edit/Submit Actions */}
                                      {draftId === d.id ? (
                                         <span className="text-[10px] font-bold text-[#F97316] bg-orange-50 px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-orange-100">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#F97316] animate-pulse"></span>
                                            Editing
                                         </span>
                                      ) : (
                                         <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => loadDraft(d)}
                                                className="text-[10px] font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 transition-all"
                                            >
                                                Edit
                                            </button>
                                            {d.id && (
                                                <button 
                                                   onClick={(e) => submitDraftDirectly(e, d)}
                                                   className="text-[10px] font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1"
                                                >
                                                   <span>Submit</span>
                                                   <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                </button>
                                            )}
                                         </div>
                                      )}
                                   </div>
                                </div>
                             </div>
                          </div>
                       ))}
                    </div>
                 )}
              </div>
           </div>

           <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full max-h-[600px]">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                 <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recent Reports</div>
                 <button onClick={() => setShowAllReports(true)} className="text-xs font-bold text-[#F97316] hover:text-[#EA580C] transition-colors hover:underline">View All</button>
              </div>
              <div className="p-3 overflow-y-auto custom-scrollbar flex-1">
                 {safeReports.length === 0 ? (
                    <div className="py-12 text-center flex flex-col items-center">
                       <div className="p-4 rounded-full bg-gray-50 text-gray-300 mb-3">
                          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                       </div>
                       <p className="text-sm font-medium text-gray-500">No reports yet</p>
                       <p className="text-xs text-gray-400 mt-1">Submitted reports will appear here</p>
                    </div>
                 ) : (
                    <div className="space-y-2">
                      {safeReports.slice(0, 5).map((r, idx) => (
                         <div key={idx} onClick={() => setViewing(r)} className="p-3 rounded-xl hover:bg-orange-50 cursor-pointer group transition-all border border-transparent hover:border-orange-100 relative">
                             <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                                   {(r.instructorComment || r.isViewedByInstructor) && (
                                     <div className="flex items-center gap-1">
                                        {r.instructorComment ? (
                                           <button
                                              onClick={(e) => { e.stopPropagation(); setViewingComment(r); }} 
                                              className="flex-shrink-0 text-red-500 animate-pulse hover:bg-red-50 rounded-full p-1 -ml-1 transition-all" 
                                              title="View Instructor Feedback"
                                           >
                                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                                           </button>
                                        ) : (
                                           <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100 whitespace-nowrap">Viewed</span>
                                        )}
                                     </div>
                                   )}
                                   <h4 className="text-sm font-bold text-gray-800 line-clamp-1 group-hover:text-[#F97316] transition-colors">{r.title || "Untitled Report"}</h4>
                                </div>
                                <span className="text-[10px] text-gray-400 whitespace-nowrap font-medium">{new Date(r.submittedAt).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
                             </div>
                             {r.fileName ? (
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 border border-orange-100 mb-2">
                                   <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 flex-shrink-0">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                   </div>
                                   <div className="min-w-0">
                                      <div className="text-xs font-bold text-gray-900 truncate">{r.fileName}</div>
                                      <div className="text-[10px] text-gray-500">Attached Document</div>
                                   </div>
                                </div>
                             ) : (
                                <p className="text-xs text-gray-500 line-clamp-2 mb-2 leading-relaxed">{r.body || "No text content."}</p>
                             )}
                             <div className="flex items-center gap-2">
                                <div className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">Submitted</div>
                             </div>
                             <div className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                             </div>
                          </div>
                       ))}
                    </div>
                 )}
              </div>
           </div>
           

        </div>
      </div>

    {showAllReports && (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-6">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAllReports(false)} aria-hidden="true" />
        <div
          className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl p-6 sm:p-10 max-h-[90vh] overflow-hidden flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="All Reports"
        >
          <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-4 shrink-0">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">All Submitted Reports</h2>
            <button 
              onClick={() => setShowAllReports(false)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <div className="mb-6 flex flex-col sm:flex-row gap-4 shrink-0">
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1 block">Search Title</label>
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title..." 
                className="w-full rounded-lg border border-gray-400 px-4 py-2.5 text-sm font-medium text-gray-900 placeholder:text-gray-500 focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all"
              />
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
            {(searchQuery || filterDate) && (
               <div className="flex items-end">
                 <button 
                   onClick={() => { setSearchQuery(""); setFilterDate(""); }}
                   className="mb-[1px] px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                 >
                   Clear
                 </button>
               </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
            {filteredReports.length > 0 ? (
              <div className="space-y-3">
                {filteredReports.slice().reverse().map((r, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => setViewing(r)}
                    className="group relative p-5 rounded-2xl border border-gray-200 bg-white hover:border-[#F97316]/30 hover:shadow-md hover:shadow-orange-500/5 transition-all cursor-pointer"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          {(r.instructorComment || r.isViewedByInstructor) && (
                            <>
                              {r.instructorComment ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setViewingComment(r); }}
                                  className="flex-shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full bg-red-50 text-red-600 border border-red-100 shadow-sm hover:bg-red-100 transition-colors" 
                                  title="View Instructor Feedback"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                                </button>
                              ) : (
                                <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100 whitespace-nowrap uppercase tracking-wide">Viewed</span>
                              )}
                            </>
                          )}
                          <h3 className="text-base font-bold text-gray-900 group-hover:text-[#F97316] transition-colors truncate">
                            {r.title || "(Untitled)"}
                          </h3>
                          {r.fileName && (
                            <span className="flex-shrink-0 inline-flex items-center justify-center h-5 w-5 rounded bg-gray-100 text-gray-500" title="Has attachment">
                               <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                            </span>
                          )}
                        </div>
                        
                        {r.fileName ? (
                           <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 border border-orange-100 mb-3">
                              <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 flex-shrink-0">
                                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                              </div>
                              <div className="min-w-0">
                                 <div className="text-sm font-bold text-gray-900 truncate">{r.fileName}</div>
                                 <div className="text-xs text-gray-500">Attached Document</div>
                              </div>
                           </div>
                        ) : (
                           <p className="text-sm text-gray-500 line-clamp-2 mb-3 leading-relaxed">
                             {r.body || "No text content provided."}
                           </p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          <span className="px-2 py-1 rounded-md bg-green-50 text-green-700 font-bold border border-green-100 uppercase tracking-wide text-[10px]">
                            Submitted
                          </span>
                          <span className="text-gray-300 hidden sm:inline">•</span>
                          <div className="flex items-center gap-3 text-gray-500 font-medium">
                            <span>{new Date(r.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                            <span>{new Date(r.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>

                      {/* Chevron that appears/moves on hover */}
                      <div className="text-gray-300 group-hover:text-[#F97316] group-hover:translate-x-1 transition-all self-center">
                         <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-50"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <p>No reports found matching your filters.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    {viewing && (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-6">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewing(null)} aria-hidden="true" />
        <div
          className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="View Report"
        >
          {/* Modal Header */}
          <div className="flex items-start justify-between p-6 sm:p-8 border-b border-gray-100 bg-gray-50/50">
            <div className="pr-8">
              <div className="flex items-center gap-3 flex-wrap">
                 <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{viewing.title}</h1>
                 {viewing.instructorComment && (
                    <button 
                       onClick={() => setViewingComment(viewing)}
                       className="px-3 py-1 rounded-full bg-red-50 text-red-600 text-xs font-bold border border-red-100 flex items-center gap-1.5 hover:bg-red-100 transition-colors"
                    >
                       <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                       Feedback Available
                    </button>
                 )}
              </div>
              <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
                <span className="flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  {new Date(viewing.submittedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                <span className="text-gray-300">•</span>
                <span className="flex items-center gap-1.5">
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                   {new Date(viewing.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
            <button 
              onClick={() => setViewing(null)} 
              className="p-2 -mr-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          
          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 custom-scrollbar">
            {/* Attachment Card */}
            {viewing.fileName && (
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between group hover:border-[#F97316]/30 hover:bg-orange-50/30 transition-all">
                <div className="flex items-center gap-4 min-w-0">
                   <div className="h-12 w-12 rounded-lg bg-white border border-gray-200 shadow-sm flex items-center justify-center text-[#F97316]">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                   </div>
                   <div className="min-w-0">
                      <div className="text-sm font-bold text-gray-900 truncate">{viewing.fileName}</div>
                      <div className="text-xs text-gray-500">Attached Document</div>
                   </div>
                </div>
                <a 
                   href={viewing.fileUrl || "#"} 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className={`px-4 py-2 text-sm font-semibold border rounded-lg shadow-sm transition-all flex items-center gap-2 ${
                     viewing.fileUrl 
                       ? "text-[#F97316] bg-white border-gray-200 hover:bg-[#F97316] hover:text-white hover:border-[#F97316]" 
                       : "text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed"
                   }`}
                   onClick={(e) => !viewing.fileUrl && e.preventDefault()}
                >
                   <span>Download</span>
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                </a>
              </div>
            )}

            {/* Report Body */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Report Content</h3>
              <div className="prose prose-gray max-w-none">
                {viewing.body ? (
                  <p className="text-gray-800 text-base leading-relaxed whitespace-pre-wrap">{viewing.body}</p>
                ) : (
                  <div className="py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 italic">
                    No text content provided in this report.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end">
            <button 
              onClick={() => setViewing(null)} 
              className="px-6 py-2.5 bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-sm transition-all active:scale-95"
            >
              Close Viewer
            </button>
          </div>
        </div>
      </div>
    )}

    {viewingComment && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 sm:px-6">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewingComment(null)} aria-hidden="true" />
        <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-200" role="dialog" aria-modal="true">
            <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Instructor Feedback</h2>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Comment</div>
                <p className="text-gray-800 text-base leading-relaxed whitespace-pre-wrap">
                    {viewingComment.instructorComment}
                </p>
                <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
                    <span className="text-xs text-gray-400"> regarding report: </span>
                    <span className="text-xs font-bold text-gray-600 truncate max-w-[200px]">{viewingComment.title}</span>
                </div>
            </div>

            <div className="mt-8 flex justify-end">
                <button 
                    onClick={() => setViewingComment(null)} 
                    className="px-6 py-2.5 bg-gray-900 text-white font-semibold rounded-xl hover:bg-black transition-all shadow-lg shadow-gray-200"
                >
                    Close Feedback
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

  const fullname = student ? `${student.firstname || ""} ${student.middlename ? student.middlename + " " : ""}${student.lastname || ""}`.trim() : "";
  
  // Use supervisor's company/location
  const company = supervisor?.company || "N/A";
  const location = supervisor?.location || "N/A";

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
              <div className="h-32 w-32 rounded-2xl border-4 border-white bg-white shadow-md flex items-center justify-center text-4xl font-bold text-gray-800 shrink-0">
                {(fullname?.[0] || student?.firstname?.[0] || student?.lastname?.[0] || "?").toUpperCase()}
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
    </div>
  );
}
