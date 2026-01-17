"use client";
import React, { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { AttendanceDetailsModal } from "@/components/AttendanceDetailsModal";
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
  Check,
  Clock,
  CheckCircle2,
  ClipboardCheck,
  UserCheck,
  Download,
  MessageSquare,
  Calendar,
  Plus
} from 'lucide-react';

// --- Types ---
export type AttendanceEntry = { id?: number; type: "in" | "out"; timestamp: number; photoDataUrl: string; photourl?: string; photoUrl?: string; status?: "Pending" | "Approved" | "Rejected"; validatedAt?: number };
export type ServerAttendanceEntry = {
  id: number;
  type: "in" | "out";
  ts: number;
  photourl: string;
  status: string;
  validated_by?: string | null;
  validated_at?: string | null;
};
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
};
export type ApprovalRow = {
  id: number;
  idnumber: string;
  name: string;
  type: "in" | "out";
  dateLabel: string;
  timeLabel: string;
  approved: boolean;
  photourl?: string;
  ts: number;
};

// --- Helpers ---
function formatDuration(ms: number): string {
  if (ms <= 0) return "-";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

// --- Components ---
export function EvaluationButton({ 
  isEnabled, 
  onOpenModal 
}: { 
  isEnabled: boolean; 
  onOpenModal: () => void; 
}) {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);
  const active = isClient ? isEnabled : false;
  return (
    <button
      type="button"
      onClick={() => {
        if (active) onOpenModal();
      }}
      disabled={!active}
      suppressHydrationWarning
      className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md flex items-center gap-2 text-white ${
        active
          ? "bg-green-600 hover:bg-green-700 shadow-green-200 ring-2 ring-green-200 ring-offset-1 cursor-pointer"
          : "bg-red-500 shadow-red-200 ring-2 ring-red-200 ring-offset-1 cursor-not-allowed opacity-80"
      }`}
      style={{ display: 'flex', visibility: 'visible', opacity: 1 }}
    >
      {active ? (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          <span>Evaluate Student</span>
        </>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          <span>Evaluation Locked</span>
        </>
      )}
    </button>
  );
}

// --- Set Official Time View ---
export function SetOfficialTimeView({ students }: { students: User[] }) {
  // Time Settings State
  const [timeSettings, setTimeSettings] = useState<{
    amIn: string;
    amOut: string;
    amOutTime: string; // "12:00"
    pmIn: string;
    pmInTime: string; // "13:00"
    pmOut: string;
  }>({ 
    amIn: "08:00", 
    amOut: "12:00", 
    amOutTime: "12:00", 
    pmIn: "13:00", 
    pmInTime: "13:00", 
    pmOut: "17:00"
  });

  const [isSaving, setIsSaving] = useState(false);
  const [initialSettings, setInitialSettings] = useState<{
    amIn: string;
    amOut: string;
    pmIn: string;
    pmOut: string;
  } | null>(null);
  const [noChangeModal, setNoChangeModal] = useState(false);

  // Load global settings
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`schedule_default`);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Migration/Safety check for new fields
        const next = {
          amIn: parsed.amIn || "08:00",
          amOut: parsed.amOut || "12:00",
          amOutTime: parsed.amOutTime || parsed.amOut || "12:00",
          pmIn: parsed.pmIn || "13:00",
          pmInTime: parsed.pmInTime || parsed.pmIn || "13:00",
          pmOut: parsed.pmOut || "17:00"
        };
        setTimeSettings(next);
        setInitialSettings({
          amIn: next.amIn,
          amOut: next.amOut,
          pmIn: next.pmIn,
          pmOut: next.pmOut
        });
      } else {
        // Default
        const next = { 
          amIn: "08:00", 
          amOut: "12:00", 
          amOutTime: "12:00",
          pmIn: "13:00", 
          pmInTime: "13:00",
          pmOut: "17:00"
        };
        setTimeSettings(next);
        setInitialSettings({
          amIn: next.amIn,
          amOut: next.amOut,
          pmIn: next.pmIn,
          pmOut: next.pmOut
        });
      }
    } catch {
      const next = { 
        amIn: "08:00", 
        amOut: "12:00", 
        amOutTime: "12:00",
        pmIn: "13:00", 
        pmInTime: "13:00",
        pmOut: "17:00"
      };
      setTimeSettings(next);
      setInitialSettings({
        amIn: next.amIn,
        amOut: next.amOut,
        pmIn: next.pmIn,
        pmOut: next.pmOut
      });
    }
  }, []);

  const handleSave = async () => {
    if (
      initialSettings &&
      initialSettings.amIn === timeSettings.amIn &&
      initialSettings.amOut === timeSettings.amOut &&
      initialSettings.pmIn === timeSettings.pmIn &&
      initialSettings.pmOut === timeSettings.pmOut
    ) {
      setNoChangeModal(true);
      return;
    }

    setIsSaving(true);
    try {
      let supervisorId = "";
      try {
        supervisorId = typeof window !== "undefined" ? localStorage.getItem("idnumber") || "" : "";
      } catch {
        supervisorId = "";
      }
      localStorage.setItem(`schedule_default`, JSON.stringify(timeSettings));
      students.forEach(s => {
        if (s.idnumber) {
          localStorage.setItem(`schedule_${s.idnumber}`, JSON.stringify(timeSettings));
        }
      });

      let savedToDb = false;

      if (supabase) {
        const today = new Date();
        const effectiveDate = today.toISOString().split("T")[0];
        const rows = [
          {
            shift_name: "Morning Shift",
            official_start: timeSettings.amIn,
            official_end: timeSettings.amOut,
            supervisor_id: supervisorId || null,
            effective_date: effectiveDate,
          },
          {
            shift_name: "Afternoon Shift",
            official_start: timeSettings.pmIn,
            official_end: timeSettings.pmOut,
            supervisor_id: supervisorId || null,
            effective_date: effectiveDate,
          },
        ];

        const { error } = await supabase
          .from("shifts")
          .upsert(rows, { onConflict: "shift_name" });

        if (error) {
          console.error("Failed to save schedule via Supabase client", error.message || error);
        } else {
          savedToDb = true;
        }
      }

      if (!savedToDb) {
        const res = await fetch("/api/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amIn: timeSettings.amIn,
            amOut: timeSettings.amOut,
            pmIn: timeSettings.pmIn,
            pmOut: timeSettings.pmOut
          }),
        });

        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          console.error("Failed to save schedule to database", json?.error || res.statusText);
        }
      }

      alert("Schedule saved successfully for all students!");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 mb-6 flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
           <Clock size={24} />
        </div>
        <div>
           <h2 className="text-xl font-bold text-gray-900">Official Schedule</h2>
           <p className="text-sm text-gray-500">Set the required working hours for all your students.</p>
        </div>
      </div>

      {noChangeModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">No Changes Detected</h2>
            <p className="text-gray-700 mb-4">
              The official schedule has not been modified. Please adjust the times before saving to avoid creating duplicate entries.
            </p>
            <button
              onClick={() => setNoChangeModal(false)}
              className="w-full px-4 py-2 bg-[#F97316] text-white rounded-xl font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Settings View */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        <div className="max-w-xl mx-auto w-full space-y-8">
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
              <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </div>
              <div>
                 <h3 className="font-bold text-gray-900">Standard Schedule</h3>
                 <p className="text-xs text-gray-500">This schedule will apply to all students under your supervision.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
                 <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    Morning Shift
                 </h4>
                 <div>
                   <label className="block text-sm font-bold text-gray-900 mb-1">Time In</label>
                   <input 
                     type="time" 
                     value={timeSettings.amIn}
                     onClick={(e) => e.currentTarget.showPicker()}
                     onChange={(e) => setTimeSettings(prev => ({ ...prev, amIn: e.target.value }))}
                     className="w-full rounded-xl border border-gray-400 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all shadow-sm"
                   />
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-gray-900 mb-1">Time Out</label>
                   <input 
                     type="time" 
                     value={timeSettings.amOut}
                     onClick={(e) => e.currentTarget.showPicker()}
                     onChange={(e) => setTimeSettings(prev => ({ ...prev, amOut: e.target.value }))}
                     className="w-full rounded-xl border border-gray-400 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all shadow-sm"
                   />
                 </div>
              </div>

              <div className="space-y-4">
                 <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    Afternoon Shift
                 </h4>
                 <div>
                   <label className="block text-sm font-bold text-gray-900 mb-1">Time In</label>
                   <input 
                     type="time" 
                     value={timeSettings.pmIn}
                     onClick={(e) => e.currentTarget.showPicker()}
                     onChange={(e) => setTimeSettings(prev => ({ ...prev, pmIn: e.target.value }))}
                     className="w-full rounded-xl border border-gray-400 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all shadow-sm"
                   />
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-gray-900 mb-1">Time Out</label>
                   <input 
                     type="time" 
                     value={timeSettings.pmOut}
                     onClick={(e) => e.currentTarget.showPicker()}
                     onChange={(e) => setTimeSettings(prev => ({ ...prev, pmOut: e.target.value }))}
                     className="w-full rounded-xl border border-gray-400 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all shadow-sm"
                   />
                 </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-8 py-3 rounded-xl bg-[#F97316] text-white font-bold shadow-lg shadow-orange-200 hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                  Save Schedule
                </>
              )}
            </button>
          </div>
        </div>
    </div>
    </div>
  );
}

export function EvaluationModal({
  isOpen, onClose, selected,
  evalScore, setEvalScore,
  evalComments, setEvalComments,
  isSubmitting, onSubmit
}: {
  isOpen: boolean;
  onClose: () => void;
  selected: User | null;
  evalScore: number;
  setEvalScore: (n: number) => void;
  evalComments: string;
  setEvalComments: (s: string) => void;
  isSubmitting: boolean;
  onSubmit: (payload: {
    overallScore: number;
    overallPercent: number;
    interpretation: string;
    criteria: Record<string, number>;
    comments: string;
  }) => void;
}) {
  if (!isOpen || !selected) return null;
  const rubric = [
    { id: "quantity_of_work", title: "Quantity of Work", items: [
      { id: "quantity_volume", label: "Considers volume of assignment completed on time as compared with standards." },
      { id: "quantity_replace", label: "Is willing to replace an absent trainee if needed." },
    ]},
    { id: "quality_of_work", title: "Quality of Work", items: [
      { id: "quality_serious", label: "Serious in his/her work, accurate/enjoy what he/she is doing." },
      { id: "quality_housekeeping", label: "Follows good housekeeping even if without order of the superior." },
    ]},
    { id: "job_competence", title: "Job Competence", items: [
      { id: "competence_knowledge", label: "Considers knowledge and skills required of the job." },
    ]},
    { id: "dependability", title: "Dependability", items: [
      { id: "depend_follow", label: "Considers reliability in following instructions and procedure." },
      { id: "depend_trust", label: "Can be depended upon when things go wrong." },
    ]},
    { id: "initiative", title: "Initiative", items: [
      { id: "init_help", label: "Goes out his/her way to perform things which will help the company even if it is not his/her responsibility." },
      { id: "init_volunteer", label: "Volunteers to do the job when needed." },
    ]},
    { id: "cooperative", title: "Cooperative", items: [
      { id: "coop_trainee", label: "Considers how well he/she can get along with his/her co-trainee." },
      { id: "coop_superior", label: "Considers how well he/she can get along with his/her superior." },
      { id: "coop_owner", label: "Considers how well he/she can get along with owner/managers." },
    ]},
    { id: "loyalty", title: "Loyalty", items: [
      { id: "loyal_protect", label: "Protects the company." },
      { id: "loyal_trust", label: "Can be trusted." },
      { id: "loyal_policy", label: "Follows policies/objectives of the company." },
    ]},
    { id: "judgment", title: "Judgment", items: [
      { id: "judge_grasp", label: "Considers ability to grasp problem. Can follow instruction." },
      { id: "judge_decide", label: "Knows how to decide when needed." },
    ]},
    { id: "attendance", title: "Attendance", items: [
      { id: "attend_regular", label: "Regular in his/her work schedule. Does not absent without prior leave." },
      { id: "attend_punctual", label: "Always punctual in work schedule. Does not come in late." },
    ]},
    { id: "customer_service", title: "Customer Service", items: [
      { id: "cs_practice", label: "Practices good customer service." },
      { id: "cs_never_argue", label: "Never argues/fights with customer." },
      { id: "cs_greet", label: "Greets customer(s)." },
    ]},
  ];
  const [criteria, setCriteria] = useState<Record<string, number | null>>(() => {
    const init: Record<string, number | null> = {};
    rubric.forEach(cat => cat.items.forEach(i => { init[i.id] = null; }));
    return init;
  });
  const scores = Object.values(criteria).filter((v): v is number => typeof v === "number");
  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const overallPercent = Math.round(avg);
  const interp = scores.length === 0
    ? ""
    : overallPercent >= 95 ? "Excellent"
    : overallPercent >= 86 ? "Very Good"
    : overallPercent >= 79 ? "Good"
    : overallPercent >= 75 ? "Fair"
    : "Needs Improvement";
  const totalRequired = rubric.reduce((sum, cat) => sum + cat.items.length, 0);
  const filledCount = Object.values(criteria).filter(v => typeof v === "number").length;
  const hasComments = evalComments.trim().length > 0;
  const isComplete = filledCount === totalRequired && hasComments;
  const submitPayload = () => onSubmit({
    overallScore: avg,
    overallPercent,
    interpretation: interp || null as unknown as string,
    criteria: criteria as Record<string, number>,
    comments: evalComments
  });
  const gradeTags = [
    { label: "Excellent", range: "99–95" },
    { label: "Very Good", range: "94–86" },
    { label: "Good", range: "85–79" },
    { label: "Fair", range: "78–75" },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <h3 className="font-bold text-gray-900">Evaluate Student</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="text-sm text-gray-600">
            Evaluating <span className="font-bold text-gray-900">{selected.firstname} {selected.lastname}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {filledCount}/{totalRequired} fields completed
            </span>
            {!isComplete && (
              <span className="text-xs text-red-600">
                Complete all fields to enable submission
              </span>
            )}
          </div>
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Grade Interpretation</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {gradeTags.map((t) => (
                <div key={t.label} className="rounded-lg bg-white border border-gray-200 px-3 py-2">
                  <div className="text-xs font-bold text-gray-900">{t.label}</div>
                  <div className="text-[11px] text-gray-500">{t.range}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {rubric.map(cat => (
              <div key={cat.id} className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
                <div className="text-sm font-bold text-gray-900 mb-2">{cat.title}</div>
                <div className="space-y-3">
                  {cat.items.map(item => (
                    <div key={item.id} className="space-y-2">
                      <div className="text-xs text-gray-600">{item.label}</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={criteria[item.id] ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const valNum = Number(raw);
                            const val = Number.isFinite(valNum) ? Math.max(1, Math.min(100, valNum)) : null;
                            const next = { ...criteria, [item.id]: val };
                            setCriteria(next);
                          }}
                          placeholder="1–100"
                          className="w-24 sm:w-28 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 placeholder:text-xs placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-[#F97316]/20 border border-gray-300 bg-white shadow-sm focus:border-[#F97316]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Comments / Remarks</label>
            <textarea
              value={evalComments}
              onChange={e => setEvalComments(e.target.value)}
              className={`w-full h-40 rounded-xl p-4 text-sm font-medium text-gray-900 placeholder-gray-500 outline-none resize-y focus:ring-2 focus:ring-[#F97316]/20 ${
                hasComments ? "border-gray-300 focus:border-[#F97316]" : "border-red-300 focus:border-red-400"
              }`}
              placeholder="Write remarks..."
            />
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submitPayload}
            disabled={isSubmitting || !isComplete}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#F97316] hover:bg-[#EA580C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-orange-200"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Submitting...
              </>
            ) : (
              "Submit Evaluation"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function StudentAttendanceDetailView({
  student, attendance, onBack, onValidate, onRefresh
}: {
  student: User;
  attendance: AttendanceEntry[];
  onBack: () => void;
  onValidate: (entry: AttendanceEntry, action: 'approve' | 'reject' | 'reset') => void;
  onRefresh?: () => void;
}) {
  const [logs, setLogs] = useState<AttendanceEntry[]>(attendance);
  const [now, setNow] = useState(() => Date.now());
  const [selectedImage, setSelectedImage] = useState<{ url: string, timestamp: number } | null>(null);
  const [overtimeModal, setOvertimeModal] = useState<{ isOpen: boolean; date: Date | null; defaultStart?: string }>({ isOpen: false, date: null });
  const [otInTime, setOtInTime] = useState("");
  const [otHours, setOtHours] = useState(0);
  const [otMinutes, setOtMinutes] = useState(0);
  const [isSavingOt, setIsSavingOt] = useState(false);
  const [scheduleSettings, setScheduleSettings] = useState<{
    amIn: string;
    amOut: string;
    pmIn: string;
    pmOut: string;
    overtimeIn: string;
    overtimeOut: string;
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkValidating, setIsBulkValidating] = useState(false);
  const [monthFilter, setMonthFilter] = useState("");

  useEffect(() => {
    setLogs(attendance);
    setSelectedIds(new Set());
  }, [attendance]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    try {
        const key = `schedule_${student.idnumber}`;
        const saved = localStorage.getItem(key) || localStorage.getItem("schedule_default");
        if (saved) {
            setScheduleSettings(JSON.parse(saved));
        }
    } catch (e) {
        console.error("Failed to load schedule settings", e);
    }
  }, [student.idnumber]);

  useEffect(() => {
    if (!supabase) return;
    const id = student.idnumber;
    if (!id) return;
    type RTEntry = ServerAttendanceEntry & { id: number; idnumber: string };
    const channel = supabase
      .channel(`student_attendance_detail_${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "attendance", filter: `idnumber=eq.${id}` },
        (payload: RealtimePostgresChangesPayload<RTEntry>) => {
          const e = payload.new as RTEntry;
          if (!e) return;
          const sStr = String(e.status || "").trim().toLowerCase();
          const isRejected = sStr === "rejected";
          const isApproved = sStr === "approved" || (!!e.validated_by && !isRejected);
          const entry: AttendanceEntry = {
            id: e.id,
            type: e.type,
            timestamp: Number(e.ts),
            photoDataUrl: e.photourl,
            status: isRejected ? "Rejected" : isApproved ? "Approved" : "Pending",
            validatedAt: e.validated_at ? Number(new Date(e.validated_at).getTime()) : undefined
          };
          setLogs(prev => {
            const others = prev.filter(x => x.id !== entry.id);
            const next = [...others, entry];
            return next.slice().sort((a, b) => a.timestamp - b.timestamp);
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "attendance", filter: `idnumber=eq.${id}` },
        (payload: RealtimePostgresChangesPayload<RTEntry>) => {
          const e = payload.new as RTEntry;
          if (!e) return;
          const sStr = String(e.status || "").trim().toLowerCase();
          const isRejected = sStr === "rejected";
          const isApproved = sStr === "approved" || (!!e.validated_by && !isRejected);
          const updatedStatus: "Pending" | "Approved" | "Rejected" =
            isRejected ? "Rejected" : isApproved ? "Approved" : "Pending";
          const updatedValidatedAt = e.validated_at ? Number(new Date(e.validated_at).getTime()) : undefined;
          const tsNum = Number(e.ts);
          const idNum = e.id;
          setLogs(prev =>
            prev
              .map(log =>
                log.id === idNum
                  ? {
                      ...log,
                      timestamp: tsNum,
                      photoDataUrl: e.photourl,
                      status: updatedStatus,
                      validatedAt: updatedValidatedAt
                    }
                  : log
              )
              .slice()
              .sort((a, b) => a.timestamp - b.timestamp)
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "attendance", filter: `idnumber=eq.${id}` },
        (payload: RealtimePostgresChangesPayload<RTEntry>) => {
          const e = payload.old as RTEntry;
          if (!e) return;
          const idNum = e.id;
          setLogs(prev => prev.filter(log => log.id !== idNum));
        }
      )
      .subscribe();
    return () => {
      try {
        supabase?.removeChannel(channel);
      } catch {}
    };
  }, [student.idnumber]);

  // Helper to format hours
  const formatHours = (ms: number) => {
      if (!ms) return "0h 0m 0s";
      const totalSeconds = Math.floor(ms / 1000);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      return `${h}h ${m}m ${s}s`;
  };

  // Helper to format time
  const formatTime = (ts: number) => {
      return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };

  const getEntryPhoto = (entry?: AttendanceEntry | null) => {
      if (!entry) return "";
      return entry.photoDataUrl || entry.photourl || entry.photoUrl || "";
  };

  const toggleSlotPairSelection = (entryIn?: AttendanceEntry | null, entryOut?: AttendanceEntry | null) => {
    if (!entryIn || entryIn.id == null) return;
    const ids: number[] = [];
    ids.push(Number(entryIn.id));
    if (entryOut && entryOut.id != null) {
      ids.push(Number(entryOut.id));
    }
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = ids.every(id => next.has(id));
      if (allSelected) {
        ids.forEach(id => next.delete(id));
      } else {
        ids.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const isSlotPairSelected = (entryIn?: AttendanceEntry | null, entryOut?: AttendanceEntry | null) => {
    const ids: number[] = [];
    if (entryIn && entryIn.id != null) ids.push(Number(entryIn.id));
    if (entryOut && entryOut.id != null) ids.push(Number(entryOut.id));
    if (ids.length === 0) return false;
    return ids.every(id => selectedIds.has(id));
  };

  const selectAllPending = () => {
    const ids = new Set<number>();

    days.forEach(day => {
      [day.s1, day.s2, day.s3, day.s4, day.s5, day.s6].forEach(slot => {
        if (!slot || slot.id == null) return;
        const status = (slot.status || "Pending").toString().trim();
        if (status === "Pending") {
          ids.add(Number(slot.id));
        }
      });
    });

    setSelectedIds(ids);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const bulkValidate = (action: "approve" | "reject") => {
    if (selectedIds.size === 0) return;
    setIsBulkValidating(true);
    const ids = Array.from(selectedIds);
    const entries = logs.filter(e => e.id != null && ids.includes(Number(e.id)));
    entries.forEach(entry => onValidate(entry, action));
    setSelectedIds(new Set());
    setIsBulkValidating(false);
    if (onRefresh) onRefresh();
  };

  const monthOptions = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach(a => {
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
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (!monthFilter) return logs;
    return logs.filter(a => {
      const d = new Date(a.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return key === monthFilter;
    });
  }, [logs, monthFilter]);

  const statusCounts = useMemo(() => {
    const counts = { Pending: 0, Approved: 0, Rejected: 0 };
    filteredLogs.forEach(a => {
      const s = a.status || "Pending";
      if (s === "Approved") counts.Approved += 1;
      else if (s === "Rejected") counts.Rejected += 1;
      else counts.Pending += 1;
    });
    return counts;
  }, [filteredLogs]);

  const handleSaveOvertime = async () => {
    if (!overtimeModal.date || !otInTime || (otHours === 0 && otMinutes === 0)) return;
    setIsSavingOt(true);
    try {
        const supervisorId = localStorage.getItem("idnumber") || "";
        
        const [inH, inM] = otInTime.split(':').map(Number);
        
        const tsIn = new Date(overtimeModal.date);
        tsIn.setHours(inH, inM, 0, 0);
        
        const durationMs = (otHours * 60 * 60 * 1000) + (otMinutes * 60 * 1000);
        const tsOut = new Date(tsIn.getTime() + durationMs);
        
        // Save IN
        await fetch("/api/attendance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                idnumber: student.idnumber,
                type: "in",
                timestamp: tsIn.getTime(),
                validated_by: supervisorId
            })
        });

        // Save OUT
        await fetch("/api/attendance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                idnumber: student.idnumber,
                type: "out",
                timestamp: tsOut.getTime(),
                validated_by: supervisorId
            })
        });

        alert("Overtime set successfully!");
        setOvertimeModal({ isOpen: false, date: null });
        setOtInTime("");
        setOtHours(0);
        setOtMinutes(0);
        if (onRefresh) onRefresh();
    } catch (e) {
        alert("Failed to save overtime");
    } finally {
        setIsSavingOt(false);
    }
  };

  const { days, overallTotal, overallValidated } = useMemo(() => {
      const studentLogs = filteredLogs;
      
      const grouped = new Map<string, { date: Date, logs: AttendanceEntry[] }>();
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

              const baseDate = new Date(day.date);
              baseDate.setHours(0, 0, 0, 0);

              const buildShift = (timeStr: string) => {
                  const [h, m] = timeStr.split(":").map(Number);
                  const d = new Date(baseDate.getTime());
                  d.setHours(h || 0, m || 0, 0, 0);
                  return d.getTime();
              };

              let schedule = {
                  amIn: buildShift("07:00"),
                  amOut: buildShift("11:00"),
                  pmIn: buildShift("13:00"),
                  pmOut: buildShift("17:00"),
                  otStart: buildShift("17:00"),
                  otEnd: buildShift("18:00"),
              };

              if (scheduleSettings) {
                  schedule = {
                      amIn: buildShift(scheduleSettings.amIn || "07:00"),
                      amOut: buildShift(scheduleSettings.amOut || "11:00"),
                      pmIn: buildShift(scheduleSettings.pmIn || "13:00"),
                      pmOut: buildShift(scheduleSettings.pmOut || "17:00"),
                      otStart: buildShift(scheduleSettings.overtimeIn || "17:00"),
                      otEnd: buildShift(scheduleSettings.overtimeOut || "18:00"),
                  };
              }

              const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

              const findPairDuration = (
                  logs: AttendanceEntry[],
                  windowStart: number,
                  windowEnd: number,
                  requireApproved: boolean
              ) => {
                  const earlyWindowStart = windowStart - 30 * 60 * 1000;
                  let currentIn: number | null = null;
                  let duration = 0;

                  logs.forEach(log => {
                      if (requireApproved && log.status !== "Approved") return;
                      if (log.type === "in") {
                          if (log.timestamp > windowEnd) return;
                          if (log.timestamp < earlyWindowStart) return;
                          const effectiveIn = clamp(log.timestamp, windowStart, windowEnd);
                          currentIn = effectiveIn;
                      } else if (log.type === "out") {
                          if (currentIn === null) return;
                          const effectiveOut = clamp(log.timestamp, windowStart, windowEnd);
                          if (effectiveOut > currentIn) {
                              duration += effectiveOut - currentIn;
                          }
                          currentIn = null;
                      }
                  });

                  if (!requireApproved && currentIn !== null) {
                      const effectiveOut = clamp(now, windowStart, windowEnd);
                      if (effectiveOut > currentIn) {
                          duration += effectiveOut - currentIn;
                      }
                  }

                  return duration;
              };

              const dayTotalAm = findPairDuration(dayLogs, schedule.amIn, schedule.amOut, false);
              const dayTotalPm = findPairDuration(dayLogs, schedule.pmIn, schedule.pmOut, false);
              const dayTotalOt = findPairDuration(dayLogs, schedule.otStart, schedule.otEnd, false);

              const dayValidatedAm = findPairDuration(dayLogs, schedule.amIn, schedule.amOut, true);
              const dayValidatedPm = findPairDuration(dayLogs, schedule.pmIn, schedule.pmOut, true);
              const dayValidatedOt = findPairDuration(dayLogs, schedule.otStart, schedule.otEnd, true);

              const dayTotalMs = dayTotalAm + dayTotalPm + dayTotalOt;
              const dayValidatedMs = dayValidatedAm + dayValidatedPm + dayValidatedOt;

              totalMsAll += dayTotalMs;
              totalValidatedMsAll += dayValidatedMs;

              const classifySegment = (ts: number) => {
                  const h = new Date(ts).getHours();
                  return h < 12 ? "morning" : "afternoon";
              };

              const morningSegLogs = dayLogs.filter(l => classifySegment(l.timestamp) === "morning");
              const afternoonSegLogs = dayLogs.filter(l => classifySegment(l.timestamp) === "afternoon");

              const s1 = morningSegLogs.find(l => l.type === "in") || null;
              const s2 = [...morningSegLogs].filter(l => l.type === "out").pop() || null;
              const s3 = afternoonSegLogs.find(l => l.type === "in") || null;
              const s4 = [...afternoonSegLogs].filter(l => l.type === "out").pop() || null;

              const s5 =
                  (() => {
                      const overtimeLogs = dayLogs.filter(l => l.timestamp >= schedule.otStart && l.timestamp <= schedule.otEnd);
                      return overtimeLogs.find(l => l.type === "in") || null;
                  })();
              const s6 =
                  (() => {
                      const overtimeLogs = dayLogs.filter(l => l.timestamp >= schedule.otStart && l.timestamp <= schedule.otEnd);
                      return [...overtimeLogs].filter(l => l.type === "out").pop() || null;
                  })();

              const overtimeMs = dayTotalOt;

              return { date: day.date, s1, s2, s3, s4, s5, s6, dayTotalMs, overtimeMs };
          });

      return { days: processedDays, overallTotal: totalMsAll, overallValidated: totalValidatedMsAll };
  }, [filteredLogs, scheduleSettings, now]);

  const selectedPairCount = useMemo(() => {
    let count = 0;
    days.forEach(day => {
        // Morning Pair
        if ((day.s1?.id && selectedIds.has(Number(day.s1.id))) || (day.s2?.id && selectedIds.has(Number(day.s2.id)))) {
            count++;
        }
        // Afternoon Pair
        if ((day.s3?.id && selectedIds.has(Number(day.s3.id))) || (day.s4?.id && selectedIds.has(Number(day.s4.id)))) {
            count++;
        }
        // Overtime Pair
        if ((day.s5?.id && selectedIds.has(Number(day.s5.id))) || (day.s6?.id && selectedIds.has(Number(day.s6.id)))) {
            count++;
        }
    });
    return count;
  }, [days, selectedIds]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex items-center gap-4">
             <button 
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500 hover:text-gray-900"
             >
                <ChevronLeft size={24} />
             </button>
             <div>
                <h2 className="text-2xl font-bold text-gray-900">{student.firstname} {student.lastname}</h2>
                <p className="text-gray-500 text-sm">Attendance History & Performance</p>
             </div>
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-center justify-between shadow-sm">
                <div>
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Total Hours</p>
                    <p className="text-3xl font-bold text-blue-900">{formatHours(overallTotal)}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl">
                     <Clock className="text-blue-600" size={24} />
                </div>
            </div>
            <div className="bg-green-50 p-6 rounded-2xl border border-green-100 flex items-center justify-between shadow-sm">
                <div>
                    <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Total Validated Time</p>
                    <p className="text-3xl font-bold text-green-900">{formatHours(overallValidated)}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-xl">
                    <ClipboardCheck className="text-green-600" size={24} />
                </div>
            </div>
        </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 border-b border-gray-100 bg-gray-50">
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-semibold text-gray-800">Account Monitoring</div>
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
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
                  <button
                      type="button"
                      onClick={selectAllPending}
                      disabled={statusCounts.Pending === 0}
                      title={statusCounts.Pending === 0 ? "No pending logs to select" : "Select all pending logs"}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:border-orange-400 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      Select all pending
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                      {selectedIds.size > 0 && (
                          <>
                              <button
                                  type="button"
                                  onClick={() => bulkValidate("approve")}
                                  disabled={isBulkValidating}
                                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 whitespace-nowrap"
                              >
                                  Approve {selectedPairCount}
                              </button>
                              <button
                                  type="button"
                                  onClick={() => bulkValidate("reject")}
                                  disabled={isBulkValidating}
                                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 whitespace-nowrap"
                              >
                                  Reject {selectedPairCount}
                              </button>
                          </>
                      )}
                      <button
                          type="button"
                          onClick={clearSelection}
                          disabled={selectedIds.size === 0}
                          className="px-2 py-1 text-[11px] font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md whitespace-nowrap disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-500"
                      >
                          Clear
                      </button>
                  </div>
                </div>
            </div>
            <div className="overflow-x-auto hidden md:block">
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
                        {days.map((day, i) => (
                            <tr key={i} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap border-r border-gray-100">
                                    {day.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                </td>
                                {/* Slot Cells */}
                                {[day.s1, day.s2, day.s3, day.s4, day.s5, day.s6].map((slot, idx) => {
                                    const isMorningPair = idx === 0 || idx === 1;
                                    const isAfternoonPair = idx === 2 || idx === 3;
                                    const isOvertimePair = idx === 4 || idx === 5;

                                    let pairIn: AttendanceEntry | null = null;
                                    let pairOut: AttendanceEntry | null = null;
                                    let isInCell = false;

                                    if (isMorningPair) {
                                        pairIn = day.s1;
                                        pairOut = day.s2;
                                        isInCell = idx === 0;
                                    } else if (isAfternoonPair) {
                                        pairIn = day.s3;
                                        pairOut = day.s4;
                                        isInCell = idx === 2;
                                    } else if (isOvertimePair) {
                                        pairIn = day.s5;
                                        pairOut = day.s6;
                                        isInCell = idx === 4;
                                    }

                                    const pairSelected = isSlotPairSelected(pairIn, pairOut);

                                    return (
                                        <td key={idx} className="px-1.5 py-2 border-r border-gray-100 text-center align-top min-w-[100px]">
                                            {slot ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="flex items-center gap-2">
                                                        {isInCell && pairIn && (
                                                            <input
                                                                type="checkbox"
                                                                checked={pairSelected}
                                                                onChange={() => toggleSlotPairSelection(pairIn, pairOut)}
                                                                className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                            />
                                                        )}
                                                        <span className="text-xs font-semibold text-gray-900">
                                                            {formatTime(slot.timestamp)}
                                                        </span>
                                                    </div>
                                {getEntryPhoto(slot) && (
                                    <div 
                                        className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm group cursor-zoom-in bg-gray-100" 
                                        onClick={() => setSelectedImage({ url: getEntryPhoto(slot)!, timestamp: slot.timestamp })}
                                    >
                                        <img 
                                            src={getEntryPhoto(slot)} 
                                            alt="Log" 
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                            onError={(e) => {
                                                e.currentTarget.style.display = "none";
                                                e.currentTarget.parentElement?.classList.add("bg-red-50");
                                            }}
                                        />
                                    </div>
                                )}
                                <div className="flex gap-1.5 mt-1 justify-center h-8 items-center text-[11px] font-semibold">
                                                    {(() => {
                                                        const isAfternoonPairCell = idx === 2 || idx === 3;
                                                        const afternoonIn = day.s3;
                                                        const afternoonOut = day.s4;

                                                        if (isAfternoonPairCell && afternoonIn && afternoonOut) {
                                                            const bothApproved = afternoonIn.status === 'Approved' && afternoonOut.status === 'Approved';
                                                            const bothRejected = afternoonIn.status === 'Rejected' && afternoonOut.status === 'Rejected';

                                                            if (bothApproved) {
                                                                return (
                                                                    <span className="text-[11px] font-semibold text-green-600">
                                                                        Validated
                                                                    </span>
                                                                );
                                                            }

                                                            if (bothRejected) {
                                                                return (
                                                                    <span className="text-[11px] font-semibold text-red-600">
                                                                        Unvalidated
                                                                    </span>
                                                                );
                                                            }
                                                        }

                                                        if (slot.status === 'Approved') {
                                                            return (
                                                                <span className="text-[11px] font-semibold text-green-600">
                                                                    Validated
                                                                </span>
                                                            );
                                                        }

                                                        if (slot.status === 'Rejected') {
                                                            return (
                                                                <span className="text-[11px] font-semibold text-red-600">
                                                                    Unvalidated
                                                                </span>
                                                            );
                                                        }

                                                        return (
                                                            <span className="text-[11px] font-semibold text-yellow-500">
                                                                Pending
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        ) : (
                                            idx === 4 ? (
                                                <button
                                                    onClick={() => {
                                                        const pmOutTime = day.s4 
                                                            ? new Date(day.s4.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                                                            : scheduleSettings?.pmOut || "17:00";
                                                        setOvertimeModal({ isOpen: true, date: day.date, defaultStart: pmOutTime });
                                                        setOtInTime(pmOutTime);
                                                        setOtHours(1);
                                                        setOtMinutes(0);
                                                    }}
                                                    className="w-8 h-8 rounded-full bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900 flex items-center justify-center transition-colors mx-auto"
                                                    title="Add Overtime"
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            ) : (
                                                <span className="text-gray-300 block py-4">-</span>
                                            )
                                            )}
                                        </td>
                                    );
                                })}
                                <td className="px-4 py-3 text-right font-bold text-gray-900 whitespace-nowrap">
                                    {formatHours(day.dayTotalMs)}
                                </td>
                            </tr>
                        ))}
                        {days.length === 0 && (
                            <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">No attendance records found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="md:hidden">
                <div className="divide-y divide-gray-100">
                    {days.length === 0 ? (
                        <div className="px-4 py-8 text-center text-gray-500 text-sm">
                            No attendance records found.
                        </div>
                    ) : (
                        days.map((day, i) => (
                            <div key={i} className="p-4">
                                <div className="text-sm font-semibold text-gray-900">
                                    {day.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                </div>
                                <div className="mt-3 grid grid-cols-1 gap-3">
                                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                                        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Morning</div>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[day.s1, day.s2].map((slot, idx) => {
                                                const pairIn = day.s1;
                                                const pairOut = day.s2;
                                                const isInCell = idx === 0;
                                                const pairSelected = isSlotPairSelected(pairIn, pairOut);

                                                return (
                                                <div key={idx} className="flex flex-col items-center gap-2">
                                                    {slot ? (
                                                        <>
                                                            <div className="flex items-center gap-2">
                                                                {isInCell && pairIn && (
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={pairSelected}
                                                                        onChange={() => toggleSlotPairSelection(pairIn, pairOut)}
                                                                        className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                                    />
                                                                )}
                                                                <span className={`text-xs font-bold px-2 py-1 rounded-md ${slot.type === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {formatTime(slot.timestamp)}
                                                                </span>
                                                            </div>
                                                            {slot.photoDataUrl && (
                                                                <div 
                                                                    className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100"
                                                                    onClick={() => setSelectedImage({ url: slot.photoDataUrl!, timestamp: slot.timestamp })}
                                                                >
                                                                    <img src={slot.photoDataUrl} alt="Log" className="w-full h-full object-cover" />
                                                                </div>
                                                            )}
                                                            <div className="flex gap-1.5 mt-1 justify-center h-8 items-center">
                                                                {slot.status === 'Approved' ? (
                                                                    <span className="text-[11px] font-semibold text-green-600">
                                                                        Validated
                                                                    </span>
                                                                ) : slot.status === 'Rejected' ? (
                                                                    <span className="text-[11px] font-semibold text-red-600">
                                                                        Unvalidated
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[11px] font-semibold text-yellow-500">
                                                                        Pending
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )}
                                                </div>
                                            )})}
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                                        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Afternoon</div>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[day.s3, day.s4].map((slot, idx) => {
                                                const pairIn = day.s3;
                                                const pairOut = day.s4;
                                                const isInCell = idx === 0;
                                                const pairSelected = isSlotPairSelected(pairIn, pairOut);

                                                return (
                                                <div key={idx} className="flex flex-col items-center gap-2">
                                                    {slot ? (
                                                        <>
                                                            <div className="flex items-center gap-2">
                                                                {isInCell && pairIn && (
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={pairSelected}
                                                                        onChange={() => toggleSlotPairSelection(pairIn, pairOut)}
                                                                        className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                                    />
                                                                )}
                                                                <span className={`text-xs font-bold px-2 py-1 rounded-md ${slot.type === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {formatTime(slot.timestamp)}
                                                                </span>
                                                            </div>
                                                            {slot.photoDataUrl && (
                                                                <div 
                                                                    className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100"
                                                                    onClick={() => setSelectedImage({ url: slot.photoDataUrl!, timestamp: slot.timestamp })}
                                                                >
                                                                    <img src={slot.photoDataUrl} alt="Log" className="w-full h-full object-cover" />
                                                                </div>
                                                            )}
                                                            <div className="flex gap-1.5 mt-1 justify-center h-8 items-center">
                                                                {(() => {
                                                                    const afternoonIn = day.s3;
                                                                    const afternoonOut = day.s4;

                                                                    if (afternoonIn && afternoonOut) {
                                                                        const bothApproved = afternoonIn.status === 'Approved' && afternoonOut.status === 'Approved';
                                                                        const bothRejected = afternoonIn.status === 'Rejected' && afternoonOut.status === 'Rejected';

                                                                        if (bothApproved) {
                                                                            return (
                                                                                <span className="text-[11px] font-semibold text-green-600">
                                                                                    Validated
                                                                                </span>
                                                                            );
                                                                        }

                                                                        if (bothRejected) {
                                                                            return (
                                                                                <span className="text-[11px] font-semibold text-red-600">
                                                                                    Unvalidated
                                                                                </span>
                                                                            );
                                                                        }
                                                                    }

                                                                    if (slot.status === 'Approved') {
                                                                        return (
                                                                            <span className="text-[11px] font-semibold text-green-600">
                                                                                Validated
                                                                            </span>
                                                                        );
                                                                    }

                                                                    if (slot.status === 'Rejected') {
                                                                        return (
                                                                            <span className="text-[11px] font-semibold text-red-600">
                                                                                Unvalidated
                                                                            </span>
                                                                        );
                                                                    }

                                                                    return (
                                                                        <span className="text-[11px] font-semibold text-yellow-500">
                                                                            Pending
                                                                        </span>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )}
                                                </div>
                                            )})}
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Overtime</div>
                                            {!day.s5 && (
                                                <button
                                                    onClick={() => {
                                                        const pmOutTime = day.s4 
                                                            ? new Date(day.s4.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                                                            : scheduleSettings?.pmOut || "17:00";
                                                        setOvertimeModal({ isOpen: true, date: day.date, defaultStart: pmOutTime });
                                                        setOtInTime(pmOutTime);
                                                        setOtHours(1);
                                                        setOtMinutes(0);
                                                    }}
                                                    className="w-8 h-8 rounded-full bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900 flex items-center justify-center transition-colors"
                                                    title="Add Overtime"
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[day.s5, day.s6].map((slot, idx) => (
                                                <div key={idx} className="flex flex-col items-center gap-2">
                                                    {slot ? (
                                                        <>
                                                            <span className={`text-xs font-bold px-2 py-1 rounded-md ${slot.type === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                {formatTime(slot.timestamp)}
                                                            </span>
                                                            {slot.photoDataUrl && (
                                                                <div 
                                                                    className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100"
                                                                    onClick={() => setSelectedImage({ url: slot.photoDataUrl!, timestamp: slot.timestamp })}
                                                                >
                                                                    <img src={slot.photoDataUrl} alt="Log" className="w-full h-full object-cover" />
                                                                </div>
                                                            )}
                                                            <div className="flex gap-1.5 mt-1 justify-center h-8 items-center">
                                                                {slot.status === 'Approved' ? (
                                                                    <span className="text-[11px] font-semibold text-green-600">
                                                                        Validated
                                                                    </span>
                                                                ) : slot.status === 'Rejected' ? (
                                                                    <span className="text-[11px] font-semibold text-red-600">
                                                                        Unvalidated
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[11px] font-semibold text-yellow-500">
                                                                        Pending
                                                                    </span>
                                                                )}
                                                            </div>
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
                                            {formatHours(day.dayTotalMs)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>

        {selectedImage && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedImage(null)}>
                <button 
                    onClick={() => setSelectedImage(null)}
                    className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors z-[110]"
                >
                    <X size={32} />
                </button>
                <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
                    <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-black w-auto h-auto flex flex-col">
                        <img 
                            src={selectedImage.url} 
                            alt="Attendance Log" 
                            className="max-w-full max-h-[80vh] object-contain"
                        />
                    </div>
                </div>
            </div>
        )}

    {/* Overtime Modal */}
        {overtimeModal.isOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                        <h3 className="font-bold text-gray-900">Set Overtime</h3>
                        <button onClick={() => setOvertimeModal({ isOpen: false, date: null })} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-gray-500">
                            Set overtime for <span className="font-bold text-gray-900">{overtimeModal.date?.toLocaleDateString()}</span>.
                            This will manually add validated entries.
                        </p>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Time In</label>
                            <input 
                                type="time" 
                                value={otInTime}
                                min={overtimeModal.defaultStart}
                                onClick={(e) => e.currentTarget.showPicker()}
                                onChange={(e) => setOtInTime(e.target.value)}
                                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            min="0" 
                                            value={otHours}
                                            onChange={(e) => setOtHours(Math.max(0, parseInt(e.target.value) || 0))}
                                            className="w-full rounded-xl border border-gray-300 pl-3 pr-12 py-2 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">hrs</span>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            min="0"
                                            max="59"
                                            value={otMinutes}
                                            onChange={(e) => setOtMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                                            className="w-full rounded-xl border border-gray-300 pl-3 pr-12 py-2 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">mins</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-2 text-right">
                                Ends at: <span className="font-bold text-gray-900">
                                    {(() => {
                                        if (!otInTime) return "--:--";
                                        const [h, m] = otInTime.split(':').map(Number);
                                        const date = new Date();
                                        date.setHours(h, m, 0, 0);
                                        date.setMinutes(date.getMinutes() + (otHours * 60) + otMinutes);
                                        return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                                    })()}
                                </span>
                            </p>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <button 
                                onClick={() => setOvertimeModal({ isOpen: false, date: null })}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSaveOvertime}
                                disabled={isSavingOt || !otInTime || (otHours === 0 && otMinutes === 0)}
                                className="px-4 py-2 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-md shadow-orange-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isSavingOt ? 'Saving...' : 'Save Overtime'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}

export function EvaluationView({
  students,
  evalPermissions,
  completedIds,
  onOpenModal
}: {
  students: User[];
  evalPermissions: Record<string, boolean>;
  completedIds: Set<string>;
  onOpenModal: (student: User) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCourse, setFilterCourse] = useState("");
  const [filterSection, setFilterSection] = useState("");

  const uniqueCourses = useMemo(() => Array.from(new Set(students.map(s => s.course).filter(Boolean))), [students]);
  const uniqueSections = useMemo(() => Array.from(new Set(students.map(s => s.section).filter(Boolean))), [students]);

  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const query = searchQuery.toLowerCase();
      const fullName = `${student.firstname || ""} ${student.lastname || ""}`.toLowerCase();
      const id = (student.idnumber || "").toLowerCase();
      const matchesSearch = fullName.includes(query) || id.includes(query);
      const matchesCourse = filterCourse ? student.course === filterCourse : true;
      const matchesSection = filterSection ? student.section === filterSection : true;
      return matchesSearch && matchesCourse && matchesSection;
    });
  }, [students, searchQuery, filterCourse, filterSection]);

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-500 space-y-6">
      {/* Header & Search */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>
            <div>
               <h2 className="text-lg font-bold text-gray-900">Student Evaluation</h2>
               <p className="text-sm text-gray-500">Assess performance of your assigned students.</p>
            </div>
         </div>
         
         <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto items-center">
            <div className="relative w-full md:w-64 group">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400 group-focus-within:text-orange-500 transition-colors" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
               </div>
               <input
                 type="text"
                 placeholder="Search student..."
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="block w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm placeholder-gray-500 font-medium focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 focus:bg-white transition-all duration-200"
               />
            </div>
            
            <select 
               value={filterCourse} 
               onChange={(e) => setFilterCourse(e.target.value)}
               className="w-full md:w-40 px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 cursor-pointer"
            >
               <option value="">All Courses</option>
               {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            
            <select 
               value={filterSection} 
               onChange={(e) => setFilterSection(e.target.value)}
               className="w-full md:w-40 px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 cursor-pointer"
            >
               <option value="">All Sections</option>
               {uniqueSections.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
         </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h3 className="font-bold text-gray-900">All Students</h3>
          <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-0.5 rounded-full">{filteredStudents.length} Students</span>
        </div>
        
        <div className="p-6">
          {filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
               <div className="h-14 w-14 bg-white rounded-full flex items-center justify-center mb-3 text-gray-300 shadow-sm border border-gray-100">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
               </div>
               <p className="text-gray-900 font-medium">No students found</p>
               <p className="text-gray-500 text-sm mt-1">Try adjusting your search query.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStudents.map(student => {
                const id = String(student.idnumber || "").trim();
                const isCompleted = completedIds.has(id);
                const isAllowed = evalPermissions[id] || false;
                
                // Determine button state
                // Red if toggle is off (and not completed)
                // Green if toggle is on (and not completed)
                // If completed, show specific state
                
                let buttonClass = "bg-gray-100 text-gray-400 cursor-not-allowed";
                let buttonText = "Evaluation Locked";
                let isDisabled = true;
                
                if (isCompleted) {
                  buttonClass = "bg-blue-50 text-blue-600 border border-blue-100 cursor-default";
                  buttonText = "Completed";
                  isDisabled = true;
                } else if (isAllowed) {
                  // Green & Clickable
                  buttonClass = "bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-200 cursor-pointer active:scale-[0.98]";
                  buttonText = "Evaluate";
                  isDisabled = false;
                } else {
                  // Red & Not Clickable
                  buttonClass = "bg-red-500 text-white opacity-90 cursor-not-allowed shadow-red-100";
                  buttonText = "Locked";
                  isDisabled = true;
                }

                return (
                  <div 
                    key={student.idnumber} 
                    className="group bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm ${
                          isCompleted ? "bg-blue-100 text-blue-600" :
                          isAllowed ? "bg-green-100 text-green-600" :
                          "bg-gray-100 text-gray-500"
                        }`}>
                           {(student.firstname?.[0] || student.lastname?.[0] || "S").toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-sm line-clamp-1">
                            {student.firstname} {student.lastname}
                          </h3>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">{student.idnumber}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-auto pt-4 border-t border-gray-50">
                      <div className="mb-3 flex items-center justify-between">
                         <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</span>
                         <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            isCompleted ? "bg-blue-50 text-blue-600" :
                            isAllowed ? "bg-green-50 text-green-600" :
                            "bg-red-50 text-red-600"
                         }`}>
                            {isCompleted ? "Done" : isAllowed ? "Open" : "Closed"}
                         </span>
                      </div>
                      <button
                        onClick={() => !isDisabled && onOpenModal(student)}
                        disabled={isDisabled}
                        className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${buttonClass}`}
                      >
                        {isCompleted ? (
                          <>
                            <span>Completed</span>
                            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </>
                        ) : isAllowed ? (
                          <>
                            <span>Evaluate</span>
                            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                          </>
                        ) : (
                          <>
                            <span>Evaluation Locked</span>
                            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Dashboard View ---
export function DashboardView({ 
  students, 
  myIdnumber, 
  supervisorInfo,
  selected,
  onSelect,
  refreshKey
}: { 
  students: User[], 
  myIdnumber: string, 
  supervisorInfo: { company?: string; location?: string } | null,
  selected: User | null,
  onSelect: (s: User | null) => void,
  refreshKey?: number
}) {
  const [attendanceData, setAttendanceData] = useState<AttendanceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedModalData, setSelectedModalData] = useState<{ student: User; attendance: AttendanceEntry[] } | null>(null);
  const [isFetchingModalData, setIsFetchingModalData] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; timestamp?: number; status?: string } | null>(null);

  // Filter States
  const [search, setSearch] = useState("");
  const [filterCourse, setFilterCourse] = useState("");
  const [filterSection, setFilterSection] = useState("");
  
  const handleViewStudentAttendance = async (student: User) => {
    setIsFetchingModalData(true);
    try {
      const res = await fetch(
        `/api/attendance?idnumber=${encodeURIComponent(String(student.idnumber || ""))}&limit=200`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok || !Array.isArray(json.entries)) {
        throw new Error(json?.error || "Failed to load attendance history");
      }

      const mapped: AttendanceEntry[] = (json.entries || []).map((e: any) => {
        const sStr = String(e.status || "").trim().toLowerCase();
        const isRejected = sStr === "rejected";
        const isApproved = sStr === "approved" || (!!e.validated_by && !isRejected);
        return {
          id: e.id,
          type: e.type,
          timestamp: Number(e.ts),
          photoDataUrl: e.photourl,
          status: isRejected ? "Rejected" : isApproved ? "Approved" : "Pending",
          validatedAt: e.validated_at ? Number(new Date(e.validated_at).getTime()) : undefined,
        };
      });

      setSelectedModalData({ student, attendance: mapped });
    } catch (err) {
      console.error("Error fetching student attendance:", err);
      alert("Failed to load attendance history.");
    } finally {
      setIsFetchingModalData(false);
    }
  };

  const uniqueCourses = useMemo(() => Array.from(new Set(students.map(s => s.course).filter(Boolean))).sort(), [students]);
  const uniqueSections = useMemo(() => Array.from(new Set(students.map(s => s.section).filter(Boolean))).sort(), [students]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const searchLower = search.toLowerCase();
      const matchesSearch = 
        (s.firstname?.toLowerCase() || "").includes(searchLower) ||
        (s.lastname?.toLowerCase() || "").includes(searchLower) ||
        (s.idnumber?.toLowerCase() || "").includes(searchLower);
      const matchesCourse = filterCourse ? s.course === filterCourse : true;
      const matchesSection = filterSection ? s.section === filterSection : true;
      return matchesSearch && matchesCourse && matchesSection;
    });
  }, [students, search, filterCourse, filterSection]);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkValidating, setIsBulkValidating] = useState(false);
  
  // Helpers
  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const formatHours = (ms: number) => {
    if (!ms) return "-";
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    []
  );

  const togglePairSelection = (entryIn?: AttendanceEntry | null, entryOut?: AttendanceEntry | null) => {
    const ids: number[] = [];
    if (entryIn && entryIn.id != null) ids.push(Number(entryIn.id));
    if (entryOut && entryOut.id != null) ids.push(Number(entryOut.id));
    if (ids.length === 0) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = ids.every(id => next.has(id));
      if (allSelected) {
        ids.forEach(id => next.delete(id));
      } else {
        ids.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const isPairSelected = (entryIn?: AttendanceEntry | null, entryOut?: AttendanceEntry | null) => {
    const ids: number[] = [];
    if (entryIn && entryIn.id != null) ids.push(Number(entryIn.id));
    if (entryOut && entryOut.id != null) ids.push(Number(entryOut.id));
    if (ids.length === 0) return false;
    return ids.every(id => selectedIds.has(id));
  };

  const selectAllPending = () => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const start = startOfToday.getTime();
    const end = start + 24 * 60 * 60 * 1000 - 1;

    const pendingIds = attendanceData
      .filter((e) => {
        const status = (e.status || "Pending").toString().trim();
        const isPending = status === "Pending" && e.id != null;
        return isPending && e.timestamp >= start && e.timestamp <= end;
      })
      .map((e) => Number(e.id));

    setSelectedIds(new Set(pendingIds));
  };

  const bulkValidate = async (action: "approve" | "reject") => {
    if (selectedIds.size === 0) return;
    setIsBulkValidating(true);
    const ids = Array.from(selectedIds);
    
    // Process sequentially or parallel
    for (const id of ids) {
        const entry = attendanceData.find(e => Number(e.id) === id);
        if (entry) await handleValidation(entry, action);
    }
    
    setSelectedIds(new Set());
    setIsBulkValidating(false);
  };

  const studentSummaries = useMemo(() => {
    const byStudent: Record<string, AttendanceEntry[]> = {};
    attendanceData.forEach((e: any) => {
      const id = (e as any).idnumber;
      if (!id) return;
      if (!byStudent[id]) byStudent[id] = [];
      byStudent[id].push(e as any);
    });

    return filteredStudents.map(student => {
      const logs = (byStudent[student.idnumber] || []).slice().sort((a, b) => a.timestamp - b.timestamp);
      
      // Load Schedule
      let scheduleSettings: any = null;
      try {
         const key = `schedule_${student.idnumber}`;
         const saved = localStorage.getItem(key) || localStorage.getItem("schedule_default");
         if (saved) scheduleSettings = JSON.parse(saved);
      } catch {}

      let totalValidatedMs = 0;
      const pendingDates = new Set<string>();
      let todaySlots: any = null;

      // Group by date
      const grouped = new Map<string, { date: Date, logs: AttendanceEntry[] }>();
      logs.forEach(log => {
          const date = new Date(log.timestamp);
          const key = date.toLocaleDateString();
          if (!grouped.has(key)) grouped.set(key, { date, logs: [] });
          grouped.get(key)!.logs.push(log);
      });

      const todayStr = new Date().toLocaleDateString();

      grouped.forEach(({ date, logs: dayLogs }) => {
          // Pending Days Count
          if (dayLogs.some(l => l.status === "Pending")) {
             pendingDates.add(date.toLocaleDateString());
          }

          // Calculate Validated Hours
          const baseDate = new Date(date);
          baseDate.setHours(0, 0, 0, 0);

          const buildShift = (timeStr: string) => {
              const [h, m] = timeStr.split(":").map(Number);
              const d = new Date(baseDate.getTime());
              d.setHours(h || 0, m || 0, 0, 0);
              return d.getTime();
          };

          let schedule = {
              amIn: buildShift("07:00"),
              amOut: buildShift("11:00"),
              pmIn: buildShift("13:00"),
              pmOut: buildShift("17:00"),
              otStart: buildShift("17:00"),
              otEnd: buildShift("18:00"),
          };

          if (scheduleSettings) {
              schedule = {
                  amIn: buildShift(scheduleSettings.amIn || "07:00"),
                  amOut: buildShift(scheduleSettings.amOut || "11:00"),
                  pmIn: buildShift(scheduleSettings.pmIn || "13:00"),
                  pmOut: buildShift(scheduleSettings.pmOut || "17:00"),
                  otStart: buildShift(scheduleSettings.overtimeIn || "17:00"),
                  otEnd: buildShift(scheduleSettings.overtimeOut || "18:00"),
              };
          }

          const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

          const computeShiftDuration = (
              logs: AttendanceEntry[],
              windowStart: number,
              windowEnd: number,
              requireApproved: boolean
          ) => {
              const earlyWindowStart = windowStart - 30 * 60 * 1000;
              let currentIn: number | null = null;
              let duration = 0;

              logs.forEach(log => {
                  if (requireApproved && log.status !== "Approved") return;
                  if (log.type === "in") {
                      if (log.timestamp > windowEnd) return;
                      if (log.timestamp < earlyWindowStart) return;
                      const effectiveIn = clamp(log.timestamp, windowStart, windowEnd);
                      currentIn = effectiveIn;
                  } else if (log.type === "out") {
                      if (currentIn === null) return;
                      const effectiveOut = clamp(log.timestamp, windowStart, windowEnd);
                      if (effectiveOut > currentIn) {
                          duration += effectiveOut - currentIn;
                      }
                      currentIn = null;
                  }
              });

              if (!requireApproved && currentIn !== null) {
                  const effectiveOut = clamp(Date.now(), windowStart, windowEnd);
                  if (effectiveOut > currentIn) {
                      duration += effectiveOut - currentIn;
                  }
              }

              return duration;
          };

          const dayVal = computeShiftDuration(dayLogs, schedule.amIn, schedule.amOut, true) + 
                         computeShiftDuration(dayLogs, schedule.pmIn, schedule.pmOut, true) + 
                         computeShiftDuration(dayLogs, schedule.otStart, schedule.otEnd, true);
          
          const dayRaw = computeShiftDuration(dayLogs, schedule.amIn, schedule.amOut, false) +
                         computeShiftDuration(dayLogs, schedule.pmIn, schedule.pmOut, false) +
                         computeShiftDuration(dayLogs, schedule.otStart, schedule.otEnd, false);
          
          totalValidatedMs += dayVal;
          
          // Capture Today's Slots
          if (date.toLocaleDateString() === todayStr) {
             const classifySegment = (ts: number) => new Date(ts).getHours() < 12 ? "morning" : "afternoon";
             const morningSegLogs = dayLogs.filter(l => classifySegment(l.timestamp) === "morning");
             const afternoonSegLogs = dayLogs.filter(l => classifySegment(l.timestamp) === "afternoon");

             todaySlots = {
                 s1: morningSegLogs.find(l => l.type === "in") || null,
                 s2: [...morningSegLogs].filter(l => l.type === "out").pop() || null,
                 s3: afternoonSegLogs.find(l => l.type === "in") || null,
                 s4: [...afternoonSegLogs].filter(l => l.type === "out").pop() || null,
                 s5: (() => {
                      const overtimeLogs = dayLogs.filter(l => l.timestamp >= schedule.otStart && l.timestamp <= schedule.otEnd);
                      return overtimeLogs.find(l => l.type === "in") || null;
                 })(),
                 s6: (() => {
                      const overtimeLogs = dayLogs.filter(l => l.timestamp >= schedule.otStart && l.timestamp <= schedule.otEnd);
                      return [...overtimeLogs].filter(l => l.type === "out").pop() || null;
                 })(),
                 todayTotalMs: dayRaw
             };
          }
      });

      return {
        student,
        totalMs: totalValidatedMs,
        pendingDays: pendingDates.size,
        todaySlots
      };
    });
  }, [filteredStudents, attendanceData]);

  // Fetch Attendance
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (filteredStudents.length === 0) {
        setAttendanceData([]);
        return;
      }
      setLoading(true);
      try {
        const ids = filteredStudents.map(s => s.idnumber);
        // Chunking ids if too many
        if (!supabase) return;
        const { data, error } = await supabase
          .from('attendance')
          .select('id, type, ts, photourl, status, validated_by, validated_at, idnumber')
          .in('idnumber', ids)
          .order('ts', { ascending: false })
          .limit(5000);
        
        if (!error && data && mounted) {
           const mapped: AttendanceEntry[] & { idnumber: string } = data.map((e: any) => {
             const sStr = String(e.status || "").trim().toLowerCase();
             const isRejected = sStr === "rejected";
             const isApproved = sStr === "approved" || (!!e.validated_by && !isRejected);
             return {
             id: e.id,
             idnumber: e.idnumber,
             type: e.type,
             timestamp: Number(e.ts),
             photoDataUrl: e.photourl,
            status: isRejected ? "Rejected" : isApproved ? "Approved" : "Pending",
            validatedAt: e.validated_at ? Number(new Date(e.validated_at).getTime()) : undefined
          }}) as any;
           setAttendanceData(mapped);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [filteredStudents, refreshKey]);

  // Validate Function
  const handleValidation = async (entry: AttendanceEntry, action: 'approve' | 'reject' | 'reset') => {
    if (!entry.id) return;
    if (!myIdnumber) {
        // Try to recover from localStorage
        const stored = localStorage.getItem("idnumber");
        if (!stored) {
            alert("Unable to identify supervisor. Please re-login.");
            return;
        }
    }
    const validatorId = myIdnumber || localStorage.getItem("idnumber") || "";
    
    try {
      // Optimistic update
      let newStatus = "Pending";
      if (action === 'approve') newStatus = "Approved";
      if (action === 'reject') newStatus = "Rejected";
      
      const updateEntry = (e: AttendanceEntry) => 
        e.id === entry.id ? { ...e, status: newStatus as any, validatedAt: action === 'reset' ? undefined : Date.now() } : e;

      setAttendanceData(prev => prev.map(updateEntry));
      
      if (selectedModalData) {
        setSelectedModalData(prev => {
            if (!prev) return null;
            return {
                ...prev,
                attendance: prev.attendance.map(updateEntry)
            };
        });
      }

      const res = await fetch("/api/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          id: entry.id, 
          approve: action === 'approve', 
          reject: action === 'reject', 
          validated_by: validatorId 
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to validate";
      alert(msg);
      // Revert if needed (omitted for brevity)
    }
  };

  if (selectedModalData) {
      return (
          <StudentAttendanceDetailView 
              student={selectedModalData.student}
              attendance={selectedModalData.attendance}
              onBack={() => setSelectedModalData(null)}
              onValidate={handleValidation}
              onRefresh={() => handleViewStudentAttendance(selectedModalData.student)}
          />
      );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
         <h1 className="text-2xl font-bold text-gray-900">Attendance Monitoring</h1>
         <p className="text-gray-500">Overview of total hours and pending days per student.</p>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-4">
         <div className="flex flex-col gap-3">
           <div className="flex flex-col md:flex-row md:items-center gap-3">
             <div className="flex gap-2 flex-1">
               <select 
                 value={filterCourse} 
                 onChange={(e) => setFilterCourse(e.target.value)}
                 className="px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
               >
                 <option value="">All Courses</option>
                 {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
               </select>
               <select 
                 value={filterSection} 
                 onChange={(e) => setFilterSection(e.target.value)}
                 className="px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
               >
                 <option value="">All Sections</option>
                 {uniqueSections.map(s => <option key={s} value={s}>{s}</option>)}
               </select>
             </div>
             <div className="flex flex-1 items-center gap-3">
               <div className="relative flex-1 md:max-w-xs">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                 <input 
                   type="text" 
                   placeholder="Filter by name..." 
                   value={search}
                   onChange={(e) => setSearch(e.target.value)}
                   className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-700 placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                 />
               </div>
             </div>
           </div>

           <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100 md:border-t-0 md:pt-0">
             <button
               onClick={selectAllPending}
               className="inline-flex items-center justify-center px-3 py-1 text-[11px] font-semibold rounded-md border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:border-orange-400 transition-colors"
             >
               Select all pending
             </button>
             <button
               onClick={() => setSelectedIds(new Set())}
               disabled={selectedIds.size === 0}
               className="inline-flex items-center justify-center px-3 py-1 text-[11px] font-medium rounded-md border border-gray-200 bg-white text-gray-600 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-gray-600 transition-colors"
             >
               Clear
             </button>
             {selectedIds.size > 0 && (
               <>
                 <span className="inline-flex items-center justify-center px-3 py-1 text-[11px] font-medium rounded-md border border-gray-200 bg-gray-50 text-gray-700">
                   {selectedIds.size} selected
                 </span>
                 <button
                   onClick={() => bulkValidate("approve")}
                   disabled={isBulkValidating}
                   className="inline-flex items-center justify-center px-3 py-1 text-[11px] font-semibold rounded-md border border-green-500 bg-green-500 text-white hover:bg-green-600 hover:border-green-600 transition-colors disabled:opacity-60"
                 >
                   {isBulkValidating ? "Processing..." : "Approve Selected"}
                 </button>
                 <button
                   onClick={() => bulkValidate("reject")}
                   disabled={isBulkValidating}
                   className="inline-flex items-center justify-center px-3 py-1 text-[11px] font-semibold rounded-md border border-red-400 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-500 transition-colors disabled:opacity-60"
                 >
                   Reject
                 </button>
               </>
             )}
           </div>
         </div>

         {loading && (
           <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 border-t border-gray-100">
             <RefreshCw size={14} className="animate-spin text-orange-500" />
             <span>Loading attendance data...</span>
           </div>
         )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
            Date
          </span>
          <span className="text-sm font-semibold text-gray-900">
            {todayLabel}
          </span>
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th rowSpan={2} className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-r border-gray-200 text-left bg-gray-50 sticky left-0 z-10">
                  Name / Course
                </th>
                <th colSpan={2} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider border-r border-gray-200 text-center bg-gray-100">
                  Morning
                </th>
                <th colSpan={2} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider border-r border-gray-200 text-center bg-gray-100">
                  Afternoon
                </th>
                <th colSpan={2} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider border-r border-gray-200 text-center bg-gray-100">
                  Overtime
                </th>
                <th rowSpan={2} className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                  Total Hours
                </th>
              </tr>
              <tr>
                <th className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-r border-gray-200 text-center bg-gray-50">Time In</th>
                <th className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-r border-gray-200 text-center bg-gray-50">Time Out</th>
                <th className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-r border-gray-200 text-center bg-gray-50">Time In</th>
                <th className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-r border-gray-200 text-center bg-gray-50">Time Out</th>
                <th className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-r border-gray-200 text-center bg-gray-50">Time In</th>
                <th className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-r border-gray-200 text-center bg-gray-50">Time Out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {studentSummaries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    No students found.
                  </td>
                </tr>
              ) : (
                studentSummaries.map(({ student, totalMs, todaySlots }) => {
                  const todayMs = todaySlots?.todayTotalMs || 0;
                  const renderSlot = (
                    slot: any,
                    pairIn?: AttendanceEntry | null,
                    pairOut?: AttendanceEntry | null,
                    isInCell?: boolean
                  ) => {
                    if (!slot) {
                      return (
                        <td className="px-2 py-3 text-center border-r border-gray-50 text-xs text-gray-300">
                          -
                        </td>
                      );
                    }

                    const status = slot.status as "Pending" | "Approved" | "Rejected" | undefined;
                    let statusLabel = "Pending";
                    let statusClass = "text-yellow-600";

                    if (status === "Approved") {
                      statusLabel = "Validated";
                      statusClass = "text-green-600";
                    } else if (status === "Rejected") {
                      statusLabel = "Unvalidated";
                      statusClass = "text-red-600";
                    }

                    return (
                      <td className="px-2 py-3 text-center border-r border-gray-50 text-xs text-gray-700">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1">
                            {(() => {
                              const sIn = pairIn?.status;
                              const sOut = pairOut?.status;
                              const pairHasFinalStatus =
                                sIn === "Approved" ||
                                sIn === "Rejected" ||
                                sOut === "Approved" ||
                                sOut === "Rejected";
                              const showCheckbox = !pairHasFinalStatus && isInCell;
                              if (!showCheckbox) return null;
                              return (
                                <input
                                  type="checkbox"
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                  checked={isPairSelected(pairIn, pairOut)}
                                  onChange={() => togglePairSelection(pairIn, pairOut)}
                                />
                              );
                            })()}
                            <span className="font-medium">
                              {formatTime(slot.timestamp)}
                            </span>
                          </div>
                          {slot.photoDataUrl && (
                            <div
                              className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 cursor-zoom-in"
                              onClick={() =>
                                setPreviewImage({
                                  url: slot.photoDataUrl,
                                  timestamp: slot.timestamp,
                                  status: statusLabel,
                                })
                              }
                            >
                              <img
                                src={slot.photoDataUrl}
                                alt="Log"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <span className={`text-[11px] font-semibold ${statusClass}`}>
                            {statusLabel}
                          </span>
                        </div>
                      </td>
                    );
                  };

                  return (
                    <tr key={student.idnumber} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 border-r border-gray-50 sticky left-0 bg-white hover:bg-gray-50 z-10">
                        <button
                          onClick={() => handleViewStudentAttendance(student)}
                          disabled={isFetchingModalData}
                          className="flex items-center text-left w-full group"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-gray-900 group-hover:text-orange-600 group-hover:underline truncate">
                              {student.lastname}, {student.firstname}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {student.course} • {student.section}
                            </div>
                          </div>
                        </button>
                      </td>
                      {renderSlot(todaySlots?.s1, todaySlots?.s1, todaySlots?.s2, true)}
                      {renderSlot(todaySlots?.s2, todaySlots?.s1, todaySlots?.s2, false)}
                      {renderSlot(todaySlots?.s3, todaySlots?.s3, todaySlots?.s4, true)}
                      {renderSlot(todaySlots?.s4, todaySlots?.s3, todaySlots?.s4, false)}
                      {renderSlot(todaySlots?.s5, todaySlots?.s5, todaySlots?.s6, true)}
                      {renderSlot(todaySlots?.s6, todaySlots?.s5, todaySlots?.s6, false)}
                      <td className="px-4 py-3 text-center font-bold text-gray-900">
                        {todayMs > 0 ? formatHours(todayMs) : "-"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-gray-100">
          {studentSummaries.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              No students found.
            </div>
          ) : (
            studentSummaries.map(({ student, totalMs, pendingDays, todaySlots }) => {
              const todayMs = todaySlots?.todayTotalMs || 0;
              const courseSection = [
                student.course || "",
                student.section || ""
              ]
                .filter(Boolean)
                .join(" • ");

              return (
                <div key={student.idnumber} className="p-4">
                  <button
                    onClick={() => handleViewStudentAttendance(student)}
                    disabled={isFetchingModalData}
                    className="flex items-start justify-between gap-3 w-full text-left"
                  >
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {student.lastname}, {student.firstname}
                        </div>
                        {courseSection && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {courseSection}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-orange-600 hover:text-orange-700 disabled:opacity-50 disabled:cursor-wait">
                      View details
                    </span>
                  </button>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                        Total Hours
                      </div>
                      <div className="text-sm font-bold text-gray-900 mt-1">
                        {todayMs > 0 ? formatDuration(todayMs) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                        Pending Days
                      </div>
                      <div className="mt-1">
                        {pendingDays > 0 ? (
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-100">
                            {pendingDays}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-300">0</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {previewImage && (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setPreviewImage(null)}
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors"
            >
              <X size={28} />
            </button>
            <div
              className="relative max-w-3xl max-h-[90vh] w-full flex flex-col items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-black w-auto h-auto flex flex-col">
                <img
                  src={previewImage.url}
                  alt="Attendance Log"
                  className="max-w-full max-h-[80vh] object-contain"
                />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// --- Attendance View ---
export function AttendanceView({ students, myIdnumber, onPendingChange, refreshKey }: { students: User[], myIdnumber: string, onPendingChange?: (count: number) => void, refreshKey?: number }) {
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [recent, setRecent] = useState<ApprovalRow[]>([]);
  const [selectedAttendanceEntry, setSelectedAttendanceEntry] = useState<AttendanceEntry | null>(null);
  const [selectedEntryName, setSelectedEntryName] = useState<string | undefined>(undefined);
  
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkApproving, setIsBulkApproving] = useState(false);

  // Synchronize pending count with parent state
  useEffect(() => {
    if (onPendingChange) onPendingChange(rows.length);
  }, [rows, onPendingChange]);

  const recentLast7 = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return recent.filter(r => Number(r.ts) >= cutoff);
  }, [recent]);

  useEffect(() => {
    (async () => {
      const allRows: ApprovalRow[] = [];
      for (const s of students) {
        try {
          const res = await fetch(`/api/attendance?idnumber=${encodeURIComponent(s.idnumber)}&limit=200`);
          const json = await res.json();
          if (res.ok && Array.isArray(json.entries)) {
            const entries = json.entries as ServerAttendanceEntry[];
            const mapped = entries.map((e) => {
              const d = new Date(e.ts);
              return {
                id: e.id,
                idnumber: s.idnumber,
                name: `${s.firstname || ""} ${s.lastname || ""}`.trim() || s.idnumber,
                type: e.type,
                dateLabel: d.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" }),
                timeLabel: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                approved: String(e.status || "").trim().toLowerCase() === "approved" || !!e.validated_by,
                photourl: e.photourl,
                ts: e.ts,
              } as ApprovalRow;
            });
            allRows.push(...mapped);
          }
        } catch {}
      }
      const sorted = allRows.slice().sort((a, b) => b.ts - a.ts);
      const pending = sorted.filter(r => !r.approved);
      const approved = sorted.filter(r => r.approved);
      setRows(pending.slice(0, 100));
      setRecent(approved.slice(0, 100));
    })();
  }, [students, myIdnumber, refreshKey]);

  useEffect(() => {
    if (!supabase || students.length === 0) return;
    const client = supabase;
    type RTEntry = ServerAttendanceEntry & { id: number };
    const channels = students.map(s =>
      client
        .channel(`approvals_${s.idnumber}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance', filter: `idnumber=eq.${s.idnumber}` }, (payload: RealtimePostgresChangesPayload<RTEntry>) => {
          const e = payload.new as RTEntry;
          if (!e) return;
          const d = new Date(Number(e.ts));
          const row: ApprovalRow = {
            id: Number(e.id),
            idnumber: s.idnumber,
            name: `${s.firstname || ""} ${s.lastname || ""}`.trim() || s.idnumber,
            type: e.type,
            dateLabel: d.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" }),
            timeLabel: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            approved: String(e.status || "").trim().toLowerCase() === "approved" || !!e.validated_by,
            photourl: e.photourl,
            ts: Number(e.ts),
          };
          if (!row.approved) {
            setRows(prev => {
              const next = [row, ...prev].sort((a, b) => b.ts - a.ts);
              const sliced = next.slice(0, 100);
              return sliced;
            });
          } else {
            setRecent(prev => {
              const next = [row, ...prev].sort((a, b) => b.ts - a.ts);
              return next.slice(0, 100);
            });
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attendance', filter: `idnumber=eq.${s.idnumber}` }, (payload: RealtimePostgresChangesPayload<RTEntry>) => {
          const e = payload.new as RTEntry;
          if (!e) return;
          const approvedNow = String(e.status || "").trim().toLowerCase() === "approved" || !!e.validated_by;
          const tsNum = Number(e.ts);
          const idNum = Number(e.id);
          if (approvedNow) {
            setRows(prev => {
              const sliced = prev.filter(r => r.id !== idNum);
              return sliced;
            });
            setRecent(prev => {
              const existing = prev.find(r => r.id === idNum);
              if (existing) return prev;
              const d = new Date(tsNum);
              const row: ApprovalRow = {
                id: idNum,
                idnumber: s.idnumber,
                name: `${s.firstname || ""} ${s.lastname || ""}`.trim() || s.idnumber,
                type: e.type,
                dateLabel: d.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" }),
                timeLabel: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                approved: true,
                photourl: e.photourl,
                ts: tsNum,
              };
              const next = [row, ...prev].sort((a, b) => b.ts - a.ts);
              return next.slice(0, 100);
            });
          } else {
            setRows(prev => {
              const has = prev.some(r => r.id === idNum);
              if (has) return prev;
              const d = new Date(tsNum);
              const row: ApprovalRow = {
                id: idNum,
                idnumber: s.idnumber,
                name: `${s.firstname || ""} ${s.lastname || ""}`.trim() || s.idnumber,
                type: e.type,
                dateLabel: d.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" }),
                timeLabel: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                approved: false,
                photourl: e.photourl,
                ts: tsNum,
              };
              const next = [row, ...prev].sort((a, b) => b.ts - a.ts);
              const sliced = next.slice(0, 100);
              return sliced;
            });
          }
        })
        .subscribe()
    );
    return () => {
      channels.forEach(ch => {
        try { supabase?.removeChannel(ch); } catch {}
      });
    };
  }, [students]);

  const approveEntry = async (row: ApprovalRow) => {
    try {
      const res = await fetch("/api/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, approve: true, validated_by: myIdnumber }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to approve");
      setRows(prev => {
        const sliced = prev.filter(r => r.id !== row.id);
        return sliced;
      });
      setRecent(prev => {
        const next = [{ ...row, approved: true }, ...prev].sort((a, b) => b.ts - a.ts);
        return next.slice(0, 100);
      });
      // Remove from selection if present
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    } catch {}
  };

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === rows.length && rows.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map(r => r.id)));
    }
  };

  const approveSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkApproving(true);
    const ids = Array.from(selectedIds);
    
    // Process sequentially to avoid overwhelming the server/state updates
    for (const id of ids) {
        const row = rows.find(r => r.id === id);
        if (row) {
            await approveEntry(row);
        }
    }
    
    setIsBulkApproving(false);
  };

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Pending Approvals */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-6 bg-orange-500 rounded-full" />
              <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">Pending Approvals</h2>
            </div>
            <span className="bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1 rounded-full">
              {rows.length} Pending
            </span>
          </div>

          {rows.length > 0 && (
             <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-200 transition-all animate-in fade-in slide-in-from-top-2">
                 <label className="flex items-center gap-3 cursor-pointer select-none px-2">
                     <input 
                         type="checkbox" 
                         checked={selectedIds.size > 0 && selectedIds.size === rows.length}
                         onChange={toggleAll}
                         className="w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500 transition-all cursor-pointer"
                     />
                     <span className="text-sm font-bold text-gray-700">Select All</span>
                 </label>
                 
                 {selectedIds.size > 0 && (
                     <button 
                         onClick={approveSelected}
                         disabled={isBulkApproving}
                         className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-lg shadow-md transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                     >
                         {isBulkApproving ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                         Approve Selected ({selectedIds.size})
                     </button>
                 )}
             </div>
          )}
        </div>
        
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <div className="text-gray-400 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
              </div>
              <p className="text-gray-500 font-medium">All caught up!</p>
              <p className="text-xs text-gray-400">No pending attendance requests.</p>
            </div>
          ) : (
            rows.map((r, idx) => (
              <div key={idx} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border shadow-sm transition-all gap-4 ${selectedIds.has(r.id) ? 'bg-orange-50 border-orange-200 ring-1 ring-orange-200' : 'bg-white border-gray-100 hover:border-orange-200'}`}>
                <div className="flex items-center gap-4">
                   <div className="flex-shrink-0">
                       <input 
                           type="checkbox"
                           checked={selectedIds.has(r.id)}
                           onChange={() => toggleSelection(r.id)}
                           className="w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                       />
                   </div>
                   <button
                     onClick={() => {
                       setSelectedAttendanceEntry({
                         type: r.type,
                         timestamp: Number(r.ts),
                         photoDataUrl: r.photourl || "",
                         status: r.approved ? "Approved" : "Pending"
                       });
                       setSelectedEntryName(r.name);
                     }}
                     className="h-12 w-16 rounded-lg overflow-hidden bg-gray-200 border border-gray-200 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-orange-300"
                     title="View attendance photo"
                   >
                     {r.photourl ? (
                       <img src={r.photourl} alt="Student" className="h-full w-full object-cover" />
                     ) : (
                       <div className="h-full w-full flex items-center justify-center text-orange-600 font-bold text-lg bg-orange-100">
                         {r.name.charAt(0).toUpperCase()}
                       </div>
                     )}
                   </button>
                   <div className="min-w-0">
                      <div className="text-sm font-bold text-gray-900 truncate">{r.name}</div>
                      <div className="text-xs text-gray-500 font-medium mt-0.5">{r.dateLabel} • {r.timeLabel}</div>
                      <div className={`text-xs mt-1 inline-block font-semibold ${r.type === 'in' ? 'text-green-600' : 'text-blue-600'}`}>
                        {r.type === 'in' ? 'Time In' : 'Time Out'} Request
                      </div>
                   </div>
                </div>
                <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
                   <button
                     onClick={() => approveEntry(r)}
                     className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-200 transition-all active:scale-95"
                   >
                     Approve
                   </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent History */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-6">
           <div className="w-2 h-6 bg-green-500 rounded-full" />
           <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">Recently Approved</h2>
        </div>
        
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          {recentLast7.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
              No recent approvals in the last 7 days.
            </div>
          ) : (
            recentLast7.map((r, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 opacity-75 hover:opacity-100 transition-opacity">
                 <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => {
                        setSelectedAttendanceEntry({
                          type: r.type,
                          timestamp: Number(r.ts),
                          photoDataUrl: r.photourl || "",
                          status: "Approved",
                          validatedAt: Number(r.ts)
                        });
                        setSelectedEntryName(r.name);
                      }}
                      className="h-10 w-14 rounded-md overflow-hidden bg-gray-200 border border-gray-200 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-green-300"
                      title="View attendance photo"
                    >
                      {r.photourl ? (
                        <img src={r.photourl} alt="Student" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-green-700 font-bold text-sm bg-green-100">
                          {r.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </button>
                    <div className="min-w-0">
                       <div className="text-sm font-semibold text-gray-700 truncate">{r.name}</div>
                       <div className="text-xs text-gray-500">{r.dateLabel} • {r.timeLabel}</div>
                    </div>
                 </div>
                 <div className="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                    Approved
                 </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
    {selectedAttendanceEntry && (
      <AttendanceDetailsModal
        entry={selectedAttendanceEntry}
        onClose={() => { setSelectedAttendanceEntry(null); setSelectedEntryName(undefined); }}
        userName={selectedEntryName}
      />
    )}
    </>
  );
}

// --- Profile View ---
export function ProfileView({ user }: { user: User | null }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fullname = user ? `${user.firstname || ""} ${user.middlename ? user.middlename + " " : ""}${user.lastname || ""}`.trim() : "";

  const changePassword = async () => {
    setMessage(null);
    if (!user?.idnumber) { setMessage("Unable to identify user."); return; }
    if (!currentPassword) { setMessage("Current password is required."); return; }
    if (!newPassword || newPassword.length < 6) { setMessage("Password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { setMessage("Passwords do not match."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          idnumber: user.idnumber, 
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
                {(fullname?.[0] || user?.firstname?.[0] || user?.lastname?.[0] || "?").toUpperCase()}
              </div>
              <div className="text-center sm:text-left mb-2">
                 <h1 className="text-2xl font-bold text-gray-900">{fullname || "Unknown User"}</h1>
                 <p className="text-gray-500 font-medium">{user?.idnumber || "No ID"}</p>
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
                  <div className="text-gray-900 font-semibold">{user?.firstname || "-"}</div>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Last Name</label>
                  <div className="text-gray-900 font-semibold">{user?.lastname || "-"}</div>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                   <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Role</label>
                   <div className="text-gray-900 font-semibold capitalize">Supervisor</div>
                </div>
              </div>
            </div>
            
             <div className="border-t border-gray-100 pt-8 mt-8">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-6 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F97316]"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                Employment Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                 <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Company</label>
                  <div className="text-gray-900 font-semibold">{user?.company || "N/A"}</div>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Location</label>
                  <div className="text-gray-900 font-semibold">{user?.location || "N/A"}</div>
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
}
