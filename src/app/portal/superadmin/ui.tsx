"use client";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  LayoutDashboard, 
  Users, 
  UserCog, 
  User as UserIcon, 
  LogOut, 
  Menu, 
  FileText,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Search,
  X,
  GraduationCap,
  BookOpen,
  Briefcase,
  Network,
  ShieldCheck
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { calculateSessionDuration, determineShift, ShiftSchedule as LibShiftSchedule, buildSchedule, normalizeTimeString, timeStringToMinutes, formatHours, calculateShiftDurations, calculateHoursWithinOfficialTime, isLate } from "@/lib/attendance";
import { supabase } from "@/lib/supabaseClient";

// --- Types ---

export type User = {
  [x: string]: any;
  id: number;
  idnumber: string;
  role: "student" | "instructor" | "supervisor" | "coordinator" | "superadmin";
  name?: string;
  course?: string;
  section?: string;
  courseIds?: number[];
  sectionIds?: number[];
  company?: string;
  location?: string;
  supervisorid?: string;
  firstname?: string;
  middlename?: string;
  lastname?: string;
};

export type Course = { id: number; name: string; name_key: string };
export type Section = { id: number; name: string; code: string; course_id: number };

export const roles = ["student", "instructor", "supervisor", "coordinator", "superadmin"] as const;
export const roleTabs = ["student", "instructor", "supervisor", "coordinator"] as const;

type ShiftSchedule = {
  amIn: string;
  amOut: string;
  pmIn: string;
  pmOut: string;
  otIn?: string;
  otOut?: string;
};



type AdminAttendanceLog = {
  id: number;
  idnumber: string;
  type: "in" | "out";
  ts: number;
  photourl?: string | null;
  status?: string | null;
  validated_by?: string | null;
  rendered_hours?: number | null;
  validated_hours?: number | null;
  is_late?: boolean;
  late_minutes?: number;
  official_time_in?: string | null;
  official_time_out?: string | null;
};

function getLogStatus(entry?: { status?: string | null } | null): "Pending" | "Approved" | "Rejected" | "Adjusted" {
  if (!entry || !entry.status || entry.status === "RAW") return "Pending";
  if (entry.status === "Approved" || entry.status === "VALIDATED" || entry.status === "OFFICIAL") return "Approved";
  if (entry.status === "ADJUSTED") return "Adjusted";
  if (entry.status === "Rejected" || entry.status === "REJECTED") return "Rejected";
  return "Pending";
}

function formatLogStatusLabel(entry: { status?: string | null; validated_by?: string | null }): string {
  if (entry.validated_by === "SYSTEM_AUTO_CLOSE" || entry.validated_by === "AUTO TIME OUT") return "No Time-Out";
  const status = getLogStatus(entry);
  if (status === "Approved") return "Validated";
  if (status === "Rejected") return "Unvalidated";
  if (status === "Adjusted") return "Adjusted";
  return "Pending";
}

function getLogStatusColorClass(entry?: { status?: string | null; validated_by?: string | null } | null): string {
  if (entry?.validated_by === "SYSTEM_AUTO_CLOSE" || entry?.validated_by === "AUTO TIME OUT") return "text-red-600";
  const status = getLogStatus(entry);
  if (status === "Approved") return "text-green-600";
  if (status === "Rejected") return "text-red-600";
  if (status === "Adjusted") return "text-blue-600";
  return "text-yellow-600";
}

// --- Components ---

export function SuperAdminHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [dateText, setDateText] = useState<string>("");

  useEffect(() => {
    try {
      const d = new Date();
      setDateText(d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }));
    } catch {}
  }, []);

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      localStorage.clear();
      router.replace("/");
    } catch (e) {
      console.error("Logout failed", e);
      router.replace("/");
    }
  };

  return (
    <header className="flex-shrink-0 w-full bg-gradient-to-b from-[#F97316] to-[#EA580C] text-white shadow-lg z-10">
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 md:px-8 pt-3 pb-3 md:pt-4 md:pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/icons-512.png" alt="CITE" width={40} height={40} className="h-10 w-10 rounded-md object-cover" />
            <div>
              <div className="text-white font-extrabold text-base md:text-[1.25rem] tracking-wide leading-tight">
                OJTonTrack
              </div>
              <div className="text-white/80 text-xs font-medium">Super Admin Portal</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             {dateText && (
                <div className="hidden sm:block text-xs sm:text-sm text-white/80 font-medium">
                  {dateText}
                </div>
              )}
            <button
              onClick={logout}
              className="inline-flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white font-semibold px-3 py-1 md:px-4 md:py-1.5 text-sm transition-colors"
            >
              Log Out
            </button>
            <button
              onClick={async () => {
                if (!confirm("This will freeze all historical attendance hours based on the schedule at the time of log. This is a one-time operation to prevent past records from changing when schedules are updated. Continue?")) return;
                try {
                  const res = await fetch("/api/admin/backfill-hours");
                  const json = await res.json();
                  alert(json.message || "Process started. Check console for details.");
                } catch (e) {
                  alert("Error: " + (e instanceof Error ? e.message : "Unknown error"));
                }
              }}
              className="hidden sm:inline-flex items-center justify-center rounded-full bg-red-500/20 hover:bg-red-500/30 text-white font-semibold px-3 py-1 md:px-4 md:py-1.5 text-sm transition-colors border border-white/20"
              title="Run this once to freeze historical attendance hours"
            >
              Fix History
            </button>
          </div>
        </div>
        <div className="mt-4 md:mt-8 hidden md:flex justify-center gap-6 overflow-x-auto pb-2">
          {[
            { key: "users", label: "Manage Users", href: "/portal/superadmin" },
          ].map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`relative pb-2 text-sm font-semibold tracking-wide uppercase transition-colors whitespace-nowrap ${
                  isActive ? "text-white" : "text-white/60 hover:text-white/90"
                }`}
              >
                {item.label}
                {isActive && <span className="absolute bottom-0 left-0 h-1 w-full rounded-full bg-white" />}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}

