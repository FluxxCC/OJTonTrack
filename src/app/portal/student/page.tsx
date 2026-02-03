"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { 
  LayoutDashboard, 
  Clock, 
  FileText, 
  User as UserIcon, 
  LogOut, 
  Menu,
  ChevronRight,
  Calendar,
  LogIn,
  Zap,
  Bell,
  Check,
  X
} from 'lucide-react';
import { 
  AttendanceView as LegacyAttendanceView, 
  ReportsView, 
  ProfileView as LegacyProfileView,
  DashboardView,
  AttendanceEntry,
  ReportEntry,
  User
} from "./ui";
import { calculateSessionDuration, determineShift, ShiftSchedule, buildSchedule, normalizeTimeString, timeStringToMinutes, formatHours, calculateShiftDurations } from "@/lib/attendance";
import Link from "next/link";




type Notification = {
  id: number;
  recipient_id: number;
  recipient_role: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  link?: string;
  type?: string;
};

type ServerAttendanceEntry = { 
  id: number;
  type: "in" | "out"; 
  ts: number; 
  photourl: string; 
  status?: string; 
  validated_by?: string | null;
  validated_at?: string | null;
};

type StoredSchedule = {
  amIn?: string;
  amOut?: string;
  pmIn?: string;
  pmOut?: string;
  overtimeIn?: string;
  overtimeOut?: string;
};

// --- Helper Components ---

function StatCard({ title, value, icon: Icon, color, subtext, progress, action, valueClassName }: { title: string, value: string | number, icon: any, color: string, subtext?: string, progress?: number, action?: React.ReactNode, valueClassName?: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:border-orange-200 transition-colors min-h-[140px]">
      <div className="flex items-center gap-4">
        <div className={`p-4 rounded-xl ${color} text-white shadow-md`}>
          <Icon size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <div className="text-sm text-gray-500 font-medium">{title}</div>
            {action}
          </div>
          <div
            className={`font-bold text-gray-900 leading-tight text-xl sm:text-2xl ${valueClassName || ""}`}
          >
            {value}
          </div>
          {subtext && <div className="text-xs text-gray-400 mt-0.5">{subtext}</div>}
        </div>
      </div>
      {progress !== undefined && (
        <div className="mt-4 w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <div 
            className="bg-[#F97316] h-2.5 rounded-full transition-all duration-1000 ease-out" 
            style={{ width: `${progress}%` }} 
          />
        </div>
      )}
    </div>
  );
}

