"use client";
import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import citeLogo from "../../../../assets/CITE.png";
import { supabase } from "../../../lib/supabaseClient";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { 
  LayoutDashboard, 
  Clock, 
  FileText, 
  User as UserIcon, 
  LogOut, 
  Menu,
  ChevronRight,
  Briefcase,
  MapPin,
  Calendar,
  LogIn,
  Zap,
  BellRing,
} from 'lucide-react';
import { 
  AttendanceView as LegacyAttendanceView, 
  ReportsView as LegacyReportsView, 
  ProfileView as LegacyProfileView,
  DashboardView,
  AttendanceEntry,
  ReportEntry,
  User
} from "./ui";
import Link from "next/link";

type ServerAttendanceEntry = { type: "in" | "out"; ts: number; photourl: string; status?: string; approvedby?: string | null };

// --- Helper Components ---

function StatCard({ title, value, icon: Icon, color, subtext, progress, action }: { title: string, value: string | number, icon: any, color: string, subtext?: string, progress?: number, action?: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:border-orange-200 transition-colors min-h-[140px]">
      <div className="flex items-center gap-4">
        <div className={`p-4 rounded-xl ${color} text-white shadow-md`}>
          <Icon size={24} />
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <div className="text-sm text-gray-500 font-medium">{title}</div>
            {action}
          </div>
          <div className="text-2xl font-bold text-gray-900">{value}</div>
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

export default function StudentPage() {
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
       } catch (e) {
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
      const res = await fetch(`/api/attendance?idnumber=${encodeURIComponent(idnumber)}&limit=100`);
      const json = await res.json();
      if (res.ok && Array.isArray(json.entries)) {
        const mapped = json.entries.map((e: any) => {
          const status = String(e.status || "").trim().toLowerCase() === "approved" || !!e.approvedby ? "Approved" : "Pending";
          const approvedAtNum = e.approvedat ? Number(new Date(e.approvedat).getTime()) : undefined;
          return {
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
      .subscribe();
    return () => { supabase?.removeChannel(channel); };
  }, [idnumber]);

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

  // Live "now" for approved session timing
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Computed Stats
  const stats = useMemo(() => {
    const sorted = [...attendance].sort((a, b) => a.timestamp - b.timestamp);
    const approved = sorted.filter(e => e.status === "Approved");
    let sumMs = 0;
    let activeStart: number | null = null;
    for (let i = 0; i < approved.length; i++) {
      if (approved[i].type === "in") {
        let outIndex = -1;
        for (let j = i + 1; j < approved.length; j++) {
          if (approved[j].type === "out") {
            outIndex = j;
            break;
          }
        }
        if (outIndex !== -1) {
          const inTs = approved[i].approvedAt ?? approved[i].timestamp;
          const outTs = approved[outIndex].approvedAt ?? approved[outIndex].timestamp;
          sumMs += outTs - inTs;
          i = outIndex;
        } else {
          activeStart = approved[i].approvedAt ?? approved[i].timestamp;
        }
      }
    }
    if (activeStart) {
      sumMs += Math.max(0, now - activeStart);
    }

    // Format H:M:S
    const totalSeconds = Math.floor(sumMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const formattedTime = `${hours}h ${minutes}m ${seconds}s`;
    
    // Progress calculation
    const targetMs = targetHours * 3600 * 1000;
    const progress = Math.min(100, (sumMs / targetMs) * 100);

    return { 
      hours, 
      formattedTime, 
      progress,
      count: approved.length 
    };
  }, [attendance, targetHours, now]);

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

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "attendance", label: "Attendance", icon: Clock },
    { id: "reports", label: "Reports", icon: FileText },
    { id: "profile", label: "Profile", icon: UserIcon },
  ];

  const handleLogout = () => {
    router.replace("/");
  };

  // --- Views ---



  return (
    <div className="flex h-screen bg-[#F6F7F9] font-sans overflow-hidden">
      {/* Sidebar Overlay */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-30 w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl lg:shadow-none lg:relative lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="h-20 flex items-center gap-3 px-6 border-b border-gray-100 bg-gradient-to-r from-orange-50/50 to-transparent">
          <Image src={citeLogo} alt="CITE Logo" width={40} height={40} className="w-10 h-10 rounded-xl shadow-sm object-cover" />
          <div>
            <h1 className="font-extrabold text-xl text-gray-900 tracking-tight leading-none">OJTonTrack</h1>
            <p className="text-xs font-medium text-[#F97316] uppercase tracking-wider mt-0.5">Student Portal</p>
          </div>
        </div>

        {/* Navigation */}
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
                  <Icon size={20} className={isActive ? "text-white" : "text-gray-400 group-hover:text-[#F97316]"} strokeWidth={2.5} />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight size={16} className="text-white/80" strokeWidth={3} />}
              </button>
            );
          })}
        </nav>

        {/* Profile Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[#F97316] font-bold shadow-sm">
              {(student?.firstname || "S").charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">
                {student?.firstname} {student?.lastname}
              </p>
              <p className="text-xs text-gray-500 truncate">{student?.idnumber}</p>
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
            <LogOut size={16} strokeWidth={2.5} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#F6F7F9]">
        {/* Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu size={24} />
            </button>
            <div>
              <h2 className="text-xl font-bold text-gray-900 capitalize tracking-tight">
                {activeTab === 'dashboard' ? 'Overview' : activeTab}
              </h2>
              <p className="text-xs text-gray-500 hidden sm:block">
                Manage your OJT activities and reports.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {activeTab === "dashboard" && (
              <div className="space-y-6 animate-in fade-in duration-500">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <StatCard 
                    title="Total Hours" 
                    value={stats.formattedTime} 
                    icon={Clock} 
                    color="bg-orange-500" 
                    subtext={`Target: ${targetHours}h`}
                    progress={stats.progress}
                  />
                  <StatCard 
                    title="Company" 
                    value={supervisor?.company || "N/A"} 
                    icon={Briefcase} 
                    color="bg-blue-500" 
                  />
                  <StatCard 
                    title="Location" 
                    value={supervisor?.location || "N/A"} 
                    icon={MapPin} 
                    color="bg-purple-500" 
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900">Recent Activity</h3>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setActiveTab("attendance")} className="text-sm text-[#F97316] hover:underline">Attendance</button>
                        <button onClick={() => setActiveTab("reports")} className="text-sm text-[#F97316] hover:underline">Reports</button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {recentActivity.length === 0 ? (
                        <div className="text-center text-gray-400 py-8">No recent activity</div>
                      ) : recentActivity.map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center border ${
                              item.kind === 'attendance'
                                ? (item.label === 'Time In' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200')
                                : 'bg-orange-50 text-orange-600 border-orange-200'
                            }`}>
                              {item.kind === 'attendance' ? (
                                item.label === 'Time In' ? <LogIn size={16} /> : <LogOut size={16} />
                              ) : (
                                <FileText size={16} />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-gray-900">
                                {item.kind === 'report' ? 'Report Submitted' : item.label}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(item.timestamp).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <div className="text-sm font-medium text-gray-600">
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 text-gray-900 flex flex-col items-center gap-3 self-start">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-orange-50 text-[#F97316] border border-orange-100">
                        <Zap size={14} />
                      </div>
                      <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">Quick Actions</div>
                    </div>
                    <div className="w-full sm:w-64 space-y-2">
                      <button
                        onClick={() => setActiveTab("attendance")}
                        className={`w-full rounded-xl font-bold py-3 px-6 text-sm transition-all active:scale-95 shadow ${isCheckedIn ? "bg-white text-red-600 hover:bg-gray-100 border border-gray-200" : "bg-[#F97316] text-white hover:bg-[#EA580C] border border-transparent"}`}
                      >
                        <span className="inline-flex items-center justify-center gap-2">
                          {isCheckedIn ? <LogOut size={16} /> : <LogIn size={16} />}
                          {isCheckedIn ? "Time Out" : "Time In"}
                        </span>
                      </button>
                      <Link
                        href="/portal/student/reports"
                        className="block w-full rounded-xl font-bold py-3 px-6 text-sm transition-all active:scale-95 shadow bg-[#F97316] text-white hover:bg-[#EA580C] border border-transparent text-center"
                      >
                        Submit Report
                      </Link>
                      {notificationPermission === 'default' && (
                        <button
                          onClick={requestNotificationPermission}
                          className="w-full rounded-xl font-bold py-3 px-6 text-sm transition-all active:scale-95 shadow bg-blue-600 text-white hover:bg-blue-700 border border-transparent"
                        >
                          <span className="inline-flex items-center justify-center gap-2">
                            <BellRing size={16} />
                            Enable Notifications
                          </span>
                        </button>
                      )}
                      {notificationPermission === 'granted' && (
                         <div className="text-center mt-2">
                           <button 
                             onClick={() => alert("If you are not receiving notifications:\n1. Check your phone's Settings > Apps > OJTonTrack > Notifications.\n2. Ensure 'Allow Notifications' is on.\n3. Disable 'Battery Saver' for this app if possible.")}
                             className="text-xs text-gray-400 underline hover:text-orange-500"
                           >
                             Not receiving alerts?
                           </button>
                         </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === "attendance" && (
               <div className="space-y-6 animate-in fade-in duration-500">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Attendance Tracker</h1>
                    <p className="text-gray-500">Record your daily time-in and time-out.</p>
                  </div>
                  <LegacyAttendanceView 
                    idnumber={idnumber} 
                    attendance={attendance} 
                    onUpdate={setAttendance} 
                  />
               </div>
            )}

            {activeTab === "reports" && (
               <div className="space-y-6 animate-in fade-in duration-500">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Weekly Reports</h1>
                    <p className="text-gray-500">Submit and view your accomplishment reports.</p>
                  </div>
                  <LegacyReportsView 
                    idnumber={idnumber} 
                    reports={reports} 
                    drafts={drafts}
                    onDraftUpdate={(newDrafts) => setDrafts(newDrafts)}
                    onUpdate={(newReports) => {
                       setReports(newReports);
                       const key = idnumber ? `reportLogs:${idnumber}` : "reportLogs:";
                       localStorage.setItem(key, JSON.stringify(newReports));
                    }} 
                  />
               </div>
            )}

            {activeTab === "profile" && (
               <div className="space-y-6 animate-in fade-in duration-500">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
                    <p className="text-gray-500">Manage your account settings.</p>
                  </div>
                  <LegacyProfileView student={student} supervisor={supervisor} onUpdate={fetchData} />
               </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