export function EditTimeEntryModal({ entry, studentName, onClose, onSave }: { entry: any, studentName?: string, onClose: () => void, onSave: () => void }) {
  const toLocalInputValue = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
  };
  const [ts, setTs] = useState<string>(entry.ts ? toLocalInputValue(new Date(entry.ts)) : "");
  const [type, setType] = useState<string>(entry.type);
  const [status, setStatus] = useState<string>(() => {
      if (entry.status) return entry.status;
      // Auto-select 'Official' for system auto-timeouts to ensure they show up as "Official Time-Out" for students
      if (entry.validated_by === 'SYSTEM_AUTO_CLOSE' || entry.validated_by === 'AUTO TIME OUT') {
          return 'Official';
      }
      return "Pending";
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
        let adminId = "";
        let adminRole = "superadmin";

        // 1. Try LocalStorage (fastest, populated by AuthGuard)
        if (typeof window !== 'undefined') {
            adminId = localStorage.getItem("idnumber") || "";
            const storedRole = localStorage.getItem("role");
            if (storedRole) adminRole = storedRole;
        }

        // 2. If missing, try API
        if (!adminId) {
            const sessionRes = await fetch("/api/auth/check-session");
            if (sessionRes.ok) {
                const session = await sessionRes.json();
                if (session.idnumber) {
                    adminId = session.idnumber;
                    adminRole = session.role || adminRole;
                }
            }
        }

        if (!adminId) throw new Error("Could not get admin ID. Please try logging out and back in.");

        const res = await fetch("/api/attendance", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: entry.id,
                ts: new Date(ts).getTime(),
                type,
                status,
                adminId,
                adminRole
            })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to update");
        onSave();
        onClose();
    } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed");
    } finally {
        setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose}>
        <div className="p-6">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Edit Time Entry</h2>
                    {studentName && <p className="text-sm text-gray-500 font-medium mt-1">Student: <span className="text-gray-900">{studentName}</span></p>}
                </div>
                {entry.status && (
                     <span className={`px-2.5 py-1 text-xs font-bold uppercase rounded-full ${
                        entry.status === 'Approved' ? 'bg-green-100 text-green-700 border border-green-200' :
                        entry.status === 'Rejected' ? 'bg-red-100 text-red-700 border border-red-200' :
                        'bg-yellow-100 text-yellow-700 border border-yellow-200'
                     }`}>
                        {entry.status}
                     </span>
                )}
            </div>

            {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg mb-4 text-sm border border-red-100">{error}</div>}
            
            <div className="space-y-5">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Time</label>
                    <input 
                        type="datetime-local" 
                        value={ts} 
                        onChange={e => setTs(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 p-3 text-gray-900 focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316] outline-none transition-all shadow-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Type</label>
                    <select 
                        value={type} 
                        onChange={e => setType(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 p-3 text-gray-900 focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316] outline-none transition-all shadow-sm bg-white"
                    >
                        <option value="in">Time In</option>
                        <option value="out">Time Out</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Status</label>
                    <select 
                        value={status} 
                        onChange={e => setStatus(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 p-3 text-gray-900 focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316] outline-none transition-all shadow-sm bg-white"
                    >
                        <option value="Pending">Pending</option>
                        <option value="Approved">Validated</option>
                        <option value="Rejected">Unvalidated</option>
                        <option value="Official">Official (System Adjustment)</option>
                    </select>
                </div>
                <div className="flex justify-end gap-3 mt-8">
                    <button 
                        onClick={onClose} 
                        className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={loading}
                        className="px-5 py-2.5 bg-[#F97316] text-white font-bold rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-all shadow-sm active:scale-95"
                    >
                        {loading ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>
        </div>
    </Modal>
  );
}

export function TimeEntryView() {
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [logs, setLogs] = useState<AdminAttendanceLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [schedule, setSchedule] = useState<ShiftSchedule | null>(null);
  const [courseFilter, setCourseFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [availableSections, setAvailableSections] = useState<Section[]>([]);
  const [studentSchedules, setStudentSchedules] = useState<Record<string, any>>({});

  const courseOptions = useMemo(() => {
    const names = availableCourses.map(c => c.name).filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [availableCourses]);

  const sectionOptions = useMemo(() => {
    const names = availableSections.map(s => s.name).filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [availableSections]);

  // Fetch student schedules
  useEffect(() => {
    fetch("/api/student-schedules")
      .then(res => res.json())
      .then(data => {
        if (data.schedules) {
          setStudentSchedules(data.schedules);
        }
      })
      .catch(console.error);
  }, []);

  // Fetch metadata for filters
  useEffect(() => {
    fetch("/api/metadata")
      .then(res => res.json())
      .then(data => {
        if (data.courses) setAvailableCourses(data.courses);
        if (data.sections) setAvailableSections(data.sections);
      })
      .catch(console.error);
  }, []);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("role", "student");
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (courseFilter) params.set("course", courseFilter);
      if (sectionFilter) params.set("section", sectionFilter);

      const res = await fetch(`/api/users?${params.toString()}`);
      const data = await res.json();
      if (data.users) {
        setStudents(data.users);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, courseFilter, sectionFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchStudents]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, courseFilter, sectionFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/shifts", { cache: "no-store" });
        const json = await res.json();
        let rows: any[] | null = null;
        const data = json.shifts;
        if (Array.isArray(data)) {
          rows = data.filter((r: any) => r && (r.official_start || r.official_end));
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
          sorted.find((r) => {
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

        const amInNorm = normalizeTimeString(amCandidate?.official_start) || "09:00";
        const amOutNorm = normalizeTimeString(amCandidate?.official_end) || "12:00";
        const pmInNorm = normalizeTimeString(pmCandidate?.official_start) || "13:00";
        const pmOutNorm = normalizeTimeString(pmCandidate?.official_end) || "17:00";
        const otInNorm = undefined; // normalizeTimeString(finalOtRow?.official_start);
        const otOutNorm = undefined; // normalizeTimeString(finalOtRow?.official_end);

        // Explicitly ignore global overtime shift from DB to prevent overcounting.
        // Overtime must be authorized per student/day (dynamicOt).

        if (!cancelled) {
          setSchedule({
            amIn: amInNorm,
            amOut: amOutNorm,
            pmIn: pmInNorm,
            pmOut: pmOutNorm,
            otIn: otInNorm || undefined,
            otOut: otOutNorm || undefined,
          });
        }
      } catch {
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchStudentLogs = useCallback(async (student: User) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/attendance?idnumber=${encodeURIComponent(student.idnumber.trim())}&limit=200`, {
        cache: "no-store",
        headers: { "Pragma": "no-cache" }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch attendance");
      const entries = Array.isArray(json.entries) ? json.entries : [];
      setLogs(
        entries.map((e: any) => ({
          id: e.id,
          idnumber: e.idnumber,
          type: e.type,
          ts: Number(e.ts),
          photourl: e.photourl,
          status: e.status,
          validated_by: e.validated_by,
          official_time_in: e.official_time_in,
          official_time_out: e.official_time_out,
        }))
      );
    } catch (e) {
      console.error("Fetch logs error:", e);
      setError(e instanceof Error ? e.message : "Failed to fetch attendance");
    } finally {
      setLoading(false);
    }
  }, []);

  // Real-time subscription for attendance changes
  useEffect(() => {
    if (!selectedStudent || !supabase) return;

    const channel = supabase
      .channel(`superadmin-attendance-${selectedStudent.idnumber}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        () => {
             fetchStudentLogs(selectedStudent);
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [selectedStudent, fetchStudentLogs]);

  const onSelectStudent = (student: User) => {
    setSelectedStudent(student);
    fetchStudentLogs(student);
  };

  const onBackToList = () => {
    setSelectedStudent(null);
    setLogs([]);
    setError(null);
  };



  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  };

  const processedDays = useMemo(() => {
    if (!selectedStudent) return [];
    const grouped = new Map<string, { date: Date; logs: AdminAttendanceLog[] }>();
    logs.forEach((log) => {
      const d = new Date(Number(log.ts));
      const key = d.toLocaleDateString();
      if (!grouped.has(key)) grouped.set(key, { date: d, logs: [] });
      grouped.get(key)!.logs.push(log);
    });

    let totalMsAll = 0;
    let totalValidatedMsAll = 0;

    const results = Array.from(grouped.values())
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map((day) => {
        // Deduplicate logs
        const uniqueMap = new Map<string, AdminAttendanceLog>();
        day.logs.forEach(l => {
            const key = l.id ? String(l.id) : `${l.ts}-${l.type}`;
            if (!uniqueMap.has(key)) uniqueMap.set(key, l);
        });
        
        const sorted = Array.from(uniqueMap.values()).sort((a, b) => a.ts - b.ts);
        
        // Filter out OT Auth logs if present
        const processingLogs = sorted.filter(l => !l.photourl?.startsWith("OT_AUTH:") && l.status !== "Rejected");

        const baseDate = new Date(day.date);
        baseDate.setHours(0, 0, 0, 0);

        // Determine schedule source: specific student schedule > global schedule
        let src = schedule;
        const studentId = selectedStudent?.idnumber.trim();
        
        // DEBUG: Capture schedule info for UI display
        let debugInfo: any = {
            studentId,
            hasSpecificSchedule: false,
            globalSchedule: schedule,
            specificSchedule: null as any,
            appliedSrc: null as any,
            availableKeysCount: Object.keys(studentSchedules).length,
            availableKeysSample: Object.keys(studentSchedules).slice(0, 5)
        };

        // Case-insensitive lookup
        const scheduleKey = Object.keys(studentSchedules).find(k => k.toLowerCase() === studentId?.toLowerCase());

        if (selectedStudent && studentId && scheduleKey) {
            const s = studentSchedules[scheduleKey];
            debugInfo.hasSpecificSchedule = true;
            debugInfo.specificSchedule = s;
            
            // Override if specific AM or PM schedule exists
            if (s.am_in || s.pm_in) {
                 src = {
                    amIn: s.am_in || (schedule?.amIn || "08:00"),
                    amOut: s.am_out || (schedule?.amOut || "12:00"),
                    pmIn: s.pm_in || (schedule?.pmIn || "13:00"),
                    pmOut: s.pm_out || (schedule?.pmOut || "17:00"),
                    otIn: s.ot_in || schedule?.otIn,
                    otOut: s.ot_out || schedule?.otOut
                 };
            }
        }
        
        debugInfo.appliedSrc = src;
        
        // Use centralized buildSchedule
        let dailySchedule: LibShiftSchedule;

        if (src && (src.amIn || src.pmIn)) {
            dailySchedule = buildSchedule(
                day.date,
                {
                    amIn: src.amIn || "08:00",
                    amOut: src.amOut || "12:00",
                    pmIn: src.pmIn || "13:00",
                    pmOut: src.pmOut || "17:00",
                    otIn: src.otIn || "17:00",
                    otOut: src.otOut || "18:00"
                }
            );
        } else {
             // Fallback
             dailySchedule = buildSchedule(
                day.date,
                {
                    amIn: "08:00",
                    amOut: "12:00",
                    pmIn: "13:00",
                    pmOut: "17:00",
                    otIn: "",
                    otOut: ""
                }
            );
        }

        // DEBUG: Capture computed schedule details
        if (dailySchedule) {
            debugInfo['amWindow'] = `${new Date(dailySchedule.amIn).toLocaleTimeString()} - ${new Date(dailySchedule.amOut).toLocaleTimeString()}`;
            debugInfo['pmWindow'] = `${new Date(dailySchedule.pmIn).toLocaleTimeString()} - ${new Date(dailySchedule.pmOut).toLocaleTimeString()}`;
            debugInfo['computedSchedule'] = {
                amIn: new Date(dailySchedule.amIn).toLocaleTimeString(),
                amOut: new Date(dailySchedule.amOut).toLocaleTimeString(),
                pmIn: new Date(dailySchedule.pmIn).toLocaleTimeString(),
                pmOut: new Date(dailySchedule.pmOut).toLocaleTimeString()
            };
        } else {
             debugInfo['amWindow'] = 'N/A (Schedule Null)';
             debugInfo['pmWindow'] = 'N/A';
        }

        // --- SMART PAIRING LOGIC (COPIED FROM STUDENT PORTAL) ---
        const usedIds = new Set<string>();
        const isAvailable = (l: AdminAttendanceLog) => {
             const key = l.id ? String(l.id) : `${l.ts}-${l.type}`;
             return !usedIds.has(key);
        };
        const markUsed = (l: AdminAttendanceLog) => {
             const key = l.id ? String(l.id) : `${l.ts}-${l.type}`;
             usedIds.add(key);
        };

        const sortedLogs = [...processingLogs].sort((a, b) => a.ts - b.ts);

        let s1: AdminAttendanceLog | null = null;
        let s3: AdminAttendanceLog | null = null;
        let s5: AdminAttendanceLog | null = null;

        const isInWindow = (ts: number, start: number | undefined, end: number | undefined) => {
             if (!start || !end) return false;
             // 30 min buffer before start, up to end
             return ts >= (start - 30 * 60000) && ts <= end;
        };

        // 1. Assign INs to Slots (Greedy by Window)
        sortedLogs.filter(l => (l.type || "").toLowerCase() === 'in' && isAvailable(l)).forEach(l => {
             if (!s1 && isInWindow(l.ts, dailySchedule.amIn, dailySchedule.amOut)) {
                 s1 = l; markUsed(l); return;
             }
             if (!s3 && isInWindow(l.ts, dailySchedule.pmIn, dailySchedule.pmOut)) {
                 s3 = l; markUsed(l); return;
             }
             if (!s5 && isInWindow(l.ts, dailySchedule.otStart, dailySchedule.otEnd)) {
                 s5 = l; markUsed(l); return;
             }
        });

        const today = new Date();
        today.setHours(0,0,0,0);
        const isPastDate = baseDate < today;

        const createVirtualOut = (inEntry: AdminAttendanceLog, shift: 'am' | 'pm' | 'ot'): AdminAttendanceLog => {
             const outTs = shift === 'am' ? dailySchedule.amOut : (shift === 'pm' ? dailySchedule.pmOut : dailySchedule.otEnd);
             const finalOutTs = outTs > inEntry.ts ? outTs : inEntry.ts + 60000;
             
             return {
                  id: inEntry.id ? -Math.abs(Number(inEntry.id)) : -Math.floor(Math.random() * 1000000),
                  idnumber: inEntry.idnumber,
                  type: 'out',
                  ts: finalOutTs,
                  photourl: '',
                  validated_by: 'AUTO TIME OUT',
                  status: 'Pending'
             } as AdminAttendanceLog;
        };

        // 2. Find OUTs for each IN
        let s2: AdminAttendanceLog | null = null;
        if (s1) {
            const searchEnd = s3 ? (s3 as AdminAttendanceLog).ts : (new Date(baseDate).setHours(23, 59, 59, 999));
            const candidates = sortedLogs.filter(l => (l.type || "").toLowerCase() === "out" && l.ts > (s1 as AdminAttendanceLog).ts && l.ts < searchEnd && isAvailable(l));
            const candidate = candidates.pop() || null; // Take the latest valid out
            if (candidate) {
                s2 = candidate;
                markUsed(s2);
            } else if (isPastDate) {
                s2 = createVirtualOut(s1 as AdminAttendanceLog, 'am');
            }
        }

        let s4: AdminAttendanceLog | null = null;
        if (s3) {
            const searchEnd = s5 ? (s5 as AdminAttendanceLog).ts : (new Date(baseDate).setHours(23, 59, 59, 999));
            const candidates = sortedLogs.filter(l => (l.type || "").toLowerCase() === "out" && l.ts > (s3 as AdminAttendanceLog).ts && l.ts < searchEnd && isAvailable(l));
            s4 = candidates.pop() || null;
            if (s4) {
                markUsed(s4);
            } else if (isPastDate) {
                s4 = createVirtualOut(s3 as AdminAttendanceLog, 'pm');
            }
        }

        let s6: AdminAttendanceLog | null = null;
        if (s5) {
            const candidates = sortedLogs.filter(l => (l.type || "").toLowerCase() === "out" && l.ts > (s5 as AdminAttendanceLog).ts && isAvailable(l));
            s6 = candidates.pop() || null;
            if (s6) {
                markUsed(s6);
            } else if (isPastDate) {
                s6 = createVirtualOut(s5 as AdminAttendanceLog, 'ot');
            }
        }

        // 3. Calculate Hours (Golden Rule)
        const calc = (inLog: AdminAttendanceLog | null, outLog: AdminAttendanceLog | null, shift: 'am' | 'pm' | 'ot', requireApproved: boolean) => {
            if (!inLog || !outLog) return 0;
            if (requireApproved) {
                const inStatus = getLogStatus(inLog);
                const outStatus = getLogStatus(outLog);
                // In Admin view, we calculate validated hours based on approval
                const inOk = inStatus === "Approved";
                const outOk = outStatus === "Approved";
                if (!inOk || !outOk) return 0;
            }

            // Priority: Validated Hours (Ledger - Source of Truth)
            if (outLog.validated_hours !== undefined && outLog.validated_hours !== null && Number(outLog.validated_hours) >= 0) {
                if (shift === 'pm' && outLog.id === s2?.id) return 0;
                if (shift === 'ot' && (outLog.id === s2?.id || outLog.id === s4?.id)) return 0;
                return Number(outLog.validated_hours) * 3600000;
            }

            // Do not use rendered_hours for totals; rely on validated_hours or snapshot/clamp

            // Priority: Use Snapshot Rules if available (Ledger Logic)
            // This ensures historical calculations remain consistent even if global schedule changes.
            if (outLog.official_time_in && outLog.official_time_out) {
                 try {
                     const dateBase = new Date(inLog.ts);
                     
                     const parseTime = (t: string) => {
                         const [h, m, s] = t.split(':').map(Number);
                         const d = new Date(dateBase);
                         d.setHours(h, m, s || 0, 0);
                         return d;
                     };

                     const offIn = parseTime(outLog.official_time_in);
                     const offOut = parseTime(outLog.official_time_out);

                     // Handle cross-day shifts (e.g. night shift)
                     if (offOut.getTime() < offIn.getTime()) {
                         offOut.setDate(offOut.getDate() + 1);
                     }

                     return calculateHoursWithinOfficialTime(
                         new Date(inLog.ts), 
                         new Date(outLog.ts), 
                         offIn, 
                         offOut
                     );
                 } catch (e) {
                     console.error("Error calculating from snapshot", e);
                 }
            }

            // Fallback: Live Schedule
            let oInTs: number = 0;
            let oOutTs: number = 0;

            if (shift === 'am') {
                oInTs = dailySchedule.amIn;
                oOutTs = dailySchedule.amOut;
            } else if (shift === 'pm') {
                oInTs = dailySchedule.pmIn;
                oOutTs = dailySchedule.pmOut;
            } else { // ot
                oInTs = dailySchedule.otStart;
                oOutTs = dailySchedule.otEnd;
            }

            // Safety check
            if (!oInTs || !oOutTs) return 0;

            return calculateHoursWithinOfficialTime(
                new Date(inLog.ts), 
                new Date(outLog.ts), 
                new Date(oInTs), 
                new Date(oOutTs)
            );
        };

        let total = 0;
        let validatedTotal = 0;
        
        total += calc(s1, s2, 'am', false);
        total += calc(s3, s4, 'pm', false);
        total += calc(s5, s6, 'ot', false);

        validatedTotal += calc(s1, s2, 'am', true);
        validatedTotal += calc(s3, s4, 'pm', true);
        validatedTotal += calc(s5, s6, 'ot', true);
        
        const pendingTotal = total - validatedTotal;

        totalMsAll += total;
        totalValidatedMsAll += validatedTotal;

        const toDate = (t: string, baseTs: number) => {
            const d = new Date(baseTs);
            const parts = t.split(":").map(Number);
            d.setHours(parts[0] || 0, parts[1] || 0, parts[2] || 0, 0);
            return d.getTime();
        };
        if (s1) {
            const baseTs = (s1 as AdminAttendanceLog).ts;
            let officialInTs = dailySchedule.amIn;
            if (s2 && (s2 as any).official_time_in) {
                officialInTs = toDate((s2 as any).official_time_in, baseTs);
            }
            if (officialInTs && isLate(baseTs, officialInTs)) {
                (s1 as AdminAttendanceLog).is_late = true;
                (s1 as AdminAttendanceLog).late_minutes = Math.floor((baseTs - officialInTs)/60000);
            }
        }
        if (s3) {
            const baseTs = (s3 as AdminAttendanceLog).ts;
            let officialInTs = dailySchedule.pmIn;
            if (s4 && (s4 as any).official_time_in) {
                officialInTs = toDate((s4 as any).official_time_in, baseTs);
            }
            if (officialInTs && isLate(baseTs, officialInTs)) {
                (s3 as AdminAttendanceLog).is_late = true;
                (s3 as AdminAttendanceLog).late_minutes = Math.floor((baseTs - officialInTs)/60000);
            }
        }

        return { 
            date: day.date, 
            s1, s2, 
            s3, s4, 
            s5, s6, 
            total, 
            validatedTotal,
            pendingTotal,
            debugInfo
        };
      });
      
      return results;
  }, [logs, schedule, selectedStudent, studentSchedules]);

  const totalHoursMs = useMemo(
    () => processedDays.reduce((sum, day) => sum + day.total, 0),
    [processedDays]
  );

  const totalValidatedHoursMs = useMemo(
    () => processedDays.reduce((sum, day) => sum + (day.validatedTotal || 0), 0),
    [processedDays]
  );

  const totalPendingHoursMs = useMemo(
    () => processedDays.reduce((sum, day) => sum + (day.pendingTotal || 0), 0),
    [processedDays]
  );
  
  const statusCounts = useMemo(() => {
    const counts = { Pending: 0, Approved: 0, Rejected: 0, Adjusted: 0 };
    logs.forEach(log => {
        const status = getLogStatus(log);
        counts[status]++;
    });
    return counts;
  }, [logs]);

  // Debug Info Display
  const debugData = processedDays.length > 0 ? (processedDays[0] as any).debugInfo : null;

  if (!selectedStudent) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1F2937]">Time Entry Management</h1>
             <p className="text-sm text-gray-500">
               Select a student to view and edit detailed attendance logs.
             </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by name, ID number, course or section..."
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 pl-9 text-sm text-gray-900 placeholder:text-gray-500 focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none"
              >
                <option value="" hidden>All courses</option>
                {courseOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none"
              >
                <option value="" hidden>All sections</option>
                {sectionOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Course / Section
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                     <tr><td colSpan={3} className="px-6 py-12 text-center text-gray-500">Loading students...</td></tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                        No students found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    students.map((s) => (
                      <tr
                        key={s.id}
                        className="hover:bg-orange-50/50 transition-colors cursor-pointer group"
                        onClick={() => onSelectStudent(s)}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-[#F97316] font-bold text-xs mr-3">
                              {(s.name || s.firstname || s.idnumber).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 group-hover:text-[#F97316] transition-colors">
                                {s.name || [s.firstname, s.lastname].filter(Boolean).join(" ") || "Unknown"}
                              </div>
                              <div className="text-xs text-gray-500">{s.idnumber}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-gray-700">
                             {[s.course, s.section].filter(Boolean).join(" - ") || <span className="text-gray-400 italic">--</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectStudent(s);
                            }}
                            className="text-[#F97316] hover:text-[#EA580C] font-semibold text-xs"
                          >
                            View Logs
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between sm:px-6">
               <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
               </div>
               <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                     <p className="text-sm text-gray-700">
                        Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to <span className="font-medium">{Math.min(page * limit, total)}</span> of <span className="font-medium">{total}</span> results
                     </p>
                  </div>
                  <div>
                     <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <span className="sr-only">Previous</span>
                          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                           Page {page} of {totalPages}
                        </span>
                        <button
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page >= totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <span className="sr-only">Next</span>
                          <ChevronRight className="h-5 w-5" aria-hidden="true" />
                        </button>
                     </nav>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const studentName =
    selectedStudent.name ||
    [selectedStudent.firstname, selectedStudent.lastname].filter(Boolean).join(" ");

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToList}
            className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft size={14} className="mr-1" />
            Back
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#1F2937]">
              {studentName || selectedStudent.idnumber}
            </h1>
            <p className="text-xs text-gray-500">
              ID {selectedStudent.idnumber}
              {selectedStudent.course && selectedStudent.section
                ? ` • ${selectedStudent.course} ${selectedStudent.section}`
                : ""}
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchStudentLogs(selectedStudent)}
          disabled={loading}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 2v6h-6"></path>
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
            <path d="M3 22v-6h6"></path>
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
          </svg>
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 text-red-600 border border-red-100 flex items-center gap-2 text-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-3 py-1 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900">
              Attendance History
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Editable attendance records for {studentName || selectedStudent.idnumber}.
            </p>
          </div>
          <div className="text-xs sm:text-sm font-semibold text-gray-700">
            Total Hours:{" "}
            <span className="text-[#F97316]">
              {formatHours(totalHoursMs)}
            </span>
          </div>
        </div>

        <div className="p-2">
          {loading && processedDays.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
              Loading attendance logs...
            </div>
          ) : processedDays.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mb-3 opacity-60"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <p className="text-sm">No attendance records found.</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 flex items-center justify-between shadow-sm">
                    <div>
                        <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Total Tracked</p>
                        <p className="text-xl font-bold text-blue-900">{formatHours(totalHoursMs)}</p>
                        <p className="text-[10px] text-gray-600 mt-1">Pending + Validated</p>
                    </div>
                    <div className="p-1.5 bg-blue-100 rounded-xl">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                </div>

                <div className="bg-green-50 p-3 rounded-2xl border border-green-100 flex items-center justify-between shadow-sm">
                    <div>
                        <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Total Validated</p>
                        <p className="text-xl font-bold text-green-900">{formatHours(totalValidatedHoursMs)}</p>
                        <p className="text-[10px] text-gray-600 mt-1">Approved Hours</p>
                    </div>
                    <div className="p-1.5 bg-green-100 rounded-xl">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 15 2 2 4-4"/></svg>
                    </div>
                </div>
              </div>

              <div className="hidden md:block overflow-x-auto custom-scrollbar">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
                    <tr>
                      <th
                        rowSpan={2}
                        className="px-2 py-1 border-r border-gray-100 min-w-[130px] text-left align-bottom pb-2"
                      >
                        Date
                      </th>
                      <th
                        colSpan={2}
                        className="px-1 py-1 text-center border-r border-gray-100 border-b bg-gray-100/50"
                      >
                        Morning
                      </th>
                      <th
                        colSpan={2}
                        className="px-1 py-1 text-center border-r border-gray-100 border-b bg-gray-100/50"
                      >
                        Afternoon
                      </th>
                      <th
                        colSpan={2}
                        className="px-1 py-1 text-center border-r border-gray-100 border-b bg-gray-100/50"
                      >
                        Overtime
                      </th>
                      <th
                        rowSpan={2}
                        className="px-2 py-1 text-right align-bottom pb-2"
                      >
                        Total Hours
                      </th>
                    </tr>
                    <tr>
                      <th className="px-1 py-1 text-center border-r border-gray-100 min-w-[90px] text-[10px] tracking-wider">
                        Time In
                      </th>
                      <th className="px-1 py-1 text-center border-r border-gray-100 min-w-[90px] text-[10px] tracking-wider">
                        Time Out
                      </th>
                      <th className="px-1 py-1 text-center border-r border-gray-100 min-w-[90px] text-[10px] tracking-wider">
                        Time In
                      </th>
                      <th className="px-1 py-1 text-center border-r border-gray-100 min-w-[90px] text-[10px] tracking-wider">
                        Time Out
                      </th>
                      <th className="px-1 py-1 text-center border-r border-gray-100 min-w-[90px] text-[10px] tracking-wider">
                        Time In
                      </th>
                      <th className="px-1 py-1 text-center border-r border-gray-100 min-w-[90px] text-[10px] tracking-wider">
                        Time Out
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {processedDays.map((day, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-2 py-1 font-medium text-gray-900 whitespace-nowrap border-r border-gray-100">
                          {day.date.toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        {[day.s1, day.s2, day.s3, day.s4, day.s5, day.s6].map(
                          (slot: AdminAttendanceLog | null, idx: number) => {
                            const isAutoTimeOut = idx % 2 !== 0 && slot && (slot.validated_by === "SYSTEM_AUTO_CLOSE" || slot.validated_by === "AUTO TIME OUT");
                            return (
                              <td
                                key={idx}
                                className={`px-1 py-1 border-r border-gray-100 text-center min-w-[110px] ${isAutoTimeOut ? 'align-middle' : 'align-top'}`}
                              >
                                {slot ? (
                                      <div className="flex flex-col items-center gap-1">
                                        {isAutoTimeOut ? (
                                          <span className="text-[10px] font-bold text-orange-500 py-1">No Time-Out</span>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center w-full">
                                                <div className={`text-[11px] font-medium whitespace-nowrap text-center ${slot.is_late ? 'text-red-600 font-bold' : 'text-gray-900'}`}>
                                                    {formatTime(slot.ts)}
                                                </div>
                                                {slot.is_late ? (
                                                    <div className="text-[7px] font-bold text-red-500 leading-none mt-0.5 text-center">LATE</div>
                                                ) : (
                                                    <div className="text-[7px] font-bold text-transparent leading-none mt-0.5 invisible text-center">LATE</div>
                                                )}
                                            </div>
                                        )}
                                        {slot.photourl && !isAutoTimeOut && (
                                      <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100">
                                        <img
                                          src={slot.photourl}
                                          alt="Log"
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    )}
                                    {!isAutoTimeOut && (
                                    <span
                                      className={`text-[10px] font-medium ${getLogStatusColorClass(
                                        slot
                                      )}`}
                                    >
                                      {formatLogStatusLabel(slot)}
                                    </span>
                                    )}
                                    <button
                                      onClick={() => setEditingEntry(slot)}
                                      className="mt-0.5 text-[10px] font-semibold text-[#F97316] hover:text-[#EA580C]"
                                    >
                                      Edit
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-gray-300 block py-1">-</span>
                                )}
                              </td>
                            );
                          }
                        )}
                        <td className="px-2 py-1 text-right font-bold text-gray-900">
                          {formatHours(day.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-3">
                {processedDays.map((day, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-2xl border border-gray-200 bg-white"
                  >
                    <div className="text-sm font-semibold text-gray-900">
                      {day.date.toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3">
                      {[
                        { label: "Morning", slots: [day.s1, day.s2] },
                        { label: "Afternoon", slots: [day.s3, day.s4] },
                        { label: "Overtime", slots: [day.s5, day.s6] },
                      ].map((group, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-gray-100 bg-gray-50 p-3"
                        >
                          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                            {group.label}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {group.slots.map(
                              (slot: AdminAttendanceLog | null, slotIdx: number) => {
                                const isAutoTimeOut = slotIdx === 1 && slot && (slot.validated_by === "SYSTEM_AUTO_CLOSE" || slot.validated_by === "AUTO TIME OUT");
                                return (
                                  <div
                                    key={slotIdx}
                                    className={`flex flex-col items-center gap-1.5 ${isAutoTimeOut ? 'justify-center h-full' : ''}`}
                                  >
                                    {slot ? (
                                      <>
                                        {isAutoTimeOut ? (
                                          <span className="text-[10px] font-bold text-orange-500 py-2">No Time-Out</span>
                                        ) : (
                                          <div className="flex flex-col items-center justify-center w-full">
                                            <div className={`text-[11px] font-medium whitespace-nowrap text-center ${slot.is_late ? 'text-red-600 font-bold' : 'text-gray-900'}`}>
                                              {formatTime(slot.ts)}
                                            </div>
                                            {slot.is_late ? (
                                                <div className="text-[7px] font-bold text-red-500 leading-none mt-0.5 text-center">LATE</div>
                                            ) : (
                                                <div className="text-[7px] font-bold text-transparent leading-none mt-0.5 invisible text-center">LATE</div>
                                            )}
                                          </div>
                                        )}
                                        {slot.photourl && !isAutoTimeOut && (
                                          <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100">
                                            <img
                                              src={slot.photourl}
                                              alt="Log"
                                              className="w-full h-full object-cover"
                                            />
                                          </div>
                                        )}
                                        {!isAutoTimeOut && (
                                        <span
                                          className={`text-[10px] font-medium ${getLogStatusColorClass(
                                            slot
                                          )}`}
                                        >
                                          {formatLogStatusLabel(slot)}
                                        </span>
                                        )}
                                        <button
                                          onClick={() => setEditingEntry(slot)}
                                          className="mt-0.5 text-[10px] font-semibold text-[#F97316] hover:text-[#EA580C]"
                                        >
                                          Edit
                                        </button>
                                      </>
                                    ) : (
                                      <span className="text-gray-300">-</span>
                                    )}
                                  </div>
                                );
                              }
                            )}
                          </div>
                        </div>
                      ))}
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                          Total Hours
                        </div>
                        <div className="text-sm font-bold text-gray-900 mt-1 text-right">
                          {formatHours(day.total)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {editingEntry && (
        <EditTimeEntryModal
          entry={editingEntry}
          studentName={selectedStudent ? `${selectedStudent.lastname || ''}, ${selectedStudent.firstname || ''}` : undefined}
          onClose={() => setEditingEntry(null)}
          onSave={() => {
            if (selectedStudent) {
              fetchStudentLogs(selectedStudent);
            }
          }}
        />
      )}
    </div>
  );
}

export function SystemLogsView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/logs?limit=100");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch system logs");
      setLogs(json.logs || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
         <div>
            <h1 className="text-2xl font-bold text-[#1F2937]">System Logs</h1>
            <p className="text-sm text-gray-500">Audit trail of admin actions</p>
         </div>
         <button onClick={fetchLogs} className="p-2 text-gray-500 hover:text-[#F97316] hover:bg-orange-50 rounded-lg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
         </button>
      </div>
      {error && <div className="p-4 rounded-xl bg-red-50 text-red-600 border border-red-100">{error}</div>}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actor</th>
                <th className="px-2 py-1 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-2 py-1 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Target</th>
                <th className="px-2 py-1 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Details</th>
                <th className="px-2 py-1 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={5} className="px-2 py-4 text-center text-gray-500">Loading logs...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="px-2 py-4 text-center text-gray-500">No system logs found</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-2 py-1 whitespace-nowrap text-sm font-medium text-gray-900">
                      {log.actor_idnumber}
                      <span className="block text-xs text-gray-500 font-normal">{log.actor_role}</span>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap text-sm text-gray-500">{log.action}</td>
                    <td className="px-2 py-1 whitespace-nowrap text-sm text-gray-500">{log.target_table} #{log.target_id}</td>
                    <td className="px-2 py-1 text-sm text-gray-500 max-w-xs truncate" title={JSON.stringify(log.reason || { before: log.before_data, after: log.after_data })}>
                       {log.reason || JSON.stringify(log.after_data)}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function SuperAdminBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 md:hidden bg-white border-t border-gray-200 shadow-sm z-20" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} aria-label="Bottom navigation">
      <div className="flex justify-around items-center py-2">
        {[
          { key: "users", label: "Users", href: "/portal/superadmin", icon: (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>) },
        ].map(item => (
          <Link
            key={item.key}
            href={item.href}
            className={`flex flex-col items-center gap-1 px-3 ${pathname === item.href ? "text-[#F97316]" : "text-gray-500"}`}
            aria-current={pathname === item.href ? "page" : undefined}
          >
            {item.icon}
            <span className="text-xs">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

export const MultiSelect = ({ options, value, onChange, placeholder }: { options: {id: number, name: string}[], value: number[], onChange: (val: number[]) => void, placeholder: string }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button 
        type="button" 
        onClick={() => setOpen(!open)} 
        className="w-full text-left rounded-xl border border-gray-300 px-4 py-2.5 text-[#1F2937] bg-white flex justify-between items-center focus:ring-2 focus:ring-[#F97316]/20 transition-all hover:border-gray-400 group"
      >
        <span className={`text-sm ${value.length > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
          {value.length > 0 ? `${value.length} selected` : placeholder}
        </span>
        <span className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors">▼</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl p-2 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100">
          {options.map(opt => {
            const isSelected = value.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  if (isSelected) onChange(value.filter(v => v !== opt.id));
                  else onChange([...value, opt.id]);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-left group/item ${isSelected ? 'bg-orange-50' : 'hover:bg-gray-50'}`}
              >
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isSelected ? 'border-orange-500 bg-orange-500' : 'border-gray-300 bg-white group-hover/item:border-orange-300'}`}>
                  {isSelected && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  )}
                </div>
                <span className={`text-sm font-medium ${isSelected ? 'text-orange-900' : 'text-[#1F2937]'}`}>{opt.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export function Modal({ children, onClose, className }: { children: React.ReactNode; onClose: () => void; className?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className={`relative w-full max-h-[90vh] rounded-2xl bg-white shadow-2xl overflow-y-auto animate-in fade-in zoom-in duration-200 ${className || "max-w-lg"}`}>
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 z-10 p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        {children}
      </div>
    </div>
  );
}

export function AddUserForm({ 
  onSuccess, 
  onClose, 
  availableCourses, 
  availableSections 
}: { 
  onSuccess: (data: any) => Promise<void>; 
  onClose: () => void;
  availableCourses: Course[];
  availableSections: Section[];
}) {
  const [form, setForm] = useState<{
    idnumber: string;
    email: string;
    role: typeof roles[number];
    password: string;
    firstname?: string;
    middlename?: string;
    lastname?: string;
    course?: string;
    section?: string;
    courseIds: number[];
    sectionIds: number[];
    company?: string;
    location?: string;
    supervisorid?: string;
  }>({
    idnumber: "",
    email: "",
    role: "student",
    password: "",
    firstname: "",
    middlename: "",
    lastname: "",
    course: "",
    section: "",
    courseIds: [],
    sectionIds: [],
    company: "",
    location: "",
    supervisorid: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const combinedCourseSections = useMemo(() => {
    return availableSections.map(s => {
      const c = availableCourses.find(c => c.id === s.course_id);
      return {
        id: s.id, 
        name: `${c?.name || "Unknown"} ${s.name}`,
        courseId: s.course_id
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [availableCourses, availableSections]);

  const submit = async () => {
    if (!form.idnumber || !form.email || !form.password || !form.firstname || !form.lastname) {
      setError("First Name, Last Name, ID Number, Email, and Password are required");
      return;
    }
    
    if (form.role === 'student' && (form.sectionIds.length === 0 || form.courseIds.length === 0)) {
      setError("Please select a Course & Section.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSuccess(form);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add user";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="p-6 sm:p-10 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Role Selection Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <div className="flex flex-wrap -mb-px">
          {["student", "instructor", "supervisor", "coordinator", "superadmin"].map((r) => {
             const isActive = form.role === r;
             const label = r === "superadmin" ? "ADMINS" : r.toUpperCase() + "S";
             return (
               <button
                 key={r}
                 type="button"
                 onClick={() => setForm({ ...form, role: r as any })}
                 className={`mr-8 px-1 py-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${
                   isActive 
                     ? "border-[#F97316] text-[#F97316]" 
                     : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                 }`}
               >
                 {label}
               </button>
             );
          })}
        </div>
      </div>

      {/* Unified Form - Simple Layout */}
      <div className="max-w-xl mx-auto mt-8">
         <h2 className="text-xl font-bold text-gray-900 mb-8">
            Add New {form.role === "superadmin" ? "Admin" : form.role.charAt(0).toUpperCase() + form.role.slice(1)}
         </h2>

         <div className="space-y-6">
            {/* ID Number */}
            <div className="space-y-1">
               <label className="block text-sm font-bold text-gray-700">ID Number</label>
               <input
                  value={form.idnumber}
                  onChange={(e) => setForm({ ...form, idnumber: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all"
                  placeholder="e.g. 2021-00001"
               />
            </div>

            {/* Email */}
            <div className="space-y-1">
               <label className="block text-sm font-bold text-gray-700">Email</label>
               <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all"
                  placeholder="e.g. user@school.edu"
               />
            </div>

            {/* Password */}
            <div className="space-y-1">
               <label className="block text-sm font-bold text-gray-700">Password</label>
               <input
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all"
                  placeholder="Temporary password"
               />
            </div>

            {/* First Name */}
            <div className="space-y-1">
               <label className="block text-sm font-bold text-gray-700">First Name</label>
               <input
                  value={form.firstname}
                  onChange={(e) => setForm({ ...form, firstname: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all"
                  placeholder="First name"
               />
            </div>

            {/* Last Name */}
            <div className="space-y-1">
               <label className="block text-sm font-bold text-gray-700">Last Name</label>
               <input
                  value={form.lastname}
                  onChange={(e) => setForm({ ...form, lastname: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all"
                  placeholder="Last name"
               />
            </div>

            {/* Course & Section (Student) - Single Select */}
            {form.role === "student" && (
               <div className="space-y-1">
                  <label className="block text-sm font-bold text-gray-700">Course & Section</label>
                  <div className="relative">
                     <select
                        value={form.sectionIds[0] || ""}
                        onChange={(e) => {
                           const id = Number(e.target.value);
                           const s = availableSections.find(x => x.id === id);
                           if (s) {
                              setForm({ 
                                 ...form, 
                                 sectionIds: [id], 
                                 courseIds: [Number(s.course_id)],
                                 section: s.name,
                                 course: availableCourses.find(c => c.id === s.course_id)?.name || ""
                              });
                           } else {
                              setForm({ ...form, sectionIds: [], courseIds: [], section: "", course: "" });
                           }
                        }}
                        className="w-full appearance-none px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all"
                     >
                        <option value="">Select course & section</option>
                        {combinedCourseSections.map(cs => (
                           <option key={cs.id} value={cs.id}>{cs.name}</option>
                        ))}
                     </select>
                     <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                  </div>
               </div>
            )}

            {/* Supervisor: Company & Location */}
            {form.role === "supervisor" && (
               <>
                  <div className="space-y-1">
                     <label className="block text-sm font-bold text-gray-700">Company</label>
                     <input
                        value={form.company}
                        onChange={(e) => setForm({ ...form, company: e.target.value })}
                        className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all"
                        placeholder="Company name"
                     />
                  </div>
                  <div className="space-y-1">
                     <label className="block text-sm font-bold text-gray-700">Location</label>
                     <input
                        value={form.location}
                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                        className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all"
                        placeholder="Company location"
                     />
                  </div>
               </>
            )}

            {/* Instructor: Multiple Sections */}
            {form.role === "instructor" && (
               <div className="space-y-1">
                  <label className="block text-sm font-bold text-gray-700">Assigned Sections</label>
                  <MultiSelect
                     options={combinedCourseSections}
                     value={form.sectionIds}
                     onChange={(ids) => {
                        // Derive courseIds from selected sectionIds
                        const selectedSections = availableSections.filter(s => ids.includes(s.id));
                        const derivedCourseIds = Array.from(new Set(selectedSections.map(s => Number(s.course_id))));
                        setForm({ ...form, sectionIds: ids, courseIds: derivedCourseIds });
                     }}
                     placeholder="Select sections"
                  />
               </div>
            )}

            {/* Coordinator: Courses Only */}
            {form.role === "coordinator" && (
               <div className="space-y-1">
                  <label className="block text-sm font-bold text-gray-700">Assigned Courses</label>
                  <MultiSelect
                     options={availableCourses}
                     value={form.courseIds}
                     onChange={(ids) => setForm({ ...form, courseIds: ids })}
                     placeholder="Select courses"
                  />
               </div>
            )}

            {/* Error Message */}
            {error && (
               <div className="p-4 rounded-lg bg-red-50 text-red-600 border border-red-100 flex items-center gap-2 text-sm">
                  <X size={16} /> {error}
               </div>
            )}

            {/* Buttons */}
            <div className="pt-4 flex items-center justify-end gap-4">
               <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-lg font-bold text-gray-500 hover:bg-gray-100 transition-colors"
               >
                  Cancel
               </button>
               <button
                  type="button"
                  onClick={submit}
                  disabled={loading}
                  className="px-8 py-2.5 rounded-lg font-bold bg-[#F97316] text-white hover:bg-[#EA580C] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20"
               >
                  {loading ? "Creating..." : "Create Account"}
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};

export function DeleteConfirmationModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal onClose={onCancel} className="max-w-md">
      <div className="p-6 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900">Delete User?</h3>
        <p className="text-gray-500">Are you sure you want to delete this user? This action cannot be undone.</p>
        <div className="flex gap-3 pt-2">
           <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors">Cancel</button>
           <button onClick={onConfirm} className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20">Delete</button>
        </div>
      </div>
    </Modal>
  )
}

export function EditUserForm({ 
  user, 
  onSuccess, 
  onClose, 
  availableCourses, 
  availableSections 
}: { 
  user: User; 
  onSuccess: (id: number, updates: any) => Promise<void>; 
  onClose: () => void;
  availableCourses: Course[];
  availableSections: Section[];
}) {
  // Form for editing user details - Role is not editable here
  const [form, setForm] = useState({
    idnumber: user.idnumber,
    password: "",
    firstname: user.firstname || "",
    middlename: user.middlename || "",
    lastname: user.lastname || "",
    email: user.email || "",
    course: user.course || "",
    section: user.section || "",
    courseIds: user.courseIds || [],
    sectionIds: user.sectionIds || [],
    company: user.company || "",
    location: user.location || "",
    supervisorid: user.supervisorid || "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const combinedCourseSections = useMemo(() => {
    return availableSections.map(s => {
      const c = availableCourses.find(c => c.id === s.course_id);
      return {
        id: s.id, 
        name: `${c?.name || "Unknown"} ${s.name}`,
        courseId: s.course_id
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [availableCourses, availableSections]);

  const submit = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const payload: any = {
        idnumber: form.idnumber,
        firstname: form.firstname,
        middlename: form.middlename,
        lastname: form.lastname,
        email: form.email,
        role: user.role, // Include role to ensure correct table update
      };

      if (form.password) payload.password = form.password;

      // Role specific fields
      if (user.role === "student") {
        const courseObj = availableCourses.find(c => c.name === form.course);
        const sectionObj = availableSections.find(s => s.name === form.section && (courseObj ? s.course_id === courseObj.id : true));

        payload.course = courseObj ? courseObj.id : form.course;
        payload.section = sectionObj ? sectionObj.id : form.section;

        // Deployment info for students
        if (form.company) payload.company = form.company;
        if (form.location) payload.location = form.location;
        if (form.supervisorid) payload.supervisorid = form.supervisorid;
      }
      
      if (user.role === "supervisor") {
        payload.company = form.company;
        payload.location = form.location;
      }

      // Arrays for relationships
      if (form.courseIds) payload.courseIds = form.courseIds;
      if (form.sectionIds) payload.sectionIds = form.sectionIds;

      await onSuccess(user.id, payload);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update user";
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 sm:p-8">
      <h2 className="text-2xl font-bold text-[#1F2937] mb-6">Edit User</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">ID Number</span>
          <input
            value={form.idnumber}
            onChange={(e) => setForm({ ...form, idnumber: e.target.value })}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="e.g. 2021-00001"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">New Password (Optional)</span>
          <input
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="Leave blank to keep current"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">First Name</span>
          <input
            value={form.firstname}
            onChange={(e) => setForm({ ...form, firstname: e.target.value })}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="First name"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Last Name</span>
          <input
            value={form.lastname}
            onChange={(e) => setForm({ ...form, lastname: e.target.value })}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="Last name"
          />
        </label>
        
        {user.role === "student" && (
          <>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Course</span>
              <div className="relative">
                <select
                  value={form.course}
                  onChange={(e) => {
                    const newCourse = e.target.value;
                    setForm({ ...form, course: newCourse, section: "" });
                  }}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all appearance-none bg-white"
                >
                  <option value="">Select Course</option>
                  {availableCourses.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Section</span>
              <div className="relative">
                <select
                  value={form.section}
                  onChange={(e) => setForm({ ...form, section: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all appearance-none bg-white"
                  disabled={!form.course}
                >
                  <option value="">Select Section</option>
                  {availableSections
                    .filter(s => {
                      const course = availableCourses.find(c => c.name === form.course);
                      return course && s.course_id === course.id;
                    })
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))
                  }
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
            </label>
            
            <div className="md:col-span-2 border-t border-gray-100 pt-4 mt-2">
               <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">Deployment Info</label>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                   <label className="grid gap-1.5">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Company</span>
                      <input
                        value={form.company}
                        onChange={(e) => setForm({ ...form, company: e.target.value })}
                        className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
                        placeholder="Company Name"
                      />
                   </label>
                   <label className="grid gap-1.5">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Location</span>
                      <input
                        value={form.location}
                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                        className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
                        placeholder="City / Address"
                      />
                   </label>
                   <label className="grid gap-1.5 md:col-span-2">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Supervisor ID</span>
                      <input
                        value={form.supervisorid}
                        onChange={(e) => setForm({ ...form, supervisorid: e.target.value })}
                        className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all font-mono"
                        placeholder="Supervisor's ID Number"
                      />
                   </label>
               </div>
            </div>
          </>
        )}

        {user.role === "coordinator" && (
          <>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email</span>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
                placeholder="Email address"
              />
            </label>
            <label className="grid gap-1.5 md:col-span-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Assigned Courses</span>
              <MultiSelect
                options={availableCourses}
                value={form.courseIds}
                onChange={(ids) => setForm({ ...form, courseIds: ids })}
                placeholder="Select courses to manage"
              />
            </label>
          </>
        )}

        {(user.role === "instructor" || user.role === "supervisor") && (
          <>
            {user.role === "supervisor" && (
              <>
                 <label className="grid gap-1.5">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Company</span>
                  <input
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
                    placeholder="Company name"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Location</span>
                  <input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
                    placeholder="Location"
                  />
                </label>
              </>
            )}
            <label className="grid gap-1.5 md:col-span-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Assigned Sections</span>
              <MultiSelect
                options={combinedCourseSections}
                value={form.sectionIds}
                onChange={(ids) => {
                  const selected = combinedCourseSections.filter(x => ids.includes(x.id));
                  const cIds = Array.from(new Set(selected.map(x => x.courseId)));
                  setForm({ ...form, sectionIds: ids, courseIds: cIds });
                }}
                placeholder="Select sections to handle"
              />
            </label>
          </>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-3">
        {message && <div className="text-sm text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">{message}</div>}
        <button
          onClick={submit}
          disabled={loading}
          className="w-full rounded-xl bg-[#F97316] py-3.5 text-white font-bold hover:bg-[#EA580C] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-orange-200"
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

export function UserManagementView({ 
  onDelete, 
  onEdit, 
  onAdd, 
  availableCourses, 
  availableSections 
}: { 
  onDelete: (id: number, role?: string) => Promise<void>; 
  onEdit: (id: number, updates: any) => Promise<void>; 
  onAdd: (data: any) => Promise<void>;
  availableCourses: Course[]; 
  availableSections: Section[];
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(0);

  const [filter, setFilter] = useState<typeof roleTabs[number]>("student");
  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("role", filter);
      if (query.trim()) params.set("search", query.trim());
      if (courseFilter) params.set("course", courseFilter);
      if (sectionFilter) params.set("section", sectionFilter);
      if (filter === "student") params.set("approvedOnly", "true");

      const res = await fetch(`/api/users?${params.toString()}`);
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, limit, filter, query, courseFilter, sectionFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  useEffect(() => {
    setPage(1);
  }, [filter, query, courseFilter, sectionFilter]);

  const handleAdd = async (data: any) => {
    await onAdd(data);
    fetchUsers();
    setShowAdd(false);
  };
  
  const handleEdit = async (id: number, updates: any) => {
    await onEdit(id, updates);
    fetchUsers();
    setEditingUser(null);
  };

  const handleDelete = async () => {
    if (deletingUser) {
      await onDelete(deletingUser.id, deletingUser.role);
      fetchUsers();
      setDeletingUser(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
           <h1 className="text-xl font-bold text-[#1F2937]">Manage Users</h1>
           <p className="text-xs text-gray-500">View and manage system users</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="flex items-center justify-center gap-2 bg-[#F97316] text-white px-4 py-2 rounded-xl hover:bg-[#EA580C] transition-colors font-semibold shadow-sm active:scale-95 text-sm"
        >
          <Users size={16} />
          <span>Add User</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="border-b border-gray-200">
           <div className="flex overflow-x-auto scrollbar-hide">
              {roleTabs.map((r) => {
                 const isActive = filter === r;
                 return (
                    <button
                       key={r}
                       onClick={() => {
                           setFilter(r as any);
                           setCourseFilter("");
                           setSectionFilter("");
                       }}
                       className={`px-4 py-2 text-xs font-bold uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors ${isActive ? 'border-[#F97316] text-[#F97316]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                    >
                       {r === "student" ? "Students" : r.charAt(0).toUpperCase() + r.slice(1) + "s"}
                    </button>
                 )
              })}
           </div>
        </div>

        <div className="p-3 bg-gray-50 border-b border-gray-200 flex flex-col md:flex-row gap-3">
           <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <Search className="text-gray-400" size={18} />
              </div>
              <input
                 type="text"
                 value={query}
                 onChange={(e) => setQuery(e.target.value)}
                 className="block w-full rounded-xl border-gray-200 pl-10 pr-3 py-2.5 text-sm placeholder-gray-500 focus:border-[#F97316] focus:ring-[#F97316] focus:ring-opacity-50 transition-all shadow-sm"
                 placeholder="Search by name, ID number..."
              />
           </div>
           
           {(filter === "student" || filter === "instructor" || availableCourses.length > 0) && (
             <div className="flex gap-2">
                <select
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                  className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] text-gray-700 min-w-[140px] shadow-sm"
                >
                  <option value="">All Courses</option>
                  {availableCourses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <select
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] text-gray-700 min-w-[140px] shadow-sm"
                >
                  <option value="">All Sections</option>
                  {availableSections.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
             </div>
           )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-2 py-1 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                {filter === 'supervisor' ? (
                   <>
                      <th scope="col" className="px-2 py-1 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Company</th>
                      <th scope="col" className="px-2 py-1 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Location</th>
                   </>
                ) : (
                   <th scope="col" className="px-2 py-1 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                     {filter === 'coordinator' ? 'Assigned Courses' : 
                      filter === 'instructor' ? 'Assigned Sections' :
                      'Details'}
                   </th>
                )}
                <th scope="col" className="px-2 py-1 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                 <tr><td colSpan={filter === 'supervisor' ? 4 : 3} className="px-2 py-4 text-center text-gray-500">Loading users...</td></tr>
              ) : users.length === 0 ? (
                 <tr><td colSpan={filter === 'supervisor' ? 4 : 3} className="px-2 py-4 text-center text-gray-500">No users found matching your criteria</td></tr>
              ) : (
                users.map((u) => {
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-2 py-1 whitespace-nowrap">
                        <div className="flex items-center">
                           <div className="flex-shrink-0 h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-[#F97316] font-bold text-xs">
                              {(u.name || u.firstname || u.idnumber).charAt(0).toUpperCase()}
                           </div>
                           <div className="ml-2">
                              <div className="text-xs font-bold text-gray-900">
                                {u.name || [u.firstname, u.lastname].filter(Boolean).join(" ") || "Unknown Name"}
                              </div>
                              <div className="text-xs text-gray-500">{u.idnumber}</div>
                           </div>
                        </div>
                      </td>
                      {filter === 'supervisor' ? (
                         <>
                            <td className="px-2 py-1">
                               <div className="text-xs font-bold text-gray-900">{u.company || <span className="text-gray-400 font-normal italic">--</span>}</div>
                            </td>
                            <td className="px-2 py-1">
                               <div className="text-xs font-bold text-gray-900">{u.location || <span className="text-gray-400 font-normal italic">--</span>}</div>
                            </td>
                         </>
                      ) : (
                         <td className="px-2 py-1">
                            <div className="text-xs font-bold text-gray-900">
                               {[u.course, u.section].filter(Boolean).join("-") || <span className="text-gray-400 font-normal italic">--</span>}
                            </div>
                         </td>
                      )}
                      <td className="px-2 py-1 whitespace-nowrap text-right text-xs font-medium">
                        <div className="flex justify-end gap-3">
                           <button onClick={() => setEditingUser(u)} className="text-[#F97316] hover:text-[#EA580C] font-semibold transition-colors">Edit</button>
                           <button 
                              onClick={() => setDeletingUser(u)} 
                              className="text-red-600 hover:text-red-900 font-semibold transition-colors"
                           >
                              Delete
                           </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between sm:px-6">
           <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
           </div>
           <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                 <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to <span className="font-medium">{Math.min(page * limit, total)}</span> of <span className="font-medium">{total}</span> results
                 </p>
              </div>
              <div>
                 <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <span className="sr-only">Previous</span>
                      <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                       Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <span className="sr-only">Next</span>
                      <ChevronRight className="h-5 w-5" aria-hidden="true" />
                    </button>
                 </nav>
              </div>
           </div>
        </div>
      </div>

      {showAdd && (
        <Modal onClose={() => setShowAdd(false)} className="max-w-4xl">
          <AddUserForm 
            onClose={() => setShowAdd(false)} 
            onSuccess={handleAdd}
            availableCourses={availableCourses}
            availableSections={availableSections}
          />
        </Modal>
      )}

      {editingUser && (
        <Modal onClose={() => setEditingUser(null)} className="max-w-4xl">
           <EditUserForm
             user={editingUser}
             onSuccess={handleEdit}
             onClose={() => setEditingUser(null)}
             availableCourses={availableCourses}
             availableSections={availableSections}
           />
        </Modal>
      )}

      {deletingUser && (
         <DeleteConfirmationModal
            onConfirm={handleDelete}
            onCancel={() => setDeletingUser(null)}
         />
      )}
    </div>
  );
}
