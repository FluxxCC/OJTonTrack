"use client";
import React, { useEffect, useMemo, useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import citeLogo from "../../../../assets/CITE.png";
import { supabase } from "../../../lib/supabaseClient";
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
  X,
  Clock,
  CheckCircle2
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
import { UsersView, AddUserForm, EditUserForm, ViewUserDetails, Modal, ConfirmationModal, SuccessModal } from './ui';
 

// --- Types ---

type AttendanceEntry = { type: "in" | "out"; timestamp: number; photoDataUrl: string; status?: "Pending" | "Approved"; approvedAt?: number; approvedBy?: string };
type ServerAttendanceEntry = { type: "in" | "out"; ts: number; photourl: string; status?: string; approvedby?: string | null; approvedat?: string | null };
type ReportEntry = { id: number; title?: string; body?: string; fileName?: string; fileType?: string; fileUrl?: string; submittedAt: number; instructorComment?: string };
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
};

type Course = { id: number; name: string; name_key: string };
type Section = { id: number; name: string; code: string; course_id: number };
type TabId = "dashboard" | "students" | "users" | "profile";
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

const LiveTotal = ({ baseMs, activeStart, now: propNow }: { baseMs: number; activeStart?: number; now?: number }) => {
  const [internalNow, setInternalNow] = useState(() => Date.now());
  useEffect(() => {
    if (propNow !== undefined) return;
    if (!activeStart) return;
    const i = setInterval(() => setInternalNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [activeStart, propNow]);

  const currentNow = propNow !== undefined ? propNow : internalNow;
  const dynamicMs = activeStart ? Math.max(0, currentNow - activeStart) : 0;
  return <>{formatHMS(baseMs + dynamicMs)}</>;
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

const AttendanceChart = React.memo(({ attendance, selected, activeStart, now: propNow }: { attendance: AttendanceEntry[], selected: User | null, activeStart?: number, now?: number }) => {
    
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
        let filtered = attendance.slice();
        
        // Always Week View logic
        const start = new Date(selectedWeekStart);
        const end = new Date(selectedWeekStart + 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(e => e.timestamp >= start.getTime() && e.timestamp < end.getTime());
        
        const dayMs = Array(7).fill(0);
        const sortedW = filtered.sort((a, b) => a.timestamp - b.timestamp);
        let inTsW: number | null = null;
        for (const entry of sortedW) {
            if (entry.type === "in" && inTsW === null) {
            inTsW = entry.timestamp;
            } else if (entry.type === "out" && inTsW !== null) {
            let s = new Date(inTsW);
            const e = new Date(entry.timestamp);
            while (s.getTime() < e.getTime()) {
                const endOfDay = new Date(s);
                endOfDay.setHours(23, 59, 59, 999);
                const chunkEndMs = Math.min(e.getTime(), endOfDay.getTime());
                const idx = new Date(s).getDay();
                dayMs[idx] += Math.max(0, chunkEndMs - s.getTime());
                s = new Date(chunkEndMs + 1);
            }
            inTsW = null;
            }
        }
        if (activeStart) {
            const ws = selectedWeekStart;
            const we = selectedWeekStart + weekMs - 1;
            const s0 = Math.max(activeStart, ws);
            const e0 = Math.min(currentTick, we);
            if (e0 > s0) {
                let s = new Date(s0);
                const e = new Date(e0);
                while (s.getTime() < e.getTime()) {
                    const endOfDay = new Date(s);
                    endOfDay.setHours(23, 59, 59, 999);
                    const chunkEndMs = Math.min(e.getTime(), endOfDay.getTime());
                    const idx = new Date(s).getDay();
                    dayMs[idx] += Math.max(0, chunkEndMs - s.getTime());
                    s = new Date(chunkEndMs + 1);
                }
            }
        }
        const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        return labels.map((label, i) => ({ date: label, ms: dayMs[i], hours: dayMs[i] / (1000 * 60 * 60) }));
    }, [selected, attendance, selectedWeekStart, activeStart, currentTick]);

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
    openEvaluationModal
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
    openEvaluationModal: () => void
}) => {
    const activeStart = selected ? activeSessions[selected.idnumber] : undefined;
    const [now, setNow] = useState(() => Date.now());
    
    // Evaluation Toggle State
    const [showEvalConfirm, setShowEvalConfirm] = useState(false);
    const [pendingEvalToggle, setPendingEvalToggle] = useState<string | null>(null);

    const handleToggleClick = (idnumber: string, current: boolean) => {
        if (current) {
            // Turning OFF - no check needed
            toggleEvaluation(idnumber, current);
        } else {
            // Turning ON - check hours
            const baseMs = attendanceSummary[idnumber] || 0;
            const hours = baseMs / (1000 * 60 * 60);
            if (hours < 486) {
                setPendingEvalToggle(idnumber);
                setShowEvalConfirm(true);
            } else {
                toggleEvaluation(idnumber, current);
            }
        }
    };
    
    useEffect(() => {
        if (!activeStart) return;
        setNow(Date.now());
        const i = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(i);
    }, [activeStart]);

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
                        <LiveTotal baseMs={(attendanceSummary[selected.idnumber] || 0)} activeStart={activeSessions[selected.idnumber]} now={now} /> / 486 Hours
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

            {/* Confirmation Modal for Evaluation */}
            {showEvalConfirm && (
                <ConfirmationModal 
                    title="Enable Evaluation?"
                    message="Are you sure you want to enable evaluation? The student hasn't reached the requirements."
                    confirmLabel="Yes, Enable"
                    onConfirm={() => {
                        if (pendingEvalToggle) {
                            toggleEvaluation(pendingEvalToggle, false); 
                            setShowEvalConfirm(false);
                            setPendingEvalToggle(null);
                        }
                    }}
                    onCancel={() => {
                        setShowEvalConfirm(false);
                        setPendingEvalToggle(null);
                    }}
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
        const ch = supabase.channel('global-evaluation-updates');
        ch.subscribe();
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

  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
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
  const [evaluationStatuses, setEvaluationStatuses] = useState<Record<string, boolean>>({});
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

  // User Info
  const myIdnumber = useMemo(() => {
    if (typeof window === "undefined") return "";
    try { return localStorage.getItem("idnumber") || ""; } catch { return ""; }
  }, []);
  const [myProfile, setMyProfile] = useState<User | null>(null);

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
        if (json.summary) setAttendanceSummary(json.summary);
        if (json.activeSessions) setActiveSessions(json.activeSessions);
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
      .channel('instructor_evaluation_status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'evaluation_status' }, (payload: RealtimePostgresChangesPayload<{ idnumber: string, enabled: boolean }>) => {
        const row = payload.new as { idnumber: string, enabled: boolean } | null;
        if (row && row.idnumber) {
          setEvaluationStatuses(prev => ({ ...prev, [row.idnumber]: row.enabled }));
        }
      })
      .subscribe();
    return () => {
      try { supabase?.removeChannel(ch); } catch {}
    };
  }, []);

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

  // Fetch Attendance (Selected)
  useEffect(() => {
    (async () => {
      if (!selected?.idnumber) { setAttendance([]); return; }
          try {
            const res = await fetch(`/api/attendance?idnumber=${encodeURIComponent(selected.idnumber)}&limit=200`);
            const json = await res.json();
            if (res.ok && Array.isArray(json.entries)) {
              const mapped = json.entries.map((e: ServerAttendanceEntry) => ({
                type: e.type,
                timestamp: e.ts,
                photoDataUrl: e.photourl,
                status: String(e.status || "").trim().toLowerCase() === "approved" || !!e.approvedby ? "Approved" : "Pending",
                approvedAt: e.approvedat ? Number(new Date(e.approvedat).getTime()) : undefined,
                approvedBy: e.approvedby || undefined
              })) as AttendanceEntry[];
              setAttendance(mapped);
            } else {
              setAttendance([]);
            }
      } catch {
        setAttendance([]);
      }
    })();
  }, [selected, refreshTrigger]);

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

  const DashboardView = () => {
    const totalStudents = students.length;
    const courseDistribution = useMemo(() => {
      const dist: Record<string, number> = {};
      students.forEach(s => {
        const c = s.course || "Unknown";
        dist[c] = (dist[c] || 0) + 1;
      });
      return Object.entries(dist).map(([name, value]) => ({ name, value }));
    }, [students]);
    const assignedCoursesCount = useMemo(() => {
      const raw = (myProfile?.course || "").split(",").map(s => s.trim()).filter(Boolean);
      return raw.length;
    }, [myProfile]);
    
    const evaluationsOpen = useMemo(() => {
      const ids = new Set(students.map(s => s.idnumber));
      let count = 0;
      Object.entries(evaluationStatuses).forEach(([id, enabled]) => {
        if (ids.has(id) && enabled) count += 1;
      });
      return count;
    }, [students, evaluationStatuses]);
    
    // Active sessions panel removed in favor of recent attendance

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Overview of your students and their activities.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Total Students" 
            value={totalStudents} 
            icon={Users} 
            color="bg-blue-500" 
          />
          <StatCard 
            title="Courses Managed" 
            value={assignedCoursesCount || courseDistribution.length} 
            icon={FileText} 
            color="bg-orange-500" 
          />
          <StatCard 
            title="Evaluations Open" 
            value={evaluationsOpen} 
            icon={UserCog} 
            color="bg-green-600" 
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Recent Attendance</h3>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500">Last 7 days</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">{recentAttendance.length > 9 ? "9+" : recentAttendance.length}</span>
            </div>
            {recentAttendance.length === 0 ? (
              <div className="p-6 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500 text-sm">No recent entries</div>
            ) : (
              <div className="space-y-3">
                {recentAttendance.slice(0, 10).map((e, idx) => {
                  const s = students.find(st => st.idnumber === e.idnumber);
                  return (
                    <div key={`${e.idnumber}-${e.ts}-${idx}`} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                          {(s?.firstname?.[0] || e.idnumber[0] || "S").toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">{s ? `${s.firstname} ${s.lastname}` : e.idnumber}</div>
                          <div className="text-xs text-gray-500">{new Date(e.ts).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${e.type === "in" ? "bg-green-100 text-green-700 border border-green-200" : "bg-blue-100 text-blue-700 border border-blue-200"}`}>{e.type.toUpperCase()}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Recent Reports</h3>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500">Last 7 days</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">{recentReports.length > 9 ? "9+" : recentReports.length}</span>
            </div>
            {recentReports.length === 0 ? (
              <div className="p-6 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500 text-sm">No recent reports</div>
            ) : (
              <div className="space-y-3">
                {recentReports.slice(0, 10).map((r) => {
                  const s = students.find(st => st.idnumber === r.idnumber);
                  return (
                    <div key={r.id} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-gray-900 text-sm">{r.title}</div>
                        <div className="text-xs text-gray-500">{new Date(r.ts).toLocaleDateString()}</div>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{s ? `${s.firstname} ${s.lastname} • ${s.idnumber}` : r.idnumber}</div>
                      <div className="text-xs text-gray-600 mt-1 line-clamp-2">{r.body || "No content"}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };


  const UserManagementView = () => {
    const [activeTab, setActiveTab] = useState<"student" | "supervisor">("student");
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const allUsers = useMemo(() => [...students, ...supervisors], [students, supervisors]);

    const { allowedCourses, allowedSections } = useMemo(() => {
      if (!myProfile) return { allowedCourses: [], allowedSections: [] };
      
      const normalize = (s: string) => s.toLowerCase().trim();
      const myCourseNames = (myProfile.course || "").split(",").map(normalize).filter(Boolean);
      const mySectionNames = (myProfile.section || "").split(",").map(normalize).filter(Boolean);

      const ac = availableCourses.filter(c => myCourseNames.includes(normalize(c.name)) || myCourseNames.includes(normalize(c.name_key)));
      const as = availableSections.filter(s => mySectionNames.includes(normalize(s.name)));
      
      return { allowedCourses: ac, allowedSections: as };
    }, [myProfile, availableCourses, availableSections]);

    return (
      <div className="h-full flex flex-col gap-6 max-w-2xl mx-auto w-full min-w-0">
        {/* Tab Switcher */}
        <div className="flex bg-gray-100 p-1 rounded-2xl w-full">
            <button 
                onClick={() => setActiveTab("student")}
                className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "student" ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
                Add Student
            </button>
            <button 
                onClick={() => setActiveTab("supervisor")}
                className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "supervisor" ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
                Add Supervisor
            </button>
        </div>

        {/* Inline Add Form */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-visible">
             <AddUserForm 
                role={activeTab}
                onSuccess={() => { 
                    setRefreshTrigger(prev => prev + 1); 
                    setSuccessMessage(`${activeTab === 'student' ? 'Student' : 'Supervisor'} has been successfully added to the system.`);
                }}
                onClose={() => {}} // No-op for inline
                availableCourses={availableCourses}
                availableSections={availableSections}
                users={allUsers}
                allowedCourses={allowedCourses}
                allowedSections={allowedSections}
            />
        </div>

        {/* Success Modal */}
        {successMessage && (
            <SuccessModal 
                message={successMessage} 
                onClose={() => setSuccessMessage(null)} 
            />
        )}
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
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "students", label: "Students", icon: Users },
    { id: "users", label: "User Management", icon: UserCog },
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
          <Image src={citeLogo} alt="Logo" width={40} height={40} className="rounded-lg shadow-sm" />
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
                  if (item.id === "students") setBadgeVersion(v => v + 1);
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
                  {item.id === "students" && (
                    (() => {
                      const total = combinedBadgeCount;
                      return (
                        <>
                          {total > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold border bg-red-50 text-red-700 border-red-200">
                              {total > 9 ? "9+" : total}
                            </span>
                          )}
                        </>
                      );
                    })()
                  )}
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
              <div className="absolute -top-1 -right-1 flex items-center gap-1">
                {(() => {
                  const total = combinedBadgeCount;
                  return total > 0 ? (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold border bg-red-50 text-red-700 border-red-200 shadow-sm">
                      {total > 9 ? "9+" : total}
                    </span>
                  ) : null;
                })()}
              </div>
            </div>
            <div className="hidden lg:block text-sm text-gray-400 font-medium">
              Portal / <span className="text-gray-900 capitalize">{activeTab.replace('-', ' ')}</span>
            </div>
          </div>
          <div />
        </header>

        {/* View Area */}
        <main className="flex-1 overflow-auto p-4 lg:p-8">
          {activeTab === "dashboard" && <DashboardView />}
          {activeTab === "students" && <StudentsView students={students} attendance={attendance} reports={reports} recentAttendance={recentAttendance} recentReports={recentReports} myIdnumber={myIdnumber as string} selected={selected} setSelected={setSelected} viewingReport={viewingReport} setViewingReport={(r) => { setViewingReport(r); setBadgeVersion(v => v + 1); }} setReports={setReports} isAttendanceModalOpen={isAttendanceModalOpen} setAttendanceModalOpen={(open) => { setAttendanceModalOpen(open); if (!open) setBadgeVersion(v => v + 1); }} isReportsModalOpen={isReportsModalOpen} setReportsModalOpen={(open) => { setReportsModalOpen(open); if (!open) setBadgeVersion(v => v + 1); }} evaluationStatuses={evaluationStatuses} setEvaluationStatuses={setEvaluationStatuses} activeSessions={activeSessions} attendanceSummary={attendanceSummary} evaluation={evaluation} onViewedChange={() => setBadgeVersion(v => v + 1)} />}
          {activeTab === "users" && <UserManagementView />}
          {activeTab === "profile" && <ProfileView />}
        </main>
      </div>
    </div>
  );
}
