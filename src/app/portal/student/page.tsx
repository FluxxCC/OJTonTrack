"use client";
import React, { useEffect, useMemo, useState } from "react";
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
import Link from "next/link";

function normalizeTimeString(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parts = String(raw).split(":");
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
  const [drafts, setDrafts] = useState<ReportEntry[]>([]);
  const [targetHours, setTargetHours] = useState<number>(486);
  const [courseDeadlines, setCourseDeadlines] = useState<Record<string, Record<number, string>>>({});
  const [dbSchedule, setDbSchedule] = useState<{ amIn: string; amOut: string; pmIn: string; pmOut: string; otIn?: string; otOut?: string } | null>(null);
  const [schedule, setSchedule] = useState<{ amIn: string; amOut: string; pmIn: string; pmOut: string; otIn?: string; otOut?: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  
  // PWA Install
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
       try {
         if ('serviceWorker' in navigator) {
           const reg = await navigator.serviceWorker.ready;
           const res = await fetch('/api/push/public-key');
           const { publicKey } = await res.json();
           const existing = await reg.pushManager.getSubscription();
           const sub = existing || await reg.pushManager.subscribe({
             userVisibleOnly: true,
             applicationServerKey: (() => {
               const padding = '='.repeat((4 - (publicKey.length % 4)) % 4);
               const base64Safe = (publicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
               const rawData = atob(base64Safe);
               const outputArray = new Uint8Array(rawData.length);
               for (let i = 0; i < rawData.length; ++i) {
                 outputArray[i] = rawData.charCodeAt(i);
               }
               return outputArray;
             })()
           });
           
           if (idnumber) {
             await fetch('/api/push/subscribe', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ idnumber, subscription: sub })
             });
             
             if (!existing) {
                try {
                  reg.showNotification("Notifications Enabled", {
                    body: "You will now receive updates even when the app is closed.",
                    icon: '/icons-192.png'
                  });
                } catch {
                  new Notification("Notifications Enabled", {
                    body: "You will now receive updates even when the app is closed.",
                    icon: '/icons-192.png'
                  });
                }
             }
           }
         }
       } catch (e: any) {
         if (e.name === 'AbortError' || e.message?.includes('push service not available')) {
            // Suppress specific AbortError from browser when push service is unavailable
            return;
         }
         console.error("Push subscription failed", e);
       }
    }
  };

  useEffect(() => {
    if (notificationPermission === 'granted' && idnumber) {
      requestNotificationPermission();
    }
  }, [notificationPermission, idnumber]);

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
      const res = await fetch(`/api/attendance?idnumber=${encodeURIComponent(idnumber)}`);
      const json = await res.json();
      if (res.ok && Array.isArray(json.entries)) {
        const mapped = json.entries.map((e: any) => {
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
          };
        }) as AttendanceEntry[];
        setAttendance(mapped);
      }
    } catch (e) { console.error(e); }

    try {
      // Fetch User Info
      const uRes = await fetch("/api/users", { cache: "no-store" });
      const uJson = await uRes.json();
      if (Array.isArray(uJson.users)) {
        const me = uJson.users.find((u: User) => String(u.idnumber) === String(idnumber) && String(u.role).toLowerCase() === "student");
        if (me) {
          setStudent(me);
          if (me.supervisorid) {
            const sup = uJson.users.find((u: User) => u.idnumber === me.supervisorid && u.role === "supervisor");
            setSupervisor(sup || null);
          } else {
            setSupervisor(null);
          }
        }
      }
    } catch (e) { console.error(e); }

    try {
      // Fetch Reports
      const rRes = await fetch(`/api/reports?idnumber=${encodeURIComponent(idnumber)}`);
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

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 10000);
    return () => clearInterval(iv);
  }, [idnumber]);

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
      .subscribe();
    return () => { supabase?.removeChannel(channel); };
  }, [idnumber]);

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

  const formatHours = (ms: number) => {
    if (!ms) return "0h 0m";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let fromLocal: StoredSchedule | null = null;

        if (typeof window !== "undefined") {
          const key = idnumber ? `schedule_${idnumber}` : "schedule_default";
          const saved = localStorage.getItem(key) || localStorage.getItem("schedule_default");
          if (saved) {
            const parsed = JSON.parse(saved) as StoredSchedule;
            fromLocal = parsed;
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
          if (!cancelled) setSchedule(next);
          return;
        }

        const res = await fetch("/api/shifts", { cache: "no-store" });
        const json = await res.json();
        const rows = Array.isArray(json.shifts)
          ? json.shifts.filter((r: any) => r && (r.official_start || r.official_end))
          : [];
        if (!rows.length) return;

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
          rows.find((r: any) => {
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

        if (!cancelled) {
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
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [idnumber]);

  const hoursAgg = useMemo(() => {
    const grouped = new Map<string, { date: Date; logs: AttendanceEntry[] }>();
    attendance.forEach(log => {
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

      const effectiveSchedule = dbSchedule || schedule;
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
            if (log.timestamp > inTs) {
              dayTotalMs += log.timestamp - inTs;
            }
            if (approvedInTs !== null && log.status === "Approved" && log.timestamp > approvedInTs) {
              dayValidatedMs += log.timestamp - approvedInTs;
            }
            inTs = null;
            approvedInTs = null;
          }
        });
        
        // Note: We removed the "live" duration addition to ensure finalized calculation only on time-out.
        // If inTs is not null (still checked in), we DO NOT add to total. This matches user request.
        
      } else {
        const baseDate = new Date(day.date);
        baseDate.setHours(0, 0, 0, 0);

        const buildShift = (timeStr: string | undefined) => {
          if (!timeStr) return null;
          const [h, m] = timeStr.split(":").map(Number);
          const d = new Date(baseDate.getTime());
          d.setHours(h || 0, m || 0, 0, 0);
          return d.getTime();
        };

        const amInMs = buildShift(effectiveSchedule.amIn);
        const amOutMs = buildShift(effectiveSchedule.amOut);
        const pmInMs = buildShift(effectiveSchedule.pmIn);
        const pmOutMs = buildShift(effectiveSchedule.pmOut);
        const otInMs = buildShift(effectiveSchedule.otIn);
        const otOutMs = buildShift(effectiveSchedule.otOut);

        const localSchedule = {
            amIn: amInMs || 0,
            amOut: amOutMs || 0,
            pmIn: pmInMs || 0,
            pmOut: pmOutMs || 0,
            otStart: otInMs || 0,
            otEnd: otOutMs || 0,
        };

        type Session = { in: AttendanceEntry; out: AttendanceEntry | null };
        const sessions: Session[] = [];
        let currentIn: AttendanceEntry | null = null;

        dayLogs.forEach(log => {
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

        const calculateOverlap = (start: number, end: number, limitStart: number, limitEnd: number) => {
            if (!limitStart || !limitEnd || limitStart >= limitEnd) return 0;
            const s = Math.max(start, limitStart);
            const e = Math.min(end, limitEnd);
            if (s >= e) return 0;
            const sFl = Math.floor(s / 60000) * 60000;
            const eFl = Math.floor(e / 60000) * 60000;
            return Math.max(0, eFl - sFl);
        };

        sessions.forEach(session => {
            if (!session.out) return;

            let am = calculateOverlap(session.in.timestamp, session.out.timestamp, localSchedule.amIn, localSchedule.amOut);
            let pm = calculateOverlap(session.in.timestamp, session.out.timestamp, localSchedule.pmIn, localSchedule.pmOut);
            const ot = calculateOverlap(session.in.timestamp, session.out.timestamp, localSchedule.otStart, localSchedule.otEnd);
            
            // Fallback: If session strictly encloses the AM window but overlap returned 0 (e.g. due to minor boundary mismatch), force full AM credit.
            if (am === 0 && localSchedule.amIn && localSchedule.amOut) {
                if (session.in.timestamp <= localSchedule.amIn && session.out.timestamp >= localSchedule.amOut) {
                    am = localSchedule.amOut - localSchedule.amIn;
                }
            }

            // If a single session spans across Morning and Afternoon (e.g. AM IN -> PM OUT),
            // it means the student failed to clock out for lunch and clock in for PM.
            // In this case, we only credit the Morning hours and invalidating the PM hours.
            if (am > 0 && pm > 0) {
                pm = 0;
            }

            const sessionDuration = am + pm + ot;
            dayTotalMs += sessionDuration;

            const isInApproved = session.in.status === "Approved";
            const isOutApproved = session.out.status === "Approved";
            if (isInApproved && isOutApproved) {
                dayValidatedMs += sessionDuration;
            }
        });

        // Uniform rounding for the day total
        dayTotalMs = Math.round(dayTotalMs / 60000) * 60000;
        dayValidatedMs = Math.round(dayValidatedMs / 60000) * 60000;
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

    return {
      totalMs: totalMsAll,
      validatedMs: totalValidatedMsAll,
      formattedTotal: formatHours(totalMsAll),
      formattedValidated: formatHours(totalValidatedMsAll),
      progress,
      recentRows,
    };
  }, [attendance, targetHours, idnumber, schedule, dbSchedule, now]);

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
            <div className="flex items-center gap-4" />
          </header>

          <main className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
            <div className="max-w-7xl mx-auto">
              {activeTab === "dashboard" && (
                <DashboardView
                  attendance={attendance}
                  reports={reports}
                  totalHours={hoursAgg.formattedTotal}
                  totalValidatedHours={hoursAgg.formattedValidated}
                  targetHours={student?.target_hours || 486}
                  nextDeadline={studentDeadlines.find(d => d.status === "pending") || studentDeadlines[studentDeadlines.length - 1]}
                  onTimeIn={handleTimeIn}
                  onTimeOut={handleTimeOut}
                  onViewAttendance={() => setActiveTab("attendance")}
                  companyText={student?.company || "N/A"}
                  supervisorText={student?.supervisor_name || student?.supervisorid || "N/A"}
                  locationText={student?.location || "N/A"}
                  recentRows={hoursAgg.recentRows}
                />
              )}

              {activeTab === "attendance" && (
                <div className="space-y-6">
                  <LegacyAttendanceView
                    idnumber={idnumber}
                    attendance={attendance}
                    onUpdate={setAttendance}
                    supervisorId={student?.supervisorid}
                    studentName={
                      student
                        ? `${student.firstname} ${student.lastname}`
                        : undefined
                    }
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
