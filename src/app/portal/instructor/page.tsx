"use client";
import React, { useEffect, useMemo, useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { RealtimePostgresChangesPayload, RealtimeChannel } from "@supabase/supabase-js";
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
  RefreshCw,
  X,
  Clock,
  CheckCircle2,
  ClipboardCheck,
  UserCheck,
  Download,
  MessageSquare,
  Calendar,
  ShieldAlert
} from 'lucide-react';
import { 
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';
import { AttendanceDetailsModal } from "@/components/AttendanceDetailsModal";
import { UsersView, AddUserForm, EditUserForm, ViewUserDetails, Modal, ConfirmationModal, SuccessModal, AlertModal } from './ui';


// --- Global Cache for Reports ---
let cachedReportsData: ReportEntry[] | null = null;
let lastReportsFetchTime = 0;
const REPORTS_CACHE_DURATION = 300000; // 5 minutes


// --- Types ---

type AttendanceEntry = { idnumber: string; type: "in" | "out"; timestamp: number; photoDataUrl: string; status?: "Pending" | "Approved" | "Rejected"; validatedAt?: number; validatedBy?: string; is_overtime?: boolean };
type ServerAttendanceEntry = { idnumber: string; type: "in" | "out"; ts: number; photourl: string; status?: string; validated_by?: string | null; validated_at?: string | null; is_overtime?: boolean };
type ReportEntry = { id: number; title?: string; body?: string; text?: string; fileName?: string; fileType?: string; fileUrl?: string; submittedAt: number; instructorComment?: string; idnumber?: string; isViewedByInstructor?: boolean };
type ReportFile = { name?: string; type?: string } | null;
type ReportFiles = ReportFile[] | ReportFile | undefined;
type User = {
  id: number;
  idnumber: string;
  role: string;
  firstname?: string;
  middlename?: string;
  lastname?: string;
  course?: string;
  section?: string;
  company?: string;
  location?: string;
  supervisorid?: string;
  courseIds?: number[];
  sectionIds?: number[];
  status?: string;
  signup_status?: string;
};

type Course = { id: number; name: string; name_key: string };
type Section = { id: number; name: string; code: string; course_id: number };
type TabId = "attendance" | "reports" | "approval" | "profile";
type ReportRow = { id: number; idnumber: string; title?: string | null; text?: string | null; files?: ReportFiles; ts?: number | null; submittedat?: string | null; instructor_comment?: string | null; status?: string | null };
type ApiReport = { id: number; title?: string; body?: string; fileName?: string; fileType?: string; fileUrl?: string; submittedAt: number; instructorComment?: string | null; status?: string };
type EvaluationDetail = { createdAt: number; supervisorId?: string; comment?: string; interpretation?: string; criteria: Record<string, number>; overallScore?: number };

function formatCourseSection(courseStr?: string, sectionStr?: string): string {
  if (!courseStr) return "";
  if (!sectionStr) return courseStr;
  
  const courses = courseStr.split(',').map(s => s.trim());
  const sections = sectionStr.split(',').map(s => s.trim());
  
  if (courses.length > 0 && courses.length === sections.length) {
    return courses.map((c, i) => `${c}-${sections[i]}`).join(', ');
  }
  return `${courseStr} - ${sectionStr}`;
}

// --- Helper Components ---

function StatCard({ title, value, icon: Icon, color }: { title: string, value: string | number, icon: React.ComponentType<{ size?: number; className?: string }>, color: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
      <div className={`p-4 rounded-xl ${color} text-white`}>
        <Icon size={24} />
      </div>
      <div>
        <div className="text-sm text-gray-500 font-medium">{title}</div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
      </div>
    </div>
  );
}

const formatHMS = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}h ${m}m ${s}s`;
};

const LiveTotal = ({ baseMs }: { baseMs: number; activeStart?: number; now?: number }) => {
  return <>{formatHMS(baseMs)}</>;
};

const MonthDropdown = ({ options, value, onChange }: { options: { key: string, label: string }[], value: string, onChange: (val: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedLabel = options.find(o => o.key === value)?.label || "Select Month";

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium text-sm transition-colors border border-gray-200"
            >
                <span>{selectedLabel}</span>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100">
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        {options.map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => { onChange(opt.key); setIsOpen(false); }}
                                className={`w-full text-left px-4 py-2 text-sm transition-colors ${opt.key === value ? "bg-orange-50 text-orange-700 font-medium" : "text-gray-700 hover:bg-gray-50"}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
      </div>
    );
};

const AttendanceChart = React.memo(({ attendance, selected, activeStart, now: propNow, overtimeShifts = [] }: { attendance: AttendanceEntry[], selected: User | null, activeStart?: number, now?: number, overtimeShifts?: { student_id: string; date: string; start: number; end: number }[] }) => {
    
    const startOfWeekSunday = (d: Date) => {
        const s = new Date(d);
        const day = s.getDay();
        s.setHours(0, 0, 0, 0);
        s.setDate(s.getDate() - day);
        return s;
    };
    
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const getMonthKeyFromWeekStart = (start: number) => {
        const d = new Date(start + 3 * 24 * 60 * 60 * 1000);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };
    const getFirstWeekStartForMonth = (key: string) => {
        const [y, m] = key.split("-");
        const d = new Date(Number(y), Number(m) - 1, 1);
        let s = startOfWeekSunday(d).getTime();
        const midKey = getMonthKeyFromWeekStart(s);
        if (midKey !== key) s += weekMs;
        return s;
    };
    const getLastWeekStartForMonth = (key: string) => {
        const [y, m] = key.split("-");
        const last = new Date(Number(y), Number(m), 0);
        let s = startOfWeekSunday(last).getTime();
        const midKey = getMonthKeyFromWeekStart(s);
        if (midKey !== key) s -= weekMs;
        return s;
    };
    
    const [selectedWeekStart, setSelectedWeekStart] = useState<number>(() => startOfWeekSunday(new Date()).getTime());
    const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => getMonthKeyFromWeekStart(startOfWeekSunday(new Date()).getTime()));

    const [internalTick, setInternalTick] = useState(() => Date.now());

    const [scheduleConfig, setScheduleConfig] = useState<{
        amIn: string; amOut: string;
        pmIn: string; pmOut: string;
        otIn: string; otOut: string;
    } | null>(null);

    useEffect(() => {
        const fetchSchedule = async () => {
            try {
                const res = await fetch('/api/shifts');
                const data = await res.json();
                if (data.shifts) {
                    const config = {
                        amIn: "07:00", amOut: "11:00",
                        pmIn: "13:00", pmOut: "17:00",
                        otIn: "17:00", otOut: "18:00"
                    };
                    data.shifts.forEach((s: any) => {
                        if (s.shift_name === "Morning Shift") {
                            config.amIn = s.official_start;
                            config.amOut = s.official_end;
                        } else if (s.shift_name === "Afternoon Shift") {
                            config.pmIn = s.official_start;
                            config.pmOut = s.official_end;
                        } else if (s.shift_name === "Overtime Shift") {
                            config.otIn = s.official_start;
                            config.otOut = s.official_end;
                        }
                    });
                    setScheduleConfig(config);
                }
            } catch (e) {
                console.error("Failed to fetch schedule", e);
            }
        };
        fetchSchedule();
    }, []);

    // Live update removed as per user request (refresh-based only)
    /*
    useEffect(() => {
        if (propNow !== undefined) return;
        if (!activeStart) return;
        const ws = selectedWeekStart;
        const we = selectedWeekStart + weekMs;
        const nowT = Date.now();
        if (nowT < ws || nowT >= we) return;
        const i = setInterval(() => setInternalTick(Date.now()), 1000);
        return () => clearInterval(i);
    }, [activeStart, selectedWeekStart, propNow]);
    */

    const currentTick = propNow !== undefined ? propNow : internalTick;

    // Persist chart state per-student to survive any remounts caused by live updates
    useEffect(() => {
        const id = selected?.idnumber;
        if (!id) return;
        try {
            const wkStr = sessionStorage.getItem(`chart_week_${id}`) || "";
            const mk = sessionStorage.getItem(`chart_month_${id}`) || "";
            const wk = Number(wkStr);
            if (wk && Number.isFinite(wk)) setSelectedWeekStart(wk);
            if (mk) setSelectedMonthKey(mk);
        } catch {}
    }, [selected?.idnumber]);
    useEffect(() => {
        const id = selected?.idnumber;
        if (!id) return;
        try {
            sessionStorage.setItem(`chart_week_${id}`, String(selectedWeekStart));
            sessionStorage.setItem(`chart_month_${id}`, selectedMonthKey);
        } catch {}
    }, [selectedWeekStart, selectedMonthKey, selected?.idnumber]);

    // Sync month key when week changes
    useEffect(() => {
        const currentMonthKey = getMonthKeyFromWeekStart(selectedWeekStart);
        if (currentMonthKey !== selectedMonthKey) {
            setSelectedMonthKey(currentMonthKey);
        }
    }, [selectedWeekStart]);

    const monthsAvailable = useMemo(() => {
        const map = new Map<string, string>();
        
        // Ensure current year months are available
        const now = new Date();
        const currentYear = now.getFullYear();
        for (let i = 0; i < 12; i++) {
            const d = new Date(currentYear, i, 1);
            const key = `${currentYear}-${String(i + 1).padStart(2, "0")}`;
            const label = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
            map.set(key, label);
        }

        // Add months from attendance
        attendance.forEach(e => {
            const d = new Date(e.timestamp);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const label = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
            map.set(key, label);
        });

        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([key, label]) => ({ key, label }));
    }, [attendance]);

    const handleMonthChange = React.useCallback((val: string) => {
        setSelectedMonthKey(val);
        const newStart = getFirstWeekStartForMonth(val);
        setSelectedWeekStart(newStart);
    }, []);

    const studentChartData = useMemo(() => {
        if (!selected || attendance.length === 0) return [];
        
        // Build schedule template with defaults
        const buildShiftTemplate = (timeStr: string) => {
             const [h, m] = timeStr.split(":").map(Number);
             return { h: h||0, m: m||0 };
        };
        let scheduleTemplate = {
             amIn: {h:8, m:0}, amOut: {h:12, m:0},
             pmIn: {h:13, m:0}, pmOut: {h:17, m:0},
             otIn: {h:17, m:0}, otOut: {h:18, m:0}
        };
        
        if (scheduleConfig) {
             scheduleTemplate = {
                 amIn: buildShiftTemplate(scheduleConfig.amIn),
                 amOut: buildShiftTemplate(scheduleConfig.amOut),
                 pmIn: buildShiftTemplate(scheduleConfig.pmIn),
                 pmOut: buildShiftTemplate(scheduleConfig.pmOut),
                 otIn: buildShiftTemplate(scheduleConfig.otIn),
                 otOut: buildShiftTemplate(scheduleConfig.otOut),
             };
        }

        const dayMs = Array(7).fill(0);
        const start = new Date(selectedWeekStart);
        const end = new Date(selectedWeekStart + 7 * 24 * 60 * 60 * 1000);

        const logsByDateKey = new Map<string, AttendanceEntry[]>();
        attendance.forEach(e => {
            if (e.timestamp < start.getTime() || e.timestamp >= end.getTime()) return;
            const d = new Date(e.timestamp);
            const key = d.toLocaleDateString();
            if (!logsByDateKey.has(key)) logsByDateKey.set(key, []);
            logsByDateKey.get(key)!.push(e);
        });

        const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
        const computeShift = (entries: AttendanceEntry[], start: number, end: number, isToday: boolean) => {
             let currentIn: number | null = null;
             let duration = 0;
             const BUFFER_START_MS = 30 * 60 * 1000;
             const BUFFER_END_MS = 4 * 60 * 60 * 1000;
             const searchStart = start - BUFFER_START_MS;
             const searchEnd = end + BUFFER_END_MS;

             entries.forEach(log => {
                 if (log.timestamp < searchStart || log.timestamp > searchEnd) return;
                 
                 if (log.type === "in") {
                     if (log.timestamp > end) return;
                     currentIn = clamp(log.timestamp, start, end);
                 } else if (log.type === "out") {
                     if (currentIn === null) return;
                     const effectiveOut = clamp(log.timestamp, start, end);
                     if (effectiveOut > currentIn) duration += effectiveOut - currentIn;
                     currentIn = null;
                 }
             });

             if (currentIn !== null && isToday) {
                 const nowTs = Date.now();
                 const effectiveOut = clamp(nowTs, start, end);
                 if (effectiveOut > currentIn) duration += effectiveOut - currentIn;
             }

             return duration;
        };

        for (let i = 0; i < 7; i++) {
            const date = new Date(selectedWeekStart);
            date.setDate(date.getDate() + i);
            const key = date.toLocaleDateString();
            const logs = (logsByDateKey.get(key) || []).sort((a,b) => a.timestamp - b.timestamp);
            const isToday = new Date().toDateString() === date.toDateString();
            
            const makeTime = (t: {h:number, m:number}) => {
                const d = new Date(date);
                d.setHours(t.h, t.m, 0, 0);
                return d.getTime();
            };

            const amIn = makeTime(scheduleTemplate.amIn);
            const amOut = makeTime(scheduleTemplate.amOut);
            const pmIn = makeTime(scheduleTemplate.pmIn);
            const pmOut = makeTime(scheduleTemplate.pmOut);
            
            // Dynamic OT Lookup
            const dateStr = date.toLocaleDateString('en-CA');
            const otShift = overtimeShifts.find(s => s.student_id === selected.idnumber && s.date === dateStr);
            
            let otIn, otOut;
            if (otShift) {
                otIn = otShift.start;
                otOut = otShift.end;
            } else {
                otIn = makeTime(scheduleTemplate.otIn);
                otOut = makeTime(scheduleTemplate.otOut);
            }

            dayMs[i] = 
                computeShift(logs, amIn, amOut, isToday) +
                computeShift(logs, pmIn, pmOut, isToday) +
                computeShift(logs, otIn, otOut, isToday);
        }

        const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        return labels.map((label, i) => ({ date: label, ms: dayMs[i], hours: dayMs[i] / (1000 * 60 * 60) }));
    }, [selected, attendance, selectedWeekStart, scheduleConfig, overtimeShifts]);

    const rangeTotalMs = useMemo(() => {
        return studentChartData.reduce((acc, d) => acc + (d.ms || 0), 0);
    }, [studentChartData]);

    const chartContent = useMemo(() => {
        if (studentChartData.length === 0) {
            return (
                <div className="h-full w-full flex flex-col items-center justify-center text-gray-400">
                    <LayoutDashboard size={32} className="mb-2 opacity-20" />
                    <p className="text-sm font-medium">No data for this week</p>
                </div>
            );
        }
        return (
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={studentChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748B', fontSize: 12 }} 
                        dy={10}
                    />
                    <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748B', fontSize: 12 }}
                        tickFormatter={(v) => `${Math.round(v)}h`}
                    />
                    <Tooltip 
                        cursor={{ fill: '#F8FAFC' }}
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                    <div className="bg-gray-900 text-white text-xs py-1.5 px-3 rounded-lg shadow-xl">
                                        <div className="font-semibold mb-0.5">{data.date}</div>
                                        <div>{formatHMS(data.ms)}</div>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Bar 
                        dataKey="hours" 
                        fill="#F97316" 
                        radius={[6, 6, 6, 6]} 
                        barSize={32}
                    />
                </BarChart>
            </ResponsiveContainer>
        );
    }, [studentChartData]);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <MonthDropdown 
                        options={monthsAvailable} 
                        value={selectedMonthKey} 
                        onChange={handleMonthChange} 
                    />
                    <div className="h-6 w-px bg-gray-200 hidden sm:block"></div>
                    <h3 className="text-sm font-semibold text-gray-900 hidden sm:block">Analytics</h3>
                </div>

                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200">
                    <button
                        onClick={() => setSelectedWeekStart(prev => {
                            const nextStart = prev - weekMs;
                            const midKey = getMonthKeyFromWeekStart(nextStart);
                            if (midKey !== selectedMonthKey) {
                                return getLastWeekStartForMonth(selectedMonthKey);
                            }
                            return nextStart;
                        })}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-white hover:shadow-sm transition-all"
                        aria-label="Previous week"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-semibold text-gray-700 w-28 text-center tabular-nums whitespace-nowrap">
                        {new Date(selectedWeekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" })} - {new Date(selectedWeekStart + 6 * 24 * 60 * 60 * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                    <button
                        onClick={() => setSelectedWeekStart(prev => {
                            const nextStart = prev + weekMs;
                            const midKey = getMonthKeyFromWeekStart(nextStart);
                            if (midKey !== selectedMonthKey) {
                                return getFirstWeekStartForMonth(selectedMonthKey);
                            }
                            return nextStart;
                        })}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-white hover:shadow-sm transition-all"
                        aria-label="Next week"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <div className="h-[250px] w-full">{chartContent}</div>
            
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    <span>Tracked Hours</span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-gray-50 text-gray-700 text-xs font-semibold border border-gray-200" title="Sum of tracked hours in the selected week">
                    Range Total: {formatHMS(rangeTotalMs)}
                </div>
            </div>
        </div>
    );
});



