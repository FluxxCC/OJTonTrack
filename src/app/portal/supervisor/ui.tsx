"use client";
import React, { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "../../../lib/supabaseClient";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { ProfileView as StudentProfileView } from "../student/ui";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { AttendanceDetailsModal } from "@/components/AttendanceDetailsModal";

// --- Types ---
export type AttendanceEntry = { type: "in" | "out"; timestamp: number; photoDataUrl: string; status?: "Pending" | "Approved"; approvedAt?: number };
export type ServerAttendanceEntry = {
  id: number;
  type: "in" | "out";
  ts: number;
  photourl: string;
  status: string;
  approvedby?: string | null;
  approvedat?: string | null;
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
function computeStats(attendance: AttendanceEntry[]): { totalMs: number; activeStart: number | null } {
  const sorted = attendance.slice().sort((a, b) => a.timestamp - b.timestamp);
  const approved = sorted.filter(e => e.status === "Approved");
  
  let totalMs = 0;
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
        totalMs += outTs - inTs;
        i = outIndex;
      } else {
        // Active session
        activeStart = approved[i].approvedAt ?? approved[i].timestamp;
      }
    }
  }
  return { totalMs, activeStart };
}

function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function computeTotalHours(attendance: AttendanceEntry[]): string {
  const { totalMs, activeStart } = computeStats(attendance);
  // If there is an active session, we add the current duration
  // BUT computeTotalHours is a pure function, it doesn't know "now".
  // So we just return the completed hours + duration up to now? 
  // No, let's just return the completed hours for the list view, 
  // or maybe assume "now" is Date.now() but that causes hydration mismatch.
  // For safety, we just return the base total. The detailed view handles realtime.
  return formatDuration(totalMs);
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
  onSelect
}: { 
  students: User[], 
  myIdnumber: string, 
  supervisorInfo: { company?: string; location?: string } | null,
  selected: User | null,
  onSelect: (s: User | null) => void
}) {
  const detailsRef = useRef<HTMLDivElement>(null);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);
  const [targetHours, setTargetHours] = useState<number>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("targetHours") || "" : "";
      const t = Number(raw);
      return !Number.isNaN(t) && t > 0 ? t : 486;
    } catch {
      return 486;
    }
  });
  const [progressMap, setProgressMap] = useState<Record<string, { baseMs: number; activeStart: number | null }>>({});
  const [isMobile, setIsMobile] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [selectedAttendanceEntry, setSelectedAttendanceEntry] = useState<AttendanceEntry | null>(null);
  const searchParams = useSearchParams();

  const [assignedSearch, setAssignedSearch] = useState("");
  const [filterCourse, setFilterCourse] = useState("");
  const [filterSection, setFilterSection] = useState("");

  const uniqueCourses = useMemo(() => Array.from(new Set(students.map(s => s.course).filter(Boolean))).sort(), [students]);
  const uniqueSections = useMemo(() => Array.from(new Set(students.map(s => s.section).filter(Boolean))).sort(), [students]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const searchLower = assignedSearch.toLowerCase();
      const matchesSearch = 
        (s.firstname?.toLowerCase() || "").includes(searchLower) ||
        (s.lastname?.toLowerCase() || "").includes(searchLower) ||
        (s.idnumber?.toLowerCase() || "").includes(searchLower);
      const matchesCourse = filterCourse ? s.course === filterCourse : true;
      const matchesSection = filterSection ? s.section === filterSection : true;
      return matchesSearch && matchesCourse && matchesSection;
    });
  }, [students, assignedSearch, filterCourse, filterSection]);

  useEffect(() => {
    if (selected && window.innerWidth < 768) {
      setTimeout(() => {
        detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [selected]);

  

  useEffect(() => {
    const update = () => {
      try {
        setIsMobile(window.matchMedia("(max-width: 767px)").matches);
      } catch {}
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    (async () => {
      if (!selected?.idnumber) { setAttendance([]); return; }
      try {
        const res = await fetch(`/api/attendance?idnumber=${encodeURIComponent(selected.idnumber)}&limit=200`);
        const json = await res.json();
        if (res.ok && Array.isArray(json.entries)) {
          const mapped = json.entries.map((e: any) => ({
            type: e.type,
            timestamp: e.ts,
            photoDataUrl: e.photourl,
            status: String(e.status || "").trim().toLowerCase() === "approved" || !!e.approvedby ? "Approved" : "Pending",
            approvedAt: e.approvedat ? Number(new Date(e.approvedat).getTime()) : undefined
          })) as AttendanceEntry[];
          setAttendance(mapped);
        } else {
          setAttendance([]);
        }
      } catch {
        setAttendance([]);
      }
    })();
  }, [selected]);

  useEffect(() => {
    if (!supabase || !selected?.idnumber) return;
    const ch = supabase
      .channel(`attendance_${selected.idnumber}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance', filter: `idnumber=eq.${selected.idnumber}` }, (payload: RealtimePostgresChangesPayload<{ id: number; idnumber: string; type: "in" | "out"; ts: number; photourl: string }>) => {
        const row = payload.new as { id: number; idnumber: string; type: "in" | "out"; ts: number; photourl: string };
        if (!row) return;
        setAttendance(prev => {
          const next = [...prev, { type: row.type, timestamp: Number(row.ts), photoDataUrl: row.photourl }];
          return next;
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attendance', filter: `idnumber=eq.${selected.idnumber}` }, (_payload: RealtimePostgresChangesPayload<{ id: number }>) => {
        setAttendance(prev => [...prev]);
      })
      .subscribe();
    return () => {
      try { supabase?.removeChannel(ch); } catch {}
    };
  }, [selected?.idnumber]);

  const [now, setNow] = useState(() => Date.now());
  
  useEffect(() => {
    // Only run interval if there is an active session to save resources?
    // But we don't know if there is an active session until we compute stats.
    // However, computing stats is cheap.
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const totalHours = useMemo(() => {
    const { totalMs, activeStart } = computeStats(attendance);
    const currentTotal = totalMs + (activeStart ? Math.max(0, now - activeStart) : 0);
    return formatDuration(currentTotal);
  }, [attendance, now]);

  useEffect(() => {
    (async () => {
      const map: Record<string, { baseMs: number; activeStart: number | null }> = {};
      for (const s of students) {
        try {
          const res = await fetch(`/api/attendance?idnumber=${encodeURIComponent(s.idnumber)}&limit=200`, { cache: "no-store" });
          const json = await res.json();
          if (res.ok && Array.isArray(json.entries)) {
            const mapped = json.entries.map((e: ServerAttendanceEntry) => ({
              type: e.type,
              timestamp: e.ts,
              photoDataUrl: e.photourl,
              status: String(e.status || "").trim().toLowerCase() === "approved" || !!e.approvedby ? "Approved" : "Pending"
            })) as AttendanceEntry[];
            const { totalMs, activeStart } = computeStats(mapped);
            map[s.idnumber] = { baseMs: totalMs, activeStart };
          }
        } catch {}
      }
      setProgressMap(map);
    })();
  }, [students]);
  
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel('dashboard_progress_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, async (payload: RealtimePostgresChangesPayload<{ idnumber: string }>) => {
        const row = payload.new as { idnumber: string };
        const id = row?.idnumber;
        if (!id) return;
        try {
          const res = await fetch(`/api/attendance?idnumber=${encodeURIComponent(id)}&limit=200`);
          const json = await res.json();
          if (Array.isArray(json.entries)) {
            const mapped = json.entries.map((e: ServerAttendanceEntry) => ({
              type: e.type,
              timestamp: e.ts,
              photoDataUrl: e.photourl,
              status: String(e.status || "").trim().toLowerCase() === "approved" || !!e.approvedby ? "Approved" : "Pending"
            })) as AttendanceEntry[];
            const { totalMs, activeStart } = computeStats(mapped);
            setProgressMap(prev => ({ ...prev, [id]: { baseMs: totalMs, activeStart } }));
          }
        } catch {}
      })
      .subscribe();
    return () => {
      try { supabase?.removeChannel(ch); } catch {}
    };
  }, [students]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Student List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:col-span-1 h-auto max-h-[400px] lg:h-[calc(100vh-200px)] lg:max-h-none flex flex-col">
        <div className="mb-4 space-y-3">
           <div className="text-sm font-bold text-gray-900 uppercase tracking-wide">Assigned Students</div>
           <input 
             type="text" 
             placeholder="Search student..." 
             value={assignedSearch}
             onChange={(e) => setAssignedSearch(e.target.value)}
             className="w-full text-sm px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 placeholder:text-gray-500 font-medium"
           />
           <div className="flex gap-2">
             <select 
               value={filterCourse} 
               onChange={(e) => setFilterCourse(e.target.value)}
               className="flex-1 text-xs px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-medium text-gray-700"
             >
               <option value="">All Courses</option>
               {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
             </select>
             <select 
               value={filterSection} 
               onChange={(e) => setFilterSection(e.target.value)}
               className="flex-1 text-xs px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-medium text-gray-700"
             >
               <option value="">All Sections</option>
               {uniqueSections.map(s => <option key={s} value={s}>{s}</option>)}
             </select>
           </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {filteredStudents.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No students found.</div>
          ) : (
            filteredStudents.map((s) => {
              const name = `${s.firstname || ""} ${s.lastname || ""}`.trim() || s.idnumber;
              const isActive = selected?.idnumber === s.idnumber;
              const pData = progressMap[s.idnumber] || { baseMs: 0, activeStart: null };
              const currentMs = pData.baseMs + (pData.activeStart ? Math.max(0, now - pData.activeStart) : 0);
              const progressStr = formatDuration(currentMs);
              return (
                <button
                  key={s.idnumber}
                  onClick={() => onSelect(selected?.idnumber === s.idnumber ? null : s)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${isActive ? "border-orange-500 bg-orange-50 ring-1 ring-orange-200" : "border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200"}`}
                >
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${isActive ? "bg-orange-500 text-white" : "bg-orange-100 text-orange-600"}`}>
                    {(s.firstname?.[0] || s.lastname?.[0] || s.idnumber?.[0] || "S").toUpperCase()}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{name}</div>
                    <div className="text-xs text-gray-500">Progress: <span className="font-medium text-gray-700">{progressStr.split("h")[0]}h</span> / {targetHours}h</div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Detail View */}
      <div ref={detailsRef} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:col-span-2 h-auto lg:h-[calc(100vh-200px)] flex flex-col">
        {/* Persistent Header */}
        <div className="flex items-center justify-between pb-6 border-b border-gray-100 mb-6 flex-shrink-0">
          <div>
            {selected ? (
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-200">
                  <span className="text-white font-bold text-xl">
                    {(`${selected.firstname || ""} ${selected.lastname || ""}`.trim() || "S").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {`${selected.firstname || ""} ${selected.middlename ? selected.middlename + " " : ""}${selected.lastname || ""}`.trim() || selected.idnumber}
                  </h2>
                  <p className="text-sm text-gray-500 font-medium">{selected.idnumber}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium border border-gray-200">
                      {selected.course && selected.section ? `${selected.course} - ${selected.section}` : (selected.course || selected.section || "No Course/Section")}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <h2 className="text-xl font-bold text-gray-900">Student Details</h2>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {!selected && searchParams.get("studentId") && students.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mb-4"></div>
                  <p className="text-gray-500">Loading student details...</p>
               </div>
            ) : !selected ? (
               <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">No Student Selected</h3>
                  <p className="text-sm text-gray-500 mt-1 max-w-xs">Select a student from the list to view their attendance logs and progress.</p>
               </div>
            ) : (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-orange-50 border border-orange-100">
                    <div className="text-xs font-semibold text-orange-600 uppercase tracking-wider">Total Hours</div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-gray-900">{totalHours}</span>
                      <span className="text-sm text-gray-500">/ {targetHours} hrs</span>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-gray-200">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</div>
                    <div className="mt-1 text-sm font-semibold text-gray-900 truncate">{selected.company || supervisorInfo?.company || "Not Assigned"}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-gray-200">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</div>
                    <div className="mt-1 text-sm font-semibold text-gray-900 truncate">{selected.location || supervisorInfo?.location || "Not Set"}</div>
                  </div>
                </div>

                {/* Attendance Logs */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-gray-900">Attendance Logs</h3>
                    <button
                      onClick={() => setShowAll(true)}
                      className="text-sm font-medium text-orange-600 hover:text-orange-700 hover:underline"
                    >
                      View All History
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {attendance.length === 0 ? (
                      <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500 text-sm">
                        No attendance records found for this student.
                      </div>
                    ) : (
                      attendance.slice().sort((a,b) => b.timestamp - a.timestamp).slice(0, 5).map((entry, idx) => (
                        <button 
                            key={idx} 
                            onClick={() => setSelectedAttendanceEntry(entry)}
                            className="w-full flex items-center gap-4 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-white hover:border-orange-200 hover:shadow-sm transition-all text-left group"
                        >
                          <div className="h-10 w-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200 border border-gray-200 relative">
                            {entry.photoDataUrl ? (
                              <img src={entry.photoDataUrl} alt="Log" className="h-full w-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Img</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${entry.type === "in" ? "bg-green-500" : "bg-gray-400"}`} />
                              <span className="font-semibold text-gray-900 text-sm capitalize group-hover:text-orange-700 transition-colors">{entry.type === "in" ? "Time In" : "Time Out"}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {new Date(entry.timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>

      {/* Modal for All Logs */}
      {showAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50 shrink-0">
              <h3 className="font-bold text-gray-900">Attendance History</h3>
              <button
                onClick={() => setShowAll(false)}
                className="p-2 rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 shrink-0">
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1 block">Search</label>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-gray-400 px-4 py-2.5 text-sm font-medium text-gray-900 placeholder:text-gray-500 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  placeholder="Search by date or type..."
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1 block">Filter by Date</label>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-400 px-4 py-2.5 text-sm font-medium text-gray-900 placeholder:text-gray-500 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3 custom-scrollbar">
              {attendance
                .slice()
                .sort((a,b) => b.timestamp - a.timestamp)
                .filter((entry) => {
                  const q = searchQuery.trim().toLowerCase();
                  const matchesSearch = q === "" ? true : 
                    entry.type.toLowerCase().includes(q) ||
                    new Date(entry.timestamp).toLocaleString().toLowerCase().includes(q);
                  const matchesDate = filterDate === "" ? true : 
                    new Date(entry.timestamp).toLocaleDateString() === new Date(filterDate).toLocaleDateString();
                  return matchesSearch && matchesDate;
                })
                .map((entry, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => setSelectedAttendanceEntry(entry)}
                    className="w-full flex items-center gap-4 p-3 rounded-xl bg-white border border-gray-100 shadow-sm hover:border-orange-200 hover:shadow-md transition-all text-left group"
                  >
                    <div className="h-10 w-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 relative">
                      {entry.photoDataUrl ? (
                        <img src={entry.photoDataUrl} alt="Log" className="h-full w-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Img</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${entry.type === "in" ? "bg-green-500" : "bg-gray-400"}`} />
                        <span className="font-semibold text-gray-900 text-sm capitalize group-hover:text-orange-700 transition-colors">{entry.type === "in" ? "Time In" : "Time Out"}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {new Date(entry.timestamp).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}
                      </div>
                    </div>
                  </button>
                ))
              }
              {attendance.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">No records found.</div>
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
    </div>
  );
}

// --- Attendance View ---
export function AttendanceView({ students, myIdnumber, onPendingChange, refreshKey }: { students: User[], myIdnumber: string, onPendingChange?: (count: number) => void, refreshKey?: number }) {
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [recent, setRecent] = useState<ApprovalRow[]>([]);
  const [selectedAttendanceEntry, setSelectedAttendanceEntry] = useState<AttendanceEntry | null>(null);
  const [selectedEntryName, setSelectedEntryName] = useState<string | undefined>(undefined);
  
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
                approved: String(e.status || "").trim().toLowerCase() === "approved" || !!e.approvedby,
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
            approved: String(e.status || "").trim().toLowerCase() === "approved" || !!e.approvedby,
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
          const approvedNow = String(e.status || "").trim().toLowerCase() === "approved" || !!e.approvedby;
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
        body: JSON.stringify({ id: row.id, approve: true, approvedby: myIdnumber }),
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
    } catch {}
  };

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Pending Approvals */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-6 bg-orange-500 rounded-full" />
            <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">Pending Approvals</h2>
          </div>
          <span className="bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1 rounded-full">
            {rows.length} Pending
          </span>
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
              <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-white border border-gray-100 shadow-sm hover:border-orange-200 transition-all gap-4">
                <div className="flex items-center gap-4">
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
                          approvedAt: Number(r.ts)
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