function StudentPage() {
  const router = useRouter();
  const idnumber = useMemo(() => {
    if (typeof window === 'undefined') return "";
    try { return localStorage.getItem("idnumber") || ""; } catch { return ""; }
  }, []);
  const [activeTab, setActiveTab] = useState<"dashboard" | "attendance" | "reports" | "profile">("dashboard");
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Data State
  const [student, setStudent] = useState<User | null>(null);
  const [supervisor, setSupervisor] = useState<User | null>(null);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!student?.id || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', student.id)
        .eq('recipient_role', 'student')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (!error && data) {
        setNotifications(data);
      }
    } catch (e) {
      console.error("Fetch notifications error:", e);
    }
  }, [student?.id]);

  const markAsRead = async (id: number) => {
    if (!supabase) return;
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
        
      if (error) {
        // Revert if error
        console.error("Error marking as read:", JSON.stringify(error, null, 2));
        fetchNotifications();
      }
    } catch (e) { 
        console.error("Exception marking as read:", e); 
        fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
     if (!student?.id || !supabase) return;
     // Optimistic update
     setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
     try {
       const { error } = await supabase
         .from('notifications')
         .update({ is_read: true })
         .eq('recipient_id', student.id)
         .eq('recipient_role', 'student')
         .eq('is_read', false);
         
       if (error) {
          console.error("Error marking all as read:", JSON.stringify(error, null, 2));
          fetchNotifications(); // Revert
       }
     } catch (e) { 
        console.error("Exception marking all as read:", e);
        fetchNotifications(); // Revert
     }
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.is_read) {
      await markAsRead(n.id);
    }
    
    setShowNotifications(false);

    if (n.link) {
      if (n.link.includes('tab=')) {
         try {
             const url = new URL(n.link, window.location.origin);
             const tab = url.searchParams.get('tab');
             if (tab && ['dashboard', 'attendance', 'reports', 'profile'].includes(tab)) {
                 setActiveTab(tab as any);
             } else {
                 router.push(n.link);
             }
         } catch {
             // Fallback for simple string match if URL parsing fails
             const match = n.link.match(/tab=([^&]*)/);
             if (match && ['dashboard', 'attendance', 'reports', 'profile'].includes(match[1])) {
                 setActiveTab(match[1] as any);
             } else {
                 router.push(n.link);
             }
         }
      } else {
         router.push(n.link);
      }
    }
  };

  const [drafts, setDrafts] = useState<ReportEntry[]>([]);
  const [targetHours, setTargetHours] = useState<number>(486);
  const [schedule, setSchedule] = useState<StoredSchedule | null>(null);
  const [dbSchedule, setDbSchedule] = useState<any>(null);
  const [studentSchedule, setStudentSchedule] = useState<{ amIn: string; amOut: string; pmIn: string; pmOut: string; otIn?: string; otOut?: string } | null>(null);
  const [dateOverrides, setDateOverrides] = useState<Record<string, any>>({});
  const [courseDeadlines, setCourseDeadlines] = useState<Record<string, Record<number, string>>>({});
  const [now, setNow] = useState(() => Date.now());

  
  // PWA Install
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNow(Date.now());
    }, 60000);
    return () => clearInterval(intervalId);
  }, []);

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


  // User Info

  // --- Effects ---

  // Fetch Data
  const fetchData = async () => {
    if (!idnumber) return;
    try {
      // Fetch Attendance
      const res = await fetch(`/api/attendance?idnumber=${encodeURIComponent(idnumber)}`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok && Array.isArray(json.entries)) {
        const mapped = json.entries.map((e: any) => {
          const sStr = String(e.status || "").trim().toLowerCase();
          const isRejected = sStr === "rejected";
          const isApproved = sStr === "approved" || (!!e.validated_by && !isRejected);
          let status = isRejected ? "Rejected" : isApproved ? "Approved" : "Pending";
          
          if (sStr === "official") {
             status = "Official";
          }
          
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
            validated_hours: e.validated_hours,
          };
        }) as AttendanceEntry[];
        setAttendance(mapped);
      }
    } catch (e) { console.error(e); }

    // 3. User Data (Student & Supervisor)
    if (idnumber) {
      try {
        const res = await fetch(`/api/users?idnumber=${encodeURIComponent(idnumber)}`);
        const json = await res.json();
        if (Array.isArray(json.users) && json.users.length > 0) {
          const me = json.users[0];
          setStudent(me);
          
          // Check for joined supervisor data (from API join)
          if ((me as any).users_supervisors) {
            const joinedSup = (me as any).users_supervisors;
            setSupervisor({
              id: Number(me.supervisorid) || 0,
              idnumber: joinedSup.idnumber,
              role: 'supervisor',
              firstname: joinedSup.firstname,
              lastname: joinedSup.lastname,
              company: joinedSup.company,
              location: joinedSup.location
            } as User);
          }
        }
      } catch {}
    }

    try {
      // Fetch Reports
      const rRes = await fetch(`/api/reports?idnumber=${encodeURIComponent(idnumber)}`, { cache: "no-store" });
      const rJson = await rRes.json();
      if (rRes.ok) {
         if (Array.isArray(rJson.reports)) {
           setReports(rJson.reports.map((r: any) => ({
             ...r,
             submittedAt: r.submittedAt || r.ts || Date.now()
           })));
         }
         if (Array.isArray(rJson.drafts)) {
           setDrafts(rJson.drafts.map((d: any) => ({
             ...d,
             submittedAt: d.submittedAt || d.ts || Date.now()
           })));
         } else {
           setDrafts([]);
         }
      } else {
        // Fallback to localStorage if API fails or returns empty (optional, but good for offline dev)
        const key = idnumber ? `reportLogs:${idnumber}` : "reportLogs:";
        const raw = localStorage.getItem(key);
        if (raw) setReports(JSON.parse(raw));
      }
    } catch (e) { 
       console.error(e);
       // Fallback
       const key = idnumber ? `reportLogs:${idnumber}` : "reportLogs:";
       const raw = localStorage.getItem(key);
       if (raw) setReports(JSON.parse(raw));
    }

    try {
      const t = Number(localStorage.getItem("targetHours") || "");
      if (!Number.isNaN(t) && t > 0) setTargetHours(t);
    } catch {}
  };

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

  const fetchSchedule = useCallback(async () => {
    try {
      let nextSchedule: any = null;

      // 0. Check for Coordinator Events (Highest Priority)
      try {
        const eventsRes = await fetch('/api/events', { cache: "no-store" });
        const eventsData = await eventsRes.json();
        if (eventsData.events && Array.isArray(eventsData.events)) {
          const now = new Date();
          const offset = now.getTimezoneOffset();
          const localDate = new Date(now.getTime() - (offset * 60 * 1000));
          const todayStr = localDate.toISOString().split('T')[0];
          
          const todayEvents = eventsData.events.filter((e: any) => e.event_date === todayStr);
          let applicableEvent = null;

          // Priority 1: Course-specific event
          if (student && student.courseIds && student.courseIds.length > 0) {
            applicableEvent = todayEvents.find((e: any) => 
              e.courses_id && Array.isArray(e.courses_id) && e.courses_id.length > 0 &&
              student.courseIds!.some(id => e.courses_id.map(String).includes(String(id)))
            );
          }

          // Priority 2: General event
          if (!applicableEvent) {
            applicableEvent = todayEvents.find((e: any) => 
              !e.courses_id || !Array.isArray(e.courses_id) || e.courses_id.length === 0
            );
          }
          
          if (applicableEvent) {
            nextSchedule = {
              amIn: normalizeTimeString(applicableEvent.am_in) || "",
              amOut: normalizeTimeString(applicableEvent.am_out) || "",
              pmIn: normalizeTimeString(applicableEvent.pm_in) || "",
              pmOut: normalizeTimeString(applicableEvent.pm_out) || "",
              otIn: normalizeTimeString(applicableEvent.overtime_in) || undefined,
              otOut: normalizeTimeString(applicableEvent.overtime_out) || undefined,
            };
          }
        }
      } catch (e) {
        console.error("Failed to fetch events", e);
      }

      if (nextSchedule) {
        setDbSchedule(nextSchedule);
        setSchedule(nextSchedule);
        return;
      }

      // 1. Student Specific Schedule
      if (supabase && idnumber) {
        const { data: studentSched } = await supabase
          .from("student_shift_schedules")
          .select("*")
          .eq("student_id", idnumber)
          .maybeSingle();

        if (studentSched) {
            nextSchedule = {
                amIn: normalizeTimeString(studentSched.am_in) || "",
                amOut: normalizeTimeString(studentSched.am_out) || "",
                pmIn: normalizeTimeString(studentSched.pm_in) || "",
                pmOut: normalizeTimeString(studentSched.pm_out) || "",
                otIn: normalizeTimeString(studentSched.ot_in) || undefined,
                otOut: normalizeTimeString(studentSched.ot_out) || undefined,
            };
            setDbSchedule(nextSchedule);
            setSchedule(nextSchedule);
            return;
        }
      }

      // 2. Supervisor Default
      let fromLocal: StoredSchedule | null = null;
      if (typeof window !== "undefined") {
        const key = idnumber ? `schedule_${idnumber}` : "schedule_default";
        const saved = localStorage.getItem(key);
        if (saved) {
          fromLocal = JSON.parse(saved) as StoredSchedule;
        }
      }

      if (fromLocal) {
        const next = {
          amIn: fromLocal.amIn || "",
          amOut: fromLocal.amOut || "",
          pmIn: fromLocal.pmIn || "",
          pmOut: fromLocal.pmOut || "",
          otIn: fromLocal.overtimeIn,
          otOut: fromLocal.overtimeOut,
        };
        setSchedule(next);
      }

      if (!student && idnumber) {
         // Small delay to allow student profile fetch if needed
         await new Promise(r => setTimeout(r, 1000));
      }

      const res = await fetch(`/api/shifts${student?.supervisorid ? `?supervisor_id=${encodeURIComponent(student.supervisorid)}` : ''}`, { cache: "no-store" });
      const json = await res.json();
      const rows = Array.isArray(json.shifts)
        ? json.shifts.filter((r: any) => r && (r.official_start || r.official_end))
        : [];
        
      if (!rows.length) {
        setDbSchedule(null);
        setSchedule(null);
        if (typeof window !== "undefined") {
          const key = idnumber ? `schedule_${idnumber}` : "schedule_default";
          localStorage.removeItem(key);
        }
        return;
      }

      const sorted = rows
        .slice()
        .sort(
          (a: any, b: any) =>
            timeStringToMinutes(a.official_start || "") -
            timeStringToMinutes(b.official_start || "")
        );

      let amRow = sorted[0];
      let pmRow = sorted[1] || sorted[0];

      const findByName = (match: (name: string) => boolean) =>
        sorted.find((r: any) => {
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

      const next = {
        amIn: amInNorm,
        amOut: amOutNorm,
        pmIn: pmInNorm,
        pmOut: pmOutNorm,
        otIn: otInNorm || undefined,
        otOut: otOutNorm || undefined,
      };

      setDbSchedule(next);
      setSchedule(next);
      
      if (typeof window !== "undefined") {
        const key = idnumber ? `schedule_${idnumber}` : "schedule_default";
        const payload = {
            amIn: next.amIn,
            amOut: next.amOut,
            pmIn: next.pmIn,
            pmOut: next.pmOut,
            overtimeIn: next.otIn,
            overtimeOut: next.otOut,
        };
        try {
            localStorage.setItem(key, JSON.stringify(payload));
        } catch {}
      }

    } catch (e) {
      console.error(e);
    }
  }, [idnumber, student]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 10000);
    return () => clearInterval(iv);
  }, [idnumber]);

  // Fetch Student Specific Schedule and Overrides
  useEffect(() => {
      const fetchExtraSchedules = async () => {
          if (!idnumber || !supabase) return;
          
          // 1. Fetch Student Shift Schedule
          const { data } = await supabase
              .from('student_shift_schedules')
              .select('*')
              .eq('student_id', idnumber)
              .single();
          
          if (data) {
              setStudentSchedule({
                  amIn: data.am_in,
                  amOut: data.am_out,
                  pmIn: data.pm_in,
                  pmOut: data.pm_out,
                  otIn: data.ot_in,
                  otOut: data.ot_out
              });
          } else {
              setStudentSchedule(null);
          }

          // 2. Fetch Date Overrides (if supervisor exists)
          if (student?.supervisorid) {
              try {
                  const res = await fetch(`/api/shifts/overrides?supervisor_id=${encodeURIComponent(student.supervisorid)}`);
                  const json = await res.json();
                  const map: Record<string, any> = {};
                  if (json.overrides) {
                      json.overrides.forEach((o: any) => {
                          map[o.date] = o;
                      });
                  }
                  setDateOverrides(map);
              } catch (e) {
                  console.error("Failed to fetch overrides", e);
              }
          }
      };
      
      fetchExtraSchedules();
  }, [idnumber, student?.supervisorid]);

  // Realtime Subscription
  useEffect(() => {
    if (!idnumber || !supabase) return;
    const channel = supabase
      .channel('student-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        (payload: RealtimePostgresChangesPayload<any>) => { fetchData(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'report_requirements' },
        (payload: RealtimePostgresChangesPayload<any>) => { fetchDeadlines(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        (payload: RealtimePostgresChangesPayload<any>) => { fetchData(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'report_comments' },
        (payload: RealtimePostgresChangesPayload<any>) => { fetchData(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'coordinator_events' },
        () => { fetchSchedule(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts' },
        () => { fetchSchedule(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => { fetchNotifications(); }
      )
      .subscribe();
    return () => { supabase?.removeChannel(channel); };
  }, [idnumber, fetchSchedule, fetchNotifications]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    fetchDeadlines();
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



  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!student?.supervisorid) return;
        const res = await fetch(`/api/shifts/overrides?supervisor_id=${encodeURIComponent(student.supervisorid)}`);
        const json = await res.json();
        if (cancelled) return;
        
        const map: Record<string, any> = {};
        if (json.overrides) {
            json.overrides.forEach((o: any) => {
                map[o.date] = o;
            });
        }
        setDateOverrides(map);
      } catch (e) {
        console.error("Failed to fetch overrides", e);
      }
    })();
    return () => { cancelled = true; };
  }, [student?.supervisorid]);



  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const processedAttendance = useMemo(() => {
    const sorted = [...attendance].sort((a, b) => a.timestamp - b.timestamp);
    const grouped = new Map<string, AttendanceEntry[]>();
    sorted.forEach(entry => {
      const d = new Date(entry.timestamp);
      const key = d.toLocaleDateString();
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(entry);
    });

    const result: AttendanceEntry[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    grouped.forEach((dayEntries) => {
        const dayDate = new Date(dayEntries[0].timestamp);
        dayDate.setHours(0,0,0,0);
        const isPastDate = dayDate < today;
        const dateStr = dayDate.getFullYear() + "-" + String(dayDate.getMonth() + 1).padStart(2, '0') + "-" + String(dayDate.getDate()).padStart(2, '0');
        
        const baseConfig = studentSchedule || dbSchedule || schedule || {
             amIn: "08:00", amOut: "12:00",
             pmIn: "13:00", pmOut: "17:00",
             otIn: "17:00", otOut: "18:00"
        };

        const override = dateOverrides[dateStr];
        const effSchedule = override ? {
             amIn: override.am?.start || baseConfig.amIn,
             amOut: override.am?.end || baseConfig.amOut,
             pmIn: override.pm?.start || baseConfig.pmIn,
             pmOut: override.pm?.end || baseConfig.pmOut,
             otIn: baseConfig.otIn,
             otOut: baseConfig.otOut
        } : baseConfig;
        
        let currentIn: AttendanceEntry | null = null;
        
        for (const entry of dayEntries) {
            if (entry.status === "Rejected") continue;
            if (entry.type === 'in') {
                if (currentIn) {
                    result.push(currentIn);
                }
                currentIn = entry;
            } else {
                if (currentIn) {
                    result.push(currentIn);
                    result.push(entry);
                    currentIn = null;
                } else {
                    result.push(entry);
                }
            }
        }

        if (currentIn) {
            result.push(currentIn);
            if (isPastDate && effSchedule) {
                 const scheduleObj = buildSchedule(dayDate, effSchedule);
                 const shift = determineShift(currentIn.timestamp, scheduleObj);
                 
                 let outTs = 0;
                 if (shift === 'am') outTs = scheduleObj.amOut;
                 else if (shift === 'pm') outTs = scheduleObj.pmOut;
                 else if (shift === 'ot') outTs = scheduleObj.otEnd;
                 
                 if (outTs) {
                     if (outTs <= currentIn.timestamp) outTs = currentIn.timestamp + 60000;
                     
                     result.push({
                         id: -(currentIn.id || Math.floor(Math.random() * 1000000)),
                         type: 'out',
                         timestamp: outTs,
                         photoDataUrl: '',
                         status: 'Pending',
                         validated_by: 'AUTO TIME OUT',
                         approvedAt: undefined
                     } as AttendanceEntry);
                 }
            }
        }
    });
    
    return result.sort((a, b) => a.timestamp - b.timestamp);
  }, [attendance, dbSchedule, schedule, now]);

  const hoursAgg = useMemo(() => {
    const grouped = new Map<string, { date: Date; logs: AttendanceEntry[] }>();
    processedAttendance.forEach(log => {
      const d = new Date(log.timestamp);
      const key = d.toLocaleDateString();
      if (!grouped.has(key)) grouped.set(key, { date: d, logs: [] });
      grouped.get(key)!.logs.push(log);
    });

    let totalMsAll = 0;
    let totalValidatedMsAll = 0;
    const recentRows: any[] = [];

    const sortedDays = Array.from(grouped.values()).sort((a, b) => b.date.getTime() - a.date.getTime());

    sortedDays.forEach((day, index) => {
      const dayLogs = day.logs.slice().sort((a, b) => a.timestamp - b.timestamp);

      const dateStr = day.date.getFullYear() + "-" + String(day.date.getMonth() + 1).padStart(2, '0') + "-" + String(day.date.getDate()).padStart(2, '0');
      const baseConfig = dbSchedule || schedule || {
            amIn: "08:00", amOut: "12:00",
            pmIn: "13:00", pmOut: "17:00",
            otIn: "17:00", otOut: "18:00"
      };
      const override = dateOverrides[dateStr];
      const effectiveSchedule = override ? {
             amIn: override.am?.start || baseConfig.amIn,
             amOut: override.am?.end || baseConfig.amOut,
             pmIn: override.pm?.start || baseConfig.pmIn,
             pmOut: override.pm?.end || baseConfig.pmOut,
             otIn: baseConfig.otIn,
             otOut: baseConfig.otOut
      } : baseConfig;

      let dayTotalMs = 0;
      let dayValidatedMs = 0;

      if (!effectiveSchedule || (!effectiveSchedule.amIn && !effectiveSchedule.pmIn && !effectiveSchedule.otIn)) {
        let inTs: number | null = null;
        let approvedInTs: number | null = null;

        dayLogs.forEach(log => {
          if (log.type === "in") {
            inTs = log.timestamp;
            if (log.status === "Approved") {
              approvedInTs = log.timestamp;
            }
          } else if (log.type === "out" && inTs !== null) {
            if (typeof log.rendered_hours === 'number' && log.rendered_hours > 0) {
               dayTotalMs += log.rendered_hours * 3600000;
            } else if (log.timestamp > inTs) {
              dayTotalMs += log.timestamp - inTs;
            }
            if (approvedInTs !== null && log.status === "Approved") {
               if (typeof log.validated_hours === 'number' && log.validated_hours > 0) {
                   dayValidatedMs += log.validated_hours * 3600000;
               } else if (typeof log.rendered_hours === 'number' && log.rendered_hours > 0) {
                   dayValidatedMs += log.rendered_hours * 3600000;
               } else if (log.timestamp > approvedInTs) {
                   dayValidatedMs += log.timestamp - approvedInTs;
               }
            }
            inTs = null;
            approvedInTs = null;
          }
        });
        
        // Note: We removed the "live" duration addition to ensure finalized calculation only on time-out.
        // If inTs is not null (still checked in), we DO NOT add to total. This matches user request.
        
      } else {
        const baseDate = new Date(day.date);
        // Use centralized schedule builder
        const schedule = buildSchedule(baseDate, effectiveSchedule);

        type Session = { in: AttendanceEntry; out: AttendanceEntry | null };
        const sessions: Session[] = [];
        
        let currentIn: AttendanceEntry | null = null;
        dayLogs.forEach(log => {
          if (log.type === 'in') {
            currentIn = log;
          } else if (log.type === 'out' && currentIn) {
            sessions.push({ in: currentIn, out: log });
            currentIn = null;
          }
        });

        // Calculate duration for each session using centralized logic
        sessions.forEach(session => {
            const inTime = session.in.timestamp;
            const outTime = session.out ? session.out.timestamp : 0;
            if (!outTime) return;

            // Use rendered_hours if available (frozen historical data), otherwise calculate dynamically
            if (session.out && typeof session.out.rendered_hours === 'number' && session.out.rendered_hours > 0) {
                dayTotalMs += session.out.rendered_hours * 3600000;
            } else {
                let shiftTotal = calculateSessionDuration(inTime, outTime, 'am', schedule) + 
                                 calculateSessionDuration(inTime, outTime, 'pm', schedule) + 
                                 calculateSessionDuration(inTime, outTime, 'ot', schedule);
                
                // Fallback to raw duration if off-schedule (Tracked Hours)
                if (shiftTotal === 0) {
                    const raw = outTime - inTime;
                    if (raw > 0) shiftTotal = raw;
                }
                
                dayTotalMs += shiftTotal;
            }

            // Validated time (only if approved)
            if (session.in.status === 'Approved' && session.out?.status === 'Approved') {
                 if (session.out && typeof session.out.validated_hours === 'number' && session.out.validated_hours > 0) {
                     dayValidatedMs += session.out.validated_hours * 3600000;
                 } else if (session.out && typeof session.out.rendered_hours === 'number' && session.out.rendered_hours > 0) {
                     dayValidatedMs += session.out.rendered_hours * 3600000;
                 } else {
                     dayValidatedMs += calculateSessionDuration(inTime, outTime, 'am', schedule);
                     dayValidatedMs += calculateSessionDuration(inTime, outTime, 'pm', schedule);
                     dayValidatedMs += calculateSessionDuration(inTime, outTime, 'ot', schedule);
                 }
            }
        });


      }

      totalMsAll += dayTotalMs;
      totalValidatedMsAll += dayValidatedMs;

      if (index < 5) {
          const firstIn = dayLogs.find(l => l.type === 'in');
          const lastOut = dayLogs.filter(l => l.type === 'out').pop(); // Simple approximation for display
          
          recentRows.push({
             labelDate: day.date.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" }),
             inLabel: firstIn ? new Date(firstIn.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-",
             outLabel: lastOut ? new Date(lastOut.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-",
             inEntry: firstIn,
             outEntry: lastOut,
             duration: formatHours(dayTotalMs),
             status: dayTotalMs > 0 ? "Approved" : "Pending"
          });
      }
    });

    const targetMs = targetHours * 3600 * 1000;
    const progress = targetMs > 0 ? Math.min(100, (totalMsAll / targetMs) * 100) : 0;
    const validatedProgress = targetMs > 0 ? Math.min(100, (totalValidatedMsAll / targetMs) * 100) : 0;

    return {
      totalMs: totalMsAll,
      validatedMs: totalValidatedMsAll,
      formattedTotal: formatHours(totalMsAll),
      formattedValidated: formatHours(totalValidatedMsAll),
      progress,
      validatedProgress,
      recentRows,
    };
  }, [attendance, targetHours, idnumber, schedule, dbSchedule, now, studentSchedule, dateOverrides]);

  const recentActivity = useMemo(() => {
    const att = attendance.map((e) => ({
      kind: "attendance" as const,
      label: e.type === "in" ? "Time In" : "Time Out",
      timestamp: e.timestamp
    }));
    const rep = reports.map((r) => ({
      kind: "report" as const,
      label: "Report Submitted",
      timestamp: r.submittedAt
    }));
    return [...att, ...rep].sort((a,b) => b.timestamp - a.timestamp).slice(0, 8);
  }, [attendance, reports]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);

  const isCheckedIn = useMemo(() => {
    const sorted = attendance.slice().sort((a,b) => a.timestamp - b.timestamp);
    const last = sorted[sorted.length - 1];
    return last?.type === "in";
  }, [attendance]);

  const studentDeadlines = useMemo(() => {
    if (!student) return [];
    const courseKey = student.course || "ALL";
    const sectionKey = student.section || "ALL";
    const keys = [
      `${courseKey}:::${sectionKey}`,
      `${courseKey}:::ALL`,
      `ALL:::${sectionKey}`,
      "ALL:::ALL",
    ];
    const merged: Record<number, string> = {};
    keys.forEach((k) => {
      const weeks = courseDeadlines[k];
      if (!weeks) return;
      Object.keys(weeks).forEach((weekStr) => {
        const weekNum = Number(weekStr);
        if (!weekNum) return;
        if (merged[weekNum] == null) {
          merged[weekNum] = weeks[weekNum];
        }
      });
    });
    return Object.entries(merged)
      .map(([weekStr, date]) => {
        const week = Number(weekStr);
        const isSubmitted = reports.length >= week;
        return { 
          week, 
          date, 
          status: isSubmitted ? "submitted" as const : "pending" as const 
        };
      })
      .sort((a, b) => a.week - b.week);
  }, [student, courseDeadlines, reports]);

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "attendance", label: "Attendance", icon: Clock },
    { id: "reports", label: "Reports", icon: FileText },
    { id: "profile", label: "Profile", icon: UserIcon },
  ];

  const handleTimeIn = () => {
    setActiveTab("attendance");
  };

  const handleTimeOut = () => {
    setActiveTab("attendance");
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      localStorage.clear();
    } catch (e) {
      console.error("Logout failed", e);
    }
    router.replace("/");
  };

  return (
    <div className="flex h-screen bg-[#F6F7F9] font-sans overflow-hidden">
      <div className="flex h-full w-full">
        {isMobile && isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 backdrop-blur-sm transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-30 w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl lg:shadow-none lg:relative lg:translate-x-0 ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="h-20 flex items-center gap-3 px-6 border-b border-gray-100 bg-gradient-to-r from-orange-50/50 to-transparent">
            <Image
              src="/icons-512.png"
              alt="CITE Logo"
              width={40}
              height={40}
              className="w-10 h-10 rounded-xl shadow-sm object-cover"
            />
            <div>
              <h1 className="font-extrabold text-xl text-gray-900 tracking-tight leading-none">
                OJTonTrack
              </h1>
              <p className="text-xs font-medium text-[#F97316] uppercase tracking-wider mt-0.5">
                Student Portal
              </p>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    if (isMobile) setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                    isActive
                      ? "bg-[#F97316] text-white shadow-lg shadow-orange-200 translate-x-1"
                      : "text-gray-600 hover:bg-orange-50 hover:text-[#F97316]"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <Icon
                      size={20}
                      className={
                        isActive
                          ? "text-white"
                          : "text-gray-400 group-hover:text-[#F97316]"
                      }
                      strokeWidth={2.5}
                    />
                    <span>{item.label}</span>
                  </div>
                  {isActive && (
                    <ChevronRight
                      size={16}
                      className="text-white/80"
                      strokeWidth={3}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3 mb-3 px-2">
              <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[#F97316] font-bold shadow-sm">
                {(student?.firstname || "S").charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">
                  {student?.firstname} {student?.lastname}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {student?.idnumber}
                </p>
              </div>
            </div>
            {deferredPrompt && (
              <button
                onClick={handleInstallClick}
                className="w-full flex items-center justify-center gap-2 text-[#F97316] hover:bg-orange-50 p-2 rounded-lg transition-colors text-sm font-semibold mb-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Install App</span>
              </button>
            )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white text-gray-600 px-4 py-2.5 text-sm font-semibold hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all active:scale-95"
            >
              <LogOut size={16} strokeWidth={2.5} />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0 bg-[#F6F7F9]">
          <header className="h-20 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!isSidebarOpen)}
                className="lg:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Menu size={24} />
              </button>
              <div />
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)} 
                  className="p-2.5 rounded-full hover:bg-orange-50 text-gray-500 hover:text-[#F97316] transition-colors relative"
                >
                  <Bell size={22} strokeWidth={2} />
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
                  )}
                </button>
                
                {showNotifications && (
                   <>
                   <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                   <div className="absolute right-0 top-full mt-4 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                      <div className="px-5 py-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                         <h3 className="font-bold text-gray-900">Notifications</h3>
                         {unreadCount > 0 && (
                           <button onClick={markAllAsRead} className="text-xs font-bold text-[#F97316] hover:text-orange-700">Clear all</button>
                         )}
                      </div>
                      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                         {notifications.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center justify-center text-gray-400">
                               <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                                  <Bell size={20} className="text-gray-300" />
                               </div>
                               <p className="text-sm font-medium">No notifications yet</p>
                            </div>
                         ) : (
                            notifications.map(n => (
                               <div 
                                 key={n.id} 
                                 onClick={() => handleNotificationClick(n)}
                                 className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer group relative ${!n.is_read ? 'bg-red-50' : ''}`}
                               >
                                  <div className="flex items-start gap-3.5">
                                     <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 transition-colors ${!n.is_read ? 'bg-red-500' : 'bg-gray-200 group-hover:bg-gray-300'}`} />
                                     <div className="flex-1 min-w-0">
                                        <p className={`text-sm ${!n.is_read ? 'font-bold text-gray-900' : 'font-medium text-gray-600'}`}>{n.title}</p>
                                        <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{n.message}</p>
                                        <p className="text-[10px] text-gray-400 mt-2 font-medium">
                                          {new Date(n.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} • {new Date(n.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                                        </p>
                                     </div>
                                  </div>
                               </div>
                            ))
                         )}
                      </div>
                   </div>
                   </>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
            <div className="max-w-7xl mx-auto">
              {activeTab === "dashboard" && (
                <DashboardView
                  attendance={attendance}
                  reports={reports}
                  totalHours={hoursAgg.formattedTotal}
                  totalValidatedHours={hoursAgg.formattedValidated}
                  targetHours={targetHours}
                  validatedProgress={hoursAgg.validatedProgress}
                  deadlines={studentDeadlines}
                  nextDeadline={studentDeadlines.find(d => d.status === "pending") || studentDeadlines[studentDeadlines.length - 1]}
                  onTimeIn={handleTimeIn}
                  onTimeOut={handleTimeOut}
                  onViewAttendance={() => setActiveTab("attendance")}
                  onViewReports={() => setActiveTab("reports")}
                  companyText={student?.company || "N/A"}
                  supervisorText={student?.supervisor_name || student?.supervisorid || "N/A"}
                  locationText={student?.location || "N/A"}
                  recentRows={hoursAgg.recentRows}
                  now={now}
                  schedule={dbSchedule || schedule}
                />
              )}

              {activeTab === "attendance" && (
                <div className="space-y-6">
                  <LegacyAttendanceView
                    idnumber={idnumber}
                    attendance={processedAttendance}
                    onUpdate={setAttendance}
                    supervisorId={student?.supervisorid}
                    studentName={
                      student
                        ? `${student.firstname} ${student.lastname}`
                        : undefined
                    }
                    schedule={dbSchedule || schedule}
                  />
                </div>
              )}

              {activeTab === "reports" && (
                <div className="space-y-6">
                  <ReportsView
                    idnumber={idnumber}
                    reports={reports}
                    drafts={drafts}
                    deadlines={studentDeadlines}
                    onDraftUpdate={(newDrafts) => setDrafts(newDrafts)}
                    onUpdate={(newReports) => {
                      setReports(newReports);
                      const key = idnumber
                        ? `reportLogs:${idnumber}`
                        : "reportLogs:";
                      localStorage.setItem(key, JSON.stringify(newReports));
                    }}
                  />
                </div>
              )}

              {activeTab === "profile" && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      My Profile
                    </h1>
                    <p className="text-gray-500">Manage your account settings.</p>
                  </div>
                  <LegacyProfileView
                    student={student}
                    supervisor={supervisor}
                    onUpdate={fetchData}
                  />
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default StudentPage;
