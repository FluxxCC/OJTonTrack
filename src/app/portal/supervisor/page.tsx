"use client";
import React, { useEffect, useMemo, useState, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  LayoutDashboard, 
  CheckSquare, 
  User as UserIcon, 
  LogOut, 
  Menu,
  ChevronRight,
  Users,
  ClipboardCheck,
  BellRing,
  CalendarClock
} from 'lucide-react';
import { supabase } from "@/lib/supabaseClient";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import dynamic from "next/dynamic";
import { 
  AttendanceView, 
  ProfileView,
  EvaluationView,
  EvaluationButton,
  EvaluationModal,
  SetOfficialTimeView,
  User
} from "./ui";
import ServiceWorkerRegister from "../../../components/ServiceWorkerRegister";

const DashboardView = dynamic(() => import('./ui').then(mod => mod.DashboardView), {
  ssr: false,
  loading: () => <div className="p-8 text-center text-gray-500">Loading dashboard...</div>
});

function SupervisorContent() {
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

  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "attendance" | "profile" | "evaluation" | "schedule">("dashboard");

  // Data State
  const [students, setStudents] = useState<User[]>([]);
  const [supervisorInfo, setSupervisorInfo] = useState<{ company?: string; location?: string } | null>(null);
  const [me, setMe] = useState<User | null>(null);
  const [myIdnumber, setMyIdnumber] = useState("");
  const [evalStatuses, setEvalStatuses] = useState<Record<string, boolean>>({});
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const evaluationOpenCount = useMemo(() => {
    const ids = new Set(students.map(s => String(s.idnumber).trim()));
    let count = 0;
    Object.entries(evalStatuses).forEach(([id, enabled]) => {
      if (enabled && ids.has(String(id).trim()) && !completedIds.has(String(id).trim())) count += 1;
    });
    return count;
  }, [students, evalStatuses, completedIds]);
  
  // Lifted State
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<User | null>(null);
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [evalComments, setEvalComments] = useState("");
  const [evalScore, setEvalScore] = useState(5);
  const [isSubmittingEval, setIsSubmittingEval] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; title: string; message: string }[]>([]);
  const pushToast = (title: string, message: string) => {
    const id = String(Date.now() + Math.random());
    setToasts((prev) => [...prev, { id, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  // User Info - Client Side Only to avoid Hydration Mismatch
  useEffect(() => {
    try {
      const stored = localStorage.getItem("idnumber");
      if (stored) setMyIdnumber(stored.trim());
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchStatuses = async () => {
      try {
        const res = await fetch("/api/evaluation-status", { cache: "no-store" });
        if (!res.ok) {
          return;
        }
        const json = await res.json();
        if (!cancelled && Array.isArray(json.statuses)) {
          const map: Record<string, boolean> = {};
          json.statuses.forEach((s: any) => {
            if (s.idnumber) map[String(s.idnumber).trim()] = s.enabled;
          });
          setEvalStatuses(map);
        }
      } catch {
      }
    };

    fetchStatuses();
    const interval = setInterval(fetchStatuses, 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Fetch Completed Evaluations
  useEffect(() => {
    if (!myIdnumber) return;
    const fetchCompleted = async () => {
      try {
        const res = await fetch(`/api/evaluation?supervisor_id=${encodeURIComponent(myIdnumber)}`, { cache: 'no-store' });
        if (res.ok) {
           const json = await res.json();
           if (json.completedIds && Array.isArray(json.completedIds)) {
             setCompletedIds(new Set(json.completedIds.map((id: any) => String(id).trim())));
           }
        }
      } catch (e) {
        console.error("Failed to fetch completed evaluations", e);
      }
    };
    fetchCompleted();
  }, [myIdnumber, refreshKey]);
  
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      const data = event.data as any;
      if (data && data.type === 'notification-click' && data.url) {
        try {
          const u = new URL(String(data.url), window.location.origin);
          const tab = (u.searchParams.get("tab") || "").toLowerCase();
          if (tab) setActiveTab(tab as any);
          router.replace(u.pathname + (u.search || ""), { scroll: false });
        } catch {}
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handler);
    };
  }, [router]);

  const fetchBadgeCounts = async () => {
    try {
      const ids = students.map(s => s.idnumber).filter(Boolean);
      if (!supabase || ids.length === 0) {
        setPendingApprovalsCount(0);
        return;
      }
      const { count } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .in('idnumber', ids)
        .eq('status', 'Pending');
      setPendingApprovalsCount(Number(count || 0));
    } catch {
      setPendingApprovalsCount(0);
    }
  };

  useEffect(() => {
    fetchBadgeCounts();
  }, [students]);

  useEffect(() => {
    if (!supabase) return;
    const idsSet = new Set(students.map(s => String(s.idnumber).trim()));
    const ch = supabase
      .channel('supervisor-badges-attendance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, async (payload: RealtimePostgresChangesPayload<any>) => {
        const row = payload.new as { idnumber?: string; status?: string; type?: string; createdat?: string; ts?: string } | null;
        const oldRow = payload.old as { idnumber?: string; status?: string } | null;
        
        const rowId = row?.idnumber ? String(row.idnumber).trim() : "";
        const oldRowId = oldRow?.idnumber ? String(oldRow.idnumber).trim() : "";

        const inScopeNew = rowId && idsSet.has(rowId);
        const inScopeOld = oldRowId && idsSet.has(oldRowId);

        if (payload.eventType === 'INSERT') {
          if (inScopeNew) {
             const student = students.find(s => String(s.idnumber).trim() === rowId);
             const name = student ? `${student.firstname} ${student.lastname}` : (rowId || 'Student');
             const type = row!.type === 'in' ? "Times in" : "Times out";
             // Use ts (timestamp) if createdat is missing
             const timeMs = row!.ts ? Number(row!.ts) : (row!.createdat ? new Date(row!.createdat).getTime() : Date.now());
             const message = `${name} ${type}`;

             // 1. In-App Toast (Always show)
             pushToast("Attendance Update", message);

             try {
                fetch('/api/push/send-attendance', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ idnumber: myIdnumber, message, origin: window.location.origin })
                }).catch(() => {});
             } catch {}

             if (String(row!.status).trim() === 'Pending') {
               setPendingApprovalsCount(c => c + 1);
             }
          }
        } else if (payload.eventType === 'UPDATE') {
          const wasPending = inScopeOld && String(oldRow!.status).trim() === 'Pending';
          const isPending = inScopeNew && String(row!.status).trim() === 'Pending';
          if (wasPending && !isPending) {
            setPendingApprovalsCount(c => Math.max(0, c - 1));
          } else if (!wasPending && isPending) {
            setPendingApprovalsCount(c => c + 1);
          }
        } else if (payload.eventType === 'DELETE') {
          if (inScopeOld && String(oldRow!.status).trim() === 'Pending') {
            setPendingApprovalsCount(c => Math.max(0, c - 1));
          }
        }
      })
      .subscribe();
    fetchBadgeCounts();
    return () => {
      try { supabase?.removeChannel(ch); } catch {}
    };
  }, [students]);
  // Handle Selection Persistence
  useEffect(() => {
    if (students.length === 0) return;
    const tab = (searchParams.get("tab") || "").toLowerCase();
    if (tab === "attendance" || tab === "evaluation" || tab === "profile" || tab === "dashboard" || tab === "schedule") {
      setActiveTab(tab as any);
    }
    const id = searchParams.get("studentId");
    if (id) {
      const s = students.find(x => x.idnumber === id);
      if (s) {
         if (!selected || selected.idnumber !== id) setSelected(s);
      }
    }
  }, [students, searchParams]);

  // Auto-close modal if evaluation is disabled (Realtime Toggle Off)
  useEffect(() => {
    if (showEvalModal && selected) {
      const id = String(selected.idnumber).trim();
      // Only close if we have explicit status false (locked)
      // If it's undefined, we assume it's loading or not set, but if we opened it, it must have been allowed.
      // So we check if it is explicitly false.
      if (evalStatuses[id] === false) {
         setShowEvalModal(false);
         // Optional: Add a toast notification here if we had a toast system
         alert("Evaluation has been locked by the instructor.");
      }
    }
  }, [evalStatuses, selected, showEvalModal]);

  const handleSelect = (s: User | null) => {
    setSelected(s);
    const params = new URLSearchParams(searchParams.toString());
    if (s) {
      params.set("studentId", s.idnumber);
      if (activeTab === "dashboard") {
        params.delete("tab");
      }
    } else {
      params.delete("studentId");
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const handleSubmitEvaluation = async (payload: {
    overallScore: number;
    overallPercent: number;
    interpretation: string;
    criteria: Record<string, number>;
    comments: string;
  }) => {
    if (!selected) return;
    setIsSubmittingEval(true);
    try {
      const res = await fetch("/api/evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idnumber: selected.idnumber,
          supervisor_id: myIdnumber,
          score: payload.overallPercent,
          comments: payload.comments,
          criteria: payload.criteria,
          interpretation: payload.interpretation,
          overallScore: payload.overallScore,
          submitted_at: new Date().toISOString()
        })
      });
      if (res.ok) {
        setShowEvalModal(false);
        setEvalComments("");
        setRefreshKey(prev => prev + 1);
        setCompletedIds(prev => {
          const next = new Set(prev);
          next.add(selected.idnumber);
          return next;
        });
      } else {
        alert("Failed to submit evaluation.");
      }
    } catch (e) {
      console.error(e);
      alert("Error submitting evaluation.");
    } finally {
      setIsSubmittingEval(false);
    }
  };

  // --- Effects ---

  // Handle Resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-close sidebar on mobile
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
    else setSidebarOpen(true);
  }, [isMobile]);

  // Fetch Data
  const fetchSupervisorData = async () => {
      if (!myIdnumber) return;
      try {
        // Fetch Me
        const resMe = await fetch(`/api/users?idnumber=${encodeURIComponent(myIdnumber)}`, { cache: "no-store" });
        const jsonMe = await resMe.json();
        if (jsonMe.users && jsonMe.users.length > 0) {
           const myself = jsonMe.users[0];
           setMe(myself);
           setSupervisorInfo({ company: myself.company, location: myself.location });
        }

        // Fetch Assigned Students
        const resStudents = await fetch(`/api/users?supervisor_id=${encodeURIComponent(myIdnumber)}&role=student&limit=10000`, { cache: "no-store" });
        const jsonStudents = await resStudents.json();
        
        if (Array.isArray(jsonStudents.users)) {
          console.log(`[Supervisor] Loaded ${jsonStudents.users.length} students for supervisor ${myIdnumber}`);
          setStudents(jsonStudents.users);
        }
      } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchSupervisorData();
  }, [myIdnumber]);

  // Visibility Change Listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Supervisor] App foregrounded, refreshing data...');
        fetchSupervisorData();
        fetchBadgeCounts();
        setRefreshKey(prev => prev + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [myIdnumber]);

  // Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      localStorage.clear();
    } catch (e) {
      console.error("Logout failed", e);
    }
    router.replace("/");
  };

  // Menu Items
  const menuItems = [
    { id: "dashboard", label: "Account Monitoring", icon: LayoutDashboard },
    { id: "evaluation", label: "Evaluation", icon: ClipboardCheck },
    { id: "schedule", label: "Set Official Time", icon: CalendarClock },
    { id: "profile", label: "Profile", icon: UserIcon },
  ];

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
          <Image src="/icons-512.png" alt="CITE Logo" width={40} height={40} className="w-10 h-10 rounded-xl shadow-sm object-cover" />
          <div>
            <h1 className="font-extrabold text-xl text-gray-900 tracking-tight leading-none">OJTonTrack</h1>
            <p className="text-xs font-medium text-[#F97316] uppercase tracking-wider mt-0.5">Supervisor Portal</p>
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
                <div className="flex items-center gap-2">
                  {item.id === "attendance" && pendingApprovalsCount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-red-50 text-red-700 border-red-200">
                      {pendingApprovalsCount}
                    </span>
                  )}
                  {item.id === "evaluation" && evaluationOpenCount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-blue-50 text-blue-700 border-blue-200">
                      {evaluationOpenCount > 9 ? "9+" : evaluationOpenCount}
                    </span>
                  )}
                  {isActive && <ChevronRight size={16} className="text-white/80" strokeWidth={3} />}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Profile Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[#F97316] font-bold shadow-sm">
              {(me?.firstname || "S").charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">
                {me?.firstname} {me?.lastname}
              </p>
              <p className="text-xs text-gray-500 truncate">{me?.idnumber}</p>
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
            <div className="relative lg:hidden -ml-2">
              <button 
                onClick={() => setSidebarOpen(!isSidebarOpen)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Menu size={24} />
              </button>
              <div className="absolute -top-1 -right-1 flex items-center gap-1">
                {pendingApprovalsCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold border bg-red-50 text-red-700 border-red-200 shadow-sm">
                    {pendingApprovalsCount > 9 ? "9+" : pendingApprovalsCount}
                  </span>
                )}
                {evaluationOpenCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold border bg-blue-50 text-blue-700 border-blue-200 shadow-sm">
                    {evaluationOpenCount > 9 ? "9+" : evaluationOpenCount}
                  </span>
                )}
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 capitalize tracking-tight">
                {menuItems.find(i => i.id === activeTab)?.label || activeTab}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden lg:block" />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            {activeTab === 'dashboard' && (
              <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading...</div>}>
                <DashboardView 
                  students={students} 
                  myIdnumber={myIdnumber} 
                  supervisorInfo={supervisorInfo}
                  selected={selected}
                  onSelect={handleSelect}
                  refreshKey={refreshKey}
                />
              </Suspense>
            )}
            {activeTab === 'evaluation' && (
              <EvaluationView 
                students={students} 
                evalPermissions={evalStatuses}
                completedIds={completedIds}
                onOpenModal={(s) => {
                  setSelected(s);
                  setEvalScore(5);
                  setEvalComments("");
                  setShowEvalModal(true);
                }}
              />
            )}
            {activeTab === 'schedule' && <SetOfficialTimeView students={students} myIdnumber={myIdnumber} />}
            {activeTab === 'profile' && <ProfileView user={me} />}
          </div>
        </main>

        {/* Modal */}
        <EvaluationModal 
          isOpen={showEvalModal}
          onClose={() => setShowEvalModal(false)}
          selected={selected}
          evalScore={evalScore}
          setEvalScore={setEvalScore}
          evalComments={evalComments}
          setEvalComments={setEvalComments}
          isSubmitting={isSubmittingEval}
          onSubmit={handleSubmitEvaluation}
        />
        {toasts.length > 0 && (
          <div className="fixed top-24 right-4 z-50 space-y-3">
            {toasts.map(t => (
              <div key={t.id} className="w-80 bg-white border border-gray-200 shadow-xl rounded-xl p-4 flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-100 text-[#F97316] flex items-center justify-center">
                  <BellRing size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900">{t.title}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{t.message}</p>
                </div>
                <button
                  aria-label="Close"
                  onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SupervisorPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading supervisor portal...</div>}>
      <>
        <ServiceWorkerRegister />
        <SupervisorContent />
      </>
    </Suspense>
  );
}