const StudentDetailsPanel = ({ 
    selected, 
    attendance, 
    reports, 
    attendanceSummary, 
    activeSessions, 
    evaluationStatuses, 
    toggleEvaluation, 
    setViewingReport,
    openAttendanceModal,
    openReportsModal,
    onViewAttendanceEntry,
    evaluation,
    openEvaluationModal,
    overtimeShifts = []
}: { 
    selected: User | null, 
    attendance: AttendanceEntry[], 
    reports: ReportEntry[], 
    attendanceSummary: Record<string, number>, 
    activeSessions: Record<string, number>, 
    evaluationStatuses: Record<string, boolean>, 
    toggleEvaluation: (id: string, current: boolean) => void, 
    setViewingReport: (r: ReportEntry) => void,
    openAttendanceModal: () => void,
    openReportsModal: () => void,
    onViewAttendanceEntry: (entry: AttendanceEntry) => void,
    evaluation: EvaluationDetail | null,
    openEvaluationModal: () => void,
    overtimeShifts?: { student_id: string; date: string; start: number; end: number }[]
}) => {
    const activeStart = selected ? activeSessions[selected.idnumber] : undefined;
    const now = Date.now();
    
    // Evaluation Toggle State
    const [showEvalRestriction, setShowEvalRestriction] = useState(false);

    const handleToggleClick = (idnumber: string, current: boolean) => {
        if (current) {
            // Turning OFF - no check needed
            toggleEvaluation(idnumber, current);
        } else {
            // Turning ON - check hours
            const baseMs = attendanceSummary[idnumber] || 0;
            const hours = baseMs / (1000 * 60 * 60);
            if (hours < 486) {
                setShowEvalRestriction(true);
            } else {
                toggleEvaluation(idnumber, current);
            }
        }
    };
    
    if (!selected) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-white rounded-2xl border border-gray-200 border-dashed">
                <UserIcon size={48} className="mb-4 opacity-20" />
                <p>Select a student to view details</p>
            </div>
        );
    }

    const baseMs = attendanceSummary[selected.idnumber] || 0;

    return (
        <>
            {/* Header */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                <div className="h-20 w-20 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-3xl font-bold flex-shrink-0">
                    {(selected.firstname?.[0] || "?").toUpperCase()}
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selected.firstname} {selected.lastname}</h2>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                    <span>ID: {selected.idnumber}</span>
                    <span>{selected.course} - {selected.section}</span>
                    {selected.company && (
                      <>
                        <span className="font-medium text-orange-600">{selected.company}</span>
                        {selected.location && <span className="text-gray-400"> ({selected.location})</span>}
                      </>
                    )}
                    </div>
                </div>
                </div>

                <div className="flex flex-col items-start sm:items-end gap-3 border-t sm:border-t-0 pt-4 sm:pt-0 border-gray-100">
                <div className={`px-4 py-1.5 rounded-full text-sm font-bold border flex items-center gap-2 ${
                    (attendanceSummary[selected.idnumber] || 0) / (1000 * 60 * 60) >= 486 
                    ? 'bg-green-50 text-green-700 border-green-200' 
                    : 'bg-gray-50 text-gray-600 border-gray-200'
                        }`}>
                        <span className={`h-2 w-2 rounded-full ${(attendanceSummary[selected.idnumber] || 0) / (1000 * 60 * 60) >= 486 ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                        <LiveTotal baseMs={(attendanceSummary[selected.idnumber] || 0)} /> / 486 Hours
                        </div>
                    
                    <label className="flex items-center gap-3 cursor-pointer select-none bg-gray-50 px-3 py-2 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                    <span className="text-sm text-gray-700 font-medium">Allow Evaluation</span>
                    <div className="relative">
                        <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={evaluationStatuses[selected.idnumber] || false}
                            onChange={() => handleToggleClick(selected.idnumber, evaluationStatuses[selected.idnumber] || false)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </div>
                </label>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative">
                <AttendanceChart 
                key={selected.idnumber}
                attendance={attendance} 
                selected={selected}
                activeStart={activeSessions[selected.idnumber]}
                now={now}
                overtimeShifts={overtimeShifts}
                />
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">Supervisor Evaluation</h3>
                        {evaluation ? (
                            <span className="text-xs font-semibold text-green-700 bg-green-100 border border-green-200 px-2 py-0.5 rounded-full">
                                Submitted
                            </span>
                        ) : (
                            <span className="text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                                {evaluationStatuses[selected.idnumber] ? "Awaiting Submission" : "Locked"}
                            </span>
                        )}
                    </div>
                    {evaluation && (
                        <div className="flex items-center gap-3">
                            {evaluation.overallScore !== undefined && (
                                 <div className="text-sm font-bold text-gray-900 bg-orange-50 px-2 py-1 rounded-lg border border-orange-100">
                                     Avg: {Number(evaluation.overallScore).toFixed(1)}%
                                 </div>
                             )}
                            <div className="text-xs text-gray-500">
                                {new Date(evaluation.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                    )}
                </div>
                <div className={`mt-2 p-4 rounded-xl border flex items-center justify-between gap-4 ${
                    evaluation 
                        ? "bg-green-50 border-green-100" 
                        : "bg-gray-50 border-gray-100"
                }`}>
                    <div className="flex items-center gap-3">
                         <div className={`p-2 rounded-lg ${
                             evaluation ? "bg-green-100 text-green-600" : "bg-white border border-gray-200 text-gray-500"
                         }`}>
                             {evaluation ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                         </div>
                         <div>
                             <div className={`text-sm font-bold ${
                                 evaluation ? "text-green-900" : "text-gray-900"
                             }`}>
                                 {evaluation ? "Evaluation Submitted" : "Supervisor has not evaluated yet"}
                             </div>
                             <div className={`text-xs ${
                                 evaluation ? "text-green-700" : "text-gray-500"
                             }`}>
                                 {evaluation 
                                    ? "Rubric scores and remarks are available." 
                                    : (evaluationStatuses[selected.idnumber] 
                                        ? "Waiting for supervisor submission." 
                                        : "Requirements not met.")}
                             </div>
                         </div>
                    </div>

                    <button
                        onClick={() => { if (evaluation) openEvaluationModal(); }}
                        disabled={!evaluation}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            evaluation 
                                ? "bg-white text-green-700 border border-green-200 hover:bg-green-50 shadow-sm" 
                                : "bg-gray-200 text-gray-400 cursor-not-allowed"
                        }`}
                    >
                        View Details
                    </button>
                </div>
            </div>

            {/* Lists Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Attendance Log */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col max-h-[60vh] lg:max-h-[500px]">
                <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">Approved Attendance</h3>
                        <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{attendance.filter(a => a.status === "Approved").length}</span>
                    </div>
                    <button 
                        onClick={openAttendanceModal}
                        className="text-[11px] font-semibold text-orange-600 hover:text-orange-700 px-3 py-1 rounded-lg hover:bg-orange-50 transition-colors"
                    >
                        View all
                    </button>
                </div>
                <div className="overflow-y-auto p-3 space-y-2 custom-scrollbar flex-1">
                    {attendance.filter(a => a.status === "Approved").slice().sort((a,b) => b.timestamp - a.timestamp).map((entry, idx) => (
                    <button 
                        key={idx} 
                        onClick={() => onViewAttendanceEntry(entry)}
                        className="w-full flex items-center gap-2 p-2 rounded-xl bg-gray-50 border border-gray-100 hover:border-orange-200 transition-colors text-left group"
                    >
                        <div className="h-8 w-8 rounded-md bg-gray-200 overflow-hidden flex-shrink-0 relative">
                        {entry.photoDataUrl ? (
                            <img src={entry.photoDataUrl} className="h-full w-full object-cover" alt="log" />
                        ) : (
                            <div className="flex items-center justify-center h-full w-full text-gray-400">
                                <Users size={16} />
                            </div>
                        )}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${entry.type === 'in' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                {entry.type.toUpperCase()}
                            </span>
                            <span className="text-[11px] text-gray-900 font-medium group-hover:text-orange-700 transition-colors">
                                {new Date(entry.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <div className="text-[11px] text-gray-600">
                                {new Date(entry.timestamp).toLocaleDateString()}
                              </div>
                              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
                                Approved by Supervisor
                              </div>
                            </div>
                        </div>
                    </button>
                    ))}
                    {attendance.filter(a => a.status === "Approved").length === 0 && <div className="text-center text-gray-400 text-sm py-8">No approved records</div>}
                </div>
                </div>

                {/* Reports */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col max-h-[500px]">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">Reports</h3>
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{reports.length}</span>
                    </div>
                    <button 
                        onClick={openReportsModal}
                        className="text-xs font-semibold text-orange-600 hover:text-orange-700 px-3 py-1 rounded-lg hover:bg-orange-50 transition-colors"
                    >
                        View all
                    </button>
                </div>
                <div className="overflow-y-auto p-4 space-y-3 custom-scrollbar flex-1">
                    {reports.map((r) => (
                    <div
                        key={r.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setViewingReport(r)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setViewingReport(r); }}
                        className="w-full text-left p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-orange-200 transition-colors group cursor-pointer"
                    >
                        <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-900 text-sm group-hover:text-orange-700 transition-colors">{r.title || "Untitled Report"}</h4>
                        <span className="text-xs text-gray-400">{new Date(r.submittedAt).toLocaleDateString()}</span>
                        </div>
                        {r.fileName ? (
                           <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 border border-orange-100 mb-2">
                              <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 flex-shrink-0">
                                 <FileText size={16} />
                              </div>
                              <div className="min-w-0">
                                 <div className="text-xs font-bold text-gray-900 truncate">{r.fileName}</div>
                                 <div className="text-[10px] text-gray-500">Attached Document</div>
                              </div>
                           </div>
                        ) : (
                           <p className="text-xs text-gray-600 line-clamp-2 mb-2">{r.body || "No content"}</p>
                        )}
                        <div className="flex items-center gap-2">
                            {r.instructorComment && (
                            <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                Feedback
                            </div>
                            )}
                        </div>
                    </div>
                    ))}
                    {reports.length === 0 && <div className="text-center text-gray-400 text-sm py-8">No reports submitted</div>}
                </div>
                </div>
            </div>

            {showEvalRestriction && selected && (
                <ConfirmationModal 
                    title="Requirements Not Met"
                    message="The student hasn't reached the requirements. Total validated time must be at least 486 hours. Do you still want to enable the evaluation for this student?"
                    confirmLabel="Yes, enable evaluation"
                    onCancel={() => setShowEvalRestriction(false)}
                    onConfirm={() => {
                        toggleEvaluation(selected.idnumber, evaluationStatuses[selected.idnumber] || false);
                        setShowEvalRestriction(false);
                    }}
                    variant="warning"
                />
            )}
        </>
    );
};

interface StudentsViewProps {
  students: User[];
  attendance: AttendanceEntry[];
  reports: ReportEntry[];
  recentAttendance: { idnumber: string; type: "in" | "out"; ts: number }[];
  recentReports: { id: number; idnumber: string; title: string; body: string; ts: number }[];
  myIdnumber: string;
  selected: User | null;
  setSelected: React.Dispatch<React.SetStateAction<User | null>>;
  viewingReport: ReportEntry | null;
  setViewingReport: React.Dispatch<React.SetStateAction<ReportEntry | null>>;
  setReports: React.Dispatch<React.SetStateAction<ReportEntry[]>>;
  isAttendanceModalOpen: boolean;
  setAttendanceModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isReportsModalOpen: boolean;
  setReportsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  evaluationStatuses: Record<string, boolean>;
  setEvaluationStatuses: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  activeSessions: Record<string, number>;
  attendanceSummary: Record<string, number>;
  evaluation: EvaluationDetail | null;
  onViewedChange?: () => void;
}

  const StudentAttendanceDetailView = ({ 
    student, 
    attendance, 
    overtimeShifts,
    scheduleConfig: globalScheduleConfig,
    onBack,
    evaluationStatuses,
    toggleEvaluation,
  }: { 
    student: User, 
    attendance: AttendanceEntry[], 
    overtimeShifts: { student_id: string; date: string; start: number; end: number }[],
    scheduleConfig: any,
    onBack: () => void,
    evaluationStatuses: Record<string, boolean>,
    toggleEvaluation: (id: string, current: boolean) => void,
  }) => {
    const [now] = useState(() => Date.now());
    const [monthFilter, setMonthFilter] = useState("");

    const monthOptions = useMemo(() => {
        const map = new Map<string, string>();
        attendance
          .filter(a => (a as any).idnumber === student.idnumber)
          .forEach(a => {
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
    }, [attendance, student.idnumber]);

    const filteredAttendance = useMemo(() => {
        if (!monthFilter) return attendance;
        return attendance.filter(a => {
          if ((a as any).idnumber !== student.idnumber) return false;
          const d = new Date(a.timestamp);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          return key === monthFilter;
        });
    }, [attendance, monthFilter, student.idnumber]);

    const statusCounts = useMemo(() => {
        const counts = { Pending: 0, Approved: 0, Rejected: 0 };
        filteredAttendance
          .filter(a => (a as any).idnumber === student.idnumber)
          .forEach(a => {
            const s = a.status || "Pending";
            if (s === "Approved") counts.Approved += 1;
            else if (s === "Rejected") counts.Rejected += 1;
            else counts.Pending += 1;
          });
        return counts;
    }, [filteredAttendance, student.idnumber]);

    // Helper to format hours
    const formatHours = (ms: number) => {
        if (!ms) return "0h 0m";
        const totalSeconds = Math.floor(ms / 1000);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        return `${h}h ${m}m`;
    };

    // Helper to format time
    const formatTime = (ts: number) => {
        return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    };

    const { days, overallTotal, overallValidated } = useMemo(() => {
        const studentLogs = filteredAttendance.filter(a => (a as any).idnumber === student.idnumber);

        const grouped = new Map<string, { date: Date; logs: AttendanceEntry[] }>();
        studentLogs.forEach(log => {
            const date = new Date(log.timestamp);
            const key = date.toLocaleDateString();
            if (!grouped.has(key)) grouped.set(key, { date, logs: [] });
            grouped.get(key)!.logs.push(log);
        });

        let totalMsAll = 0;
        let totalValidatedMsAll = 0;

        const processedDays = Array.from(grouped.values())
            .sort((a, b) => b.date.getTime() - a.date.getTime())
            .map(day => {
                const dayLogs = day.logs.sort((a, b) => a.timestamp - b.timestamp);

                const dayDate = new Date(day.date);
                dayDate.setHours(0, 0, 0, 0);
                const isToday = new Date().toDateString() === dayDate.toDateString();

                const buildShift = (timeStr: string) => {
                    const [h, m] = timeStr.split(":").map(Number);
                    const d = new Date(dayDate.getTime());
                    d.setHours(h || 0, m || 0, 0, 0);
                    return d.getTime();
                };

                // Use passed config or default
                const config = globalScheduleConfig || {
                    amIn: "08:00", amOut: "12:00",
                    pmIn: "13:00", pmOut: "17:00",
                    otIn: "17:00", otOut: "18:00"
                };

                let schedule = {
                    amIn: buildShift(config.amIn),
                    amOut: buildShift(config.amOut),
                    pmIn: buildShift(config.pmIn),
                    pmOut: buildShift(config.pmOut),
                    otStart: buildShift(config.otIn),
                    otEnd: buildShift(config.otOut),
                };
                
                // Dynamic OT check
                const dateStr = dayDate.getFullYear() + "-" + 
                              String(dayDate.getMonth() + 1).padStart(2, '0') + "-" + 
                              String(dayDate.getDate()).padStart(2, '0');
                const dynamicOt = overtimeShifts?.find(s => s.student_id === student.idnumber && s.date === dateStr);
                if (dynamicOt) {
                    schedule.otStart = dynamicOt.start;
                    schedule.otEnd = dynamicOt.end;
                }

                const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

                const computeShiftDuration = (
                    logs: AttendanceEntry[],
                    windowStart: number,
                    windowEnd: number,
                    requireApproved: boolean
                ) => {
                    let currentIn: number | null = null;
                    let duration = 0;
                    // 30 mins buffer for start, 12 hours for end (to allow late outs to close the shift)
                    const BUFFER_START_MS = 30 * 60 * 1000;
                    const BUFFER_END_MS = 12 * 60 * 60 * 1000;
                    const searchStart = windowStart - BUFFER_START_MS;
                    const searchEnd = windowEnd + BUFFER_END_MS;

                    logs.forEach(log => {
                        if (log.timestamp < searchStart || log.timestamp > searchEnd) return;
                        if (requireApproved) {
                             const status = String(log.status || "").toUpperCase();
                             const isApproved = status === "APPROVED" || status === "VALIDATED" || !!log.validatedBy;
                             if (!isApproved) return;
                        }
                        
                        // Floor to minute
                        const logTime = Math.floor(log.timestamp / 60000) * 60000;

                        if (log.type === "in") {
                            if (logTime > windowEnd) return;
                            // Clamp start
                            let effectiveIn = clamp(logTime, windowStart, windowEnd);
                            currentIn = effectiveIn;
                        } else if (log.type === "out") {
                            if (currentIn === null) return;
                            // Clamp end
                            let effectiveOut = clamp(logTime, windowStart, windowEnd);
                            if (effectiveOut > currentIn) {
                                duration += effectiveOut - currentIn;
                            }
                            currentIn = null;
                        }
                    });
                    
                    // Handle ongoing session for today
                    if (currentIn !== null && isToday) {
                         const nowFl = Math.floor(Date.now() / 60000) * 60000;
                         const effectiveOut = clamp(nowFl, windowStart, windowEnd);
                         if (effectiveOut > currentIn) {
                             duration += effectiveOut - currentIn;
                         }
                    }

                    return duration;
                };

                const regularLogs = dayLogs.filter(l => !l.is_overtime);
                const overtimeLogs = dayLogs.filter(l => l.is_overtime);

                const dayTotalAm = computeShiftDuration(regularLogs, schedule.amIn, schedule.amOut, false);
                const dayTotalPm = computeShiftDuration(regularLogs, schedule.pmIn, schedule.pmOut, false);
                const dayTotalOt = computeShiftDuration(overtimeLogs, schedule.otStart, schedule.otEnd, false);

                const dayValidatedAm = computeShiftDuration(regularLogs, schedule.amIn, schedule.amOut, true);
                const dayValidatedPm = computeShiftDuration(regularLogs, schedule.pmIn, schedule.pmOut, true);
                const dayValidatedOt = computeShiftDuration(overtimeLogs, schedule.otStart, schedule.otEnd, true);

                const dayTotalMs = dayTotalAm + dayTotalPm + dayTotalOt;
                const dayValidatedMs = dayValidatedAm + dayValidatedPm + dayValidatedOt;

                totalMsAll += dayTotalMs;
                totalValidatedMsAll += dayValidatedMs;

                // Smart Pairing Logic to handle late lunches and avoid duplicates
                const sortedRegular = [...regularLogs].sort((a, b) => a.timestamp - b.timestamp);
                const sortedOvertime = [...overtimeLogs].sort((a, b) => a.timestamp - b.timestamp);
                
                const noonCutoff = new Date(day.date).setHours(12, 30, 0, 0);

                // 1. Identify Start Points (INs) - Regular
                const s1 = sortedRegular.find(l => l.type === "in" && l.timestamp < noonCutoff) || null;
                const s3 = sortedRegular.find(l => l.type === "in" && l.timestamp >= noonCutoff) || null;
                
                // OT IN: First from overtime logs
                // Ensure we don't pick up the same timestamp as a regular log (if duplicate logs exist)
                const s5 = sortedOvertime.find(l => 
                    l.type === "in" && 
                    (!s1 || l.timestamp !== s1.timestamp) && 
                    (!s3 || l.timestamp !== s3.timestamp)
                ) || null;

                // 2. Identify End Points (OUTs) based on Pairs
                
                // s2 (AM OUT): Last regular OUT after s1 but before s3 (if s3 exists)
                let s2: AttendanceEntry | null = null;
                if (s1) {
                    const searchEnd = s3 ? s3.timestamp : (new Date(day.date).setHours(23, 59, 59, 999));
                    const candidates = sortedRegular.filter(l => l.type === "out" && l.timestamp > s1.timestamp && l.timestamp < searchEnd);
                    s2 = candidates.pop() || null;
                }

                // s4 (PM OUT): Last regular OUT after s3
                let s4: AttendanceEntry | null = null;
                if (s3) {
                    const candidates = sortedRegular.filter(l => l.type === "out" && l.timestamp > s3.timestamp);
                    s4 = candidates.pop() || null;
                }

                // s6 (OT OUT): Last OT OUT after s5
                let s6: AttendanceEntry | null = null;
                if (s5) {
                    const candidates = sortedOvertime.filter(l => 
                        l.type === "out" && 
                        l.timestamp > s5.timestamp &&
                        (!s2 || l.timestamp !== s2.timestamp) &&
                        (!s4 || l.timestamp !== s4.timestamp)
                    );
                    s6 = candidates.pop() || null;
                }

                const overtimeMs = dayTotalOt;

                return { date: day.date, s1, s2, s3, s4, s5, s6, dayTotalMs, overtimeMs, dayTotalMsScheduled: dayTotalMs };
            });

        return { days: processedDays, overallTotal: totalMsAll, overallValidated: totalValidatedMsAll };
    }, [student, filteredAttendance, now, globalScheduleConfig, overtimeShifts]);

    const [showEvalRestriction, setShowEvalRestriction] = useState(false);
    const [detailEvaluation, setDetailEvaluation] = useState<EvaluationDetail | null>(null);
    const [isDetailEvalModalOpen, setDetailEvalModalOpen] = useState(false);

    const handleToggleClick = () => {
        const current = evaluationStatuses[student.idnumber] || false;
        if (current) {
            toggleEvaluation(student.idnumber, current);
            return;
        }
        const hours = overallValidated / (1000 * 60 * 60);
        if (hours < 486) {
            setShowEvalRestriction(true);
        } else {
            toggleEvaluation(student.idnumber, current);
        }
    };

    useEffect(() => {
        if (!student?.idnumber) {
            setDetailEvaluation(null);
            return;
        }

        const fetchEval = async () => {
            try {
                const res = await fetch(`/api/evaluation?idnumber=${encodeURIComponent(student.idnumber)}`, { cache: "no-store" });
                const json = await res.json();
                if (res.ok && json.evaluation) {
                    const ev = json.evaluation;
                    const created = ev.createdAt ? Number(new Date(ev.createdAt).getTime()) : Date.now();
                    setDetailEvaluation({
                        createdAt: created,
                        supervisorId: ev.supervisorId,
                        comment: ev.comment || "",
                        interpretation: ev.interpretation || "",
                        criteria: ev.criteria || {},
                        overallScore: ev.overall
                    });
                } else {
                    setDetailEvaluation(null);
                }
            } catch {
                setDetailEvaluation(null);
            }
        };

        fetchEval();

        if (!supabase) return;
        const channel = supabase
            .channel(`evaluation_updates_detail_${student.idnumber}`)
            .on(
                'postgres_changes',
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'evaluation_forms',
                    filter: `student_id=eq.${student.idnumber}`
                },
                () => {
                    fetchEval();
                }
            )
            .subscribe();

        return () => {
            try { supabase?.removeChannel(channel); } catch {}
        };
    }, [student.idnumber]);

    return (
        <>
        <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <div className="flex items-center gap-4">
                <button 
                    onClick={onBack}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <ChevronLeft size={24} className="text-gray-600" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{student.lastname}, {student.firstname}</h1>
                    <p className="text-gray-500">{student.course} {student.section} • Attendance Detail</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-center justify-between shadow-sm">
                    <div>
                        <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Total Hours</p>
                        <p className="text-2xl font-bold text-blue-900">{formatHours(overallTotal)}</p>
                    </div>
                    <div className="p-2 bg-blue-100 rounded-xl">
                         <Clock className="text-blue-600" size={20} />
                    </div>
                </div>
                <div className="bg-green-50 p-4 rounded-2xl border border-green-100 flex items-center justify-between shadow-sm">
                    <div>
                        <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Total Validated Time</p>
                        <p className="text-2xl font-bold text-green-900">{formatHours(overallValidated)}</p>
                        <p className="text-[11px] text-gray-600 mt-1">Requirement: 486 hours validated</p>
                    </div>
                    <div className="p-2 bg-green-100 rounded-xl">
                        <ClipboardCheck className="text-green-600" size={20} />
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${detailEvaluation ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                        {detailEvaluation ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Supervisor Evaluation</p>
                        <p className={`text-sm font-bold ${detailEvaluation ? "text-green-900" : "text-gray-900"}`}>
                            {detailEvaluation ? "Evaluation Submitted" : "No evaluation yet"}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            {detailEvaluation
                                ? `Overall score: ${Number(detailEvaluation.overallScore ?? 0).toFixed(1)}% • ${new Date(detailEvaluation.createdAt).toLocaleDateString()}`
                                : evaluationStatuses[student.idnumber]
                                    ? "Waiting for supervisor to submit."
                                    : "Enable evaluation once requirements are met."}
                        </p>
                    </div>
                </div>
                <div className="flex flex-col items-stretch md:items-end gap-2">
                    <label className="flex items-center gap-3 cursor-pointer select-none bg-gray-50 px-3 py-2 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                        <span className="text-xs text-gray-700 font-medium">Allow Evaluation</span>
                        <div className="relative">
                            <input 
                                type="checkbox" 
                                className="sr-only peer"
                                checked={evaluationStatuses[student.idnumber] || false}
                                onChange={handleToggleClick}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                        </div>
                    </label>
                    <button
                        type="button"
                        onClick={() => { if (detailEvaluation) setDetailEvalModalOpen(true); }}
                        disabled={!detailEvaluation}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            detailEvaluation
                                ? "bg-white text-green-700 border border-green-200 hover:bg-green-50 shadow-sm"
                                : "bg-gray-200 text-gray-400 cursor-not-allowed"
                        }`}
                    >
                        View Evaluation Details
                    </button>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2 text-[11px]">
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
                <div className="w-full sm:w-40">
                    <select
                        value={monthFilter}
                        onChange={e => setMonthFilter(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-900 bg-white focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all"
                    >
                        <option value="">All months</option>
                        {monthOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
                            <tr>
                                <th rowSpan={2} className="px-6 py-4 border-r border-gray-100 min-w-[140px] align-middle">
                                    Date
                                </th>
                                <th colSpan={2} className="px-4 py-3 text-center border-r border-gray-100">
                                    Morning
                                </th>
                                <th colSpan={2} className="px-4 py-3 text-center border-r border-gray-100">
                                    Afternoon
                                </th>
                                <th colSpan={2} className="px-4 py-3 text-center border-r border-gray-100">
                                    Overtime
                                </th>
                                <th rowSpan={2} className="px-6 py-4 text-center align-middle">
                                    Total Hours
                                </th>
                            </tr>
                            <tr>
                                <th className="px-4 py-2 text-center border-r border-gray-100 min-w-[90px]">Time In</th>
                                <th className="px-4 py-2 text-center border-r border-gray-100 min-w-[90px]">Time Out</th>
                                <th className="px-4 py-2 text-center border-r border-gray-100 min-w-[90px]">Time In</th>
                                <th className="px-4 py-2 text-center border-r border-gray-100 min-w-[90px]">Time Out</th>
                                <th className="px-4 py-2 text-center border-r border-gray-100 min-w-[90px]">Time In</th>
                                <th className="px-4 py-2 text-center border-r border-gray-100 min-w-[90px]">Time Out</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {days.map((day, i) => (
                                <tr key={i} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap border-r border-gray-100">
                                        {day.date.toLocaleDateString(undefined, {
                                            weekday: "short",
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                        })}
                                    </td>
                                    {[day.s1, day.s2, day.s3, day.s4, day.s5, day.s6].map((slot, idx) => (
                                        <td
                                            key={idx}
                                            className="px-2 py-3 border-r border-gray-100 text-center align-top w-[12%]"
                                        >
                                            {slot ? (
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <span className="text-xs font-semibold text-gray-900">
                                                        {formatTime(slot.timestamp)}
                                                    </span>
                                                    <span
                                                        className={`text-[11px] font-semibold ${
                                                            slot.status === "Approved"
                                                                ? "text-green-600"
                                                                : slot.status === "Rejected"
                                                                ? "text-red-600"
                                                                : "text-yellow-600"
                                                        }`}
                                                    >
                                                        {slot.status === "Approved"
                                                            ? "Validated"
                                                            : slot.status === "Rejected"
                                                            ? "Unvalidated"
                                                            : "Pending"}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-300 block py-4">-</span>
                                            )}
                                        </td>
                                    ))}
                                    <td className="px-6 py-4 text-center font-bold text-gray-900 whitespace-nowrap">
                                        {formatHours(day.dayTotalMs)}
                                    </td>
                                </tr>
                            ))}
                            {days.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                                        No attendance records found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        {showEvalRestriction && (
            <ConfirmationModal 
                title="Requirements Not Met"
                message="The student hasn't reached the requirements. Total validated time must be at least 486 hours. Do you still want to enable the evaluation for this student?"
                confirmLabel="Yes, enable evaluation"
                onCancel={() => setShowEvalRestriction(false)}
                onConfirm={() => {
                    toggleEvaluation(student.idnumber, evaluationStatuses[student.idnumber] || false);
                    setShowEvalRestriction(false);
                }}
                variant="warning"
            />
        )}
        {isDetailEvalModalOpen && detailEvaluation && (
            <Modal onClose={() => setDetailEvalModalOpen(false)}>
                <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between mr-8">
                        <h3 className="text-lg font-bold text-gray-900">Supervisor Evaluation</h3>
                        <span className="text-xs text-gray-500">{new Date(detailEvaluation.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="text-sm text-gray-600">For {student.firstname} {student.lastname}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-orange-50 border border-orange-100">
                            <div className="text-xs font-semibold text-orange-700 uppercase tracking-wider mb-2">General Average</div>
                            <div className="text-3xl font-bold text-gray-900">{detailEvaluation.overallScore !== undefined ? `${Number(detailEvaluation.overallScore).toFixed(1)}%` : "—"}</div>
                        </div>
                        <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Grade Interpretation</div>
                            <div className="text-lg font-medium text-gray-900">{detailEvaluation.interpretation || "—"}</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                            { id: "quantity_of_work", title: "Quantity of Work", items: [
                                { id: "quantity_volume", label: "Considers volume of assignment completed on time" },
                                { id: "quantity_replace", label: "Willing to replace an absent trainee if needed" },
                            ]},
                            { id: "quality_of_work", title: "Quality of Work", items: [
                                { id: "quality_serious", label: "Serious and accurate" },
                                { id: "quality_housekeeping", label: "Follows good housekeeping without prompting" },
                            ]},
                            { id: "job_competence", title: "Job Competence", items: [
                                { id: "competence_knowledge", label: "Knowledge and skills required of the job" },
                            ]},
                            { id: "dependability", title: "Dependability", items: [
                                { id: "depend_follow", label: "Reliability in following instructions" },
                                { id: "depend_trust", label: "Can be depended upon when things go wrong" },
                            ]},
                            { id: "initiative", title: "Initiative", items: [
                                { id: "init_help", label: "Performs helpful tasks beyond responsibility" },
                                { id: "init_volunteer", label: "Volunteers to do the job when needed" },
                            ]},
                            { id: "cooperative", title: "Cooperative", items: [
                                { id: "coop_trainee", label: "Gets along with co-trainees" },
                                { id: "coop_superior", label: "Gets along with superiors" },
                                { id: "coop_owner", label: "Gets along with owners/managers" },
                            ]},
                            { id: "loyalty", title: "Loyalty", items: [
                                { id: "loyal_protect", label: "Protects the company" },
                                { id: "loyal_trust", label: "Can be trusted" },
                                { id: "loyal_policy", label: "Follows company policies/objectives" },
                            ]},
                            { id: "judgment", title: "Judgment", items: [
                                { id: "judge_grasp", label: "Ability to grasp problems and follow instructions" },
                                { id: "judge_decide", label: "Knows how to decide when needed" },
                            ]},
                            { id: "attendance", title: "Attendance", items: [
                                { id: "attend_regular", label: "Regular work schedule; leaves taken properly" },
                                { id: "attend_punctual", label: "Always punctual; does not come in late" },
                            ]},
                            { id: "customer_service", title: "Customer Service", items: [
                                { id: "cs_practice", label: "Practices good customer service" },
                                { id: "cs_never_argue", label: "Never argues with customer" },
                                { id: "cs_greet", label: "Greets customers" },
                            ]},
                        ].map(cat => (
                            <div key={cat.id} className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
                                <div className="text-sm font-bold text-gray-900 mb-2">{cat.title}</div>
                                <div className="space-y-3">
                                    {cat.items.map(item => (
                                        <div key={item.id} className="flex items-center justify-between">
                                            <div className="text-xs text-gray-600">{item.label}</div>
                                            <div className="text-sm font-semibold text-gray-900">{detailEvaluation.criteria[item.id] ?? "—"}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Comments / Remarks</div>
                        <div className="text-sm text-gray-900">{detailEvaluation.comment || "—"}</div>
                    </div>
                    <div className="flex justify-end">
                        <button
                            onClick={() => setDetailEvalModalOpen(false)}
                            className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </Modal>
        )}
        </>
    );
  };



  const AttendanceMonitoringView = ({
    students,
    attendance,
    onNavigateToApproval,
    attendanceSummary,
    evaluationStatuses,
    toggleEvaluation,
    overtimeShifts,
  }: {
    students: User[];
    attendance: AttendanceEntry[];
    onNavigateToApproval: () => void;
    attendanceSummary: Record<string, number>;
    evaluationStatuses: Record<string, boolean>;
    toggleEvaluation: (id: string, current: boolean) => void;
    overtimeShifts: { student_id: string; date: string; start: number; end: number }[];
  }) => {

    // 1. Calculate available weeks dynamically based on attendance data
    const availableWeeks = useMemo(() => {
        let startTs: number;
        let numWeeks = 1;

        if (attendance.length > 0) {
            // Find earliest and latest timestamp safely
            const minTs = attendance.reduce((min, p) => p.timestamp < min ? p.timestamp : min, attendance[0].timestamp);
            const maxTs = attendance.reduce((max, p) => p.timestamp > max ? p.timestamp : max, attendance[0].timestamp);
            
            // Start of Week 1 (Monday of minTs)
            const date = new Date(minTs);
            const day = date.getDay() || 7; // 1=Mon...7=Sun
            const monday = new Date(date);
            monday.setHours(0, 0, 0, 0);
            monday.setDate(date.getDate() - day + 1);
            startTs = monday.getTime();

            // Calculate number of weeks needed to cover maxTs
            const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
            // Ensure maxTs is included in the range. 
            // If maxTs is exactly on the start of next week, it falls into next week.
            // (maxTs - startTs) / oneWeekMs gives the index of the week (0-based)
            const weeksDiff = Math.floor((maxTs - startTs) / oneWeekMs);
            numWeeks = weeksDiff + 1;
        } else {
            // Fallback: Use current week if no data exists
            const now = new Date();
            const day = now.getDay() || 7;
            const monday = new Date(now);
            monday.setHours(0, 0, 0, 0);
            monday.setDate(now.getDate() - day + 1);
            startTs = monday.getTime();
            numWeeks = 1;
        }
            
        return Array.from({ length: numWeeks }, (_, i) => {
            const weekStart = startTs + i * 7 * 24 * 60 * 60 * 1000;
            return {
                id: i + 1,
                startTs: weekStart,
                endTs: weekStart + 7 * 24 * 60 * 60 * 1000,
                label: `${i + 1}`
            };
        });
    }, [attendance]);

    // 2. Initialize selectedWeekStart
    const [selectedWeekStart, setSelectedWeekStart] = useState<number>(() => {
        // Default to current week
        const now = new Date();
        const day = now.getDay() || 7;
        const monday = new Date(now);
        monday.setHours(0, 0, 0, 0);
        monday.setDate(now.getDate() - day + 1);
        return monday.getTime();
    });

    // Ensure selection is valid
    useEffect(() => {
        if (availableWeeks.length > 0) {
            const isSelectedValid = availableWeeks.some(w => w.startTs === selectedWeekStart);
            if (!isSelectedValid) {
                // If current selection is invalid, try to select the week containing "now", or default to Week 1
                const now = Date.now();
                const currentWeek = availableWeeks.find(w => now >= w.startTs && now < w.endTs);
                if (currentWeek) {
                    setSelectedWeekStart(currentWeek.startTs);
                } else {
                    setSelectedWeekStart(availableWeeks[0].startTs);
                }
            }
        }
    }, [availableWeeks, selectedWeekStart]);

    const [selectedStudentDetail, setSelectedStudentDetail] = useState<User | null>(null);
    const [selected, setSelected] = useState<User | null>(null);
    const [filterCourse, setFilterCourse] = useState("");
    const [filterSection, setFilterSection] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(id);
    }, []);

    const [scheduleConfig, setScheduleConfig] = useState<{
        amIn: string; amOut: string;
        pmIn: string; pmOut: string;
        otIn: string; otOut: string;
    } | null>(null);

    useEffect(() => {
        const fetchSchedule = async () => {
            try {
                const res = await fetch('/api/shifts');
                const data = await res.json();
                if (data.shifts) {
                    const config = {
                        amIn: "07:00", amOut: "11:00",
                        pmIn: "13:00", pmOut: "17:00",
                        otIn: "17:00", otOut: "18:00"
                    };
                    data.shifts.forEach((s: any) => {
                        if (s.shift_name === "Morning Shift") {
                            config.amIn = s.official_start;
                            config.amOut = s.official_end;
                        } else if (s.shift_name === "Afternoon Shift") {
                            config.pmIn = s.official_start;
                            config.pmOut = s.official_end;
                        } else if (s.shift_name === "Overtime Shift") {
                            config.otIn = s.official_start;
                            config.otOut = s.official_end;
                        }
                    });
                    setScheduleConfig(config);
                }
            } catch (e) {
                console.error("Failed to fetch schedule", e);
            }
        };
        fetchSchedule();
    }, []);

    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const weekEnd = selectedWeekStart + weekMs;

    // Filter students
    const pendingCount = useMemo(() => {
        return students.filter(s => (s.signup_status || 'APPROVED') !== 'APPROVED').length;
    }, [students]);

    const uniqueCourses = useMemo(() => Array.from(new Set(students.map(s => s.course).filter(Boolean))).sort(), [students]);
    
    // Derived sections based on selected course
    const availableSections = useMemo(() => {
        let relevantStudents = students;
        if (filterCourse) {
            relevantStudents = students.filter(s => s.course === filterCourse);
        }
        return Array.from(new Set(relevantStudents.map(s => s.section).filter(Boolean))).sort();
    }, [students, filterCourse]);

    const filteredStudents = useMemo(() => {
        return students.filter(s => {
            const matchesSearch = !searchTerm || 
                (s.firstname?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                 s.lastname?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                 s.idnumber.includes(searchTerm));
            const matchesCourse = !filterCourse || s.course === filterCourse;
            const matchesSection = !filterSection || s.section === filterSection;
            const isApproved = (s.signup_status || 'APPROVED') === 'APPROVED';
            return matchesSearch && matchesCourse && matchesSection && isApproved;
        }).sort((a, b) => (a.lastname || "").localeCompare(b.lastname || ""));
    }, [students, searchTerm, filterCourse, filterSection]);

    // Reset section if course changes
    useEffect(() => {
        if (filterCourse && !availableSections.includes(filterSection)) {
            setFilterSection("");
        }
    }, [filterCourse, availableSections, filterSection]);

    const studentHours = useMemo(() => {
        const map = new Map<string, number[]>();
        const currentNow = now;

        filteredStudents.forEach(s => {
            const logs = attendance
                .filter(a => 
                    (a as any).idnumber === s.idnumber && 
                    a.timestamp >= selectedWeekStart && 
                    a.timestamp < weekEnd
                )
                .sort((a, b) => a.timestamp - b.timestamp);

            const days = [0, 0, 0, 0, 0, 0, 0];

            if (logs.length === 0) {
                map.set(s.idnumber, days);
                return;
            }

            const grouped = new Map<string, { date: Date; logs: AttendanceEntry[] }>();
            logs.forEach(log => {
                const d = new Date(log.timestamp);
                const key = d.toLocaleDateString();
                if (!grouped.has(key)) grouped.set(key, { date: d, logs: [] });
                grouped.get(key)!.logs.push(log);
            });

            grouped.forEach(day => {
                const dayLogs = day.logs.slice().sort((a, b) => a.timestamp - b.timestamp);

                const baseDate = new Date(day.date);
                baseDate.setHours(0, 0, 0, 0);

                const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

                const buildShift = (timeStr: string) => {
                    const [h, m] = timeStr.split(":").map(Number);
                    const d = new Date(baseDate.getTime());
                    d.setHours(h || 0, m || 0, 0, 0);
                    return d.getTime();
                };

                let schedule: {
                    amIn: number; amOut: number;
                    pmIn: number; pmOut: number;
                    otStart: number; otEnd: number;
                };

                if (scheduleConfig) {
                    schedule = {
                        amIn: buildShift(scheduleConfig.amIn),
                        amOut: buildShift(scheduleConfig.amOut),
                        pmIn: buildShift(scheduleConfig.pmIn),
                        pmOut: buildShift(scheduleConfig.pmOut),
                        otStart: buildShift(scheduleConfig.otIn),
                        otEnd: buildShift(scheduleConfig.otOut),
                    };
                } else {
                    schedule = {
                        amIn: buildShift("08:00"),
                        amOut: buildShift("12:00"),
                        pmIn: buildShift("13:00"),
                        pmOut: buildShift("17:00"),
                        otStart: buildShift("17:00"),
                        otEnd: buildShift("18:00"),
                    };
                }

                const regularLogs = dayLogs.filter(l => !l.is_overtime);
                const overtimeLogs = dayLogs.filter(l => l.is_overtime);

                const computeShiftDuration = (
                    entries: AttendanceEntry[],
                    windowStart: number,
                    windowEnd: number,
                    requireApproved: boolean
                ) => {
                    let currentIn: number | null = null;
                    let duration = 0;
                    // 30 mins buffer for start, 12 hours for end (clamped)
                    const BUFFER_START_MS = 30 * 60 * 1000;
                    const BUFFER_END_MS = 12 * 60 * 60 * 1000;
                    const searchStart = windowStart - BUFFER_START_MS;
                    const searchEnd = windowEnd + BUFFER_END_MS;

                    entries.forEach(log => {
                        if (log.timestamp < searchStart || log.timestamp > searchEnd) return;
                        if (requireApproved && log.status !== "Approved") {
                            return;
                        }
                        if (log.type === "in") {
                            if (log.timestamp > windowEnd) return;
                            let effectiveIn = clamp(log.timestamp, windowStart, windowEnd);
                            effectiveIn = Math.floor(effectiveIn / 60000) * 60000;
                            currentIn = effectiveIn;
                        } else if (log.type === "out") {
                            if (currentIn === null) return;
                            let effectiveOut = clamp(log.timestamp, windowStart, windowEnd);
                            effectiveOut = Math.floor(effectiveOut / 60000) * 60000;
                            if (effectiveOut > currentIn) {
                                duration += effectiveOut - currentIn;
                            }
                            currentIn = null;
                        }
                    });

                    if (currentIn !== null) {
                        // Live calculation removed to enforce strict pairing
                    }

                    // Uniform rounding: Floor to nearest minute
                    return Math.floor(duration / 60000) * 60000;
                };

                const computeOtDuration = (logs: AttendanceEntry[]) => {
                    let duration = 0;
                    let currentIn: number | null = null;
                    const sorted = [...logs].sort((a,b) => a.timestamp - b.timestamp);
                    
                    sorted.forEach(log => {
                        if (log.type === "in") {
                            currentIn = Math.floor(log.timestamp / 60000) * 60000;
                        } else if (log.type === "out") {
                            if (currentIn !== null) {
                                const effectiveOut = Math.floor(log.timestamp / 60000) * 60000;
                                if (effectiveOut > currentIn) {
                                    duration += effectiveOut - currentIn;
                                }
                                currentIn = null;
                            }
                        }
                    });
                    return duration;
                };

                const dayTotalMs =
                    computeShiftDuration(regularLogs, schedule.amIn, schedule.amOut, false) +
                    computeShiftDuration(regularLogs, schedule.pmIn, schedule.pmOut, false) +
                    computeOtDuration(overtimeLogs);

                let dayIdx = day.date.getDay() - 1;
                if (dayIdx === -1) dayIdx = 6;
                if (dayIdx >= 0 && dayIdx <= 6) {
                    days[dayIdx] += dayTotalMs;
                }
            });

            map.set(s.idnumber, days);
        });

        return map;
    }, [filteredStudents, attendance, selectedWeekStart, weekEnd, now, scheduleConfig]);

    const formatHours = (ms: number) => {
        if (!ms) return "-";
        const totalSeconds = Math.floor(ms / 1000);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        return `${h}h ${m}m`;
    };

    const weekNumber = useMemo(() => {
        const d = new Date(selectedWeekStart);
        return Math.ceil(d.getDate() / 7);
    }, [selectedWeekStart]);

    const dayLabels = useMemo(() => {
        const start = new Date(selectedWeekStart);
        start.setHours(0, 0, 0, 0);
        return Array.from({ length: 7 }, (_, index) => {
            const d = new Date(start);
            d.setDate(start.getDate() + index);
            const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
            const month = d.toLocaleDateString(undefined, { month: "short" });
            const day = d.getDate();
            return { weekday, date: `${month} ${day}` };
        });
    }, [selectedWeekStart]);

    const handlePrint = () => {
        window.print();
    };

    if (selectedStudentDetail) {
        return (
            <StudentAttendanceDetailView 
                student={selectedStudentDetail}
                attendance={attendance}
                overtimeShifts={overtimeShifts}
                scheduleConfig={scheduleConfig}
                onBack={() => setSelectedStudentDetail(null)}
                evaluationStatuses={evaluationStatuses}
                toggleEvaluation={toggleEvaluation}
            />
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header / Controls */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden">
                <div />

                <div className="flex items-center gap-2">
                    <button 
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors shadow-sm"
                    >
                        <FileText size={18} />
                        <span>Print / PDF</span>
                    </button>
                </div>
            </div>

            {/* Compact Toolbar */}
            <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-3 print:hidden">
                 {/* Top Row: Filters */}
                 <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                     <div className="flex items-center gap-2 w-full md:w-auto">
                         <select 
                             value={filterCourse}
                             onChange={e => setFilterCourse(e.target.value)}
                             className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-gray-50 hover:bg-white transition-all cursor-pointer min-w-[140px]"
                         >
                             <option value="">Course</option>
                             {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
                         </select>
                         <select 
                             value={filterSection}
                             onChange={e => setFilterSection(e.target.value)}
                             disabled={!filterCourse}
                             className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-gray-50 hover:bg-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
                         >
                             <option value="">Section</option>
                             {availableSections.map(s => <option key={s} value={s}>{s}</option>)}
                         </select>
                     </div>

                     <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input 
                            type="text" 
                            placeholder="Filter by name..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-900 placeholder-gray-500 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm"
                        />
                    </div>
                 </div>

                 <div className="h-px w-full bg-gray-100" />

                 {/* Bottom Row: Week Navigation */}
                 <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2 overflow-x-auto w-full pb-1 sm:pb-0 custom-scrollbar">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap mr-2">Select Week:</span>
                        
                        {availableWeeks.length === 0 ? (
                            <span className="text-sm text-gray-400 italic">No attendance data yet</span>
                        ) : (
                            <>
                                {availableWeeks.length === 0 ? (
                                <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200">
                                    <Clock size={16} className="text-amber-500" />
                                    <span className="text-sm font-medium text-amber-700">Waiting for first attendance log...</span>
                                </div>
                            ) : (
                                <>
                                    {(() => {
                                        const currentIndex = availableWeeks.findIndex(w => w.startTs === selectedWeekStart);
                                        const maxPage = Math.ceil(availableWeeks.length / 8);
                                        const currentPage = Math.floor(currentIndex / 8);
                                        const startIdx = currentPage * 8;
                                        const visibleWeeks = availableWeeks.slice(startIdx, startIdx + 8);

                                        return (
                                            <div className="flex items-center gap-1">
                                                <button 
                                                    onClick={() => {
                                                        const prevPageStartIdx = Math.max(0, startIdx - 8);
                                                        if (prevPageStartIdx !== startIdx) {
                                                            setSelectedWeekStart(availableWeeks[prevPageStartIdx].startTs);
                                                        }
                                                    }}
                                                    disabled={currentPage === 0}
                                                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                                                >
                                                    <ChevronLeft size={16} />
                                                </button>

                                                {visibleWeeks.map((week) => {
                                                    const isSelected = week.startTs === selectedWeekStart;
                                                    return (
                                                        <button
                                                            key={week.id}
                                                            onClick={() => setSelectedWeekStart(week.startTs)}
                                                            className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
                                                                isSelected
                                                                    ? "bg-gray-900 text-white shadow-md" 
                                                                    : "bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-200"
                                                            }`}
                                                        >
                                                            {week.label}
                                                        </button>
                                                    );
                                                })}

                                                <button 
                                                    onClick={() => {
                                                        const nextPageStartIdx = Math.min((maxPage - 1) * 8, startIdx + 8);
                                                        if (nextPageStartIdx < availableWeeks.length && nextPageStartIdx !== startIdx) {
                                                            setSelectedWeekStart(availableWeeks[nextPageStartIdx].startTs);
                                                        }
                                                    }}
                                                    disabled={currentPage >= maxPage - 1}
                                                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                                                >
                                                    <ChevronRight size={16} />
                                                </button>
                                            </div>
                                        );
                                    })()}
                                </>
                            )}
                            </>
                        )}
                    </div>

                    {/* Display Selected Week Date Range */}
                    {availableWeeks.length > 0 && (
                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 whitespace-nowrap">
                             <Clock size={14} className="text-gray-400" />
                             <span className="text-xs font-semibold text-gray-700">
                                 {new Date(selectedWeekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {new Date(selectedWeekStart + 6 * 24 * 60 * 60 * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                             </span>
                        </div>
                    )}
                 </div>
            </div>



            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-900 font-bold border-b border-gray-200 print:bg-gray-100">
                            <tr>
                                <th className="px-4 py-3 border-r border-gray-200 min-w-[200px]">Name</th>
                                {dayLabels.map((item, index) => (
                                    <th key={index} className="px-2 py-3 text-center border-r border-gray-200 min-w-[90px] align-middle">
                                        <div className="flex flex-col items-center gap-0.5">
                                            <span className="text-sm font-bold text-gray-900 leading-tight">{item.weekday}</span>
                                            <span className="text-sm font-bold text-gray-900 leading-tight whitespace-nowrap">{item.date}</span>
                                        </div>
                                    </th>
                                ))}
                                <th className="px-4 py-3 text-center min-w-[100px]">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 border-b border-gray-200">
                            {filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                                        No active students found
                                        {pendingCount > 0 && (
                                            <div className="mt-2 text-sm">
                                                You have {pendingCount} pending student{pendingCount !== 1 ? 's' : ''}.{' '}
                                                <button 
                                                    onClick={onNavigateToApproval}
                                                    className="text-orange-600 font-bold hover:underline"
                                                >
                                                    Go to Approvals
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                filteredStudents.map(s => {
                                    const hours = studentHours.get(s.idnumber) || [0,0,0,0,0,0,0];
                                    const total = hours.reduce((a, b) => a + b, 0);

                                    const baseMs = attendanceSummary[s.idnumber] || 0;
                                    const totalHours = Math.floor(baseMs / (1000 * 60 * 60));

                                    return (
                                        <tr key={s.idnumber} className="hover:bg-gray-50 print:hover:bg-transparent group">
                                            <td 
                                                className="px-4 py-3 font-medium text-gray-900 border-r border-gray-100 print:border-gray-300 cursor-pointer group-hover:text-orange-600 transition-colors"
                                                onClick={() => setSelectedStudentDetail(s)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="font-bold text-sm text-gray-900">
                                                        {s.lastname}, {s.firstname}
                                                    </div>
                                                </div>
                                            </td>
                                            {hours.map((h, i) => (
                                                <td key={i} className="px-2 py-3 text-center text-gray-600 border-r border-gray-100 print:border-gray-300 whitespace-nowrap">
                                                    {formatHours(h)}
                                                </td>
                                            ))}
                                            <td className="px-4 py-3 text-center font-bold text-gray-900 whitespace-nowrap">
                                                {formatHours(total)}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <style jsx global>{`
                @media print {
                    @page { size: landscape; margin: 1cm; }
                    body * { visibility: hidden; }
                    .animate-in { animation: none !important; }
                    .print\\:hidden { display: none !important; }
                    .print\\:shadow-none { box-shadow: none !important; }
                    .print\\:border-none { border: none !important; }
                    .print\\:bg-transparent { background: transparent !important; }
                    .print\\:border-gray-300 { border-color: #d1d5db !important; }
                    .print\\:bg-gray-100 { background-color: #f3f4f6 !important; }
                    
                    /* Show only the container and its children */
                    .space-y-6, .space-y-6 * {
                        visibility: visible;
                    }
                    .space-y-6 {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                }
            `}</style>
        </div>
    );
  };

  const StudentsView = ({
    students,
  attendance,
  reports,
  recentAttendance,
  recentReports,
  myIdnumber,
  selected,
  setSelected,
  viewingReport,
  setViewingReport,
  setReports,
  isAttendanceModalOpen,
  setAttendanceModalOpen,
  isReportsModalOpen,
  setReportsModalOpen,
  evaluationStatuses,
  setEvaluationStatuses,
  activeSessions,
  attendanceSummary,
  evaluation,
  onViewedChange
}: StudentsViewProps) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCourse, setFilterCourse] = useState("");
    const [filterSection, setFilterSection] = useState("");
    const [filterCompany, setFilterCompany] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [commentText, setCommentText] = useState("");
    const [isSavingComment, setIsSavingComment] = useState(false);
    const [viewedVersion, setViewedVersion] = useState(0);
    
    // View All Modal State
    const [attendanceSearchTerm, setAttendanceSearchTerm] = useState("");
    const [attendanceDateFilter, setAttendanceDateFilter] = useState("");
    const [reportsSearchTerm, setReportsSearchTerm] = useState("");
    const [reportsDateFilter, setReportsDateFilter] = useState("");
    const [selectedAttendanceEntry, setSelectedAttendanceEntry] = useState<AttendanceEntry | null>(null);
    const [isEvaluationModalOpen, setEvaluationModalOpen] = useState(false);
    const detailsRef = useRef<HTMLDivElement>(null);

    // Persistent Broadcast Channel
    const [broadcastChannel, setBroadcastChannel] = useState<RealtimeChannel | null>(null);

    useEffect(() => {
        if (selected && window.innerWidth < 1024) {
             setTimeout(() => {
                 detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
             }, 100);
        }
    }, [selected]);

    useEffect(() => {
        if (!supabase) return;
        const ch = supabase
          .channel('global-evaluation-updates')
          .on(
            'broadcast',
            { event: 'toggle' },
            (payload: any) => {
              const data = payload?.payload || {};
              const idnumber = data.idnumber;
              const enabled = data.enabled;
              if (!idnumber) return;
              const key = String(idnumber).trim();
              setEvaluationStatuses(prev => ({
                ...prev,
                [key]: !!enabled
              }));
            }
          )
          .subscribe();
        setBroadcastChannel(ch);
        return () => { try { supabase?.removeChannel(ch); } catch {} };
    }, []);

    

    const filteredAttendance = useMemo(() => {
        let result = attendance;
        if (attendanceDateFilter) {
            result = result.filter(a => new Date(a.timestamp).toLocaleDateString() === new Date(attendanceDateFilter).toLocaleDateString());
        }
        if (attendanceSearchTerm) {
            const q = attendanceSearchTerm.toLowerCase();
            result = result.filter(a => {
                const typeStr = a.type === "in" ? "time in" : "time out";
                const dateStr = new Date(a.timestamp).toLocaleString().toLowerCase();
                return typeStr.includes(q) || dateStr.includes(q);
            });
        }
        return result.filter(a => a.status === "Approved");
    }, [attendance, attendanceDateFilter, attendanceSearchTerm]);

    const filteredReports = useMemo(() => {
        let result = reports;
        if (reportsDateFilter) {
            result = result.filter(r => new Date(r.submittedAt).toLocaleDateString() === new Date(reportsDateFilter).toLocaleDateString());
        }
        if (reportsSearchTerm) {
            const q = reportsSearchTerm.toLowerCase();
            result = result.filter(r => {
                return (r.title || "").toLowerCase().includes(q) || (r.body || "").toLowerCase().includes(q);
            });
        }
        return result;
    }, [reports, reportsDateFilter, reportsSearchTerm]);

    const uniqueCourses = useMemo(() => Array.from(new Set(students.map(s => s.course).filter((c): c is string => !!c))).sort(), [students]);
    
    const uniqueSections = useMemo(() => {
        const subset = filterCourse ? students.filter(s => s.course === filterCourse) : students;
        return Array.from(new Set(subset.map(s => s.section).filter((s): s is string => !!s))).sort();
    }, [students, filterCourse]);

    const uniqueCompanies = useMemo(() => {
        const subset = students.filter(s => 
          (!filterCourse || s.course === filterCourse) && 
          (!filterSection || s.section === filterSection)
        );
        return Array.from(new Set(subset.map(s => s.company).filter((c): c is string => !!c))).sort();
    }, [students, filterCourse, filterSection]);

    const uniqueStatuses = ["In Progress", "Ready for Evaluation", "Evaluation Enabled"];
    
    useEffect(() => {
        if (viewingReport) {
            setCommentText(viewingReport.instructorComment || "");
        }
    }, [viewingReport]);

    const handleSaveComment = async () => {
        if (!viewingReport) return;
        setIsSavingComment(true);
        try {
            const res = await fetch("/api/reports", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    id: viewingReport.id, 
                    instructorComment: commentText,
                    instructorId: myIdnumber 
                })
            });
            if (res.ok) {
                // Update local state immediately (Realtime will also catch it, but this is faster feedback)
                setReports(prev => prev.map(r => r.id === viewingReport.id ? { ...r, instructorComment: commentText } : r));
                setViewingReport(null); // Close modal
            } else {
                alert("Failed to save comment");
            }
        } catch (e) {
            console.error(e);
            alert("Error saving comment");
        } finally {
            setIsSavingComment(false);
        }
    };

    const toggleEvaluation = async (idnumber: string, current: boolean) => {
      try {
          const res = await fetch("/api/evaluation-status", {
              method: "POST",
              headers: {"Content-Type": "application/json"},
              body: JSON.stringify({ idnumber, enabled: !current })
          });
          
          if(res.ok) {
              setEvaluationStatuses(prev => ({...prev, [idnumber]: !current}));
              
              if (broadcastChannel) {
                   broadcastChannel.send({
                       type: 'broadcast',
                       event: 'toggle',
                       payload: { idnumber, enabled: !current }
                   });
              }
          } else {
            console.error("Failed to toggle evaluation");
          }
      } catch(e) { console.error(e); }
    };

    const filteredList = students.filter(s => {
      const baseMs = attendanceSummary[s.idnumber] || 0;
      const hours = Math.floor(baseMs / (1000 * 60 * 60));
      const isReady = hours >= 486;
      const isEvalEnabled = evaluationStatuses[s.idnumber];
      const status = isEvalEnabled ? "Evaluation Enabled" : (isReady ? "Ready for Evaluation" : "In Progress");

      return (
        `${s.firstname} ${s.lastname} ${s.idnumber}`.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (!filterCourse || s.course === filterCourse) &&
        (!filterSection || s.section === filterSection) &&
        (!filterCompany || s.company === filterCompany) &&
        (!filterStatus || status === filterStatus)
      );
    });

    const getLastViewedTs = (key: string) => {
      try { return Number(localStorage.getItem(key) || "0"); } catch { return 0; }
    };
    const markViewedNow = (category: "att" | "rep" | "eval", id?: string) => {
      if (!id) return;
      try { localStorage.setItem(`instructorViewed:${category}:${id}`, String(Date.now())); } catch {}
      setViewedVersion(v => v + 1);
      if (onViewedChange) onViewedChange();
    };

    return (
      <div className="flex flex-col gap-4 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Students</h1>
            <p className="text-gray-500">Monitor attendance and reports.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* List */}
          <div className="lg:col-span-4 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden h-auto max-h-[500px] lg:h-[calc(100vh-200px)] lg:max-h-none">
            <div className="p-4 border-b border-gray-100 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700" size={18} />
                <input 
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-300 text-sm text-black placeholder-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                  <select 
                      value={filterCourse} 
                      onChange={e => { setFilterCourse(e.target.value); setFilterSection(""); }}
                      className="w-full p-2 rounded-xl border border-gray-300 text-sm bg-white text-black focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm"
                  >
                      <option value="">Course</option>
                      {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select 
                      value={filterSection} 
                      onChange={e => setFilterSection(e.target.value)}
                      className="w-full p-2 rounded-xl border border-gray-300 text-sm bg-white text-black focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm"
                  >
                      <option value="">Section</option>
                      {uniqueSections.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select 
                      value={filterCompany} 
                      onChange={e => setFilterCompany(e.target.value)}
                      className="w-full p-2 rounded-xl border border-gray-300 text-sm bg-white text-black focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm"
                  >
                      <option value="">Company</option>
                      {uniqueCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select 
                      value={filterStatus} 
                      onChange={e => setFilterStatus(e.target.value)}
                      className="w-full p-2 rounded-xl border border-gray-300 text-sm bg-white text-black focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm"
                  >
                      <option value="">Status</option>
                      {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
              </div>
            </div>
            <div className="p-2 space-y-1 flex-1 overflow-y-auto custom-scrollbar">
              {filteredList.map(s => {
                const isActive = selected?.idnumber === s.idnumber;
                const baseMs = attendanceSummary[s.idnumber] || 0;
                const activeStart = activeSessions[s.idnumber];
                const hours = Math.floor(baseMs / (1000 * 60 * 60));
                const isReady = hours >= 486;
                const isEvalEnabled = evaluationStatuses[s.idnumber];
                const status = isEvalEnabled ? "Evaluation Enabled" : (isReady ? "Ready for Evaluation" : "In Progress");

                const attViewedTs = getLastViewedTs(`instructorViewed:att:${s.idnumber}`);
                const repViewedTs = getLastViewedTs(`instructorViewed:rep:${s.idnumber}`);
                const attCount = recentAttendance.filter(e => e.idnumber === s.idnumber && e.ts > attViewedTs).length;
                const repCount = recentReports.filter(r => r.idnumber === s.idnumber && r.ts > repViewedTs).length;

                return (
                  <button
                    key={s.idnumber}
                    onClick={() => { markViewedNow("att", s.idnumber); markViewedNow("rep", s.idnumber); setSelected(prev => (prev?.idnumber === s.idnumber ? null : s)); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all border ${
                      isActive 
                        ? "bg-orange-50 border-orange-200 ring-1 ring-orange-200" 
                        : (isReady 
                            ? "bg-green-50 border-green-200 hover:bg-green-100" 
                            : "bg-white border-transparent hover:bg-gray-50")
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm relative ${
                      isActive ? "bg-orange-100 text-orange-600" : (isReady ? "bg-green-100 text-green-700" : "bg-orange-50 text-orange-600")
                    }`}>
                      {(s.firstname?.[0] || s.idnumber?.[0] || "?").toUpperCase()}
                      {isEvalEnabled && (
                        <span className="absolute -bottom-1 -right-1 h-3 w-3 bg-blue-500 rounded-full border-2 border-white" title="Evaluation Enabled" />
                      )}
                      {(attCount + repCount) > 0 && (
                        <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border bg-red-50 text-red-700 border-red-200 shadow-sm z-10">
                          {(attCount + repCount) > 9 ? "9+" : (attCount + repCount)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className={`text-sm font-semibold truncate ${isActive ? "text-gray-900" : "text-gray-700"}`}>
                        {s.firstname} {s.lastname}
                      </div>
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-gray-500 truncate">
                              {s.course}
                              {s.company && <span className="text-gray-600"> â€¢ {s.company}</span>}
                            </div>
                            <div className={`text-xs font-bold ${isReady ? "text-green-600" : "text-gray-600"}`}>
                               <LiveTotal baseMs={baseMs} activeStart={activeStart} />
                            </div>
                         </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-400" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Details */}
          <div ref={detailsRef} className="lg:col-span-8 flex flex-col gap-6">
            <StudentDetailsPanel 
              selected={selected}
              attendance={attendance}
              reports={reports}
              attendanceSummary={attendanceSummary}
              activeSessions={activeSessions}
              evaluationStatuses={evaluationStatuses}
              toggleEvaluation={toggleEvaluation}
              setViewingReport={(r) => { if (selected?.idnumber) markViewedNow("rep", selected.idnumber); setViewingReport(r); }}
              openAttendanceModal={() => { if (selected?.idnumber) markViewedNow("att", selected.idnumber); setAttendanceModalOpen(true); }}
              openReportsModal={() => { if (selected?.idnumber) markViewedNow("rep", selected.idnumber); setReportsModalOpen(true); }}
              onViewAttendanceEntry={setSelectedAttendanceEntry}
              evaluation={evaluation}
              openEvaluationModal={() => { if (selected?.idnumber) { markViewedNow("att", selected.idnumber); markViewedNow("rep", selected.idnumber); } setEvaluationModalOpen(true); }}
            />
          </div>
        </div>

        {/* Report Viewing Modal */}
        {viewingReport && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">{viewingReport.title || "Untitled Report"}</h3>
                            <p className="text-sm text-gray-500 mt-1">Submitted on {new Date(viewingReport.submittedAt).toLocaleDateString()} at {new Date(viewingReport.submittedAt).toLocaleTimeString()}</p>
                        </div>
                        <button onClick={() => setViewingReport(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {viewingReport.body || <span className="text-gray-400 italic">No content provided.</span>}
                        </div>

                        {viewingReport.fileName && (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-orange-50 border border-orange-100">
                            <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                                <FileText size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">{viewingReport.fileName}</div>
                                <div className="text-xs text-gray-500 uppercase">{viewingReport.fileType?.split('/')[1] || 'FILE'}</div>
                            </div>
                            <a 
                                href={viewingReport.fileUrl || "#"} 
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                    viewingReport.fileUrl 
                                    ? "text-orange-700 bg-orange-100 hover:bg-orange-200" 
                                    : "text-gray-400 bg-gray-100 cursor-not-allowed"
                                }`}
                                onClick={(e) => !viewingReport.fileUrl && e.preventDefault()}
                            >
                                Download
                            </a>
                        </div>
                        )}

                        <div className="border-t border-gray-100 pt-6">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                                </div>
                                <label className="text-sm font-bold text-gray-900">Instructor Feedback</label>
                            </div>
                            {viewingReport.instructorComment && viewingReport.instructorComment.trim().length > 0 ? (
                              <div className="p-4 rounded-xl border border-blue-100 bg-blue-50 text-sm text-gray-800 whitespace-pre-wrap">
                                {viewingReport.instructorComment}
                              </div>
                            ) : (
                              <>
                                <textarea
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    placeholder="Write your feedback here... The student will see this."
                                    className="w-full h-48 p-4 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none transition-all text-base text-gray-900 placeholder:text-gray-500 shadow-inner"
                                />
                                <div className="mt-2 text-sm text-gray-600 flex justify-between font-medium">
                                    <span>Visible to student immediately after saving.</span>
                                </div>
                              </>
                            )}
                        </div>
                    </div>

                    <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                        <button 
                            onClick={() => setViewingReport(null)}
                            className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200/50 rounded-xl transition-colors"
                        >
                            Close
                        </button>
                        {!viewingReport.instructorComment || viewingReport.instructorComment.trim().length === 0 ? (
                          <button 
                              onClick={handleSaveComment}
                              disabled={isSavingComment}
                              className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                          >
                              {isSavingComment ? "Saving..." : "Save Comment"}
                          </button>
                        ) : null}
                    </div>
                </div>
            </div>
        )}
        
        {/* Attendance: View All Modal */}
        {isAttendanceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md md:max-w-2xl lg:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">All Attendance Logs</h3>
                    <p className="text-xs text-gray-500 mt-1">{selected?.firstname} {selected?.lastname} â€¢ {selected?.idnumber}</p>
                  </div>
                  <button onClick={() => { setAttendanceModalOpen(false); setAttendanceSearchTerm(""); setAttendanceDateFilter(""); }} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X size={20} className="text-gray-500" />
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="w-full sm:w-auto flex-1">
                        <label className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-1 block">Search</label>
                        <input 
                            type="text" 
                            placeholder="Search time in/out..." 
                            value={attendanceSearchTerm}
                            onChange={(e) => setAttendanceSearchTerm(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                        />
                    </div>
                    <div className="w-full sm:w-auto">
                        <label className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-1 block">Filter by Date</label>
                        <input 
                            type="date" 
                            value={attendanceDateFilter}
                            onChange={(e) => setAttendanceDateFilter(e.target.value)}
                            className="w-full sm:w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                        />
                    </div>
                    {(attendanceSearchTerm || attendanceDateFilter) && (
                        <div className="flex items-end">
                            <button 
                                onClick={() => { setAttendanceSearchTerm(""); setAttendanceDateFilter(""); }}
                                className="mb-[1px] px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                Clear
                            </button>
                        </div>
                    )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {filteredAttendance.length === 0 ? (
                  <div className="p-6 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500 text-sm">No attendance records found</div>
                ) : (
                  filteredAttendance.slice().sort((a,b) => b.timestamp - a.timestamp).map((entry, idx) => (
                    <button 
                        key={`${entry.timestamp}-${idx}`} 
                        onClick={() => setSelectedAttendanceEntry(entry)}
                        className="w-full flex items-center gap-2 p-2 rounded-xl bg-gray-50 border border-gray-100 hover:border-orange-200 hover:bg-orange-50/50 transition-all text-left group"
                    >
                      <div className="h-8 w-8 rounded-md bg-gray-200 overflow-hidden flex-shrink-0 relative">
                        {entry.photoDataUrl ? (
                            <img src={entry.photoDataUrl} className="h-full w-full object-cover" alt="log" />
                        ) : (
                            <div className="flex items-center justify-center h-full w-full text-gray-400">
                                <Users size={16} />
                            </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${entry.type === 'in' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            {entry.type.toUpperCase()}
                          </span>
                          <span className="text-[11px] text-gray-900 font-medium group-hover:text-orange-700 transition-colors">
                            {new Date(entry.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reports: View All Modal */}
        {isReportsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">All Reports</h3>
                    <p className="text-sm text-gray-500 mt-1">{selected?.firstname} {selected?.lastname} â€¢ {selected?.idnumber}</p>
                  </div>
                  <button onClick={() => { setReportsModalOpen(false); setReportsSearchTerm(""); setReportsDateFilter(""); }} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X size={20} className="text-gray-500" />
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="w-full sm:w-auto flex-1">
                        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1 block">Search</label>
                        <input 
                            type="text" 
                            placeholder="Search reports..." 
                            value={reportsSearchTerm}
                            onChange={(e) => setReportsSearchTerm(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 bg-white placeholder:text-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                        />
                    </div>
                    <div className="w-full sm:w-auto">
                        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1 block">Filter by Date</label>
                        <input 
                            type="date" 
                            value={reportsDateFilter}
                            onChange={(e) => setReportsDateFilter(e.target.value)}
                            className="w-full sm:w-48 rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                        />
                    </div>
                    {(reportsSearchTerm || reportsDateFilter) && (
                        <div className="flex items-end">
                            <button 
                                onClick={() => { setReportsSearchTerm(""); setReportsDateFilter(""); }}
                                className="mb-[1px] px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                Clear
                            </button>
                        </div>
                    )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {filteredReports.length === 0 ? (
                  <div className="p-6 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500 text-sm">No reports found</div>
                ) : (
                  filteredReports.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => { setViewingReport(r); setReportsModalOpen(false); }}
                      className="w-full text-left p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-orange-200 transition-colors group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-900 text-sm group-hover:text-orange-700 transition-colors">{r.title || "Untitled Report"}</h4>
                        <span className="text-xs text-gray-900 font-medium">{new Date(r.submittedAt).toLocaleDateString()}</span>
                      </div>
                      {r.fileName ? (
                         <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 border border-orange-100 mb-2">
                            <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 flex-shrink-0">
                               <FileText size={16} />
                            </div>
                            <div className="min-w-0">
                               <div className="text-xs font-bold text-gray-900 truncate">{r.fileName}</div>
                               <div className="text-[10px] text-gray-500">Attached Document</div>
                            </div>
                         </div>
                      ) : (
                         <p className="text-xs text-gray-600 line-clamp-2 mb-2">{r.body || "No content"}</p>
                      )}
                      <div className="flex items-center gap-2">
                        {r.instructorComment && (
                          <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            Feedback
                          </div>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
        {/* Attendance Details Modal */}
        {selectedAttendanceEntry && (
            <AttendanceDetailsModal
                entry={selectedAttendanceEntry}
                onClose={() => setSelectedAttendanceEntry(null)}
                userName={selected ? `${selected.firstname} ${selected.lastname}` : undefined}
            />
        )}
        {isEvaluationModalOpen && evaluation && selected && (
          <Modal onClose={() => setEvaluationModalOpen(false)}>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between mr-8">
                <h3 className="text-lg font-bold text-gray-900">Supervisor Evaluation</h3>
                <span className="text-xs text-gray-500">{new Date(evaluation.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="text-sm text-gray-600">For {selected.firstname} {selected.lastname}</div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-orange-50 border border-orange-100">
                     <div className="text-xs font-semibold text-orange-700 uppercase tracking-wider mb-2">General Average</div>
                     <div className="text-3xl font-bold text-gray-900">{evaluation.overallScore !== undefined ? `${Number(evaluation.overallScore).toFixed(1)}%` : "—"}</div>
                 </div>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Grade Interpretation</div>
                    <div className="text-lg font-medium text-gray-900">{evaluation.interpretation || "—"}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: "quantity_of_work", title: "Quantity of Work", items: [
                    { id: "quantity_volume", label: "Considers volume of assignment completed on time" },
                    { id: "quantity_replace", label: "Willing to replace an absent trainee if needed" },
                  ]},
                  { id: "quality_of_work", title: "Quality of Work", items: [
                    { id: "quality_serious", label: "Serious and accurate" },
                    { id: "quality_housekeeping", label: "Follows good housekeeping without prompting" },
                  ]},
                  { id: "job_competence", title: "Job Competence", items: [
                    { id: "competence_knowledge", label: "Knowledge and skills required of the job" },
                  ]},
                  { id: "dependability", title: "Dependability", items: [
                    { id: "depend_follow", label: "Reliability in following instructions" },
                    { id: "depend_trust", label: "Can be depended upon when things go wrong" },
                  ]},
                  { id: "initiative", title: "Initiative", items: [
                    { id: "init_help", label: "Performs helpful tasks beyond responsibility" },
                    { id: "init_volunteer", label: "Volunteers to do the job when needed" },
                  ]},
                  { id: "cooperative", title: "Cooperative", items: [
                    { id: "coop_trainee", label: "Gets along with co-trainees" },
                    { id: "coop_superior", label: "Gets along with superiors" },
                    { id: "coop_owner", label: "Gets along with owners/managers" },
                  ]},
                  { id: "loyalty", title: "Loyalty", items: [
                    { id: "loyal_protect", label: "Protects the company" },
                    { id: "loyal_trust", label: "Can be trusted" },
                    { id: "loyal_policy", label: "Follows company policies/objectives" },
                  ]},
                  { id: "judgment", title: "Judgment", items: [
                    { id: "judge_grasp", label: "Ability to grasp problems and follow instructions" },
                    { id: "judge_decide", label: "Knows how to decide when needed" },
                  ]},
                  { id: "attendance", title: "Attendance", items: [
                    { id: "attend_regular", label: "Regular work schedule; leaves taken properly" },
                    { id: "attend_punctual", label: "Always punctual; does not come in late" },
                  ]},
                  { id: "customer_service", title: "Customer Service", items: [
                    { id: "cs_practice", label: "Practices good customer service" },
                    { id: "cs_never_argue", label: "Never argues with customer" },
                    { id: "cs_greet", label: "Greets customers" },
                  ]},
                ].map(cat => (
                  <div key={cat.id} className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
                    <div className="text-sm font-bold text-gray-900 mb-2">{cat.title}</div>
                    <div className="space-y-3">
                      {cat.items.map(item => (
                        <div key={item.id} className="flex items-center justify-between">
                          <div className="text-xs text-gray-600">{item.label}</div>
                          <div className="text-sm font-semibold text-gray-900">{evaluation.criteria[item.id] ?? "—"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Comments / Remarks</div>
                <div className="text-sm text-gray-900">{evaluation.comment || "—"}</div>
              </div>
              <div className="flex justify-end">
                <button onClick={() => setEvaluationModalOpen(false)} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-200 transition-colors">Close</button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
};

// --- Main Page Component ---

export default function InstructorPage() {
  const router = useRouter();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === "accepted") {
          setDeferredPrompt(null);
        }
      });
    }
  };

  const [activeTab, setActiveTab] = useState<TabId>("attendance");
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [viewingReport, setViewingReport] = useState<ReportEntry | null>(null);
  const [isAttendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [isReportsModalOpen, setReportsModalOpen] = useState(false);
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      localStorage.clear();
    } catch (e) {
      console.error("Logout failed", e);
    }
    router.replace("/");
  };
  
  // Data State
  const [students, setStudents] = useState<User[]>([]);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [selected, setSelected] = useState<User | null>(null);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [attendanceSummary, setAttendanceSummary] = useState<Record<string, number>>({});
  const [activeSessions, setActiveSessions] = useState<Record<string, number>>({});
  const [serverSummary, setServerSummary] = useState<Record<string, number>>({});
  const [overtimeShifts, setOvertimeShifts] = useState<{ student_id: string; date: string; start: number; end: number }[]>([]);
  const [evaluationStatuses, setEvaluationStatuses] = useState<Record<string, boolean>>({});
  const [allowApproval, setAllowApproval] = useState<boolean>(true);
  const [broadcastChannel, setBroadcastChannel] = useState<RealtimeChannel | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<{ idnumber: string; type: "in" | "out"; ts: number }[]>([]);
  const [recentReports, setRecentReports] = useState<{ id: number; idnumber: string; title: string; body: string; ts: number }[]>([]);
  const [evaluation, setEvaluation] = useState<EvaluationDetail | null>(null);
  // Removed unused badge counts
  const [submittedEvaluationsCount, setSubmittedEvaluationsCount] = useState(0);
  const [badgeVersion, setBadgeVersion] = useState(0);

  // Remove global 1s ticker to prevent entire page re-rendering

  // Metadata & Modals
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [availableSections, setAvailableSections] = useState<Section[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [scheduleConfig, setScheduleConfig] = useState<{
    amIn: string; amOut: string;
    pmIn: string; pmOut: string;
    otIn: string; otOut: string;
  } | null>(null);

  useEffect(() => {
    const fetchSchedule = async () => {
        try {
            const res = await fetch('/api/shifts');
            const data = await res.json();
            if (data.shifts) {
                const config = {
                    amIn: "07:00", amOut: "11:00",
                    pmIn: "13:00", pmOut: "17:00",
                    otIn: "17:00", otOut: "18:00"
                };
                data.shifts.forEach((s: any) => {
                    if (s.shift_name === "Morning Shift") {
                        config.amIn = s.official_start;
                        config.amOut = s.official_end;
                    } else if (s.shift_name === "Afternoon Shift") {
                        config.pmIn = s.official_start;
                        config.pmOut = s.official_end;
                    } else if (s.shift_name === "Overtime Shift") {
                        config.otIn = s.official_start;
                        config.otOut = s.official_end;
                    }
                });
                setScheduleConfig(config);
            }
        } catch (e) {
            console.error("Failed to fetch schedule", e);
        }
    };
    fetchSchedule();
  }, []);

  // User Info
  const myIdnumber = useMemo(() => {
    if (typeof window === "undefined") return "";
    try { return localStorage.getItem("idnumber") || ""; } catch { return ""; }
  }, []);
  const [myProfile, setMyProfile] = useState<User | null>(null);

  const toggleEvaluation = async (idnumber: string, current: boolean) => {
    try {
      const res = await fetch("/api/evaluation-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idnumber, enabled: !current }),
      });
      if (res.ok) {
        setEvaluationStatuses(prev => ({ ...prev, [idnumber]: !current }));
        if (broadcastChannel) {
          broadcastChannel.send({
            type: 'broadcast',
            event: 'toggle',
            payload: { idnumber, enabled: !current }
          });
        }
      } else {
        console.error("Failed to toggle evaluation");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // --- Effects ---

  // Fetch Students & Profile
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/users", { cache: "no-store" });
        const json = await res.json();
        if (Array.isArray(json.users)) {
          const me = (json.users as User[]).find(u => String(u.idnumber) === String(myIdnumber) && String(u.role).toLowerCase() === "instructor");
          setMyProfile(me || null);

          const normalize = (s?: string) => (s || "").split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
          const myCourses = normalize(me?.course);
          const mySections = normalize(me?.section);

          const filtered = (json.users as User[]).filter(u => {
            if (String(u.role).toLowerCase() !== "student") return false;
            
            const uCourses = normalize(u.course);
            const uSections = normalize(u.section);

            // If instructor has specific courses, match against them
            const courseMatch = myCourses.length === 0 || myCourses.some(c => uCourses.includes(c));
            
            // If instructor has specific sections, match against them
            const sectionMatch = mySections.length === 0 || mySections.some(s => uSections.includes(s));

            return courseMatch && sectionMatch;
          });
          
          const sups = (json.users as User[]).filter(u => String(u.role).toLowerCase() === "supervisor");
          setSupervisors(sups);

          // Attach supervisor info (company/location) to students
          const studentsWithSupervisorInfo = filtered.map(student => {
            if (student.supervisorid) {
              const supervisor = sups.find(s => String(s.id) === String(student.supervisorid));
              if (supervisor) {
                return {
                  ...student,
                  company: supervisor.company,
                  location: supervisor.location
                };
              }
            }
            return student;
          });
          
          setStudents(studentsWithSupervisorInfo);
        }
      } catch {}
    })();
  }, [myIdnumber, refreshTrigger]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/metadata");
        const data = await res.json();
        if (data.courses) setAvailableCourses(data.courses);
        if (data.sections) setAvailableSections(data.sections);
      } catch {}
    })();
  }, []);

  // Fetch Attendance Summary and Evaluation Statuses
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/attendance/summary", { cache: "no-store" });
        const json = await res.json();
        if (json.activeSessions) setActiveSessions(json.activeSessions);
        if (json.summary) setServerSummary(json.summary);
        if (Array.isArray(json.overtimeShifts)) setOvertimeShifts(json.overtimeShifts);
        if (Array.isArray(json.recentAttendance)) {
          setRecentAttendance(json.recentAttendance.map((e: { idnumber: string; type: "in" | "out"; ts: number }) => ({ idnumber: e.idnumber, type: e.type, ts: Number(e.ts) })));
        }
        if (Array.isArray(json.recentReports)) {
          setRecentReports(json.recentReports.map((r: { id: number; idnumber: string; title: string; body: string; ts: number }) => ({ id: r.id, idnumber: r.idnumber, title: r.title, body: r.body, ts: Number(r.ts) })));
        }
      } catch {}
    })();
    (async () => {
      try {
        const res = await fetch("/api/evaluation-status");
        const json = await res.json();
        if (Array.isArray(json.statuses)) {
            const map: Record<string, boolean> = {};
            json.statuses.forEach((s: { idnumber: string; enabled: boolean }) => { map[s.idnumber] = s.enabled; });
            setEvaluationStatuses(map);
        }
      } catch {}
    })();
    (async () => {
      if (!myIdnumber) return;
      try {
        const res = await fetch("/api/instructor-approval-status");
        const json = await res.json();
        if (Array.isArray(json.statuses)) {
          const map: Record<string, boolean> = {};
          json.statuses.forEach((s: { idnumber: string; allowed: boolean }) => {
            if (s && s.idnumber) {
              map[s.idnumber] = s.allowed ?? true;
            }
          });
          if (Object.prototype.hasOwnProperty.call(map, myIdnumber)) {
            setAllowApproval(map[myIdnumber]);
          } else {
            setAllowApproval(true);
          }
        }
      } catch {}
    })();
  }, [refreshTrigger]);

  const fetchBadgeCounts = async () => {
    try {
      const ids = students.map(s => s.idnumber).filter(Boolean);
      if (!supabase || ids.length === 0) {
        setSubmittedEvaluationsCount(0);
        return;
      }
      const { data: evals } = await supabase
        .from('evaluation_forms')
        .select('id, student_id, created_at')
        .in('student_id', ids);
      const viewedTsById: Record<string, number> = {};
      ids.forEach(id => { viewedTsById[id] = getLastViewedTs(`instructorViewed:eval:${id}`); });
      const unseenCount = (evals || []).filter((e: { student_id: string; created_at?: string }) => {
        const sid = String(e.student_id);
        const created = e.created_at ? Number(new Date(e.created_at).getTime()) : 0;
        return created > (viewedTsById[sid] || 0);
      }).length;
      setSubmittedEvaluationsCount(unseenCount);
    } catch {
      setSubmittedEvaluationsCount(0);
    }
  };

  useEffect(() => {
    fetchBadgeCounts();
  }, [students]);

  // Visibility Change Listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Instructor] App foregrounded, refreshing data...');
        setRefreshTrigger(prev => prev + 1);
        fetchBadgeCounts();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, []);

  const getLastViewedTs = (key: string) => {
    try { return Number(localStorage.getItem(key) || "0"); } catch { return 0; }
  };

  const combinedBadgeCount = useMemo(() => {
    let count = submittedEvaluationsCount;
    // Attendance
    if (recentAttendance && recentAttendance.length > 0) {
      count += recentAttendance.filter(a => {
        const lastViewed = getLastViewedTs(`instructorViewed:att:${a.idnumber}`);
        return a.ts > lastViewed;
      }).length;
    }
    // Reports
    if (recentReports && recentReports.length > 0) {
      count += recentReports.filter(r => {
        const lastViewed = getLastViewedTs(`instructorViewed:rep:${r.idnumber}`);
        return r.ts > lastViewed;
      }).length;
    }
    return count;
  }, [submittedEvaluationsCount, recentAttendance, recentReports, badgeVersion]);

  useEffect(() => {
    // Removed attendance and reports badge listeners as requested
  }, []);
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel('instructor_global_attendance_summary')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
        setRefreshTrigger(prev => prev + 1);
      })
      .subscribe();
    return () => {
      try { supabase?.removeChannel(ch); } catch {}
    };
  }, []);
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel('instructor_global_reports_summary')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        setRefreshTrigger(prev => prev + 1);
      })
      .subscribe();
    return () => {
      try { supabase?.removeChannel(ch); } catch {}
    };
  }, []);

  // Realtime Evaluation Status
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel('global-evaluation-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'evaluation_status' }, (payload: RealtimePostgresChangesPayload<{ idnumber: string, enabled: boolean }>) => {
        const row = payload.new as { idnumber: string, enabled: boolean } | null;
        if (row && row.idnumber) {
          setEvaluationStatuses(prev => ({ ...prev, [row.idnumber]: row.enabled }));
        }
      })
      .on('broadcast', { event: 'toggle' }, (payload) => {
        const { idnumber, enabled } = payload.payload;
        if (idnumber) {
          setEvaluationStatuses(prev => ({ ...prev, [String(idnumber).trim()]: enabled }));
        }
      })
      .subscribe();
    setBroadcastChannel(ch);
    return () => {
      try { supabase?.removeChannel(ch); } catch {}
    };
  }, []);

  useEffect(() => {
    if (!supabase || !myIdnumber) return;
    const ch = supabase
      .channel('global-instructor-approval-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'instructor_approval_status' },
        (payload: RealtimePostgresChangesPayload<{ idnumber: string; allowed: boolean }>) => {
          const row = payload.new as { idnumber: string; allowed: boolean } | null;
          if (row && String(row.idnumber) === String(myIdnumber)) {
            setAllowApproval(row.allowed ?? true);
          }
        }
      )
      .subscribe();
    return () => {
      try { supabase?.removeChannel(ch); } catch {}
    };
  }, [myIdnumber]);

  // Responsive Check
  useEffect(() => {
    const update = () => {
      try {
        const mobile = window.matchMedia("(max-width: 1024px)").matches;
        setIsMobile(mobile);
        if (mobile) setSidebarOpen(false);
        else setSidebarOpen(true);
      } catch {}
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Fetch Attendance (Global, for all students)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/attendance?limit=1000`);
        const json = await res.json();
        if (res.ok && Array.isArray(json.entries)) {
          const mapped = json.entries.map((e: ServerAttendanceEntry) => {
            const sStr = String(e.status || "").trim().toLowerCase();
            const isRejected = sStr === "rejected";
            const isApproved = sStr === "approved" || (!!e.validated_by && !isRejected);
            return {
              idnumber: e.idnumber,
              type: e.type,
              timestamp: e.ts,
              photoDataUrl: e.photourl,
              status: isRejected ? "Rejected" : isApproved ? "Approved" : "Pending",
              validatedAt: e.validated_at ? Number(new Date(e.validated_at).getTime()) : undefined,
              validatedBy: e.validated_by || undefined,
              is_overtime: e.is_overtime
            };
          }) as AttendanceEntry[];
          setAttendance(mapped);
        } else {
          setAttendance([]);
        }
      } catch {
        setAttendance([]);
      }
    })();
  }, [refreshTrigger]);

  useEffect(() => {
    const nextSummary: Record<string, number> = { ...serverSummary };
    const nowTs = Date.now();

    const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

    const calculateOngoing = (start: number, studentId: string) => {
        const d = new Date(start);
        const dayDate = new Date(d);
        dayDate.setHours(0,0,0,0);

        const makeTime = (t: string) => {
            const [h, m] = t.split(":").map(Number);
            const ts = new Date(dayDate);
            ts.setHours(h, m, 0, 0);
            return ts.getTime();
        };

        const config = scheduleConfig || {
             amIn: "07:00", amOut: "11:00",
             pmIn: "13:00", pmOut: "17:00",
             otIn: "17:00", otOut: "18:00"
        };

        const amIn = makeTime(config.amIn);
        const amOut = makeTime(config.amOut);
        const pmIn = makeTime(config.pmIn);
        const pmOut = makeTime(config.pmOut);
        
        // Dynamic OT Lookup
        const dateStr = dayDate.toLocaleDateString('en-CA');
        const otShift = overtimeShifts.find(s => s.student_id === studentId && s.date === dateStr);
        
        let otIn, otOut;
        if (otShift) {
             otIn = otShift.start;
             otOut = otShift.end;
        } else {
             otIn = makeTime(config.otIn);
             otOut = makeTime(config.otOut);
        }
        
        const floorToMin = (ms: number) => Math.floor(ms / 60000) * 60000;
        const startFl = floorToMin(start);
        const nowFl = floorToMin(nowTs);

        const BUFFER_START_MS = 30 * 60 * 1000;
        const BUFFER_END_MS = 4 * 60 * 60 * 1000;
        
        const calcWindow = (wS: number, wE: number) => {
             if (start < wS - BUFFER_START_MS || start > wE + BUFFER_END_MS) return 0;
             const inT = clamp(startFl, wS, wE);
             const outT = clamp(nowFl, wS, wE);
             if (outT > inT) return outT - inT;
             return 0;
        };

        let dur = 0;
        dur += calcWindow(amIn, amOut);
        dur += calcWindow(pmIn, pmOut);
        dur += calcWindow(otIn, otOut);

        return dur;
    };

    Object.keys(activeSessions).forEach(id => {
       const start = activeSessions[id];
       if (start) {
          const ongoing = calculateOngoing(start, id);
          nextSummary[id] = (nextSummary[id] || 0) + ongoing;
       }
    });

    setAttendanceSummary(nextSummary);
  }, [serverSummary, activeSessions, scheduleConfig, overtimeShifts]);

  // Realtime Attendance subscription removed - relying on global attendance refreshTrigger
  // which updates whenever any attendance record changes (insert/update/delete)
  // causing the fetch effect above to re-run and get the latest correct state.
  /*
  useEffect(() => {
    if (!supabase || !selected?.idnumber) return;
    const ch = supabase
      .channel(`instructor_attendance_${selected.idnumber}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance', filter: `idnumber=eq.${selected.idnumber}` }, (payload: RealtimePostgresChangesPayload<{ id: number; idnumber: string; type: "in" | "out"; ts: number; photourl: string }>) => {
        const row = payload.new;
        if (!row) return;
        setAttendance(prev => {
          const next = [...prev, { type: row.type, timestamp: Number(row.ts), photoDataUrl: row.photourl }];
          return next;
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attendance', filter: `idnumber=eq.${selected.idnumber}` }, () => {
        setAttendance(prev => [...prev]);
      })
      .subscribe();
    return () => {
      try { supabase.removeChannel(ch); } catch {}
    };
  }, [selected?.idnumber]);
  */

  // Fetch Reports (Selected)
  useEffect(() => {
    (async () => {
      if (!selected?.idnumber) { setReports([]); return; }
      try {
        const res = await fetch(`/api/reports?idnumber=${encodeURIComponent(selected.idnumber)}`);
        const json = await res.json();
        if (res.ok) {
          const incomingReports: ApiReport[] = Array.isArray(json.reports) ? json.reports : [];
          const onlySubmitted: ReportEntry[] = incomingReports
            .filter(r => r.status !== "draft")
            .map((r) => ({
              id: r.id,
              title: r.title,
              body: r.body,
              fileName: r.fileName,
              fileType: r.fileType,
              fileUrl: r.fileUrl,
              submittedAt: Number(r.submittedAt),
              instructorComment: r.instructorComment || undefined,
            }))
            .sort((a, b) => b.submittedAt - a.submittedAt);
          setReports(onlySubmitted);
        } else {
          setReports([]);
        }
      } catch {
        setReports([]);
      }
    })();
  }, [selected]);

  // Fetch Evaluation (Selected) & Realtime Updates
  useEffect(() => {
    if (!selected?.idnumber) { 
      setEvaluation(null); 
      return; 
    }

    const fetchEval = async () => {
      try {
        const res = await fetch(`/api/evaluation?idnumber=${encodeURIComponent(selected.idnumber)}`, { cache: "no-store" });
        const json = await res.json();
        if (res.ok && json.evaluation) {
          const ev = json.evaluation;
          const created = ev.createdAt ? Number(new Date(ev.createdAt).getTime()) : Date.now();
          setEvaluation({
            createdAt: created,
            supervisorId: ev.supervisorId,
            comment: ev.comment || "",
            interpretation: ev.interpretation || "",
            criteria: ev.criteria || {},
            overallScore: ev.overall
          });
        } else {
          setEvaluation(null);
        }
      } catch {
        setEvaluation(null);
      }
    };

    // Initial Fetch
    fetchEval();

    // Realtime Subscription
    if (!supabase) return;
    const channel = supabase
      .channel(`evaluation_updates_${selected.idnumber}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'evaluation_forms',
          filter: `student_id=eq.${selected.idnumber}`
        },
        () => {
           fetchEval();
        }
      )
      .subscribe();

    return () => {
      try { supabase?.removeChannel(channel); } catch {}
    };
  }, [selected?.idnumber]);
  // Realtime Reports
  useEffect(() => {
    if (!supabase || !selected?.idnumber) return;
    type ReportRowRT = ReportRow;
    const ch = supabase
      .channel(`instructor_reports_${selected.idnumber}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports', filter: `idnumber=eq.${selected.idnumber}` }, (payload: RealtimePostgresChangesPayload<ReportRowRT>) => {
        const row = payload.new as ReportRow;
        if (!row) return;
        let fileName: string | undefined = undefined;
        let fileType: string | undefined = undefined;
        const files = row.files;
        if (files && Array.isArray(files) && files.length > 0) {
          const f = files[0];
          fileName = f?.name;
          fileType = f?.type;
        } else if (files && typeof files === "object") {
          const f = files as { name?: string; type?: string };
          fileName = f?.name;
          fileType = f?.type;
        }
        const submittedAt = row.ts ? Number(row.ts) : (row.submittedat ? new Date(row.submittedat).getTime() : Date.now());
         // Skip drafts in realtime inserts
         if (row.status && String(row.status).toLowerCase() === "draft") return;
         setReports(prev => [{ id: Number(row.id), title: row.title || "(Untitled)", body: row.text || "", fileName, fileType, submittedAt, instructorComment: undefined }, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reports', filter: `idnumber=eq.${selected.idnumber}` }, (payload: RealtimePostgresChangesPayload<ReportRowRT>) => {
        const row = payload.new as ReportRow;
        if (!row) return;
        
        // Handle update, hide drafts
        if (row.status && String(row.status).toLowerCase() === "draft") {
          setReports(prev => prev.filter(r => r.id !== Number(row.id)));
          return;
        }
        setReports(prev => prev.map(r => {
            if(r.id === Number(row.id)) {
                let fileName: string | undefined = undefined;
                let fileType: string | undefined = undefined;
                const files = row.files;
                if (files && Array.isArray(files) && files.length > 0) {
                  const f = files[0];
                  fileName = f?.name;
                  fileType = f?.type;
                } else if (files && typeof files === "object") {
                  const f = files as { name?: string; type?: string };
                  fileName = f?.name;
                  fileType = f?.type;
                }
                const submittedAt = row.ts ? Number(row.ts) : (row.submittedat ? new Date(row.submittedat).getTime() : Date.now());
                
                return {
                    ...r,
                    title: row.title || r.title,
                    body: row.text || r.body,
                    fileName: fileName || r.fileName,
                    fileType: fileType || r.fileType,
                    submittedAt: submittedAt,
                    instructorComment: r.instructorComment
                };
            }
            return r;
        }));
      })
      .subscribe();
    return () => {
      try { supabase?.removeChannel(ch); } catch {}
    };
  }, [selected?.idnumber]);

  // Realtime Instructor Comments
  useEffect(() => {
    if (!supabase || !selected?.idnumber) return;
    const ch = supabase
      .channel(`instructor_report_comments_${selected.idnumber}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'report_comments', filter: `idnumber=eq.${selected.idnumber}` }, (payload: RealtimePostgresChangesPayload<{ reportid: string; text: string; byrole: string }>) => {
        const row = payload.new as { reportid: string; text: string; byrole: string };
        if (!row || row.byrole !== "instructor") return;
        const rid = Number(row.reportid);
        const text = row.text || "";
        setReports(prev => prev.map(r => (r.id === rid ? { ...r, instructorComment: text } : r)));
      })
      .subscribe();
    return () => {
      try { supabase?.removeChannel(ch); } catch {}
    };
  }, [selected?.idnumber]);

  // --- View Components ---

  const ReportsView = () => {
    const [allReports, setAllReports] = useState<ReportEntry[]>(cachedReportsData || []);
    const [loading, setLoading] = useState(!cachedReportsData);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCourse, setFilterCourse] = useState("");
    const [filterSection, setFilterSection] = useState("");
    const [selectedReport, setSelectedReport] = useState<ReportEntry | null>(null);
    const [commentText, setCommentText] = useState("");
    const [isSavingComment, setIsSavingComment] = useState(false);

    useEffect(() => {
        // Subscribe to realtime changes for reports
        if (!supabase) return;
        const ch = supabase
            .channel('instructor_reports_global')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, (payload) => {
                // Optimistically update if it's an INSERT or UPDATE
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                   const newReport = payload.new as any;
                   
                   setAllReports(prev => {
                       const exists = prev.find(r => r.id === newReport.id);
                       // Preserve comment as reports table update doesn't include it
                       const comment = exists?.instructorComment;
                       // Check viewed status from DB column
                       const isViewed = !!newReport.reviewedby;

                       const mapped: ReportEntry = {
                            id: newReport.id,
                            title: newReport.title,
                            body: newReport.body,
                            fileName: newReport.fileName,
                            fileType: newReport.fileType,
                            fileUrl: newReport.fileUrl,
                            submittedAt: Number(newReport.submittedAt || newReport.ts),
                            instructorComment: comment,
                            idnumber: newReport.idnumber,
                            isViewedByInstructor: isViewed
                       };

                       let newReports;
                       if (exists) {
                           newReports = prev.map(r => r.id === mapped.id ? mapped : r);
                       } else {
                           newReports = [...prev, mapped];
                       }
                       cachedReportsData = newReports;
                       return newReports;
                   });
                } else if (payload.eventType === 'DELETE') {
                    setAllReports(prev => {
                        const newReports = prev.filter(r => r.id !== payload.old.id);
                        cachedReportsData = newReports;
                        return newReports;
                    });
                }
            })
            .subscribe();

        return () => {
            supabase?.removeChannel(ch);
        };
    }, []);

    const fetchReports = (force = false) => {
        const now = Date.now();
        if (!force && cachedReportsData && (now - lastReportsFetchTime < REPORTS_CACHE_DURATION)) {
            setLoading(false);
            setAllReports(cachedReportsData);
            return;
        }
        
        setLoading(true);
        fetch('/api/reports')
          .then(res => res.json())
          .then(data => {
              if(data.reports && Array.isArray(data.reports)) {
                  const mapped: ReportEntry[] = data.reports.map((r: any) => ({
                      id: r.id,
                      title: r.title,
                      body: r.body,
                      fileName: r.fileName,
                      fileType: r.fileType,
                      fileUrl: r.fileUrl,
                      submittedAt: Number(r.submittedAt || r.ts),
                      instructorComment: r.instructorComment,
                      idnumber: r.idnumber,
                      isViewedByInstructor: r.isViewedByInstructor
                  }));
                  cachedReportsData = mapped;
                  lastReportsFetchTime = Date.now();
                  setAllReports(mapped);
              }
          })
          .finally(() => setLoading(false));
    };

    useEffect(() => {
      fetchReports();
    }, []);

    // Update comment text when selection changes
    useEffect(() => {
        if (selectedReport) {
            setCommentText("");
        }
    }, [selectedReport?.id]);

    const handleSaveLocalComment = async (e?: React.MouseEvent) => {
        if (e) e.preventDefault();
        if (!selectedReport) return;
        setIsSavingComment(true);
        try {
            const res = await fetch("/api/reports", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    id: selectedReport.id, 
                    instructorComment: commentText,
                    instructorId: myIdnumber 
                })
            });
            if (res.ok) {
                const updated = { ...selectedReport, instructorComment: commentText, isViewedByInstructor: true };
                // Update the modal view immediately without closing
                setSelectedReport(updated);
                
                // Update the list in background
                setAllReports(prev => {
                    const newReports = prev.map(r => r.id === selectedReport.id ? updated : r);
                    cachedReportsData = newReports;
                    return newReports;
                });
            } else {
                alert("Failed to save comment");
            }
        } catch (e) {
            console.error(e);
            alert("Error saving comment");
        } finally {
            setIsSavingComment(false);
        }
    };

    const uniqueCourses = useMemo(() => Array.from(new Set(students.map(s => s.course).filter((c): c is string => !!c))).sort(), [students]);
    
    const uniqueSections = useMemo(() => {
        const subset = filterCourse ? students.filter(s => s.course === filterCourse) : students;
        return Array.from(new Set(subset.map(s => s.section).filter((s): s is string => !!s))).sort();
    }, [students, filterCourse]);

    const [weekOffset, setWeekOffset] = useState(0);
    const WEEKS_PER_PAGE = 8;
    const TOTAL_WEEKS = 15;

    // Course-specific deadlines: { "BSIT": { 1: "2023-..." }, "ALL": { ... } }
    const [courseDeadlines, setCourseDeadlines] = useState<Record<string, Record<number, string>>>({});
    const [editingDeadline, setEditingDeadline] = useState<{week: number, date: string} | null>(null);

    // Fetch deadlines from API
    const fetchDeadlines = async () => {
        try {
            const res = await fetch("/api/instructor/deadlines");
            if (res.ok) {
                const json = await res.json();
                setCourseDeadlines(json.deadlines || {});
            }
        } catch (e) {
            console.error("Failed to fetch deadlines", e);
        }
    };

    useEffect(() => {
        fetchDeadlines();
    }, []);

    const handleSaveDeadline = async (course: string, section: string, week: number, date: string) => {
        try {
            const res = await fetch("/api/instructor/deadlines", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ course, section, week, date })
            });
            if (res.ok) {
                await fetchDeadlines();
                setEditingDeadline(null);
            } else {
                alert("Failed to save deadline");
            }
        } catch (e) {
            console.error("Error saving deadline", e);
            alert("Error saving deadline");
        }
    };

    const studentReportsMap = useMemo(() => {
        const map = new Map<string, ReportEntry[]>();
        allReports.forEach(r => {
             const id = r.idnumber;
             if (!id) return;
             // Only consider submitted reports for the grid
             if (!r.submittedAt) return;
             
             if (!map.has(id)) map.set(id, []);
             map.get(id)?.push(r);
        });
        // Sort by date ascending
        map.forEach(reports => {
            reports.sort((a, b) => a.submittedAt - b.submittedAt);
        });
        return map;
    }, [allReports]);

    const filteredStudents = useMemo(() => {
        return students.filter(s => {
            if (s.signup_status === 'PENDING') return false;
            
            if (filterCourse && s.course !== filterCourse) return false;
            if (filterSection && s.section !== filterSection) return false;

            if (!searchTerm) return true;
            
            const lowerSearch = searchTerm.toLowerCase();
            const nameMatch = `${s.firstname} ${s.lastname}`.toLowerCase().includes(lowerSearch);
            const idMatch = s.idnumber.toLowerCase().includes(lowerSearch);
            
            if (nameMatch || idMatch) return true;

            const reports = studentReportsMap.get(s.idnumber);
            if (reports?.some(r => (r.title || "").toLowerCase().includes(lowerSearch))) return true;

            return false;
        }).sort((a, b) => (a.lastname || "").localeCompare(b.lastname || ""));
    }, [students, filterCourse, filterSection, searchTerm, studentReportsMap]);

    const visibleWeeks = useMemo(() => {
        const start = weekOffset;
        const end = Math.min(start + WEEKS_PER_PAGE, TOTAL_WEEKS);
        return Array.from({ length: end - start }, (_, i) => start + i + 1);
    }, [weekOffset]);

    const handlePrevWeeks = () => {
        setWeekOffset(prev => Math.max(0, prev - WEEKS_PER_PAGE));
    };

    const handleNextWeeks = () => {
        setWeekOffset(prev => Math.min(TOTAL_WEEKS - WEEKS_PER_PAGE, prev + WEEKS_PER_PAGE));
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-3">
                <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <select 
                            value={filterCourse}
                            onChange={e => { setFilterCourse(e.target.value); setFilterSection(""); }}
                            className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-gray-50 hover:bg-white transition-all cursor-pointer min-w-[140px]"
                        >
                            <option value="">All Courses</option>
                            {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select 
                            value={filterSection}
                            onChange={e => setFilterSection(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-gray-50 hover:bg-white transition-all cursor-pointer min-w-[140px]"
                        >
                            <option value="">All Sections</option>
                            {uniqueSections.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                            <input 
                                type="text" 
                                placeholder="Search reports..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-900 placeholder-gray-500 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm"
                            />
                        </div>
                        <button 
                            onClick={() => fetchReports(true)}
                            className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-300 transition-all bg-white shadow-sm"
                            title="Refresh Reports"
                        >
                            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>

                <div className="h-px w-full bg-gray-100" />
            </div>
            
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col">
                <div className="flex-1 overflow-auto custom-scrollbar">
                    {loading ? (
                         <div className="p-8 text-center text-gray-500">Loading reports...</div>
                    ) : filteredStudents.length === 0 ? (
                         <div className="p-8 text-center text-gray-500">No students found</div>
                    ) : (
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-gray-50 text-gray-900 font-bold border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 border-r border-gray-200 min-w-[200px]">
                                        Name
                                    </th>
                                    {visibleWeeks.map((week, idx) => (
                                        <th key={week} className="px-2 py-3 text-center border-r border-gray-200 min-w-[120px] align-top">
                                            <div className="flex flex-col gap-2 items-center">
                                                <div className="flex items-center justify-center gap-1 w-full">
                                                    {idx === 0 && weekOffset > 0 && (
                                                        <button 
                                                            onClick={handlePrevWeeks}
                                                            className="p-1 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
                                                        >
                                                            <ChevronLeft size={16} />
                                                        </button>
                                                    )}
                                                    <span className="text-sm font-bold">{week}</span>
                                                    {idx === visibleWeeks.length - 1 && weekOffset + WEEKS_PER_PAGE < TOTAL_WEEKS && (
                                                        <button 
                                                            onClick={handleNextWeeks}
                                                            className="p-1 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
                                                        >
                                                            <ChevronRight size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                                
                                                {/* Deadline Setter */}
                                                {(() => {
                                                     const courseKey = filterCourse || "ALL";
                                                     const sectionKey = filterSection || "ALL";
                                                     // Try specific course+section first, then generic course
                                                     const specificKey = `${courseKey}:::${sectionKey}`;
                                                     const genericKey = `${courseKey}:::ALL`;
                                                     
                                                     const currentDeadline = courseDeadlines[specificKey]?.[week] || (sectionKey === "ALL" ? courseDeadlines[genericKey]?.[week] : undefined);
                                                     const isEditing = editingDeadline?.week === week;
                                                     
                                                     return (
                                                         <div className="relative w-full flex justify-center">
                                                            {isEditing ? (
                                                                <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-white p-3 rounded-xl shadow-xl border border-gray-200 z-50 min-w-[220px] animate-in zoom-in-95 duration-200 text-left">
                                                                    <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-2">
                                                                        Deadline ({filterCourse || "All"} {filterSection ? `- ${filterSection}` : ""})
                                                                    </div>
                                                                    <input 
                                                                        type="datetime-local" 
                                                                        className="w-full text-xs p-2 border border-gray-200 rounded-lg mb-2 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                                                                        value={editingDeadline.date}
                                                                        onChange={e => setEditingDeadline({...editingDeadline, date: e.target.value})}
                                                                        autoFocus
                                                                    />
                                                                    <div className="flex gap-2">
                                                                        <button 
                                                                            onClick={() => {
                                                                                const c = filterCourse || "ALL";
                                                                                const s = filterSection || "ALL"; // Use "ALL" if empty
                                                                                handleSaveDeadline(c, s, week, editingDeadline.date);
                                                                            }}
                                                                            className="flex-1 bg-orange-500 text-white text-xs py-1.5 rounded-lg font-medium hover:bg-orange-600 transition-colors"
                                                                        >
                                                                            Save
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => setEditingDeadline(null)}
                                                                            className="flex-1 bg-gray-50 text-gray-600 text-xs py-1.5 rounded-lg font-medium hover:bg-gray-100 border border-gray-200 transition-colors"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => setEditingDeadline({ week, date: currentDeadline || "" })}
                                                                    className={`text-[10px] font-medium px-2 py-1 rounded-md border flex items-center justify-center gap-1.5 transition-all w-full max-w-[100px] ${
                                                                        currentDeadline 
                                                                            ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" 
                                                                            : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100 hover:text-gray-600 dashed border-gray-300"
                                                                    }`}
                                                                >
                                                                    <Calendar size={10} />
                                                                    <span className="truncate">
                                                                        {currentDeadline 
                                                                            ? new Date(currentDeadline).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}) 
                                                                            : "Set Due"}
                                                                    </span>
                                                                </button>
                                                            )}
                                                         </div>
                                                     );
                                                })()}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 border-b border-gray-200">
                                {filteredStudents.map(s => {
                                    const reports = studentReportsMap.get(s.idnumber) || [];
                                    const baseMs = attendanceSummary[s.idnumber] || 0;
                                    const hours = Math.floor(baseMs / (1000 * 60 * 60));
                                    
                                    return (
                                        <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-gray-900 border-r border-gray-100">
                                                <div className="flex items-center gap-3">
                                                    <div className="font-bold text-sm text-gray-900">
                                                        {s.lastname}, {s.firstname}
                                                    </div>
                                                </div>
                                            </td>
                                            {visibleWeeks.map((week) => {
                                                // Adjust index based on week number (Week 1 -> index 0)
                                                const report = reports[week - 1]; 
                                                const isReviewed = report && (report.isViewedByInstructor || report.instructorComment);
                                                return (
                                                    <td key={week} className="px-2 py-3 text-center border-r border-gray-100">
                                                        {report ? (
                                                            <button
                                                                onClick={() => setSelectedReport(report)}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all shadow-sm whitespace-nowrap flex items-center justify-center gap-1.5 mx-auto w-full max-w-[120px] ${
                                                                    isReviewed 
                                                                        ? "bg-green-50 text-green-700 hover:bg-green-100 border-green-200" 
                                                                        : "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200"
                                                                }`}
                                                                title={report.title}
                                                            >
                                                                {isReviewed ? (
                                                                    <>
                                                                        <CheckCircle2 size={13} className="shrink-0" />
                                                                        <span>Reviewed</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Clock size={13} className="shrink-0" />
                                                                        <span>Needs Review</span>
                                                                    </>
                                                                )}
                                                            </button>
                                                        ) : (
                                                            <div className="flex justify-center">
                                                                <div className="w-2 h-2 rounded-full bg-gray-200"></div>
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Detail Modal */}
            {selectedReport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="relative w-full max-w-4xl max-h-[90vh] rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                        <button
                          onClick={() => setSelectedReport(null)}
                          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 z-10 p-1 hover:bg-gray-100 rounded-full transition-colors"
                        >
                          <X size={24} />
                        </button>
                        
                        <div className="flex flex-col h-full">
                            {/* Header */}
                            <div className="p-6 border-b border-gray-100 flex-none bg-gray-50/30">
                                <div className="flex items-start justify-between mb-4 pr-8">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900 mb-1">{selectedReport.title}</h2>
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <UserIcon size={14} />
                                            <span>
                                                {(() => {
                                                    const s = students.find(st => st.idnumber === selectedReport.idnumber);
                                                    return s ? `${s.firstname} ${s.lastname}` : selectedReport.idnumber;
                                                })()}
                                            </span>
                                            <span className="mx-1">•</span>
                                            <Clock size={14} />
                                            <span>{new Date(selectedReport.submittedAt).toLocaleString()}</span>
                                        </div>
                                    </div>
                                    {selectedReport.isViewedByInstructor || selectedReport.instructorComment ? 
                                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">Reviewed</span> : 
                                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">Needs Review</span>
                                    }
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent space-y-6">
                                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                                    {(() => {
                                        const primary = (selectedReport.body || "").trim();
                                        if (primary) return primary;
                                        const fallback = String(selectedReport.text || "").trim();
                                        if (fallback) return fallback;
                                        return "No report content provided.";
                                    })()}
                                </div>

                                {/* Attachment */}
                                {selectedReport.fileUrl && (
                                    <div className="mt-4">
                                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Attachment</div>
                                        <a 
                                            href={selectedReport.fileUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors group"
                                        >
                                            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg group-hover:bg-orange-200 transition-colors">
                                                <FileText size={20} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-bold text-gray-900 truncate">{selectedReport.fileName || "Attached File"}</div>
                                                <div className="text-xs text-gray-500">{selectedReport.fileType || "Document"}</div>
                                            </div>
                                            <Download size={18} className="text-gray-400 group-hover:text-gray-600" />
                                        </a>
                                    </div>
                                )}

                                {/* Feedback Section (Moved into scrollable area) */}
                                <div className="pt-6 border-t border-gray-100">
                                    {selectedReport.instructorComment ? (
                                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="p-1.5 bg-green-100 text-green-600 rounded-lg">
                                                    <CheckCircle2 size={16} />
                                                </div>
                                                <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">Instructor Feedback</span>
                                            </div>
                                            <p className="text-gray-700 text-sm whitespace-pre-wrap pl-1">{selectedReport.instructorComment}</p>
                                        </div>
                                    ) : (
                                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                            <div className="flex items-center gap-2 mb-3">
                                                <MessageSquare size={16} className="text-orange-600" />
                                                <span className="text-sm font-bold text-gray-900">Add Feedback</span>
                                            </div>
                                            
                                            <div className="space-y-2">
                                                <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                                                    Instructor Comment
                                                </div>
                                                <textarea
                                                    value={commentText}
                                                    onChange={e => setCommentText(e.target.value)}
                                                    className="w-full p-4 rounded-xl border-2 border-orange-200 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100 min-h-[140px] text-sm resize-y bg-white text-gray-900 placeholder-gray-400 shadow-sm transition-all"
                                                    placeholder="Write your feedback here..."
                                                />
                                            </div>
                                            
                                            <div className="flex items-center justify-between mt-3">
                                                <p className="text-[10px] text-gray-400 px-1 hidden sm:block">
                                                    Clicking &quot;View&quot; will mark this report as reviewed.
                                                </p>
                                                <div className="flex items-center gap-3 ml-auto">
                                                    <span className="text-xs text-gray-400 font-medium">
                                                        {commentText.trim() ? "Sending comment..." : "Mark as Viewed"}
                                                    </span>
                                                    <button 
                                                        onClick={handleSaveLocalComment}
                                                        disabled={isSavingComment}
                                                        className="px-6 py-2 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-md shadow-orange-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                                                    >
                                                        {isSavingComment ? "Saving..." : "View"}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
  };

  const AccountApprovalView = () => {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCourse, setFilterCourse] = useState("");
    const [filterSection, setFilterSection] = useState("");
    const [filterStatus, setFilterStatus] = useState("PENDING");
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [isBulkApproving, setIsBulkApproving] = useState(false);
    
    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    
    // Confirmation Modal State
    const [confirmAction, setConfirmAction] = useState<{ type: 'single' | 'bulk', id?: number, action: 'approve' | 'reject' } | null>(null);
    const [rejectionNote, setRejectionNote] = useState("");

    // View Details Modal State
    const [viewingStudent, setViewingStudent] = useState<User | null>(null);

    const { allowedCourses, allowedSections } = useMemo(() => {
      if (!myProfile) return { allowedCourses: [], allowedSections: [] };
      
      const normalize = (s: string) => s.toLowerCase().trim();
      const myCourseNames = (myProfile.course || "").split(",").map(normalize).filter(Boolean);
      const mySectionNames = (myProfile.section || "").split(",").map(normalize).filter(Boolean);

      const ac = availableCourses.filter(c => myCourseNames.includes(normalize(c.name)) || myCourseNames.includes(normalize(c.name_key)));
      const as = availableSections.filter(s => mySectionNames.includes(normalize(s.name)));
      
      return { allowedCourses: ac, allowedSections: as };
    }, [myProfile, availableCourses, availableSections]);

    const filteredStudents = useMemo(() => {
        const normalize = (s: string) => s.toLowerCase().trim();
        return students.filter(s => {
            // Search filter
            const search = normalize(searchTerm);
            const name = normalize(`${s.firstname || ""} ${s.lastname || ""}`);
            const id = normalize(s.idnumber);
            const matchesSearch = !search || name.includes(search) || id.includes(search);

            // Course filter
            const sCourse = normalize(s.course || "");
            const matchesCourse = !filterCourse || sCourse.includes(normalize(filterCourse));

            // Section filter
            const sSection = normalize(s.section || "");
            const matchesSection = !filterSection || sSection.includes(normalize(filterSection));

            // Status filter
            const sStatus = s.signup_status || 'APPROVED';
            const matchesStatus = filterStatus === "ALL" || sStatus === filterStatus;

            return matchesSearch && matchesCourse && matchesSection && matchesStatus;
        });
    }, [students, searchTerm, filterCourse, filterSection, filterStatus]);

    // Clear selection when filters change
    useEffect(() => {
        setSelectedIds(new Set());
    }, [filterCourse, filterSection, filterStatus, searchTerm]);

    const toggleSelection = (id: number) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const toggleAll = () => {
        // Only select pending students
        const pendingStudents = filteredStudents.filter(s => (s.signup_status || 'APPROVED') !== 'APPROVED');
        if (selectedIds.size === pendingStudents.length && pendingStudents.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(pendingStudents.map(s => s.id)));
        }
    };

    const performAction = async (ids: number[], action: 'approve' | 'reject', note?: string) => {
        if (!myProfile) return;
        
        try {
            if (ids.length === 1) setActionLoading(ids[0]);
            else setIsBulkApproving(true);

            await Promise.all(ids.map(id => 
                fetch(`/api/users/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                      signup_status: action === 'approve' ? "APPROVED" : "REJECTED",
                      actorId: myProfile.idnumber,
                      actorRole: myProfile.role,
                      reason: `Instructor ${action}`,
                      rejectionNote: action === 'reject' ? (note || "") : undefined
                    })
                }).then(res => {
                    if (!res.ok) throw new Error(`Failed to ${action} ${id}`);
                    return res;
                })
            ));
            
            setRefreshTrigger(prev => prev + 1);
            setSelectedIds(new Set());
        } catch (e) {
            alert(`Failed to ${action} one or more students`);
        } finally {
            setActionLoading(null);
            setIsBulkApproving(false);
            setConfirmAction(null);
        }
    };

    return (
      <div className="h-full flex flex-col gap-6 w-full min-w-0 relative">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input 
                    type="text" 
                    placeholder="Search by name or ID..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm"
                />
            </div>
            <select 
                value={filterCourse}
                onChange={e => setFilterCourse(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm min-w-[140px]"
            >
                <option value="">All Courses</option>
                {allowedCourses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <select 
                value={filterSection}
                onChange={e => setFilterSection(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm min-w-[140px]"
            >
                <option value="">All Sections</option>
                {allowedSections.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <select 
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm min-w-[140px]"
            >
                <option value="ALL">All Status</option>
                        <option value="PENDING">Pending</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                    </select>
            
            {/* Bulk Action Buttons */}
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                    <button 
                        onClick={() => setConfirmAction({ type: 'bulk', action: 'approve' })}
                        disabled={isBulkApproving}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                        {isBulkApproving ? 'Processing...' : `Approve (${selectedIds.size})`}
                    </button>
                    <button 
                        onClick={() => setConfirmAction({ type: 'bulk', action: 'reject' })}
                        disabled={isBulkApproving}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                        {isBulkApproving ? 'Processing...' : `Reject (${selectedIds.size})`}
                    </button>
                </div>
            )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex-1">
            {/* Desktop Table */}
            <div className="overflow-x-auto h-full hidden md:block">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3 w-10">
                                <input 
                                    type="checkbox" 
                                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                                    onChange={toggleAll}
                                    checked={
                                        filteredStudents.some(s => (s.signup_status || 'APPROVED') !== 'APPROVED') &&
                                        selectedIds.size === filteredStudents.filter(s => (s.signup_status || 'APPROVED') !== 'APPROVED').length &&
                                        filteredStudents.filter(s => (s.signup_status || 'APPROVED') !== 'APPROVED').length > 0
                                    }
                                />
                            </th>
                            <th className="px-6 py-3">Student</th>
                            <th className="px-6 py-3">ID Number</th>
                            <th className="px-6 py-3">Course & Section</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredStudents.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No students found</td></tr>
                        ) : (
                            filteredStudents.map(s => {
                                const isPending = (s.signup_status || 'APPROVED') !== 'APPROVED';
                                return (
                                    <tr key={s.id} className={`hover:bg-gray-50/50 ${selectedIds.has(s.id) ? 'bg-orange-50/30' : ''}`}>
                                        <td className="px-6 py-3">
                                            {isPending && (
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedIds.has(s.id)}
                                                    onChange={() => toggleSelection(s.id)}
                                                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                                                />
                                            )}
                                        </td>
                                        <td className="px-6 py-3 font-medium text-gray-900">
                                            <button 
                                                onClick={() => setViewingStudent(s)}
                                                className="hover:text-orange-600 hover:underline text-left font-bold"
                                            >
                                                {s.firstname} {s.lastname}
                                            </button>
                                        </td>
                                        <td className="px-6 py-3 text-gray-600">{s.idnumber}</td>
                                        <td className="px-6 py-3 text-gray-600">
                                            {formatCourseSection(s.course, s.section)}
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                                                !isPending
                                                ? 'bg-green-50 text-green-700 border-green-200' 
                                                : s.signup_status === 'REJECTED'
                                                ? 'bg-red-50 text-red-700 border-red-200'
                                                : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                            }`}>
                                                {s.signup_status || 'APPROVED'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3">
                                            {isPending && (
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => setConfirmAction({ type: 'single', id: s.id, action: 'approve' })}
                                                        disabled={actionLoading === s.id}
                                                        className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
                                                    >
                                                        {actionLoading === s.id ? '...' : 'Approve'}
                                                    </button>
                                                    <button 
                                                        onClick={() => setConfirmAction({ type: 'single', id: s.id, action: 'reject' })}
                                                        disabled={actionLoading === s.id}
                                                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
                                                    >
                                                        {actionLoading === s.id ? '...' : 'Reject'}
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden">
                {filteredStudents.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-500 text-sm">
                        No students found
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {filteredStudents.map(s => {
                            const isPending = (s.signup_status || 'APPROVED') !== 'APPROVED';
                            const isSelected = selectedIds.has(s.id);
                            return (
                                <div 
                                    key={s.id} 
                                    className={`p-4 ${isSelected ? 'bg-orange-50/30' : ''}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                            <button 
                                                onClick={() => setViewingStudent(s)}
                                                className="text-sm font-bold text-gray-900 hover:text-orange-600 hover:underline text-left"
                                            >
                                                {s.firstname} {s.lastname}
                                            </button>
                                            <div className="text-xs text-gray-600 mt-0.5">
                                                {s.idnumber}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-0.5">
                                                {formatCourseSection(s.course, s.section)}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                                                !isPending
                                                ? 'bg-green-50 text-green-700 border-green-200' 
                                                : s.signup_status === 'REJECTED'
                                                ? 'bg-red-50 text-red-700 border-red-200'
                                                : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                            }`}>
                                                {s.signup_status || 'APPROVED'}
                                            </span>
                                            {isPending && (
                                                <input 
                                                    type="checkbox" 
                                                    checked={isSelected}
                                                    onChange={() => toggleSelection(s.id)}
                                                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                                                    aria-label="Select for bulk action"
                                                />
                                            )}
                                        </div>
                                    </div>
                                    {isPending && (
                                        <div className="mt-3 flex items-center gap-2">
                                            <button 
                                                onClick={() => setConfirmAction({ type: 'single', id: s.id, action: 'approve' })}
                                                disabled={actionLoading === s.id}
                                                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
                                            >
                                                {actionLoading === s.id ? '...' : 'Approve'}
                                            </button>
                                            <button 
                                                onClick={() => setConfirmAction({ type: 'single', id: s.id, action: 'reject' })}
                                                disabled={actionLoading === s.id}
                                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
                                            >
                                                {actionLoading === s.id ? '...' : 'Reject'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>

        {/* Confirmation Modal */}
        {confirmAction && (
            <ConfirmationModal 
                title={confirmAction.action === 'approve' ? "Approve Student Account(s)?" : "Reject Student Account(s)?"}
                message={
                    confirmAction.type === 'bulk'
                        ? `Are you sure you want to ${confirmAction.action} ${selectedIds.size} selected student(s)?`
                        : `Are you sure you want to ${confirmAction.action} this student account?`
                }
                confirmLabel={`Yes, ${confirmAction.action === 'approve' ? 'Approve' : 'Reject'}`}
                variant={confirmAction.action === 'approve' ? 'warning' : 'danger'}
                noteLabel={confirmAction.action === 'reject' ? "Rejection note" : undefined}
                noteRequired={confirmAction.action === 'reject'}
                noteValue={confirmAction.action === 'reject' ? rejectionNote : ""}
                onNoteChange={value => {
                    if (confirmAction.action === 'reject') {
                        setRejectionNote(value);
                    }
                }}
                onConfirm={() => {
                    if (confirmAction.action === 'reject' && (!rejectionNote || !rejectionNote.trim())) {
                        return;
                    }
                    if (confirmAction.type === 'bulk') {
                        performAction(Array.from(selectedIds), confirmAction.action, rejectionNote);
                    } else if (confirmAction.id) {
                        performAction([confirmAction.id], confirmAction.action, rejectionNote);
                    }
                    if (confirmAction.action === 'reject') {
                        setRejectionNote("");
                    }
                }}
                onCancel={() => {
                    setConfirmAction(null);
                    setRejectionNote("");
                }}
            />
        )}

        {/* View Details Modal */}
        {viewingStudent && (
            <Modal onClose={() => setViewingStudent(null)} className="max-w-4xl">
                <ViewUserDetails 
                    user={viewingStudent} 
                    users={students} 
                    onClose={() => setViewingStudent(null)} 
                />
            </Modal>
        )}
      </div>
    );
  };

  const ApprovalRestrictedView = () => {
    return (
      <div className="h-full flex items-center justify-center w-full min-w-0">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center">
            <ShieldAlert size={28} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Account Approval Is Restricted
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Account approval actions are currently disabled for your instructor account.
          </p>
          <p className="text-sm text-gray-600">
            Please contact your coordinator if you need access to manage account approvals.
          </p>
        </div>
      </div>
    );
  };

  const ProfileView = () => {
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const fullname = myProfile ? `${myProfile.firstname || ""} ${myProfile.middlename ? myProfile.middlename + " " : ""}${myProfile.lastname || ""}`.trim() : "";

    const changePassword = async () => {
      setMessage(null);
      if (!myProfile?.idnumber) { setMessage("Unable to identify user."); return; }
      if (!currentPassword) { setMessage("Current password is required."); return; }
      if (!newPassword || newPassword.length < 6) { setMessage("Password must be at least 6 characters."); return; }
      if (newPassword !== confirmPassword) { setMessage("Passwords do not match."); return; }
      setLoading(true);
      try {
        const res = await fetch("/api/profile/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            idnumber: myProfile.idnumber, 
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
                  {(fullname?.[0] || myProfile?.firstname?.[0] || myProfile?.lastname?.[0] || "?").toUpperCase()}
                </div>
                <div className="text-center sm:text-left mb-2">
                   <h1 className="text-2xl font-bold text-gray-900">{fullname || "Unknown User"}</h1>
                   <p className="text-gray-500 font-medium">{myProfile?.idnumber || "No ID"}</p>
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
                    <div className="text-gray-900 font-semibold">{myProfile?.firstname || "-"}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Last Name</label>
                    <div className="text-gray-900 font-semibold">{myProfile?.lastname || "-"}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                     <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Role</label>
                     <div className="text-gray-900 font-semibold capitalize">Instructor</div>
                  </div>
                </div>
              </div>
              
               <div className="border-t border-gray-100 pt-8 mt-8">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-6 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F97316]"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                  Assigned Classes
                </h3>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="flex flex-wrap gap-2">
                    {(myProfile?.course) ? (
                       formatCourseSection(myProfile.course, myProfile.section).split(', ').map((cls, idx) => (
                          <span key={idx} className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-sm font-semibold border border-orange-100 shadow-sm">
                              {cls}
                          </span>
                       ))
                    ) : (
                      <span className="text-sm text-gray-500">No classes assigned</span>
                    )}
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
                    placeholder="At least 6 characters"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-[#F97316] focus:ring-4 focus:ring-orange-500/10 outline-none transition-all placeholder:text-gray-400"
                    placeholder="Re-enter new password"
                  />
                </div>
                
                <button
                  onClick={changePassword}
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-[#F97316] text-white font-bold text-sm shadow-md shadow-orange-200 hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- Render Layout ---

  const menuItems: { id: TabId; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { id: "attendance", label: "Attendance Monitoring", icon: ClipboardCheck },
    { id: "reports", label: "Reports", icon: FileText },
    { id: "approval", label: "Account approval", icon: UserCheck },
    { id: "profile", label: "Profile", icon: UserIcon },
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans">
      {/* Mobile Sidebar Overlay */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } lg:translate-x-0 flex flex-col`}
      >
        <div className="p-6 flex items-center gap-3">
          <Image src="/icons-512.png" alt="Logo" width={40} height={40} className="rounded-lg shadow-sm" />
          <div>
            <div className="font-extrabold text-xl tracking-tight text-gray-900">OJTonTrack</div>
            <div className="text-xs font-medium text-orange-600 uppercase tracking-wider">Instructor Portal</div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { 
                  setActiveTab(item.id); 
                  if(isMobile) setSidebarOpen(false); 
                  if (item.id === "attendance") setBadgeVersion(v => v + 1);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
                  isActive 
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-200" 
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={20} className={isActive ? "text-white" : "text-gray-400"} />
                  {item.label}
                </div>
                <div className="flex items-center gap-2">
                  {isActive && <ChevronRight size={16} className={isActive ? "text-white" : "text-gray-400"} />}
                </div>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[#F97316] font-bold shadow-sm">
              {(myProfile?.firstname?.[0] || myProfile?.lastname?.[0] || myProfile?.idnumber?.[0] || "?").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">
                {myProfile?.firstname} {myProfile?.lastname}
              </p>
              <p className="text-xs text-gray-500 truncate">{myProfile?.idnumber}</p>
            </div>
          </div>
          {deferredPrompt && (
            <button
              onClick={handleInstallClick}
              className="w-full flex items-center justify-center gap-2 text-[#F97316] hover:bg-orange-50 p-2 rounded-lg transition-colors text-sm font-semibold mb-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>Install App</span>
            </button>
          )}
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white text-gray-600 px-4 py-2.5 text-sm font-semibold hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all active:scale-95"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header (Mobile Only / Breadcrumbs) */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 lg:px-8">
            <div className="flex items-center gap-4">
              <div className="relative lg:hidden">
                <button 
                  onClick={() => setSidebarOpen(!isSidebarOpen)}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                >
                  <Menu size={24} />
                </button>
              </div>
              <div />
            </div>
          <div />
        </header>

        {/* View Area */}
        <main className="flex-1 overflow-auto p-4 lg:p-8">
          {activeTab === "attendance" && <AttendanceMonitoringView students={students} attendance={attendance} onNavigateToApproval={() => setActiveTab("approval")} attendanceSummary={attendanceSummary} evaluationStatuses={evaluationStatuses} toggleEvaluation={toggleEvaluation} overtimeShifts={overtimeShifts} />}
          {activeTab === "reports" && <ReportsView />}
          {activeTab === "approval" && (allowApproval ? <AccountApprovalView /> : <ApprovalRestrictedView />)}
          {activeTab === "profile" && <ProfileView />}
        </main>
      </div>
    </div>
  );
}
