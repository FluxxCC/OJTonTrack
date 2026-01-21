"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
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

// --- Types ---

export type User = {
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

type AdminAttendanceLog = {
  id: number;
  idnumber: string;
  type: "in" | "out";
  ts: number;
  photourl?: string | null;
  status?: string | null;
};

function getLogStatus(entry?: { status?: string | null } | null): "Pending" | "Approved" | "Rejected" {
  if (!entry || !entry.status) return "Pending";
  if (entry.status === "Approved") return "Approved";
  if (entry.status === "Rejected") return "Rejected";
  return "Pending";
}

function formatLogStatusLabel(entry: { status?: string | null }): string {
  const status = getLogStatus(entry);
  if (status === "Approved") return "Validated";
  if (status === "Rejected") return "Unvalidated";
  return "Pending";
}

function getLogStatusColorClass(entry?: { status?: string | null } | null): string {
  const status = getLogStatus(entry);
  if (status === "Approved") return "text-green-600";
  if (status === "Rejected") return "text-red-600";
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
  const [ts, setTs] = useState<string>(entry.ts ? new Date(entry.ts).toISOString().slice(0, 16) : "");
  const [type, setType] = useState<string>(entry.type);
  const [status, setStatus] = useState<string>(entry.status || "Pending");
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

export function TimeEntryView({ users }: { users: User[] }) {
  const students = useMemo(() => users.filter(u => u.role === "student"), [users]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [logs, setLogs] = useState<AdminAttendanceLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [schedule, setSchedule] = useState<ShiftSchedule | null>(null);
  const [courseFilter, setCourseFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");

  const courseOptions = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.course) set.add(s.course);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [students]);

  const sectionOptions = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.section) set.add(s.section);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [students]);

  const filteredStudents = useMemo(() => {
    let result = students;
    if (courseFilter) {
      result = result.filter((s) => s.course === courseFilter);
    }
    if (sectionFilter) {
      result = result.filter((s) => s.section === sectionFilter);
    }
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter((s) => {
        const name = s.name || [s.firstname, s.lastname].filter(Boolean).join(" ");
        const courseSection = [s.course, s.section].filter(Boolean).join(" ");
        return (
          s.idnumber.toLowerCase().includes(q) ||
          name.toLowerCase().includes(q) ||
          courseSection.toLowerCase().includes(q)
        );
      });
    }
    return result;
  }, [students, searchQuery, courseFilter, sectionFilter]);

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

  const fetchStudentLogs = async (student: User) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/attendance?idnumber=${encodeURIComponent(student.idnumber)}&limit=200`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch attendance");
      const entries = Array.isArray(json.entries) ? json.entries : [];
      setLogs(
        entries.map((e: any) => ({
          id: e.id,
          idnumber: e.idnumber,
          type: e.type,
          ts: e.ts,
          photourl: e.photourl,
          status: e.status,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch attendance");
    } finally {
      setLoading(false);
    }
  };

  const onSelectStudent = (student: User) => {
    setSelectedStudent(student);
    fetchStudentLogs(student);
  };

  const onBackToList = () => {
    setSelectedStudent(null);
    setLogs([]);
    setError(null);
  };

  const formatHours = (ms: number) => {
    if (!ms) return "-";
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  };

  const processedDays = useMemo(() => {
    if (!selectedStudent) return [];
    const grouped = new Map<string, { date: Date; logs: AdminAttendanceLog[] }>();
    logs.forEach((log) => {
      const d = new Date(log.ts);
      const key = d.toLocaleDateString();
      if (!grouped.has(key)) grouped.set(key, { date: d, logs: [] });
      grouped.get(key)!.logs.push(log);
    });

    return Array.from(grouped.values())
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map((day) => {
        const sorted = day.logs.slice().sort((a, b) => a.ts - b.ts);
        // Filter out OT Auth logs if present (though usually separate table)
        const processingLogs = sorted.filter(l => !l.photourl?.startsWith("OT_AUTH:"));

        const baseDate = new Date(day.date);
        baseDate.setHours(0, 0, 0, 0);

        const buildShift = (timeStr: string) => {
          const [h, m] = timeStr.split(":").map(Number);
          const d = new Date(baseDate.getTime());
          d.setHours(h || 0, m || 0, 0, 0);
          return d.getTime();
        };

        const src = schedule;
        
        let localSchedule = {
            amIn: buildShift("08:00"),
            amOut: buildShift("12:00"),
            pmIn: buildShift("13:00"),
            pmOut: buildShift("17:00"),
            otStart: buildShift("17:00"),
            otEnd: buildShift("18:00"),
        };

        if (src && typeof src.amIn === "string") {
            localSchedule = {
                amIn: buildShift(src.amIn),
                amOut: buildShift(src.amOut),
                pmIn: buildShift(src.pmIn),
                pmOut: buildShift(src.pmOut),
                otStart: src.otIn ? buildShift(src.otIn) : buildShift("17:00"),
                otEnd: src.otOut ? buildShift(src.otOut) : buildShift("18:00"),
            };
        }

        // --- New Session Logic (Consistent with Supervisor) ---
        type Session = { in: AdminAttendanceLog; out: AdminAttendanceLog | null; shift: 'am' | 'pm' | 'ot' };
        const sessions: Session[] = [];
        let currentIn: AdminAttendanceLog | null = null;

        const determineShift = (ts: number): 'am' | 'pm' | 'ot' => {
            if (ts < localSchedule.amOut) return 'am';
            if (ts < localSchedule.pmOut) return 'pm';
            return 'ot';
        };

        for (const log of processingLogs) {
            if (log.status === "Rejected") continue;

            if (log.type === "in") {
                if (currentIn) {
                    // Previous session incomplete
                    sessions.push({ in: currentIn, out: null, shift: determineShift(currentIn.ts) });
                }
                currentIn = log;
            } else if (log.type === "out") {
                if (currentIn) {
                    // Normal Session
                    sessions.push({ in: currentIn, out: log, shift: determineShift(currentIn.ts) });
                    currentIn = null;
                }
            }
        }
        if (currentIn) {
            sessions.push({ in: currentIn, out: null, shift: determineShift(currentIn.ts) });
        }

        // Calculate Hours (Strict Shift Isolation)
        const calculateHours = (requireApproved: boolean) => {
            let total = 0;
            sessions.forEach(session => {
                const isInValid = !requireApproved || session.in.status === "Approved";
                const isOutValid = !session.out || !requireApproved || session.out?.status === "Approved";
                if (!isInValid || !isOutValid) return;
                
                if (!session.out) return;

                if (session.shift === 'am') {
                    const amIn = Math.max(session.in.ts, localSchedule.amIn);
                    const amOut = Math.min(session.out.ts, localSchedule.amOut);
                    const amInFl = Math.floor(amIn / 60000) * 60000;
                    const amOutFl = Math.floor(amOut / 60000) * 60000;
                    total += Math.max(0, amOutFl - amInFl);
                } else if (session.shift === 'pm') {
                    const pmIn = Math.max(session.in.ts, localSchedule.pmIn);
                    const pmOut = Math.min(session.out.ts, localSchedule.pmOut);
                    const pmInFl = Math.floor(pmIn / 60000) * 60000;
                    const pmOutFl = Math.floor(pmOut / 60000) * 60000;
                    total += Math.max(0, pmOutFl - pmInFl);
                } else if (session.shift === 'ot') {
                    const otIn = Math.max(session.in.ts, localSchedule.otStart);
                    const otOut = Math.min(session.out.ts, localSchedule.otEnd);
                    const otInFl = Math.floor(otIn / 60000) * 60000;
                    const otOutFl = Math.floor(otOut / 60000) * 60000;
                    total += Math.max(0, otOutFl - otInFl);
                }
            });
            return Math.floor(total / 60000) * 60000;
        };

        const total = calculateHours(false);
        const validatedTotal = calculateHours(true);

        const mapSessionToSlots = (shiftSessions: Session[]) => {
            if (shiftSessions.length === 0) return { in: null, out: null };
            const firstSession = shiftSessions[0];
            const lastSession = shiftSessions[shiftSessions.length - 1];
            return { in: firstSession.in, out: lastSession.out };
        };

        const amSlots = mapSessionToSlots(sessions.filter(s => s.shift === 'am'));
        const pmSlots = mapSessionToSlots(sessions.filter(s => s.shift === 'pm'));
        const otSlots = mapSessionToSlots(sessions.filter(s => s.shift === 'ot'));

        return { 
            date: day.date, 
            s1: amSlots.in, s2: amSlots.out, 
            s3: pmSlots.in, s4: pmSlots.out, 
            s5: otSlots.in, s6: otSlots.out, 
            total, 
            validatedTotal 
        };
      });
  }, [logs, schedule, selectedStudent]);

  const totalHoursMs = useMemo(
    () => processedDays.reduce((sum, day) => sum + day.total, 0),
    [processedDays]
  );

  const totalValidatedHoursMs = useMemo(
    () => processedDays.reduce((sum, day) => sum + (day.validatedTotal || 0), 0),
    [processedDays]
  );

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

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
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
                <option value="">All courses</option>
                {courseOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none"
              >
                <option value="">All sections</option>
                {sectionOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <div className="text-xs text-gray-500 font-medium">
                Showing {filteredStudents.length} student
                {filteredStudents.length === 1 ? "" : "s"}
              </div>
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
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      ID Number
                    </th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-sm text-gray-500"
                      >
                        No students found.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => {
                      const name =
                        student.name ||
                        [student.firstname, student.lastname].filter(Boolean).join(" ");
                      const courseSection = [student.course, student.section]
                        .filter(Boolean)
                        .join(" • ");
                      return (
                        <tr
                          key={student.id}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => onSelectStudent(student)}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-orange-50 text-[#F97316] flex items-center justify-center text-xs font-bold">
                                {(name || student.idnumber || "?").charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-gray-900">
                                  {name || student.idnumber}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                            {courseSection || "—"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                            {student.idnumber}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#F97316]">
                              View Attendance
                              <ChevronRight size={14} />
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
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
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
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

        <div className="p-4 sm:p-6">
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
              <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-gray-100 bg-orange-50/70 p-4 flex flex-col">
                  <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Total Hours
                  </div>
                  <div className="mt-1 text-lg font-bold text-gray-900">
                    {formatHours(totalHoursMs)}
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-emerald-50/70 p-4 flex flex-col">
                  <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Total Validated Hours
                  </div>
                  <div className="mt-1 text-lg font-bold text-gray-900">
                    {formatHours(totalValidatedHoursMs)}
                  </div>
                </div>
              </div>

              <div className="hidden md:block overflow-x-auto custom-scrollbar">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
                    <tr>
                      <th
                        rowSpan={2}
                        className="px-4 py-3 border-r border-gray-100 min-w-[130px] text-left align-bottom pb-4"
                      >
                        Date
                      </th>
                      <th
                        colSpan={2}
                        className="px-2 py-2 text-center border-r border-gray-100 border-b bg-gray-100/50"
                      >
                        Morning
                      </th>
                      <th
                        colSpan={2}
                        className="px-2 py-2 text-center border-r border-gray-100 border-b bg-gray-100/50"
                      >
                        Afternoon
                      </th>
                      <th
                        colSpan={2}
                        className="px-2 py-2 text-center border-r border-gray-100 border-b bg-gray-100/50"
                      >
                        Overtime
                      </th>
                      <th
                        rowSpan={2}
                        className="px-4 py-3 text-right align-bottom pb-4"
                      >
                        Total Hours
                      </th>
                    </tr>
                    <tr>
                      <th className="px-2 py-2 text-center border-r border-gray-100 min-w-[90px] text-[10px] tracking-wider">
                        Time In
                      </th>
                      <th className="px-2 py-2 text-center border-r border-gray-100 min-w-[90px] text-[10px] tracking-wider">
                        Time Out
                      </th>
                      <th className="px-2 py-2 text-center border-r border-gray-100 min-w-[90px] text-[10px] tracking-wider">
                        Time In
                      </th>
                      <th className="px-2 py-2 text-center border-r border-gray-100 min-w-[90px] text-[10px] tracking-wider">
                        Time Out
                      </th>
                      <th className="px-2 py-2 text-center border-r border-gray-100 min-w-[90px] text-[10px] tracking-wider">
                        Time In
                      </th>
                      <th className="px-2 py-2 text-center border-r border-gray-100 min-w-[90px] text-[10px] tracking-wider">
                        Time Out
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {processedDays.map((day, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap border-r border-gray-100">
                          {day.date.toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        {[day.s1, day.s2, day.s3, day.s4, day.s5, day.s6].map(
                          (slot: AdminAttendanceLog | null, idx: number) => (
                            <td
                              key={idx}
                              className="px-1.5 py-2 border-r border-gray-100 text-center align-top min-w-[110px]"
                            >
                              {slot ? (
                                <div className="flex flex-col items-center gap-1.5">
                                  <span className="text-[11px] font-medium text-gray-800">
                                    {formatTime(slot.ts)}
                                  </span>
                                  {slot.photourl && (
                                    <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100">
                                      <img
                                        src={slot.photourl}
                                        alt="Log"
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  )}
                                  <span
                                    className={`text-[10px] font-medium ${getLogStatusColorClass(
                                      slot
                                    )}`}
                                  >
                                    {formatLogStatusLabel(slot)}
                                  </span>
                                  <button
                                    onClick={() => setEditingEntry(slot)}
                                    className="mt-0.5 text-[10px] font-semibold text-[#F97316] hover:text-[#EA580C]"
                                  >
                                    Edit
                                  </button>
                                </div>
                              ) : (
                                <span className="text-gray-300 block py-4">-</span>
                              )}
                            </td>
                          )
                        )}
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
                              (slot: AdminAttendanceLog | null, slotIdx: number) => (
                                <div
                                  key={slotIdx}
                                  className="flex flex-col items-center gap-1.5"
                                >
                                  {slot ? (
                                    <>
                                      <span className="text-[11px] font-medium text-gray-800">
                                        {formatTime(slot.ts)}
                                      </span>
                                      {slot.photourl && (
                                        <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100">
                                          <img
                                            src={slot.photourl}
                                            alt="Log"
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      )}
                                      <span
                                        className={`text-[10px] font-medium ${getLogStatusColorClass(
                                          slot
                                        )}`}
                                      >
                                        {formatLogStatusLabel(slot)}
                                      </span>
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
                              )
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
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actor</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Target</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Details</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Loading logs...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No system logs found</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {log.actor_idnumber}
                      <span className="block text-xs text-gray-500 font-normal">{log.actor_role}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.action}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.target_table} #{log.target_id}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={JSON.stringify(log.reason || { before: log.before_data, after: log.after_data })}>
                       {log.reason || JSON.stringify(log.after_data)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
    if (!form.idnumber || !form.password || !form.firstname || !form.lastname) {
      setError("First Name, Last Name, ID Number, and Password are required");
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

            {/* Course & Section (Student, Instructor, Supervisor) */}
            {["student", "instructor", "supervisor"].includes(form.role) && (
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
                                 courseIds: [s.course_id],
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
      };

      if (form.password) payload.password = form.password;

      // Role specific fields
      if (user.role === "student") {
        payload.course = form.course;
        payload.section = form.section;
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
      if (form.courseIds && form.courseIds.length > 0) payload.courseIds = form.courseIds;
      if (form.sectionIds && form.sectionIds.length > 0) payload.sectionIds = form.sectionIds;

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
          <label className="grid gap-1.5 md:col-span-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Assigned Courses</span>
            <MultiSelect
              options={availableCourses}
              value={form.courseIds}
              onChange={(ids) => setForm({ ...form, courseIds: ids })}
              placeholder="Select courses to manage"
            />
          </label>
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
  users, 
  loading, 
  onDelete, 
  onEdit, 
  onAdd, 
  availableCourses, 
  availableSections 
}: { 
  users: User[]; 
  loading: boolean; 
  onDelete: (id: number) => Promise<void>; 
  onEdit: (id: number, updates: any) => Promise<void>; 
  onAdd: (data: any) => Promise<void>;
  availableCourses: Course[]; 
  availableSections: Section[];
}) {
  const [filter, setFilter] = useState<typeof roleTabs[number]>("student");
  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const { filtered, courses, sections } = useMemo(() => {
    // Base filter: exclude superadmin
    let base = users.filter((u) => {
      const r = String(u.role || "").toLowerCase();
      return r !== "superadmin" && r !== "super_admin";
    });

    // Role filter (mandatory now)
    base = base.filter((u) => u.role === filter);

    // Get available courses/sections for this role subset
    const userCourses = Array.from(new Set(base.map(u => u.course).filter(Boolean))).sort() as string[];
    const userSections = Array.from(new Set(base.map(u => u.section).filter(Boolean))).sort() as string[];

    // Apply other filters
    if (courseFilter) base = base.filter(u => u.course === courseFilter);
    if (sectionFilter) base = base.filter(u => u.section === sectionFilter);

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      base = base.filter(
        (u) =>
          (u.name || "").toLowerCase().includes(q) ||
          (u.firstname || "").toLowerCase().includes(q) ||
          (u.lastname || "").toLowerCase().includes(q) ||
          (u.idnumber || "").toLowerCase().includes(q)
      );
    }
    return { filtered: base, courses: userCourses, sections: userSections };
  }, [users, filter, query, courseFilter, sectionFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-bold text-[#1F2937]">Manage Users</h1>
           <p className="text-sm text-gray-500">View and manage system users</p>
        </div>
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
                       className={`px-6 py-4 text-sm font-bold uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors ${isActive ? 'border-[#F97316] text-[#F97316]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                    >
                       {r === "student" ? "Students" : r.charAt(0).toUpperCase() + r.slice(1) + "s"}
                    </button>
                 )
              })}
           </div>
        </div>

        <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col md:flex-row gap-4">
           <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </div>
              <input
                 type="text"
                 value={query}
                 onChange={(e) => setQuery(e.target.value)}
                 className="block w-full rounded-xl border-gray-200 pl-10 pr-3 py-2.5 text-sm placeholder-gray-500 focus:border-[#F97316] focus:ring-[#F97316] focus:ring-opacity-50 transition-all shadow-sm"
                 placeholder="Search by name, ID number..."
              />
           </div>
           
           {(filter === "student" || filter === "instructor" || courses.length > 0) && (
             <div className="flex gap-2">
                <select
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                  className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] text-gray-700 min-w-[140px] shadow-sm"
                >
                  <option value="">All Courses</option>
                  {courses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] text-gray-700 min-w-[140px] shadow-sm"
                >
                  <option value="">All Sections</option>
                  {sections.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
             </div>
           )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Details</th>
                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                 <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">Loading users...</td></tr>
              ) : filtered.length === 0 ? (
                 <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">No users found matching your criteria</td></tr>
              ) : (
                filtered.map((u) => {
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                           <div className="flex-shrink-0 h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-[#F97316] font-bold text-sm">
                              {(u.name || u.firstname || u.idnumber).charAt(0).toUpperCase()}
                           </div>
                           <div className="ml-4">
                              <div className="text-sm font-bold text-gray-900">
                                {u.name || [u.firstname, u.lastname].filter(Boolean).join(" ") || "Unknown Name"}
                              </div>
                              <div className="text-sm text-gray-500">{u.idnumber}</div>
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="text-sm font-bold text-gray-900">
                            {[u.course, u.section].filter(Boolean).join("-") || <span className="text-gray-400 font-normal italic">--</span>}
                         </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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
      </div>

      {showAdd && (
        <Modal onClose={() => setShowAdd(false)} className="max-w-4xl">
          <AddUserForm 
            onClose={() => setShowAdd(false)} 
            onSuccess={onAdd}
            availableCourses={availableCourses}
            availableSections={availableSections}
          />
        </Modal>
      )}

      {editingUser && (
        <Modal onClose={() => setEditingUser(null)} className="max-w-4xl">
           <EditUserForm
             user={editingUser}
             onSuccess={onEdit}
             onClose={() => setEditingUser(null)}
             availableCourses={availableCourses}
             availableSections={availableSections}
           />
        </Modal>
      )}

      {deletingUser && (
         <DeleteConfirmationModal
            onConfirm={async () => {
               await onDelete(deletingUser.id);
               setDeletingUser(null);
            }}
            onCancel={() => setDeletingUser(null)}
         />
      )}
    </div>
  );
}
