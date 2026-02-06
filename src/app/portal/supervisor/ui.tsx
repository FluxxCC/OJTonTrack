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
  Plus,
  XCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import Image from "next/image";
import { calculateSessionDuration, determineShift, buildSchedule, ShiftSchedule as LibShiftSchedule, formatHours, calculateShiftDurations, isLate, calculateHoursWithinOfficialTime } from "@/lib/attendance";
import * as XLSX from 'xlsx-js-style';

type ShiftSchedule = LibShiftSchedule;

// --- Types ---
export type AttendanceEntry = { id?: number; type: "in" | "out"; timestamp: number; photoDataUrl: string; photourl?: string; photoUrl?: string; status?: "Pending" | "Approved" | "Rejected" | "Validated" | "VALIDATED" | "OFFICIAL" | "ADJUSTED" | "Official" | "REJECTED"; validatedAt?: number; idnumber?: string; studentId?: number; validated_by?: string | null; is_overtime?: boolean; rendered_hours?: number; validated_hours?: number; official_time_in?: string; official_time_out?: string; slot?: "AM" | "PM" | "OT"; };
export type DateOverride = {
  date: string; // YYYY-MM-DD
  am?: { start: string; end: string };
  pm?: { start: string; end: string };
};
export type ServerAttendanceEntry = {
  id: number;
  type: "in" | "out";
  ts: number;
  photourl: string;
  status: string;
  validated_by?: string | null;
  validated_at?: string | null;
};
export type AttendanceQueryResult = {
  id: number;
  type: "in" | "out";
  ts: number;
  photourl: string;
  status: string;
  validated_by?: string | null;
  validated_at?: string | null;
  idnumber: string;
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
  avatar_url?: string;
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
const toDateKey = (d: Date) => {
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
};
const toLocalDateKey = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

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
      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-2 text-white ${
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
export function SetOfficialTimeView({ students, myIdnumber }: { students: User[], myIdnumber?: string }) {
  // Time Settings State
  const [timeSettings, setTimeSettings] = useState<{
    amIn: string;
    amOut: string;
    amOutTime: string; // "12:00"
    pmIn: string;
    pmInTime: string; // "13:00"
    pmOut: string;
  }>({ 
    amIn: "", 
    amOut: "", 
    amOutTime: "", 
    pmIn: "", 
    pmInTime: "", 
    pmOut: ""
  });

  const [isSaving, setIsSaving] = useState(false);
  const [initialSettings, setInitialSettings] = useState<{
    amIn: string;
    amOut: string;
    pmIn: string;
    pmOut: string;
  } | null>(null);
  const [noChangeModal, setNoChangeModal] = useState(false);
  const [successModal, setSuccessModal] = useState(false);

  // Overrides State
  const [dateOverrides, setDateOverrides] = useState<DateOverride[]>([]);
  const [overrideModal, setOverrideModal] = useState<{
    isOpen: boolean;
    date: string | null;
    amIn: string; amOut: string;
    pmIn: string; pmOut: string;
  }>({ isOpen: false, date: null, amIn: "", amOut: "", pmIn: "", pmOut: "" });
  const [isSavingOverride, setIsSavingOverride] = useState(false);

  const fetchOverrides = async () => {
    try {
        const supervisorId = myIdnumber || localStorage.getItem("idnumber") || "";
        if (!supervisorId) return;
        const res = await fetch(`/api/shifts/overrides?supervisor_id=${encodeURIComponent(supervisorId)}`);
        const json = await res.json();
        if (json.overrides) {
            setDateOverrides(json.overrides);
        }
    } catch (e) {
        console.error("Failed to fetch overrides", e);
    }
  };

  useEffect(() => {
    fetchOverrides();
  }, [myIdnumber]);

  const handleSaveOverride = async () => {
    if (!overrideModal.date) return;
    setIsSavingOverride(true);
    try {
        const supervisorId = myIdnumber || localStorage.getItem("idnumber") || "";
        console.log("Saving override for:", supervisorId, overrideModal);

        const res = await fetch("/api/shifts/overrides", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                supervisor_id: supervisorId,
                date: overrideModal.date,
                amIn: overrideModal.amIn,
                amOut: overrideModal.amOut,
                pmIn: overrideModal.pmIn,
                pmOut: overrideModal.pmOut
            })
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Failed to save");
        }

        setOverrideModal({ ...overrideModal, isOpen: false });
        fetchOverrides();
    } catch (e) {
        console.error(e);
        alert(e instanceof Error ? e.message : "Failed to save schedule override");
    } finally {
        setIsSavingOverride(false);
    }
  };

  const handleDeleteOverride = async (date: string) => {
    if (!confirm("Are you sure you want to delete this schedule override?")) return;
    try {
        const supervisorId = myIdnumber || localStorage.getItem("idnumber") || "";
        await fetch(`/api/shifts/overrides?supervisor_id=${encodeURIComponent(supervisorId)}&date=${date}`, {
            method: "DELETE"
        });
        fetchOverrides();
    } catch (e) {
        alert("Failed to delete override");
    }
  };

  const formatDisplayTime = (time: string) => {
    if(!time) return "";
    const [h, m] = time.split(':');
    const date = new Date();
    date.setHours(Number(h));
    date.setMinutes(Number(m));
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  // Load global settings
  useEffect(() => {
    const loadSchedule = async () => {
      try {
        let supervisorId = myIdnumber || "";
        if (!supervisorId) {
          try {
            supervisorId = typeof window !== "undefined" ? localStorage.getItem("idnumber") || "" : "";
          } catch {}
        }

        const res = await fetch(`/api/shifts${supervisorId ? `?supervisor_id=${encodeURIComponent(supervisorId)}` : ''}`);
        const json = await res.json();

        if (res.ok && Array.isArray(json.shifts) && json.shifts.length > 0) {
          let amIn = "";
          let amOut = "";
          let pmIn = "";
          let pmOut = "";

          json.shifts.forEach((s: any) => {
            const name = (s.shift_name || "").toLowerCase();
            if (name.includes("morning")) {
              amIn = s.official_start || amIn;
              amOut = s.official_end || amOut;
            } else if (name.includes("afternoon")) {
              pmIn = s.official_start || pmIn;
              pmOut = s.official_end || pmOut;
            }
          });

          const next = {
            amIn,
            amOut,
            amOutTime: amOut,
            pmIn,
            pmInTime: pmIn,
            pmOut
          };
          
          setTimeSettings(next);
          setInitialSettings({
            amIn: next.amIn,
            amOut: next.amOut,
            pmIn: next.pmIn,
            pmOut: next.pmOut
          });
          return;
        }
      } catch (e) {
        console.error("Failed to fetch schedule from API", e);
      }

      // No fallback to defaults - let user set it
      const next = { 
        amIn: "", 
        amOut: "", 
        amOutTime: "",
        pmIn: "", 
        pmInTime: "",
        pmOut: ""
      };
      setTimeSettings(next);
      setInitialSettings({
        amIn: next.amIn,
        amOut: next.amOut,
        pmIn: next.pmIn,
        pmOut: next.pmOut
      });
    };

    loadSchedule();
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
      let supervisorId = myIdnumber || "";
      if (!supervisorId) {
        try {
          supervisorId = typeof window !== "undefined" ? localStorage.getItem("idnumber") || "" : "";
        } catch {
          supervisorId = "";
        }
      }

      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amIn: timeSettings.amIn,
          amOut: timeSettings.amOut,
          pmIn: timeSettings.pmIn,
          pmOut: timeSettings.pmOut,
          supervisor_id: supervisorId
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        console.error("Failed to save schedule to database", json?.error || res.statusText);
        return;
      }

      setSuccessModal(true);
    } finally {
      setIsSaving(false);
    }
  };

  const calculateDuration = (start: string, end: string) => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    return Math.max(0, endMins - startMins);
  };

  const formatDuration = (mins: number) => {
    if (mins === 0) return "0h";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const amDuration = calculateDuration(overrideModal.amIn, overrideModal.amOut);
  const pmDuration = calculateDuration(overrideModal.pmIn, overrideModal.pmOut);
  const totalDuration = amDuration + pmDuration;

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm px-3 py-2 mb-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500">
           <Clock size={18} />
        </div>
        <div>
           <h2 className="text-base font-bold text-gray-900">Official Schedule</h2>
           <p className="text-[10px] text-gray-500">Set the required working hours for all your students.</p>
        </div>
      </div>

      {noChangeModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4">
            <h2 className="text-base font-bold text-gray-900 mb-2">No Changes Detected</h2>
            <p className="text-xs text-gray-700 mb-3">
              The official schedule has not been modified. Please adjust the times before saving to avoid creating duplicate entries.
            </p>
            <button
              onClick={() => setNoChangeModal(false)}
              className="w-full px-3 py-1.5 bg-[#F97316] text-white rounded-lg font-bold text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {successModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4">
            <h2 className="text-base font-bold text-gray-900 mb-2">Schedule Saved</h2>
            <p className="text-xs text-gray-700 mb-3">
              Schedule saved successfully for all students.
            </p>
            <button
              onClick={() => setSuccessModal(false)}
              className="w-full px-3 py-1.5 bg-[#F97316] text-white rounded-lg font-bold text-xs"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Settings View */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
        <div className="max-w-xl mx-auto w-full space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
              <div className="p-1 bg-orange-100 rounded text-orange-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </div>
              <div>
                 <h3 className="text-xs font-bold text-gray-900">Standard Schedule</h3>
                 <p className="text-[10px] text-gray-500">This schedule will apply to all students under your supervision.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                 <h4 className="text-[10px] font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                    Morning Shift
                 </h4>
                 <div>
                   <label className="block text-[10px] font-bold text-gray-900 mb-1">Time In</label>
                   <input 
                     type="time" 
                     value={timeSettings.amIn}
                     onClick={(e) => e.currentTarget.showPicker()}
                     onChange={(e) => setTimeSettings(prev => ({ ...prev, amIn: e.target.value }))}
                     className="w-full rounded-lg border border-gray-400 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all shadow-sm"
                   />
                 </div>
                 <div>
                   <label className="block text-[10px] font-bold text-gray-900 mb-1">Time Out</label>
                   <input 
                     type="time" 
                     value={timeSettings.amOut}
                     onClick={(e) => e.currentTarget.showPicker()}
                     onChange={(e) => setTimeSettings(prev => ({ ...prev, amOut: e.target.value }))}
                     className="w-full rounded-lg border border-gray-400 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all shadow-sm"
                   />
                 </div>
              </div>

              <div className="space-y-2">
                 <h4 className="text-[10px] font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                    Afternoon Shift
                 </h4>
                 <div>
                   <label className="block text-[10px] font-bold text-gray-900 mb-1">Time In</label>
                   <input 
                     type="time" 
                     value={timeSettings.pmIn}
                     onClick={(e) => e.currentTarget.showPicker()}
                     onChange={(e) => setTimeSettings(prev => ({ ...prev, pmIn: e.target.value }))}
                     className="w-full rounded-lg border border-gray-400 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all shadow-sm"
                   />
                 </div>
                 <div>
                   <label className="block text-[10px] font-bold text-gray-900 mb-1">Time Out</label>
                   <input 
                     type="time" 
                     value={timeSettings.pmOut}
                     onClick={(e) => e.currentTarget.showPicker()}
                     onChange={(e) => setTimeSettings(prev => ({ ...prev, pmOut: e.target.value }))}
                     className="w-full rounded-lg border border-gray-400 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all shadow-sm"
                   />
                 </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-gray-100">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 rounded-lg bg-[#F97316] text-white font-bold shadow-sm shadow-orange-200 hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 text-xs"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                  Save Schedule
                </>
              )}
            </button>
          </div>
        </div>

      {/* Specific Date Schedules Section */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3 mt-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-100 rounded text-blue-600">
                <Calendar size={16} />
              </div>
              <div>
                 <h3 className="font-bold text-gray-900 text-xs">Specific Date Schedules</h3>
                 <p className="text-[10px] text-gray-500">Set custom official times for specific dates.</p>
              </div>
          </div>
          <button
            onClick={() => setOverrideModal({ 
              isOpen: true, 
              date: new Date().toISOString().split('T')[0], 
              amIn: timeSettings.amIn, amOut: timeSettings.amOut, 
              pmIn: timeSettings.pmIn, pmOut: timeSettings.pmOut 
            })}
            className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 font-bold text-xs hover:bg-blue-100 transition-colors flex items-center gap-2"
          >
            <Plus size={16} />
            Add Date Schedule
          </button>
        </div>

        {dateOverrides.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-xs bg-gray-50 rounded-xl border border-dashed border-gray-200">
            No specific date schedules set.
          </div>
        ) : (
          <div className="space-y-2">
            {dateOverrides.map((override) => (
              <div key={override.date} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                 <div className="flex items-center gap-3">
                    <div className="text-center bg-white p-2 rounded-lg border border-gray-200 min-w-[50px]">
                       <div className="text-[10px] font-bold text-gray-500 uppercase">{new Date(override.date).toLocaleDateString('en-US', { month: 'short' })}</div>
                       <div className="text-lg font-bold text-gray-900">{new Date(override.date).getDate()}</div>
                    </div>
                    <div>
                       <div className="text-xs font-bold text-gray-900">
                          {new Date(override.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                       </div>
                       <div className="text-[10px] text-gray-500 mt-1 flex gap-3">
                          {override.am && (
                              <span className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                                  AM: {formatDisplayTime(override.am.start)} - {formatDisplayTime(override.am.end)}
                              </span>
                          )}
                          {override.pm && (
                              <span className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                                  PM: {formatDisplayTime(override.pm.start)} - {formatDisplayTime(override.pm.end)}
                              </span>
                          )}
                       </div>
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setOverrideModal({
                          isOpen: true,
                          date: override.date,
                          amIn: override.am?.start || "", amOut: override.am?.end || "",
                          pmIn: override.pm?.start || "", pmOut: override.pm?.end || ""
                      })}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                       <UserCog size={14} />
                    </button>
                    <button 
                      onClick={() => handleDeleteOverride(override.date)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                       <XCircle size={14} />
                    </button>
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Override Modal */}
      {overrideModal.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
               <h2 className="text-lg font-bold text-gray-900">Specific Date Schedule</h2>
               <button onClick={() => setOverrideModal({ ...overrideModal, isOpen: false })} className="text-gray-400 hover:text-gray-600">
                 <X size={20} />
               </button>
            </div>
            
            <div className="p-5 space-y-5">
               {/* Summary Section */}
               <div className="bg-orange-50 rounded-xl p-3 border border-orange-100 flex items-center justify-between">
                  <div>
                     <div className="text-[10px] font-bold text-orange-600 uppercase tracking-wider mb-1">Total Schedule Duration</div>
                     <div className="text-xl font-bold text-gray-900">{formatDuration(totalDuration)}</div>
                  </div>
                  <div className="flex gap-4">
                     <div className="text-right">
                         <div className="text-[10px] font-bold text-gray-500 uppercase">AM Shift</div>
                         <div className="text-xs font-bold text-gray-700">{formatDuration(amDuration)}</div>
                     </div>
                     <div className="text-right">
                         <div className="text-[10px] font-bold text-gray-500 uppercase">PM Shift</div>
                         <div className="text-xs font-bold text-gray-700">{formatDuration(pmDuration)}</div>
                     </div>
                  </div>
               </div>

               <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">Select Date</label>
                  <input 
                    type="date"
                    value={overrideModal.date || ""}
                    onChange={(e) => setOverrideModal({ ...overrideModal, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-gray-50 font-semibold text-gray-900 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-3 p-3 bg-orange-50/50 rounded-xl border border-orange-100/50">
                     <h4 className="text-[10px] font-bold text-orange-600 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                        Morning Shift
                     </h4>
                     <div>
                        <label className="block text-[10px] font-semibold text-gray-700 mb-1">Time In</label>
                        <input 
                           type="time" 
                           value={overrideModal.amIn} 
                           onChange={(e) => setOverrideModal({...overrideModal, amIn: e.target.value})} 
                           className="w-full px-2 py-1.5 rounded-lg border border-gray-300 text-xs font-bold text-gray-900 bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all" 
                        />
                     </div>
                     <div>
                        <label className="block text-[10px] font-semibold text-gray-700 mb-1">Time Out</label>
                        <input 
                           type="time" 
                           value={overrideModal.amOut} 
                           onChange={(e) => setOverrideModal({...overrideModal, amOut: e.target.value})} 
                           className="w-full px-2 py-1.5 rounded-lg border border-gray-300 text-xs font-bold text-gray-900 bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all" 
                        />
                     </div>
                  </div>
                  <div className="space-y-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
                     <h4 className="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        Afternoon Shift
                     </h4>
                     <div>
                        <label className="block text-[10px] font-semibold text-gray-700 mb-1">Time In</label>
                        <input 
                           type="time" 
                           value={overrideModal.pmIn} 
                           onChange={(e) => setOverrideModal({...overrideModal, pmIn: e.target.value})} 
                           className="w-full px-2 py-1.5 rounded-lg border border-gray-300 text-xs font-bold text-gray-900 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" 
                        />
                     </div>
                     <div>
                        <label className="block text-[10px] font-semibold text-gray-700 mb-1">Time Out</label>
                        <input 
                           type="time" 
                           value={overrideModal.pmOut} 
                           onChange={(e) => setOverrideModal({...overrideModal, pmOut: e.target.value})} 
                           className="w-full px-2 py-1.5 rounded-lg border border-gray-300 text-xs font-bold text-gray-900 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" 
                        />
                     </div>
                  </div>
               </div>
            </div>

            <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
               <button 
                 onClick={() => setOverrideModal({ ...overrideModal, isOpen: false })}
                 className="px-4 py-1.5 rounded-xl text-gray-600 font-bold text-xs hover:bg-gray-200 transition-colors"
               >
                 Cancel
               </button>
               <button 
                 onClick={handleSaveOverride}
                 disabled={!overrideModal.date || isSavingOverride}
                 className="px-4 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:opacity-70 disabled:cursor-not-allowed"
               >
                 {isSavingOverride ? "Saving..." : "Save Schedule"}
               </button>
            </div>
          </div>
        </div>
      )}

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
  const filledCount = Object.values(criteria).filter(v => typeof v === "number" && v >= 75).length;
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
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50 shrink-0">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Evaluate Student</h3>
            <div className="text-xs text-gray-600">
              Evaluating <span className="font-bold text-gray-900">{selected.firstname} {selected.lastname}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                isComplete ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
              }`}>
                {filledCount}/{totalRequired} fields completed
              </span>
              {!isComplete && (
                <span className="text-[10px] text-red-600 mt-0.5">
                  Complete all fields to enable submission
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100">
            <div className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">Grade Interpretation</div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {gradeTags.map((t) => (
                <div key={t.label} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-900">{t.label}</span>
                  <span className="text-xs text-gray-500 font-medium">({t.range})</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 font-bold text-gray-900 text-xs uppercase tracking-wider">Criteria / Performance Indicator</th>
                  <th className="px-4 py-3 font-bold text-gray-900 text-xs uppercase tracking-wider w-32 text-center">Rating (1-100)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rubric.map(cat => (
                  <React.Fragment key={cat.id}>
                    <tr className="bg-gray-50/50">
                      <td colSpan={2} className="px-4 py-2 text-xs font-bold text-gray-800 bg-gray-100/50">
                        {cat.title}
                      </td>
                    </tr>
                    {cat.items.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2 text-xs text-gray-600 align-middle">
                          {item.label}
                        </td>
                        <td className="px-4 py-2 align-middle">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={3}
                            value={criteria[item.id] ?? ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === "") {
                                setCriteria({ ...criteria, [item.id]: null });
                                return;
                              }
                              // Allow digits only
                              if (!/^\d+$/.test(raw)) return;

                              const valNum = Number(raw);
                              
                              // Strict Input Filtering for 75-100 range
                              // 1. Single digit: Must be 1, 7, 8, or 9
                              if (raw.length === 1) {
                                if (valNum !== 1 && (valNum < 7 || valNum > 9)) return;
                              }
                              // 2. Two digits
                              else if (raw.length === 2) {
                                // If starts with 1, must be 10
                                if (raw.startsWith("1")) {
                                    if (valNum !== 10) return;
                                }
                                // If starts with 7, must be >= 75
                                else if (raw.startsWith("7")) {
                                    if (valNum < 75) return;
                                }
                                // 80-99 are valid
                              }
                              // 3. Three digits: Must be 100
                              else if (raw.length === 3) {
                                if (valNum !== 100) return;
                              }

                              const next = { ...criteria, [item.id]: valNum };
                              setCriteria(next);
                            }}
                            placeholder="75–100"
                            className="w-full rounded border border-gray-300 px-3 py-1.5 text-xs text-center font-medium text-gray-900 focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all shadow-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Comments / Remarks</label>
            <textarea
              value={evalComments}
              onChange={e => setEvalComments(e.target.value)}
              className={`w-full h-24 rounded-lg p-3 text-xs font-medium text-gray-900 placeholder-gray-500 outline-none resize-y border shadow-sm transition-all focus:ring-1 ${
                hasComments 
                  ? "border-gray-300 focus:border-[#F97316] focus:ring-[#F97316]/20" 
                  : "border-red-300 focus:border-red-400 focus:ring-red-200"
              }`}
              placeholder="Write remarks..."
            />
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submitPayload}
            disabled={isSubmitting || !isComplete}
            className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#F97316] hover:bg-[#EA580C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md shadow-orange-200"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
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
  student, attendance, onBack, onValidate, onRefresh, scheduleConfig, overtimeShifts = []
}: {
  student: User;
  attendance: AttendanceEntry[];
  onBack: () => void;
  onValidate: (entry: AttendanceEntry, action: 'approve' | 'reject' | 'reset') => void;
  onRefresh?: () => void;
  scheduleConfig: { amIn: string; amOut: string; pmIn: string; pmOut: string; otIn: string; otOut: string } | null;
  overtimeShifts?: any[];
}) {
  const [logs, setLogs] = useState<AttendanceEntry[]>(attendance);
  const [now, setNow] = useState(() => Date.now());
  const [selectedImage, setSelectedImage] = useState<{ url: string, timestamp: number } | null>(null);
  const [overtimeModal, setOvertimeModal] = useState<{ isOpen: boolean; date: Date | null; defaultStart?: string }>({ isOpen: false, date: null });
  const [otInTime, setOtInTime] = useState("");
  const [otHours, setOtHours] = useState(0);
  const [otMinutes, setOtMinutes] = useState(0);
  const [isSavingOt, setIsSavingOt] = useState(false);
  const [isEditOt, setIsEditOt] = useState(false);
  const [editingOtDateStr, setEditingOtDateStr] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  // scheduleSettings state removed, using props instead
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkValidating, setIsBulkValidating] = useState(false);
  const [monthFilter, setMonthFilter] = useState("");
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [dateOverrides, setDateOverrides] = useState<Record<string, any>>({});

  useEffect(() => {
    const fetchOverrides = async () => {
        if (!student.supervisorid) {
            setDateOverrides({});
            return;
        }
        try {
            const res = await fetch(`/api/shifts/overrides?supervisor_id=${student.supervisorid}`);
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
    };
    fetchOverrides();
  }, [student.supervisorid]);

  useEffect(() => {
    setLogs(attendance);
    setSelectedIds(new Set());
  }, [attendance]);

  // LocalStorage effect removed as we now use passed scheduleConfig


  useEffect(() => {
    if (!supabase) return;
    const studentId = student.id;
    if (!studentId) return;

    // Realtime payload definition matching the 'attendance' table structure
    type RTEntry = {
        id: number;
        student_id: number;
        type: "in" | "out";
        logged_at: string;
        photourl: string;
        status: string;
        validated_by?: string | null;
        validated_at?: string | null;
        rendered_hours?: number;
    };

    const channel = supabase
      .channel(`student_attendance_detail_${studentId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "attendance", filter: `student_id=eq.${studentId}` },
        (payload: RealtimePostgresChangesPayload<RTEntry>) => {
          const e = payload.new as RTEntry;
          if (!e) return;
          const sStr = String(e.status || "").trim().toLowerCase();
          const isRejected = sStr === "rejected";
          const isApproved = sStr === "approved" || (!!e.validated_by && !isRejected);
          
          const entry: AttendanceEntry = {
            id: e.id,
            studentId: e.student_id,
            idnumber: student.idnumber,
            type: e.type,
            timestamp: new Date(e.logged_at).getTime(),
            photoDataUrl: e.photourl,
            status: isRejected ? "Rejected" : isApproved ? "Approved" : "Pending",
            validatedAt: e.validated_at ? Number(new Date(e.validated_at).getTime()) : undefined,
            validated_by: e.validated_by,
            rendered_hours: e.rendered_hours
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
        { event: "UPDATE", schema: "public", table: "attendance", filter: `student_id=eq.${studentId}` },
        (payload: RealtimePostgresChangesPayload<RTEntry>) => {
          const e = payload.new as RTEntry;
          if (!e) return;
          const sStr = String(e.status || "").trim().toLowerCase();
          const isRejected = sStr === "rejected";
          const isApproved = sStr === "approved" || (!!e.validated_by && !isRejected);
          
          const updatedStatus: "Pending" | "Approved" | "Rejected" =
            isRejected ? "Rejected" : isApproved ? "Approved" : "Pending";
          const updatedValidatedAt = e.validated_at ? Number(new Date(e.validated_at).getTime()) : undefined;
          const tsNum = new Date(e.logged_at).getTime();
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
                      validatedAt: updatedValidatedAt,
                      validated_by: e.validated_by,
                      studentId: e.student_id,
                      rendered_hours: e.rendered_hours
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
        { event: "DELETE", schema: "public", table: "attendance", filter: `student_id=eq.${studentId}` },
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
  }, [student.id, student.idnumber]);

  const [studentDbSchedule, setStudentDbSchedule] = useState<any>(null);

  useEffect(() => {
      const fetchStudentSchedule = async () => {
          if (!student?.idnumber || !supabase) return;
          const { data } = await supabase
              .from('student_shift_schedules')
              .select('*')
              .eq('student_id', student.idnumber)
              .single();
          
          if (data) {
              setStudentDbSchedule({
                  amIn: data.am_in,
                  amOut: data.am_out,
                  pmIn: data.pm_in,
                  pmOut: data.pm_out,
                  otIn: data.ot_in,
                  otOut: data.ot_out
              });
          } else {
              setStudentDbSchedule(null);
          }
      };
      fetchStudentSchedule();
  }, [student.idnumber]);

  // Helper to format time
  const formatTime = (ts: number) => {
      return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };

  const getEntryPhoto = (entry?: AttendanceEntry | null) => {
      if (!entry) return "";
      return entry.photoDataUrl || entry.photourl || entry.photoUrl || "";
  };

  const toggleSlotPairSelection = (entryIn?: AttendanceEntry | null, entryOut?: AttendanceEntry | null) => {
    const ids: number[] = [];
    // Only toggle Pending entries
    if (entryIn && entryIn.id != null && (entryIn.status || 'Pending') === 'Pending') ids.push(Number(entryIn.id));
    if (entryOut && entryOut.id != null && (entryOut.status || 'Pending') === 'Pending') ids.push(Number(entryOut.id));
    
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

  const isSlotPairSelected = (entryIn?: AttendanceEntry | null, entryOut?: AttendanceEntry | null) => {
    const ids: number[] = [];
    // Only check Pending entries (supports negative IDs for virtual entries)
    if (entryIn && entryIn.id != null && (entryIn.status || 'Pending') === 'Pending') ids.push(Number(entryIn.id));
    if (entryOut && entryOut.id != null && (entryOut.status || 'Pending') === 'Pending') ids.push(Number(entryOut.id));
    
    if (ids.length === 0) return false;
    // Check if ALL pending IDs in the pair are selected
    return ids.every(id => selectedIds.has(id));
  };

  const selectAllPending = () => {
    const ids = new Set<number>();

    days.forEach(day => {
      const pairs = [
          { in: day.s1, out: day.s2 },
          { in: day.s3, out: day.s4 },
          { in: day.s5, out: day.s6 }
      ];

      pairs.forEach(pair => {
          // Check if either slot in the pair is Pending
          const inPending = pair.in && ((pair.in as any).status || "Pending") === "Pending";
          const outPending = pair.out && ((pair.out as any).status || "Pending") === "Pending";
          
          if (inPending || outPending) {
              if (pair.in && (pair.in as any).id != null && ((pair.in as any).status || "Pending") === "Pending") ids.add(Number((pair.in as any).id));
              if (pair.out && (pair.out as any).id != null && ((pair.out as any).status || "Pending") === "Pending") ids.add(Number((pair.out as any).id));
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
    if (action === "approve") {
      setShowValidateModal(true);
    } else {
      setShowRejectModal(true);
    }
  };



  const monthOptions = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach(a => {
      const d = new Date(a.timestamp);
      const key = toDateKey(d).substring(0, 7);
      const label = d.toLocaleDateString('en-US', { month: "long", year: "numeric", timeZone: 'Asia/Manila' });
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
      const key = toDateKey(d).substring(0, 7);
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
        
        const method = isEditOt ? "PUT" : "POST";
        const res = await fetch("/api/overtime", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: overtimeModal.date.toISOString().split('T')[0],
            start: tsIn.getTime(),
            end: tsOut.getTime(),
            supervisor_id: supervisorId,
            student_id: student.idnumber
          })
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || "Failed to save overtime");
        }

        setShowSuccessModal(true);
        setOvertimeModal({ isOpen: false, date: null });
        setOtInTime("");
        setOtHours(0);
        setOtMinutes(0);
        setIsEditOt(false);
        setEditingOtDateStr(null);
        if (onRefresh) onRefresh();
    } catch (e) {
        alert("Failed to save overtime");
    } finally {
        setIsSavingOt(false);
    }
  };

  const openEditOvertime = async (date: Date) => {
    try {
      const dateStr = toDateKey(date);
      const res = await fetch(`/api/overtime?student_id=${encodeURIComponent(student.idnumber)}&date=${encodeURIComponent(dateStr)}`);
      const json = await res.json();
      const item = Array.isArray(json.overtime_shifts) ? json.overtime_shifts[0] : null;
      if (!item) {
        alert("No authorized overtime found for this date.");
        return;
      }
      const start = new Date(Number(item.overtime_start));
      const end = new Date(Number(item.overtime_end));
      const inStr = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const diffMs = Math.max(0, end.getTime() - start.getTime());
      const hrs = Math.floor(diffMs / (60 * 60 * 1000));
      const mins = Math.round((diffMs % (60 * 60 * 1000)) / (60 * 1000));
      setOtInTime(inStr);
      setOtHours(hrs);
      setOtMinutes(mins);
      setIsEditOt(true);
      setEditingOtDateStr(dateStr);
      setOvertimeModal({ isOpen: true, date, defaultStart: inStr });
    } catch (e) {
      alert("Failed to load overtime details");
    }
  };

  const deleteAuthorizedOvertime = async (date: Date) => {
    try {
      const dateStr = toDateKey(date);
      const supervisorId = localStorage.getItem("idnumber") || "";
      const res = await fetch(`/api/overtime?date=${encodeURIComponent(dateStr)}&student_id=${encodeURIComponent(student.idnumber)}&supervisor_id=${encodeURIComponent(supervisorId)}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to delete overtime");
      }
      if (onRefresh) onRefresh();
    } catch (e: any) {
      alert(e.message || "Failed to delete overtime");
    }
  };

  const { days, overallTotal, overallValidated } = useMemo(() => {
      const studentLogs = filteredLogs;
      
      const grouped = new Map<string, { date: Date, logs: AttendanceEntry[] }>();
      studentLogs.forEach(log => {
          const date = new Date(log.timestamp);
          const key = toDateKey(date);
          if (!grouped.has(key)) grouped.set(key, { date, logs: [] });
          grouped.get(key)!.logs.push(log);
      });

      let totalMsAll = 0;
      let totalValidatedMsAll = 0;

      const processedDays = Array.from(grouped.values())
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .map(day => {
              const otAuthLog = day.logs.find(l => l.photoDataUrl && l.photoDataUrl.startsWith("OT_AUTH:"));
              const processingLogs = day.logs.filter(l => !l.photoDataUrl?.startsWith("OT_AUTH:") && l.status !== "Rejected");

              // Deduplicate logs to prevent double-counting
              const uniqueMap = new Map<string, AttendanceEntry>();
              processingLogs.forEach(l => {
                  const key = l.id ? String(l.id) : `${l.timestamp}-${l.type}`;
                  if (!uniqueMap.has(key)) uniqueMap.set(key, l);
              });

              const sortedLogs = Array.from(uniqueMap.values()).sort((a, b) => a.timestamp - b.timestamp);

              const dateStr = toDateKey(day.date);
              const dynamicOt = (overtimeShifts || []).find((ot: any) => ot.effective_date === dateStr);

              const effSchedule = studentDbSchedule || scheduleConfig || {
                  amIn: "08:00", amOut: "12:00",
                  pmIn: "13:00", pmOut: "17:00",
                  otIn: "17:00", otOut: "18:00"
              };

              // Check for Date Override
              const override = Array.isArray(dateOverrides) 
                  ? dateOverrides.find(o => o.date === dateStr)
                  : (dateOverrides as any)[dateStr];
              const scheduleToUse = override ? {
                  amIn: override.am?.start || effSchedule.amIn,
                  amOut: override.am?.end || effSchedule.amOut,
                  pmIn: override.pm?.start || effSchedule.pmIn,
                  pmOut: override.pm?.end || effSchedule.pmOut,
                  otIn: effSchedule.otIn,
                  otOut: effSchedule.otOut
              } : effSchedule;

              const schedule = buildSchedule(
                  day.date,
                  {
                      amIn: scheduleToUse.amIn || "08:00",
                      amOut: scheduleToUse.amOut || "12:00",
                      pmIn: scheduleToUse.pmIn || "13:00",
                      pmOut: scheduleToUse.pmOut || "17:00",
                      otIn: scheduleToUse.otIn,
                      otOut: scheduleToUse.otOut
                  },
                  dynamicOt ? { start: dynamicOt.overtime_start, end: dynamicOt.overtime_end } : undefined
              );

              // --- SMART PAIRING LOGIC (Greedy Window Assignment) ---
              const usedIds = new Set<string>();
              const isAvailable = (l: AttendanceEntry) => {
                   const key = l.id ? String(l.id) : `${l.timestamp}-${l.type}`;
                   return !usedIds.has(key);
              };
              const markUsed = (l: AttendanceEntry) => {
                   const key = l.id ? String(l.id) : `${l.timestamp}-${l.type}`;
                   usedIds.add(key);
              };

              let s1: AttendanceEntry | null = null;
              let s3: AttendanceEntry | null = null;
              let s5: AttendanceEntry | null = null;

              const isInWindow = (ts: number, start: number | undefined, end: number | undefined) => {
                   if (!start || !end) return false;
                   // 30 min buffer before start, up to end
                   return ts >= (start - 30 * 60000) && ts <= end;
              };

              // 1. Assign INs to Slots (Greedy by Window)
              sortedLogs.filter(l => (l.type || "").toLowerCase() === 'in' && isAvailable(l)).forEach(l => {
                   if (!s1 && isInWindow(l.timestamp, schedule.amIn, schedule.amOut)) {
                       s1 = l; markUsed(l); return;
                   }
                   if (!s3 && isInWindow(l.timestamp, schedule.pmIn, schedule.pmOut)) {
                       s3 = l; markUsed(l); return;
                   }
                   if (!s5 && isInWindow(l.timestamp, schedule.otStart, schedule.otEnd)) {
                       s5 = l; markUsed(l); return;
                   }
              });

              // 2. Fallback Assignment for Remaining INs (Sequential Fill)
              sortedLogs.filter(l => (l.type || "").toLowerCase() === 'in' && isAvailable(l)).forEach(l => {
                   if (!s1) { s1 = l; markUsed(l); }
                   else if (!s3) { s3 = l; markUsed(l); }
                   else if (!s5) { s5 = l; markUsed(l); }
              });

              const today = new Date();
              today.setHours(0,0,0,0);
              const isPastDate = day.date < today;

              const createVirtualOut = (inEntry: AttendanceEntry, shift: 'am' | 'pm' | 'ot'): AttendanceEntry => {
                   const outTs = shift === 'am' ? schedule.amOut : (shift === 'pm' ? schedule.pmOut : schedule.otEnd);
                   const finalOutTs = outTs > inEntry.timestamp ? outTs : inEntry.timestamp + 60000;
                   
                   return {
                        id: inEntry.id ? -Math.abs(Number(inEntry.id)) : -Math.floor(Math.random() * 1000000),
                        idnumber: inEntry.idnumber,
                        type: 'out',
                        timestamp: finalOutTs,
                        photoDataUrl: '',
                        validated_by: 'AUTO TIME OUT',
                        status: 'Pending'
                   } as AttendanceEntry;
              };

              // 2. Find OUTs for each IN
              let s2: AttendanceEntry | null = null;
              if (s1) {
                  const searchEnd = s3 ? (s3 as AttendanceEntry).timestamp : (new Date(day.date).setHours(23, 59, 59, 999));
                  const candidates = sortedLogs.filter(l => (l.type || "").toLowerCase() === "out" && l.timestamp > (s1 as AttendanceEntry).timestamp && l.timestamp < searchEnd && isAvailable(l));
                  const candidate = candidates.pop() || null; // Take the latest valid out
                  if (candidate) {
                      s2 = candidate;
                      markUsed(s2);
                  } else if (isPastDate) {
                      s2 = createVirtualOut(s1 as AttendanceEntry, 'am');
                  }
              }

              let s4: AttendanceEntry | null = null;
              if (s3) {
                  const searchEnd = s5 ? (s5 as AttendanceEntry).timestamp : (new Date(day.date).setHours(23, 59, 59, 999));
                  const candidates = sortedLogs.filter(l => (l.type || "").toLowerCase() === "out" && l.timestamp > (s3 as AttendanceEntry).timestamp && l.timestamp < searchEnd && isAvailable(l));
                  s4 = candidates.pop() || null;
                  if (s4) {
                      markUsed(s4);
                  } else if (isPastDate) {
                      s4 = createVirtualOut(s3 as AttendanceEntry, 'pm');
                  }
              }

              let s6: AttendanceEntry | null = null;
              if (s5) {
                  const candidates = sortedLogs.filter(l => (l.type || "").toLowerCase() === "out" && l.timestamp > (s5 as AttendanceEntry).timestamp && isAvailable(l));
                  s6 = candidates.pop() || null;
                  if (s6) {
                      markUsed(s6);
                  } else if (isPastDate) {
                      s6 = createVirtualOut(s5 as AttendanceEntry, 'ot');
                  }
              }

              // 3. Calculate Hours (Golden Rule - Superadmin Logic)
              const calc = (inLog: AttendanceEntry | null, outLog: AttendanceEntry | null, shift: 'am' | 'pm' | 'ot', requireApproved: boolean) => {
                  if (!inLog || !outLog) return 0;

                  // Exclude Rejected
                  if (inLog.status === 'Rejected' || outLog.status === 'Rejected') return 0;

                // Priority: Frozen rendered_hours (History) - TRUST DB if present
                const vh = (outLog as any)?.validated_hours;
                if (vh !== undefined && vh !== null && Number(vh) >= 0) {
                    if (requireApproved) {
                         const inOk = ["Approved", "Validated", "VALIDATED", "OFFICIAL", "ADJUSTED", "Official"].includes(inLog.status || "");
                         const outOk = ["Approved", "Validated", "VALIDATED", "OFFICIAL", "ADJUSTED", "Official"].includes(outLog.status || "");
                         if (!inOk || !outOk) return 0;
                    }
                    if (shift === 'pm' && outLog.id === s2?.id) return 0;
                    if (shift === 'ot' && (outLog.id === s2?.id || outLog.id === s4?.id)) return 0;
                    return Number(vh) * 3600000;
                }
                // Do not use rendered_hours; rely on validated_hours or snapshot/clamp

                if (requireApproved) {
                    const inOk = ["Approved", "Validated", "VALIDATED", "OFFICIAL", "ADJUSTED", "Official"].includes(inLog.status || "");
                    const outOk = ["Approved", "Validated", "VALIDATED", "OFFICIAL", "ADJUSTED", "Official"].includes(outLog.status || "");
                    if (!inOk || !outOk) return 0;
                }

                // Priority: Snapshot Rules (Ledger Logic)
                if (outLog.official_time_in && outLog.official_time_out) {
                       try {
                           const dateBase = new Date(inLog.timestamp);
                           const parseTime = (t: string) => {
                               const [h, m, s] = t.split(':').map(Number);
                               const d = new Date(dateBase);
                               d.setHours(h, m, s || 0, 0);
                               return d;
                           };
                           const offIn = parseTime(outLog.official_time_in);
                           const offOut = parseTime(outLog.official_time_out);
                           // Handle cross-day shifts
                           if (offOut.getTime() < offIn.getTime()) {
                               offOut.setDate(offOut.getDate() + 1);
                           }
                           return calculateHoursWithinOfficialTime(
                               new Date(inLog.timestamp), 
                               new Date(outLog.timestamp), 
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
                      oInTs = schedule.amIn;
                      oOutTs = schedule.amOut;
                  } else if (shift === 'pm') {
                      oInTs = schedule.pmIn;
                      oOutTs = schedule.pmOut;
                  } else { // ot
                      oInTs = schedule.otStart;
                      oOutTs = schedule.otEnd;
                  }

                  // Safety check: if schedule is invalid (e.g. 0), return raw fallback for tracked view
                  if (!oInTs || !oOutTs) {
                      if (!requireApproved) {
                          const raw = (new Date(outLog.timestamp).getTime() - new Date(inLog.timestamp).getTime());
                          return raw > 0 ? raw : 0;
                      }
                      return 0;
                  }

                  const clamped = calculateHoursWithinOfficialTime(
                      new Date(inLog.timestamp), 
                      new Date(outLog.timestamp), 
                      new Date(oInTs), 
                      new Date(oOutTs)
                  );
                  
                  if (clamped === 0 && !requireApproved && !outLog.official_time_in && !outLog.official_time_out) {
                      const raw = (new Date(outLog.timestamp).getTime() - new Date(inLog.timestamp).getTime());
                      return raw > 0 ? raw : 0;
                  }
                  
                  return clamped;
              };

              let dayTotalMs = 0;
              let dayValidatedMs = 0;
              
              // Tracked (all logs, regardless of approval)
              dayTotalMs += calc(s1, s2, 'am', false);
              dayTotalMs += calc(s3, s4, 'pm', false);
              const otTracked = calc(s5, s6, 'ot', false);
              dayTotalMs += otTracked;

              // Validated (approved-only; uses ledger snapshot first)
              dayValidatedMs += calc(s1, s2, 'am', true);
              dayValidatedMs += calc(s3, s4, 'pm', true);
              dayValidatedMs += calc(s5, s6, 'ot', true);
              
              const overtimeMs = otTracked;

              totalMsAll += dayTotalMs;
              totalValidatedMsAll += dayValidatedMs;

              // Check for Lates (freeze using ledger snapshot when available)
              const toDate = (t: string, baseTs: number) => {
                  const d = new Date(baseTs);
                  const parts = t.split(":").map(Number);
                  d.setHours(parts[0] || 0, parts[1] || 0, parts[2] || 0, 0);
                  return d.getTime();
              };
              if (s1) {
                  const baseTs = (s1 as any).timestamp;
                  let officialInTs = schedule.amIn;
                  if (s2 && (s2 as any).official_time_in) {
                      officialInTs = toDate((s2 as any).official_time_in, baseTs);
                  }
                  if (officialInTs && isLate(baseTs, officialInTs)) {
                      (s1 as any).is_late = true; 
                      (s1 as any).late_minutes = Math.floor((baseTs - officialInTs)/60000);
                  }
              }
              if (s3) {
                  const baseTs = (s3 as any).timestamp;
                  let officialInTs = schedule.pmIn;
                  if (s4 && (s4 as any).official_time_in) {
                      officialInTs = toDate((s4 as any).official_time_in, baseTs);
                  }
                  if (officialInTs && isLate(baseTs, officialInTs)) {
                      (s3 as any).is_late = true; 
                      (s3 as any).late_minutes = Math.floor((baseTs - officialInTs)/60000);
                  }
              }

              return { date: day.date, s1, s2, s3, s4, s5, s6, dayTotalMs, dayValidatedMs, overtimeMs, otAuthLog, schedule };
          });

      return { days: processedDays, overallTotal: totalMsAll, overallValidated: totalValidatedMsAll };
  }, [filteredLogs, scheduleConfig, now, studentDbSchedule, dateOverrides]);

  const handleConfirmValidate = () => {
    setIsBulkValidating(true);
    const ids = Array.from(selectedIds);
    
    ids.forEach(id => {
        let entry = logs.find(e => Number(e.id) === id);
        if (!entry && id < 0) {
            // Search in days for virtual entry
            for (const day of days) {
                if (day.s2 && Number(day.s2.id) === id) { entry = day.s2; break; }
                if (day.s4 && Number(day.s4.id) === id) { entry = day.s4; break; }
                if (day.s6 && Number(day.s6.id) === id) { entry = day.s6; break; }
            }
        }
        if (entry) onValidate(entry, "approve");
    });
    
    setSelectedIds(new Set());
    setIsBulkValidating(false);
    if (onRefresh) onRefresh();
    setShowValidateModal(false);
  };

  const handleConfirmReject = () => {
    setIsBulkValidating(true);
    const ids = Array.from(selectedIds);
    
    ids.forEach(id => {
        let entry = logs.find(e => Number(e.id) === id);
        if (!entry && id < 0) {
            // Search in days for virtual entry
            for (const day of days) {
                if (day.s2 && Number(day.s2.id) === id) { entry = day.s2; break; }
                if (day.s4 && Number(day.s4.id) === id) { entry = day.s4; break; }
                if (day.s6 && Number(day.s6.id) === id) { entry = day.s6; break; }
            }
        }
        if (entry) onValidate(entry, "reject");
    });

    setSelectedIds(new Set());
    setIsBulkValidating(false);
    if (onRefresh) onRefresh();
    setShowRejectModal(false);
  };

  const selectedPairCount = useMemo(() => {
    let count = 0;
    days.forEach(day => {
        // Morning Pair
        if (((day.s1 as any)?.id && selectedIds.has(Number((day.s1 as any).id))) || ((day.s2 as any)?.id && selectedIds.has(Number((day.s2 as any).id)))) {
            count++;
        }
        // Afternoon Pair
        if (((day.s3 as any)?.id && selectedIds.has(Number((day.s3 as any).id))) || ((day.s4 as any)?.id && selectedIds.has(Number((day.s4 as any).id)))) {
            count++;
        }
        // Overtime Pair
        if (((day.s5 as any)?.id && selectedIds.has(Number((day.s5 as any).id))) || ((day.s6 as any)?.id && selectedIds.has(Number((day.s6 as any).id)))) {
            count++;
        }
    });
    return count;
  }, [days, selectedIds]);

  const handleDownloadExcel = () => {
    if (days.length === 0) return;

    let overallTotal = 0;
    let overallValidated = 0;
    days.forEach(day => {
        overallTotal += day.dayTotalMs;
        const v = [day.s2, day.s4, day.s6].reduce((acc, out) => {
            const val = out ? (out as any).validated_hours : undefined;
            const num = val !== undefined && val !== null ? Number(val) : NaN;
            return acc + (isNaN(num) ? 0 : num * 3600000);
        }, 0);
        overallValidated += v;
    });

    // Helper for formatting time
    const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Define Headers
    const headerRows = [
      [`NAME: ${student.lastname || ""}, ${student.firstname || ""}`, "", "", `COURSE: ${student.course || ""}-${student.section || ""}`, "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", "", "", ""],
      [`TOTAL HOURS: ${formatHours(overallTotal)}`, "", `TOTAL VALIDATED HOURS: ${formatHours(overallValidated)}`, "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", "", "", ""],
      ["DATE", "MORNING", "", "STATUS", "AFTERNOON", "", "OVERTIME", "", "STATUS", "TOTAL HOURS"], 
      ["", "TIME IN", "TIME OUT", "", "TIME IN", "TIME OUT", "TIME IN", "TIME OUT", "", ""] 
    ];

    // 2. Map Data
    const dataRows = days.map(day => {
      const fmt = (slot: AttendanceEntry | null | undefined) => slot ? fmtTime(slot.timestamp) : "-";
      const fmtOut = (slot: AttendanceEntry | null | undefined) => {
        if (!slot) return "-";
        if (slot.validated_by === "SYSTEM_AUTO_CLOSE" || slot.validated_by === "AUTO TIME OUT") {
            return "";
        }
        return fmtTime(slot.timestamp);
      };
      
      const getStatus = (inSlot?: AttendanceEntry | null, outSlot?: AttendanceEntry | null) => {
          const s1 = inSlot?.status?.toLowerCase();
          const s2 = outSlot?.status?.toLowerCase();
          const v1 = inSlot?.validated_by;
          const v2 = outSlot?.validated_by;

          // If any part is rejected -> unvalidated
          if (s1 === "rejected" || s2 === "rejected") {
            return "unvalidated";
          }

          // If any part is approved/validated or has validator -> validated
          if (s1 === "approved" || s1 === "validated" || 
              s2 === "approved" || s2 === "validated" ||
              v1 || v2) {
            return "validated";
          }

          // If slots exist -> pending
          if (inSlot || outSlot) {
            return "pending";
          }

          return "-";
      };

      // AM Status: s1 or s2
      const amStatus = getStatus(day.s1, day.s2);
      
      // PM/OT Status: s3, s4, s5, s6
      let pmStatus = "-";
      if (day.s3 || day.s4) {
          pmStatus = getStatus(day.s3, day.s4);
      } else if (day.s5 || day.s6) {
          pmStatus = getStatus(day.s5, day.s6);
      }
      
      return [
        toDateKey(day.date), // DATE
        fmt(day.s1),                   // MORNING IN
        fmtOut(day.s2),                // MORNING OUT
        amStatus,                      // STATUS (AM)
        fmt(day.s3),                   // AFTERNOON IN
        fmtOut(day.s4),                // AFTERNOON OUT
        fmt(day.s5),                   // OVERTIME IN
        fmtOut(day.s6),                // OVERTIME OUT
        pmStatus,                      // STATUS (PM/OT)
        formatHours(day.dayValidatedMs)    // TOTAL HOURS
      ];
    });

    // 3. Combine
    const wsData = [...headerRows, ...dataRows];

    // 4. Create Worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(wsData);

    // Apply styles
    const headerStyle = {
      font: { bold: true },
      alignment: { horizontal: "center", vertical: "center" }
    };
    const boldLeftStyle = {
      font: { bold: true },
      alignment: { horizontal: "left", vertical: "center" }
    };

    // Apply styles to Top Info (Rows 1 & 3)
    // A1, D1, A3, C3 should be bold
    const boldCells = ["A1", "D1", "A3", "C3"];
    boldCells.forEach(ref => {
      if (worksheet[ref]) worksheet[ref].s = boldLeftStyle;
    });

    // Apply styles to Table Headers (Rows 5 & 6)
    // Range A5:J6
    const range = XLSX.utils.decode_range(worksheet['!ref'] || "A1:J100");
    for (let R = 4; R <= 5; ++R) { // Rows 5 and 6 (0-indexed: 4, 5)
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
        if (cell) cell.s = headerStyle;
      }
    }

    // 5. Define Merges
    worksheet['!merges'] = [
      // Top Header Info
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, // NAME (A1:C1)
      { s: { r: 0, c: 3 }, e: { r: 0, c: 9 } }, // COURSE (D1:J1)
      { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } }, // TOTAL HOURS (A3:B3)
      { s: { r: 2, c: 2 }, e: { r: 2, c: 5 } }, // TOTAL VALIDATED (C3:F3)

      // Row 5/6 Headers
      { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } }, // DATE (A5:A6)
      { s: { r: 4, c: 1 }, e: { r: 4, c: 2 } }, // MORNING (B5:C5)
      { s: { r: 4, c: 3 }, e: { r: 5, c: 3 } }, // STATUS (D5:D6)
      { s: { r: 4, c: 4 }, e: { r: 4, c: 5 } }, // AFTERNOON (E5:F5)
      { s: { r: 4, c: 6 }, e: { r: 4, c: 7 } }, // OVERTIME (G5:H5)
      { s: { r: 4, c: 8 }, e: { r: 5, c: 8 } }, // STATUS (I5:I6)
      { s: { r: 4, c: 9 }, e: { r: 5, c: 9 } }, // TOTAL HOURS (J5:J6)
    ];

    // 6. Set Column Widths
    worksheet['!cols'] = [
      { wch: 15 }, // Date
      { wch: 12 }, // Morning In
      { wch: 18 }, // Morning Out
      { wch: 12 }, // Status (AM)
      { wch: 12 }, // Afternoon In
      { wch: 18 }, // Afternoon Out
      { wch: 12 }, // Overtime In
      { wch: 18 }, // Overtime Out
      { wch: 12 }, // Status (PM)
      { wch: 15 }, // Total Hours
    ];

    // 7. Create Workbook and Download
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
    XLSX.writeFile(workbook, `Attendance_${student.firstname}_${student.lastname}.xlsx`);
  };

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex items-center gap-2">
             <button 
                onClick={onBack}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-900"
             >
                <ChevronLeft size={18} />
             </button>
             <div>
                <h2 className="text-lg font-bold text-gray-900">{student.firstname} {student.lastname}</h2>
                <p className="text-gray-500 text-[10px]">Attendance History & Performance</p>
             </div>
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
            <div className="bg-blue-50 p-1.5 rounded-lg border border-blue-100 flex items-center justify-between shadow-sm">
                <div>
                    <p className="text-[9px] font-bold text-blue-600 uppercase tracking-wider mb-0.5">Total Tracked</p>
                    <p className="text-base font-bold text-blue-900">{formatHours(overallTotal)}</p>
                    <p className="text-[9px] text-gray-600 mt-0.5">Frozen by Ledger</p>
                </div>
                <div className="p-1 bg-blue-100 rounded-md">
                    <Clock className="text-blue-600" size={12} />
                </div>
            </div>

            <div className="bg-green-50 p-1.5 rounded-lg border border-green-100 flex items-center justify-between shadow-sm">
                <div>
                    <p className="text-[9px] font-bold text-green-600 uppercase tracking-wider mb-0.5">Total Validated</p>
                    <p className="text-base font-bold text-green-900">{formatHours(overallValidated)}</p>
                    <p className="text-[9px] text-gray-600 mt-0.5">Approved Hours</p>
                </div>
                <div className="p-1 bg-green-100 rounded-md">
                    <ClipboardCheck className="text-green-600" size={12} />
                </div>
            </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-1.5 px-2 py-1 border-b border-gray-100 bg-gray-50">
                <div className="flex flex-col gap-0.5">
                  <div className="flex flex-wrap gap-1 text-[9px]">
                    <span className="px-1.5 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-700 font-medium">
                      Pending: {statusCounts.Pending}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-full border border-green-100 bg-green-50 text-green-700 font-medium">
                      Validated: {statusCounts.Approved}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-full border border-red-100 bg-red-50 text-red-700 font-medium">
                      Unvalidated: {statusCounts.Rejected}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="w-full sm:w-32">
                    <select
                      value={monthFilter}
                      onChange={e => setMonthFilter(e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-[10px] font-medium text-gray-900 bg-white focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all h-7"
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
                      onClick={handleDownloadExcel}
                      disabled={days.length === 0}
                      className="px-2 py-1 text-[10px] font-semibold rounded border border-gray-200 bg-white text-green-700 hover:bg-green-50 hover:border-green-200 transition-colors flex items-center gap-1.5 h-7"
                  >
                      <Download size={10} />
                      Export
                  </button>
                  <button
                      type="button"
                      onClick={selectAllPending}
                      disabled={statusCounts.Pending === 0}
                      title={statusCounts.Pending === 0 ? "No pending logs to select" : "Select all pending logs"}
                      className="px-2 py-1 text-[10px] font-semibold rounded border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:border-orange-400 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed h-7"
                  >
                      Select pending
                  </button>
                  <div className="flex flex-wrap items-center gap-1.5">
                      {selectedIds.size > 0 && (
                          <>
                              <button
                                  type="button"
                                  onClick={() => bulkValidate("approve")}
                                  disabled={isBulkValidating}
                                  className="px-2 py-1 text-[10px] font-bold rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 whitespace-nowrap h-7"
                              >
                                  Approve {selectedPairCount}
                              </button>
                              <button
                                  type="button"
                                  onClick={() => bulkValidate("reject")}
                                  disabled={isBulkValidating}
                                  className="px-2 py-1 text-[10px] font-bold rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 whitespace-nowrap h-7"
                              >
                                  Reject {selectedPairCount}
                              </button>
                          </>
                      )}
                      <button
                          type="button"
                          onClick={clearSelection}
                          disabled={selectedIds.size === 0}
                          className="px-2 py-1 text-[10px] font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded whitespace-nowrap disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-500 h-7"
                      >
                          Clear
                      </button>
                  </div>
                </div>
            </div>
            <div className="overflow-x-auto hidden md:block">
                <table className="w-full text-[10px] text-left">
                    <thead className="bg-gray-50 text-[9px] uppercase text-gray-500 font-bold">
                        <tr>
                            <th rowSpan={2} className="px-1.5 py-1 border-r border-gray-100 min-w-[80px] text-left align-bottom pb-1">Date</th>
                            <th colSpan={2} className="px-1 py-0.5 text-center border-r border-gray-100 border-b bg-gray-100/50">Morning</th>
                            <th colSpan={2} className="px-1 py-0.5 text-center border-r border-gray-100 border-b bg-gray-100/50">Afternoon</th>
                            <th colSpan={2} className="px-1 py-0.5 text-center border-r border-gray-100 border-b bg-gray-100/50">Overtime</th>
                            <th rowSpan={2} className="px-2 py-1 text-right align-bottom pb-1">Total Hours</th>
                        </tr>
                        <tr>
                            <th className="px-1 py-0.5 text-center border-r border-gray-100 min-w-[60px] text-[9px] tracking-wider">Time In</th>
                            <th className="px-1 py-0.5 text-center border-r border-gray-100 min-w-[60px] text-[9px] tracking-wider">Time Out</th>
                            <th className="px-1 py-0.5 text-center border-r border-gray-100 min-w-[60px] text-[9px] tracking-wider">Time In</th>
                            <th className="px-1 py-1 text-center border-r border-gray-100 min-w-[70px] text-[9px] tracking-wider">Time Out</th>
                            <th className="px-1 py-1 text-center border-r border-gray-100 min-w-[70px] text-[9px] tracking-wider">Time In</th>
                            <th className="px-1 py-1 text-center border-r border-gray-100 min-w-[70px] text-[9px] tracking-wider">Time Out</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {days.map((day, i) => (
                            <tr key={i} className="hover:bg-gray-50 transition-colors">
                                <td className="px-1.5 py-1 font-medium text-gray-900 whitespace-nowrap border-r border-gray-100">
                                    {day.date.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
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

                                    const isAutoTimeOut = slot?.type === 'out' && (slot?.validated_by === 'SYSTEM_AUTO_CLOSE' || slot?.validated_by === 'AUTO TIME OUT');
                                   const pairSelected = isSlotPairSelected(pairIn, pairOut);

                                   let isLateTime = false;
                                   if (slot && slot.type === 'in') {
                                       const toDate = (t: string, baseTs: number) => {
                                           const d = new Date(baseTs);
                                           const parts = t.split(":").map(Number);
                                           d.setHours(parts[0] || 0, parts[1] || 0, parts[2] || 0, 0);
                                           return d.getTime();
                                       };
                                       if (pairOut && (pairOut as any).official_time_in) {
                                           const offInTs = toDate((pairOut as any).official_time_in, slot.timestamp);
                                           isLateTime = isLate(slot.timestamp, offInTs);
                                       }
                                   }

                                   return (
                                       <td key={idx} className={`px-0.5 py-0.5 border-r border-gray-100 text-center min-w-[80px] ${isAutoTimeOut ? 'align-middle' : 'align-top'}`}>
                                           {slot ? (
                                                <div className={`flex flex-col items-center gap-1 ${isAutoTimeOut ? 'justify-center h-full' : ''}`}>
                                                    <div className="flex items-center gap-1">
                                                        {isInCell && pairIn && (
                                                            (!((pairIn as any).status) || (pairIn as any).status === 'Pending' || (pairOut && (pairOut as any).status === 'Pending'))
                                                        ) && (
                                                            <input
                                                                type="checkbox"
                                                                checked={pairSelected}
                                                                onChange={() => toggleSlotPairSelection(pairIn, pairOut)}
                                                                className="w-2.5 h-2.5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                            />
                                                        )}
                                                        {isAutoTimeOut ? (
                                                            <span className="text-[9px] font-bold text-red-500 whitespace-nowrap"></span>
                                                        ) : (
                                                            <div className="flex flex-col items-center justify-center w-full">
                                                                <div className={`text-[9px] font-semibold whitespace-nowrap text-center ${isLateTime ? 'text-red-600 font-bold' : 'text-gray-900'}`}>
                                                                    {formatTime(slot.timestamp)}
                                                                </div>
                                                                {isLateTime ? (
                                                                    <div className="text-[7px] font-bold text-red-500 leading-none mt-0.5 text-center">LATE</div>
                                                                ) : (
                                                                    <div className="text-[7px] font-bold text-transparent leading-none mt-0.5 invisible text-center">LATE</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                {getEntryPhoto(slot) && !isAutoTimeOut && (
                                    <div 
                                        className="relative w-8 h-8 rounded overflow-hidden border border-gray-200 shadow-sm group cursor-zoom-in bg-gray-100" 
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
                                {!isAutoTimeOut && (
                                <div className="flex gap-0.5 mt-0.5 justify-center h-3 items-center text-[9px] font-semibold">
                                                    {(() => {
                                                        const isAfternoonPairCell = idx === 2 || idx === 3;
                                                        const afternoonIn = day.s3;
                                                        const afternoonOut = day.s4;

                                                        if (isAfternoonPairCell && afternoonIn && afternoonOut) {
                                                            const bothApproved = (afternoonIn as any).status === 'Approved' && (afternoonOut as any).status === 'Approved';
                                                            const bothRejected = (afternoonIn as any).status === 'Rejected' && (afternoonOut as any).status === 'Rejected';

                                                            if (bothApproved) {
                                                                return (
                                                                    <span className="text-[9px] font-semibold text-green-600">
                                                                        Validated
                                                                    </span>
                                                                );
                                                            }

                                                            if (bothRejected) {
                                                                return (
                                                                    <span className="text-[9px] font-semibold text-red-600">
                                                                        Unvalidated
                                                                    </span>
                                                                );
                                                            }
                                                        }

                                                        if ((slot as any).status === 'Approved') {
                                                            return (
                                                                <span className="text-[9px] font-semibold text-green-600">
                                                                    Validated
                                                                </span>
                                                            );
                                                        }

                                                        if ((slot as any).status === 'Rejected') {
                                                            return (
                                                                <span className="text-[9px] font-semibold text-red-600">
                                                                    Unvalidated
                                                                </span>
                                                            );
                                                        }

                                                        return (
                                                            <span className="text-[9px] font-semibold text-yellow-500">
                                                                Pending
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                )}
                                            </div>
                                        ) : (
                                            idx === 4 ? (
                                                day.otAuthLog ? (
                                                    <span className="text-blue-500 text-[9px] font-bold uppercase tracking-wider block py-3">OT Open</span>
                                                ) : (
                                                    <span className="text-gray-300 block py-3">-</span>
                                                )
                                            ) : (
                                                <span className="text-gray-300 block py-3">-</span>
                                            )
                                            )}
                                        </td>
                                    );
                                })}
                                <td className="px-1.5 py-1 text-right font-bold text-gray-900 whitespace-nowrap">
                                    {formatHours(day.dayTotalMs)}
                                </td>
                            </tr>
                        ))}
                        {days.length === 0 && (
                            <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">No attendance records found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="md:hidden">
                <div className="divide-y divide-gray-100">
                    {days.length === 0 ? (
                        <div className="px-3 py-6 text-center text-gray-500 text-sm">
                            No attendance records found.
                        </div>
                    ) : (
                        days.map((day, i) => (
                            <div key={i} className="p-1.5">
                                <div className="text-[10px] font-semibold text-gray-900">
                                    {day.date.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                </div>
                                <div className="mt-1 grid grid-cols-1 gap-1.5">
                                    <div className="rounded-lg border border-gray-100 bg-gray-50 p-1">
                                        <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Morning</div>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {[day.s1, day.s2].map((slot, idx) => {
                                                const pairIn = day.s1;
                                                const pairOut = day.s2;
                                                const isInCell = idx === 0;
                                                const pairSelected = isSlotPairSelected(pairIn, pairOut);

                                                const valBy = (slot?.validated_by || "").trim();
                                                const isAutoTimeOut = slot?.type === 'out' && (valBy === 'SYSTEM_AUTO_CLOSE' || valBy === 'AUTO TIME OUT');

                                                let isLateTime = false;
                                                if (slot && slot.type === 'in') {
                                                    const toDate = (t: string, baseTs: number) => {
                                                        const d = new Date(baseTs);
                                                        const parts = t.split(":").map(Number);
                                                        d.setHours(parts[0] || 0, parts[1] || 0, parts[2] || 0, 0);
                                                        return d.getTime();
                                                    };
                                                    if (pairOut && (pairOut as any).official_time_in) {
                                                        const offInTs = toDate((pairOut as any).official_time_in, slot.timestamp);
                                                        isLateTime = isLate(slot.timestamp, offInTs);
                                                    }
                                                }

                                                return (
                                                <div key={idx} className={`flex flex-col items-center gap-1 ${isAutoTimeOut ? 'justify-center h-full' : ''}`}>
                                                    {slot ? (
                                                        <>
                                                            <div className="flex items-center gap-1">
                                                                {isInCell && pairIn && (!((pairIn as any).status) || (pairIn as any).status === 'Pending') && (
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={pairSelected}
                                                                        onChange={() => toggleSlotPairSelection(pairIn, pairOut)}
                                                                        className="w-2.5 h-2.5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                                    />
                                                                )}
                                                                {isAutoTimeOut ? (
                                                                    <span className="text-[9px] font-bold text-red-500 whitespace-nowrap"></span>
                                                                ) : (
                                                                <div className="flex flex-col items-center justify-center w-full">
                                                                    <div className={`text-[9px] font-bold whitespace-nowrap text-center ${isLateTime ? 'text-red-600' : 'text-gray-900'}`}>
                                                                        {formatTime(slot.timestamp)}
                                                                    </div>
                                                                    {isLateTime ? (
                                                                        <div className="text-[7px] font-bold text-red-500 leading-none mt-0.5 text-center">LATE</div>
                                                                    ) : (
                                                                        <div className="text-[7px] font-bold text-transparent leading-none mt-0.5 invisible text-center">LATE</div>
                                                                    )}
                                                                </div>
                                                                )}
                                                            </div>
                                                            {slot.photoDataUrl && !isAutoTimeOut && (
                                                                <div 
                                                                    className="relative w-8 h-8 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100"
                                                                    onClick={() => setSelectedImage({ url: slot.photoDataUrl!, timestamp: slot.timestamp })}
                                                                >
                                                                    <img src={slot.photoDataUrl} alt="Log" className="w-full h-full object-cover" />
                                                                </div>
                                                            )}
                                                            {!isAutoTimeOut && (
                                                            <div className="flex gap-1 mt-0.5 justify-center h-3 items-center">
                                                                {(() => {
                                                                    return (slot as any).status === 'Approved' ? (
                                                                    <span className="text-[9px] font-semibold text-green-600">
                                                                        Validated
                                                                    </span>
                                                                    ) : (slot as any).status === 'Rejected' ? (
                                                                    <span className="text-[10px] font-semibold text-red-600">
                                                                        Unvalidated
                                                                    </span>
                                                                    ) : (
                                                                        <span className="text-[10px] font-semibold text-yellow-500">
                                                                            Pending
                                                                        </span>
                                                                    );
                                                                })()}
                                                            </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )}
                                                </div>
                                            )})}
                                        </div>
                                    </div>
                                    <div className="rounded-lg border border-gray-100 bg-gray-50 p-1">
                                        <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Afternoon</div>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {[day.s3, day.s4].map((slot, idx) => {
                                                const pairIn = day.s3;
                                                const pairOut = day.s4;
                                                const isInCell = idx === 0;
                                                const pairSelected = isSlotPairSelected(pairIn, pairOut);

                                                const valBy = (slot?.validated_by || "").trim();
                                                const isAutoTimeOut = slot?.type === 'out' && (valBy === 'SYSTEM_AUTO_CLOSE' || valBy === 'AUTO TIME OUT');

                                                let isLateTime = false;
                                                if (slot && slot.type === 'in') {
                                                    const toDate = (t: string, baseTs: number) => {
                                                        const d = new Date(baseTs);
                                                        const parts = t.split(":").map(Number);
                                                        d.setHours(parts[0] || 0, parts[1] || 0, parts[2] || 0, 0);
                                                        return d.getTime();
                                                    };
                                                    if (pairOut && (pairOut as any).official_time_in) {
                                                        const offInTs = toDate((pairOut as any).official_time_in, slot.timestamp);
                                                        isLateTime = isLate(slot.timestamp, offInTs);
                                                    }
                                                }

                                                return (
                                                <div key={idx} className={`flex flex-col items-center gap-1 ${isAutoTimeOut ? 'justify-center h-full' : ''}`}>
                                                    {slot ? (
                                                        <>
                                                            <div className="flex items-center gap-1">
                                                                {isInCell && pairIn && (!((pairIn as any).status) || (pairIn as any).status === 'Pending') && (
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={pairSelected}
                                                                        onChange={() => toggleSlotPairSelection(pairIn, pairOut)}
                                                                        className="w-2.5 h-2.5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                                    />
                                                                )}
                                                                {isAutoTimeOut ? (
                                                                    <span className="text-[9px] font-bold text-red-500 whitespace-nowrap"></span>
                                                                ) : (
                                                                <div className="flex flex-col items-center justify-center w-full">
                                                                    <div className={`text-[9px] font-bold whitespace-nowrap text-center ${isLateTime ? 'text-red-600' : 'text-gray-900'}`}>
                                                                        {formatTime(slot.timestamp)}
                                                                    </div>
                                                                    {isLateTime ? (
                                                                        <div className="text-[7px] font-bold text-red-500 leading-none mt-0.5 text-center">LATE</div>
                                                                    ) : (
                                                                        <div className="text-[7px] font-bold text-transparent leading-none mt-0.5 invisible text-center">LATE</div>
                                                                    )}
                                                                </div>
                                                                )}
                                                            </div>
                                                            {slot.photoDataUrl && !isAutoTimeOut && (
                                                                <div 
                                                                    className="relative w-8 h-8 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100"
                                                                    onClick={() => setSelectedImage({ url: slot.photoDataUrl!, timestamp: slot.timestamp })}
                                                                >
                                                                    <img src={slot.photoDataUrl} alt="Log" className="w-full h-full object-cover" />
                                                                </div>
                                                            )}
                                                            {!isAutoTimeOut && (
                                                            <div className="flex gap-1 mt-0.5 justify-center h-3 items-center">
                                                                {(() => {
                                                                    const afternoonIn = day.s3;
                                                                    const afternoonOut = day.s4;

                                                                    if (afternoonIn && afternoonOut) {
                                                                        const bothApproved = (afternoonIn as any).status === 'Approved' && (afternoonOut as any).status === 'Approved';
                                                                        const bothRejected = (afternoonIn as any).status === 'Rejected' && (afternoonOut as any).status === 'Rejected';

                                                                        if (bothApproved) {
                                                                            return (
                                                                                <span className="text-[9px] font-semibold text-green-600">
                                                                                    Validated
                                                                                </span>
                                                                            );
                                                                        }

                                                                        if (bothRejected) {
                                                                            return (
                                                                                <span className="text-[10px] font-semibold text-red-600">
                                                                                    Unvalidated
                                                                                </span>
                                                                            );
                                                                        }
                                                                    }

                                                                    if ((slot as any).status === 'Approved') {
                                                                        return (
                                                                            <span className="text-[10px] font-semibold text-green-600">
                                                                                Validated
                                                                            </span>
                                                                        );
                                                                    }

                                                                    if ((slot as any).status === 'Rejected') {
                                                                        return (
                                                                            <span className="text-[10px] font-semibold text-red-600">
                                                                                Unvalidated
                                                                            </span>
                                                                        );
                                                                    }

                                                                    return (
                                                                        <span className="text-[10px] font-semibold text-yellow-500">
                                                                            Pending
                                                                        </span>
                                                                    );
                                                                })()}
                                                            </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )}
                                                </div>
                                            )})}
                                        </div>
                                    </div>
                                    <div className="rounded-lg border border-gray-100 bg-gray-50 p-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Overtime</div>
                                            {!day.s5 && (
                                                (day as any).otAuthLog ? (
                                                    <div className="flex items-center gap-1">
                                                      <span className="text-[9px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">Authorized</span>
                                                      <button
                                                        onClick={() => openEditOvertime(day.date)}
                                                        className="text-[9px] text-orange-600 font-semibold hover:underline"
                                                        title="Edit Overtime"
                                                      >
                                                        Edit
                                                      </button>
                                                      <button
                                                        onClick={() => deleteAuthorizedOvertime(day.date)}
                                                        className="text-[9px] text-red-600 font-semibold hover:underline"
                                                        title="Delete Overtime"
                                                      >
                                                        Delete
                                                      </button>
                                                    </div>
                                                ) : (
                                                <button
                                                    onClick={() => {
                                                        const pmOutTime = day.s4 
                                                            ? new Date(day.s4.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                                                            : scheduleConfig?.pmOut || "17:00";
                                                        setOvertimeModal({ isOpen: true, date: day.date, defaultStart: pmOutTime });
                                                        setOtInTime(pmOutTime);
                                                        setOtHours(1);
                                                        setOtMinutes(0);
                                                    }}
                                                    className="w-4 h-4 rounded-full bg-orange-50 text-orange-600 hover:bg-orange-100 hover:text-orange-700 flex items-center justify-center transition-colors"
                                                    title="Add Overtime"
                                                >
                                                    <Plus size={10} />
                                                </button>
                                                )
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {[day.s5, day.s6].map((slot, idx) => {
                                                const pairOut = day.s6;
                                                const valBy = (slot?.validated_by || "").trim();
                                                const isAutoTimeOut = slot?.type === 'out' && (valBy === 'SYSTEM_AUTO_CLOSE' || valBy === 'AUTO TIME OUT');

                                                let isLateTime = false;
                                                if (slot && slot.type === 'in') {
                                                    const toDate = (t: string, baseTs: number) => {
                                                        const d = new Date(baseTs);
                                                        const parts = t.split(":").map(Number);
                                                        d.setHours(parts[0] || 0, parts[1] || 0, parts[2] || 0, 0);
                                                        return d.getTime();
                                                    };
                                                    if (pairOut && (pairOut as any).official_time_in) {
                                                        const offInTs = toDate((pairOut as any).official_time_in, slot.timestamp);
                                                        isLateTime = isLate(slot.timestamp, offInTs);
                                                    }
                                                }

                                                return (
                                                <div key={idx} className={`flex flex-col items-center gap-1 ${isAutoTimeOut ? 'justify-center h-full' : ''}`}>
                                                    {slot ? (
                                                        <>
                                                            <div className="flex items-center gap-1">
                                                                {isAutoTimeOut ? (
                                                                    <span className="text-[9px] font-bold text-red-500 whitespace-nowrap"></span>
                                                                ) : (
                                                                <div className="flex flex-col items-center justify-center w-full">
                                                                    <div className={`text-[9px] font-bold whitespace-nowrap text-center ${isLateTime ? 'text-red-600' : 'text-gray-900'}`}>
                                                                        {formatTime(slot.timestamp)}
                                                                    </div>
                                                                    {isLateTime ? (
                                                                        <div className="text-[7px] font-bold text-red-500 leading-none mt-0.5 text-center">LATE</div>
                                                                    ) : (
                                                                        <div className="text-[7px] font-bold text-transparent leading-none mt-0.5 invisible text-center">LATE</div>
                                                                    )}
                                                                </div>
                                                                )}
                                                            </div>
                                                            {slot.photoDataUrl && !isAutoTimeOut && (
                                                                <div 
                                                                    className="relative w-8 h-8 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100"
                                                                    onClick={() => setSelectedImage({ url: slot.photoDataUrl!, timestamp: slot.timestamp })}
                                                                >
                                                                    <img src={slot.photoDataUrl} alt="Log" className="w-full h-full object-cover" />
                                                                </div>
                                                            )}
                                                            {!isAutoTimeOut && (
                                                            <div className="flex gap-1 mt-0.5 justify-center h-3 items-center">
                                                                {(() => {
                                                                    return (slot as any).status === 'Approved' ? (
                                                                    <span className="text-[9px] font-semibold text-green-600">
                                                                        Validated
                                                                    </span>
                                                                    ) : (slot as any).status === 'Rejected' ? (
                                                                    <span className="text-[10px] font-semibold text-red-600">
                                                                        Unvalidated
                                                                    </span>
                                                                    ) : (
                                                                    <span className="text-[10px] font-semibold text-yellow-500">
                                                                        Pending
                                                                    </span>
                                                                );
                                                                })()}
                                                            </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )}
                                                </div>
                                            ); })}
                                        </div>
                                    </div>
                                    <div className="rounded-lg border border-gray-100 bg-gray-50 p-1">
                                        <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Total Hours</div>
                                        <div className="text-[10px] font-bold text-gray-900 mt-1 text-right">
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
                    className="absolute top-2 right-2 p-2 text-white/70 hover:text-white transition-colors z-[110]"
                >
                    <X size={24} />
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
                <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden">
                    <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                        <h3 className="font-bold text-gray-900 text-sm">Set Overtime</h3>
                        <button onClick={() => setOvertimeModal({ isOpen: false, date: null })} className="p-1 hover:bg-gray-200 rounded-full text-gray-500">
                            <X size={16} />
                        </button>
                    </div>
                    <div className="p-2.5 space-y-2.5">
                        <p className="text-[10px] text-gray-500">
                            Set overtime for <span className="font-bold text-gray-900">{overtimeModal.date?.toLocaleDateString()}</span>.
                            This will manually add validated entries.
                        </p>
                        <div>
                            <label className="block text-[10px] font-medium text-gray-700 mb-1">Time In</label>
                            <input 
                                type="time" 
                                value={otInTime}
                                min={overtimeModal.defaultStart}
                                onClick={(e) => e.currentTarget.showPicker()}
                                onChange={(e) => setOtInTime(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-medium text-gray-700 mb-1">Duration</label>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            min="0" 
                                            value={otHours}
                                            onChange={(e) => setOtHours(Math.max(0, parseInt(e.target.value) || 0))}
                                            className="w-full rounded-lg border border-gray-300 pl-2 pr-10 py-1 text-xs focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-medium">hrs</span>
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
                                            className="w-full rounded-xl border border-gray-300 pl-3 pr-12 py-1.5 text-xs focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-medium">mins</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-2 text-right">
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

        {/* Success Modal */}
        {showSuccessModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
              <div className="h-14 w-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                <Check size={32} strokeWidth={3} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Success</h3>
              <p className="text-gray-600 mb-6">
                Overtime authorized successfully! The student can now time in.
              </p>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-green-200"
              >
                Okay, Got it
              </button>
            </div>
          </div>
        )}

      {/* Validation Confirmation Modal */}
      {showValidateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-green-100 rounded-full mb-4">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-center text-gray-900 mb-2">Confirm Attendance Validation</h3>
              <p className="text-center text-gray-600 mb-6">
                Are you sure you want to validate the selected attendance logs? This action will mark the hours as approved and cannot be undone.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowValidateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmValidate}
                  className="px-4 py-2.5 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 transition-all shadow-md shadow-green-200"
                >
                  Yes, Validate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Confirmation Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-center text-gray-900 mb-2">Confirm Attendance Rejection</h3>
              <p className="text-center text-gray-600 mb-6">
                Are you sure you want to reject the selected attendance logs? This will mark the hours as invalid. This action cannot be undone.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReject}
                  className="px-4 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all shadow-md shadow-red-200"
                >
                  Yes, Reject
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
        <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
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
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/30">
                      <th className="px-6 py-4 rounded-tl-xl">Student</th>
                      <th className="px-6 py-4">Course & Section</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right rounded-tr-xl">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredStudents.map(student => {
                      const id = String(student.idnumber || "").trim();
                      const isCompleted = completedIds.has(id);
                      const isAllowed = evalPermissions[id] || false;
                      
                      let buttonClass = "bg-gray-100 text-gray-400 cursor-not-allowed";
                      let buttonText = "Locked";
                      let isDisabled = true;
                      
                      if (isCompleted) {
                        buttonClass = "bg-blue-50 text-blue-600 border border-blue-100 cursor-default";
                        buttonText = "Submitted";
                        isDisabled = true;
                      } else if (isAllowed) {
                        buttonClass = "bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-200 cursor-pointer active:scale-[0.98]";
                        buttonText = "Evaluate";
                        isDisabled = false;
                      }

                      return (
                        <tr key={student.idnumber} className="group hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className={`relative h-10 w-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm overflow-hidden border border-gray-100 ${
                                isCompleted ? "bg-blue-100 text-blue-600" :
                                isAllowed ? "bg-green-100 text-green-600" :
                                "bg-gray-100 text-gray-500"
                              }`}>
                                {student.avatar_url ? (
                                  <Image
                                    src={student.avatar_url}
                                    alt="Avatar"
                                    fill
                                    className="object-cover"
                                  />
                                ) : (
                                  (student.firstname?.[0] || student.lastname?.[0] || "S").toUpperCase()
                                )}
                              </div>
                              <div>
                                <h4 className="font-bold text-gray-900 text-sm">{student.firstname} {student.lastname}</h4>
                                <p className="text-xs text-gray-500 font-mono">{student.idnumber}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900">{student.course || "N/A"}</span>
                              <span className="text-xs text-gray-500">{student.section || "N/A"}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                             <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                                isCompleted ? "bg-blue-50 text-blue-600 border-blue-100" :
                                isAllowed ? "bg-green-50 text-green-600 border-green-100" :
                                "bg-gray-50 text-gray-500 border-gray-100"
                             }`}>
                                {isCompleted ? "Done" : isAllowed ? "Open" : "Closed"}
                             </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => !isDisabled && onOpenModal(student)}
                              disabled={isDisabled}
                              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${buttonClass}`}
                            >
                              {buttonText}
                              {isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="block md:hidden grid grid-cols-1 gap-4">
                {filteredStudents.map(student => {
                  const id = String(student.idnumber || "").trim();
                  const isCompleted = completedIds.has(id);
                  const isAllowed = evalPermissions[id] || false;
                  
                  // Determine button state
                  let buttonClass = "bg-gray-100 text-gray-400 cursor-not-allowed";
                  let isDisabled = true;
                  
                  if (isCompleted) {
                    buttonClass = "bg-blue-50 text-blue-600 border border-blue-100 cursor-default";
                    isDisabled = true;
                  } else if (isAllowed) {
                    buttonClass = "bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-200 cursor-pointer active:scale-[0.98]";
                    isDisabled = false;
                  } else {
                    buttonClass = "bg-red-500 text-white opacity-90 cursor-not-allowed shadow-red-100";
                    isDisabled = true;
                  }

                  return (
                    <div 
                      key={student.idnumber} 
                      className="group bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`relative h-12 w-12 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-lg shadow-sm overflow-hidden ${
                            isCompleted ? "bg-blue-100 text-blue-600" :
                            isAllowed ? "bg-green-100 text-green-600" :
                            "bg-gray-100 text-gray-500"
                          }`}>
                            {student.avatar_url ? (
                              <Image
                                src={student.avatar_url}
                                alt="Avatar"
                                fill
                                className="object-cover"
                              />
                            ) : (
                              (student.firstname?.[0] || student.lastname?.[0] || "S").toUpperCase()
                            )}
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
                              <span>Submitted</span>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Calendar Modal ---
function CalendarModal({ 
  isOpen, 
  onClose, 
  onSelectDate, 
  attendanceData 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSelectDate: (date: Date) => void; 
  attendanceData: AttendanceEntry[];
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Reset to current month when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentMonth(new Date());
    }
  }, [isOpen]);

  const dataDates = useMemo(() => {
    const dates = new Set<string>();
    attendanceData.forEach(entry => {
      const d = new Date(entry.timestamp);
      dates.add(toDateKey(d));
    });
    return dates;
  }, [attendanceData]);

  if (!isOpen) return null;

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay(); // 0 = Sun

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
         <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <h3 className="font-bold text-gray-900">Select Date</h3>
            <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full text-gray-500">
              <X size={20} />
            </button>
         </div>
         <div className="p-6">
            <div className="flex items-center justify-between mb-6">
               <button 
                 onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                 className="p-2 hover:bg-gray-100 rounded-xl text-gray-600"
               >
                 <ChevronLeft size={20} />
               </button>
               <span className="font-bold text-lg text-gray-900">
                 {currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
               </span>
               <button 
                 onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                 className="p-2 hover:bg-gray-100 rounded-xl text-gray-600"
               >
                 <ChevronRight size={20} />
               </button>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <div key={d} className="text-center text-xs font-bold text-gray-400 uppercase tracking-wider py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
               {days.map((date, i) => {
                if (!date) return <div key={`empty-${i}`} />;
                const hasData = dataDates.has(toDateKey(date));

                return (
                   <button
                     key={date.toISOString()}
                     disabled={!hasData}
                     onClick={() => {
                        onSelectDate(date);
                        onClose();
                     }}
                     className={`
                       h-10 w-full rounded-xl flex items-center justify-center text-sm font-bold transition-all
                       ${hasData 
                         ? 'bg-orange-50 text-orange-600 hover:bg-orange-100 hover:scale-105 border border-orange-100' 
                         : 'text-gray-300 cursor-not-allowed bg-gray-50/50'
                       }
                     `}
                   >
                     {date.getDate()}
                   </button>
                 );
               })}
            </div>
            
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
               <div className="w-2 h-2 rounded-full bg-orange-500"></div>
               <span>Dates with attendance data</span>
            </div>
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
  const [rawAttendanceData, setRawAttendanceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedModalData, setSelectedModalData] = useState<{ student: User; attendance: AttendanceEntry[] } | null>(null);
  const [isFetchingModalData, setIsFetchingModalData] = useState(false);
  const [scheduleConfig, setScheduleConfig] = useState<{
    amIn: string; amOut: string;
    pmIn: string; pmOut: string;
    otIn: string; otOut: string;
  } | null>(null);
  const [studentSchedules, setStudentSchedules] = useState<Record<string, any>>({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [overtimeShifts, setOvertimeShifts] = useState<any[]>([]);
  const [dateOverrides, setDateOverrides] = useState<DateOverride[]>([]);
  const [daysToShow, setDaysToShow] = useState(1);
  const [showCalendar, setShowCalendar] = useState(false);
  const [internalRefresh, setInternalRefresh] = useState(0);

  // Realtime Subscription
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('supervisor_attendance_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        (payload: RealtimePostgresChangesPayload<any>) => {
           console.log("Realtime attendance update:", payload);
           setInternalRefresh(prev => prev + 1);
        }
      )
      .subscribe();
    return () => { supabase?.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const fetchOverrides = async () => {
        try {
            const supervisorId = myIdnumber || localStorage.getItem("idnumber") || "";
            if (!supervisorId) return;
            const res = await fetch(`/api/shifts/overrides?supervisor_id=${encodeURIComponent(supervisorId)}`);
            const json = await res.json();
            if (json.overrides) {
                setDateOverrides(json.overrides);
            }
        } catch (e) {
            console.error("Failed to fetch overrides", e);
        }
    };
    fetchOverrides();
  }, [myIdnumber, refreshKey]);

  useEffect(() => {
    const fetchOvertime = async () => {
        try {
            const supervisorId = myIdnumber || localStorage.getItem("idnumber") || "";
            if (!supervisorId) return;
            const res = await fetch(`/api/overtime?supervisor_id=${encodeURIComponent(supervisorId)}`);
            const json = await res.json();
            if (json.overtime_shifts) {
                setOvertimeShifts(json.overtime_shifts);
            }
        } catch (e) {
            console.error("Failed to fetch overtime shifts", e);
        }
    };
    fetchOvertime();
    // Refresh every minute to keep in sync
    const interval = setInterval(fetchOvertime, 60000);
    return () => clearInterval(interval);
  }, [myIdnumber, refreshKey, internalRefresh]);

  useEffect(() => {
    const fetchStudentSchedules = async () => {
        if (!supabase) return;
        const { data } = await supabase.from('student_shift_schedules').select('*');
        if (data) {
            const map: Record<string, any> = {};
             data.forEach((s: any) => {
                 map[String(s.student_id)] = s;
             });
             setStudentSchedules(map);
        }
    };
    fetchStudentSchedules();
  }, [refreshKey, internalRefresh]);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const supervisorId = myIdnumber || localStorage.getItem("idnumber") || "";
        const res = await fetch(`/api/shifts?supervisor_id=${encodeURIComponent(supervisorId)}`);
        const data = await res.json();
        if (data.shifts) {
          const config = {
            amIn: "08:00", amOut: "12:00",
            pmIn: "13:00", pmOut: "17:00",
            otIn: "", otOut: ""
          };
          data.shifts.forEach((s: any) => {
            if (s.shift_name === "Morning Shift") {
              config.amIn = s.official_start || "07:00";
              config.amOut = s.official_end || "12:00";
            } else if (s.shift_name === "Afternoon Shift") {
              config.pmIn = s.official_start || "13:00";
              config.pmOut = s.official_end || "17:00";
            }
            // Overtime Shift from DB is ignored here to prevent it from being applied globally.
            // Overtime is only enabled via explicit authorization (dynamicOt).
          });
          setScheduleConfig(config);
        }
      } catch (e) {
        console.error("Failed to fetch schedule", e);
      }
    };
    fetchSchedule();
  }, [myIdnumber]);

  const [previewImage, setPreviewImage] = useState<{ url: string; timestamp?: number; status?: string } | null>(null);

  // Filter States
  // Filter States
  const [search, setSearch] = useState("");
  const [filterCourse, setFilterCourse] = useState("");
  const [filterSection, setFilterSection] = useState("");

  const [selectedDate, setSelectedDate] = useState(() => {
    // Initialize to Manila's current date, represented as a local Date object
    const now = new Date();
    const manilaDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const [y, m, d] = manilaDateStr.split('-').map(Number);
    const date = new Date();
    date.setFullYear(y, m - 1, d);
    date.setHours(0, 0, 0, 0);
    return date;
  });

  const handleViewStudentAttendance = async (student: User) => {
    setIsFetchingModalData(true);
    try {
      const res = await fetch(
        `/api/attendance?idnumber=${encodeURIComponent(String(student.idnumber || ""))}&limit=10000`,
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
          studentId: e.student_id,
          type: e.type,
          timestamp: Number(e.ts),
          photoDataUrl: e.photourl,
          status: isRejected ? "Rejected" : isApproved ? "Approved" : "Pending",
          validatedAt: e.validated_at ? Number(new Date(e.validated_at).getTime()) : undefined,
          validated_by: e.validated_by,
          rendered_hours: e.rendered_hours,
          validated_hours: e.validated_hours,
          official_time_in: e.official_time_in,
          official_time_out: e.official_time_out,
          slot: e.slot
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
  // Replaced single overtime modal with bulk modal
  const [bulkOvertimeModal, setBulkOvertimeModal] = useState<{
    isOpen: boolean;
    selectedStudentIds: Set<string>;
    date: Date | null;
    mode?: "create" | "edit";
  }>({ isOpen: false, selectedStudentIds: new Set(), date: null, mode: "create" });
  
  const [otInTime, setOtInTime] = useState("");
  const [otHours, setOtHours] = useState(1);
  const [otMinutes, setOtMinutes] = useState(0);
  const [isSavingOt, setIsSavingOt] = useState(false);
  
  // Helpers
  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  const displayDateLabel = useMemo(
    () =>
      selectedDate.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [selectedDate]
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

  const openEditOvertimeForStudent = async (studentIdnumber: string) => {
    try {
      const dateStr = toLocalDateKey(selectedDate);
      const res = await fetch(`/api/overtime?student_id=${encodeURIComponent(studentIdnumber)}&date=${encodeURIComponent(dateStr)}`);
      const json = await res.json();
      const item = Array.isArray(json.overtime_shifts) ? json.overtime_shifts[0] : null;
      if (!item) {
        alert("No authorized overtime found for this date.");
        return;
      }
      const start = new Date(Number(item.overtime_start));
      const end = new Date(Number(item.overtime_end));
      const inStr = start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      const diffMs = Math.max(0, end.getTime() - start.getTime());
      const hrs = Math.floor(diffMs / (60 * 60 * 1000));
      const mins = Math.round((diffMs % (60 * 60 * 1000)) / (60 * 1000));
      setOtInTime(inStr);
      setOtHours(hrs);
      setOtMinutes(mins);
      setBulkOvertimeModal({
        isOpen: true,
        selectedStudentIds: new Set([studentIdnumber]),
        date: new Date(selectedDate),
        mode: "edit",
      });
    } catch (e) {
      alert("Failed to load overtime details");
    }
  };

  const deleteOvertimeForStudent = async (studentIdnumber: string) => {
    try {
      const supId = myIdnumber || localStorage.getItem("idnumber") || "";
      const dateStr = toLocalDateKey(selectedDate);
      const res = await fetch(
        `/api/overtime?date=${encodeURIComponent(dateStr)}&student_id=${encodeURIComponent(studentIdnumber)}&supervisor_id=${encodeURIComponent(supId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to delete overtime");
      }
      setInternalRefresh((x) => x + 1);
    } catch (e: any) {
      alert(e.message || "Failed to delete overtime");
    }
  };
  const isPairSelected = (entryIn?: AttendanceEntry | null, entryOut?: AttendanceEntry | null) => {
    const ids: number[] = [];
    if (entryIn && entryIn.id != null) ids.push(Number(entryIn.id));
    if (entryOut && entryOut.id != null) ids.push(Number(entryOut.id));
    if (ids.length === 0) return false;
    return ids.every(id => selectedIds.has(id));
  };

  const selectAllPending = () => {
    const ids = new Set<number>();
    studentSummaries.forEach(summary => {
        const slots = summary.todaySlots;
        if (slots) {
            [slots.s1, slots.s2, slots.s3, slots.s4, slots.s5, slots.s6].forEach(slot => {
                if (slot && (slot.status || "Pending") === "Pending" && slot.id != null) {
                    ids.add(Number(slot.id));
                }
            });
        }
    });
    setSelectedIds(ids);
  };

  const bulkValidate = async (action: "approve" | "reject") => {
    if (selectedIds.size === 0) return;
    setIsBulkValidating(true);
    const ids = Array.from(selectedIds);
    
    // Process sequentially
    for (const id of ids) {
        let entry = attendanceData.find(e => Number(e.id) === id);
        
        // If not found in raw data, check derived state (for auto-generated entries)
        if (!entry && id < 0) {
             for (const summary of studentSummaries) {
                  const slots = summary.todaySlots;
                  if (!slots) continue;
                  if (slots.s2?.id === id) { entry = slots.s2; break; }
                  if (slots.s4?.id === id) { entry = slots.s4; break; }
                  if (slots.s6?.id === id) { entry = slots.s6; break; }
             }
        }

        if (entry) await handleValidation(entry, action);
    }
    
    setSelectedIds(new Set());
    setIsBulkValidating(false);
  };

  const handleBulkSaveOvertime = async () => {
    if (bulkOvertimeModal.selectedStudentIds.size === 0 || !bulkOvertimeModal.date || !otInTime || (otHours === 0 && otMinutes === 0)) return;
    setIsSavingOt(true);
    try {
      const supervisorId = myIdnumber || localStorage.getItem("idnumber") || "";
      if (!supervisorId) {
          throw new Error("Supervisor ID not found. Please log in again.");
      }

      const [inH, inM] = otInTime.split(":").map(Number);
      const tsIn = new Date(bulkOvertimeModal.date);
      tsIn.setHours(inH, inM, 0, 0);

      const durationMs = otHours * 60 * 60 * 1000 + otMinutes * 60 * 1000;
      const tsOut = new Date(tsIn.getTime() + durationMs);
      
      const y = bulkOvertimeModal.date.getFullYear();
      const m = String(bulkOvertimeModal.date.getMonth() + 1).padStart(2, '0');
      const d = String(bulkOvertimeModal.date.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const studentIds = Array.from(bulkOvertimeModal.selectedStudentIds);

      // Process in parallel
      const errors: string[] = [];
      await Promise.all(studentIds.map(async (studentId) => {
          try {
            const res = await fetch("/api/overtime", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                date: dateStr,
                start: tsIn.getTime(),
                end: tsOut.getTime(),
                supervisor_id: supervisorId,
                student_id: studentId
              }),
            });
            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || "Failed to authorize overtime");
            }
          } catch (err: any) {
             errors.push(`Student ${studentId}: ${err.message}`);
          }
      }));

      if (errors.length > 0) {
          throw new Error(`Some authorizations failed:\n${errors.join("\n")}`);
      }

      // Optimistically update overtimeShifts
      const newShifts = studentIds.map(sid => ({
          student_id: sid,
          overtime_start: tsIn.getTime(),
          overtime_end: tsOut.getTime(),
          effective_date: dateStr,
          created_by: supervisorId
      }));
      
      setOvertimeShifts(prev => [...prev, ...newShifts]);

      setShowSuccessModal(true);
      setBulkOvertimeModal({ isOpen: false, selectedStudentIds: new Set(), date: null });
      setOtInTime("");
      setOtHours(0);
      setOtMinutes(0);
    } catch (e: any) {
      alert(e.message || "Failed to authorize overtime");
    } finally {
      setIsSavingOt(false);
    }
  };

  const handleEditSaveOvertime = async () => {
    // Edit mode expects exactly one student selected
    if (bulkOvertimeModal.selectedStudentIds.size !== 1 || !bulkOvertimeModal.date || !otInTime || (otHours === 0 && otMinutes === 0)) return;
    setIsSavingOt(true);
    try {
      const supervisorId = myIdnumber || localStorage.getItem("idnumber") || "";
      if (!supervisorId) {
        throw new Error("Supervisor ID not found. Please log in again.");
      }
      const studentIdnumber = Array.from(bulkOvertimeModal.selectedStudentIds)[0];

      const [inH, inM] = otInTime.split(":").map(Number);
      const tsIn = new Date(bulkOvertimeModal.date);
      tsIn.setHours(inH, inM, 0, 0);

      const durationMs = otHours * 60 * 60 * 1000 + otMinutes * 60 * 1000;
      const tsOut = new Date(tsIn.getTime() + durationMs);

      const y = bulkOvertimeModal.date.getFullYear();
      const m = String(bulkOvertimeModal.date.getMonth() + 1).padStart(2, "0");
      const d = String(bulkOvertimeModal.date.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${d}`;

      const res = await fetch("/api/overtime", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          start: tsIn.getTime(),
          end: tsOut.getTime(),
          supervisor_id: supervisorId,
          student_id: studentIdnumber,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to update overtime");
      }

      setShowSuccessModal(true);
      setBulkOvertimeModal({ isOpen: false, selectedStudentIds: new Set(), date: null, mode: "create" });
      setOtInTime("");
      setOtHours(0);
      setOtMinutes(0);
      setInternalRefresh((x) => x + 1);
    } catch (e: any) {
      alert(e.message || "Failed to update overtime");
    } finally {
      setIsSavingOt(false);
    }
  };
  const studentSummaries = useMemo(() => {
    const byStudentId: Record<string, AttendanceEntry[]> = {};
    const byStudentIdNumber: Record<string, AttendanceEntry[]> = {};

    attendanceData.forEach((e: AttendanceEntry) => {
      if (e.studentId) {
          const sid = String(e.studentId);
          if (!byStudentId[sid]) byStudentId[sid] = [];
          byStudentId[sid].push(e);
      }
      if (e.idnumber) {
          if (!byStudentIdNumber[e.idnumber]) byStudentIdNumber[e.idnumber] = [];
          byStudentIdNumber[e.idnumber].push(e);
      }
    });
    
    const targetDateStr = toLocalDateKey(selectedDate);

    // Optimize Overtime/Override lookups
    const overtimeLookup: Record<string, any> = {};
    overtimeShifts.forEach((s: any) => {
        const key = `${s.student_id}_${s.effective_date}`;
        overtimeLookup[key] = s;
    });

    const overrideLookup: Record<string, DateOverride> = {};
    dateOverrides.forEach(o => {
        overrideLookup[o.date] = o;
    });

    return filteredStudents.map(student => {
      // Prefer matching by studentId, fallback to idnumber
      // Logs are already sorted by timestamp from useEffect
      const logs = (byStudentId[String(student.id)] || byStudentIdNumber[student.idnumber] || []);
      
      // Load Schedule
      let totalValidatedMs = 0;
      let totalRawMs = 0;
      const pendingDates = new Set<string>();
      let todaySlots: any = null;

      // Group by date
      const grouped = new Map<string, { date: Date, logs: AttendanceEntry[] }>();
      logs.forEach(log => {
          const date = new Date(log.timestamp);
          const key = toDateKey(date);
          if (!grouped.has(key)) grouped.set(key, { date, logs: [] });
          grouped.get(key)!.logs.push(log);
      });

      grouped.forEach(({ date, logs: dayLogs }) => {
          // Pending Days Count
          if (dayLogs.some(l => l.status === "Pending")) {
             pendingDates.add(toDateKey(date));
          }

          // Calculate Validated Hours
          const baseDate = new Date(date);
          baseDate.setHours(0, 0, 0, 0);

          // Dynamic OT check: Apply authorized overtime window if exists for this student/date
          const dateStr = toDateKey(date);

          const dynamicOt = overtimeLookup[`${student.idnumber}_${dateStr}`];
          const override = overrideLookup[dateStr];
          const studentSched = studentSchedules[student.idnumber];

          const schedule = buildSchedule(
            baseDate,
            {
              amIn: override?.am?.start || studentSched?.am_in || scheduleConfig?.amIn || "08:00",
              amOut: override?.am?.end || studentSched?.am_out || scheduleConfig?.amOut || "12:00",
              pmIn: override?.pm?.start || studentSched?.pm_in || scheduleConfig?.pmIn || "13:00",
              pmOut: override?.pm?.end || studentSched?.pm_out || scheduleConfig?.pmOut || "17:00",
              otIn: studentSched?.ot_in || scheduleConfig?.otIn,
              otOut: studentSched?.ot_out || scheduleConfig?.otOut
            },
            dynamicOt ? { start: dynamicOt.overtime_start, end: dynamicOt.overtime_end } : undefined
          );

          // Sort logs strictly by time
          const sortedLogs = [...dayLogs].sort((a, b) => a.timestamp - b.timestamp);

          // --- SMART PAIRING LOGIC ---
          const usedIds = new Set<string>();
          let s1: AttendanceEntry | null = null;
          let s2: AttendanceEntry | null = null;
          let s3: AttendanceEntry | null = null;
          let s4: AttendanceEntry | null = null;
          let s5: AttendanceEntry | null = null;
          let s6: AttendanceEntry | null = null;

          const isInWindow = (ts: number, start: number | undefined, end: number | undefined) => {
               if (!start || !end) return false;
               // 30 min buffer before start, up to end
               return ts >= (start - 30 * 60000) && ts <= end;
          };

          // 1. Assign INs to Slots (Greedy by Window)
          sortedLogs.filter(l => (l.type || "").toLowerCase() === 'in' && !usedIds.has(String(l.id || l.timestamp))).forEach(l => {
               const id = String(l.id || l.timestamp);
               if (!s1 && isInWindow(l.timestamp, schedule.amIn, schedule.amOut)) {
                   s1 = l; usedIds.add(id); return;
               }
               if (!s3 && isInWindow(l.timestamp, schedule.pmIn, schedule.pmOut)) {
                   s3 = l; usedIds.add(id); return;
               }
               if (!s5 && isInWindow(l.timestamp, schedule.otStart, schedule.otEnd)) {
                   s5 = l; usedIds.add(id); return;
               }
          });

          // 2. Fallback Assignment for Remaining INs (Sequential Fill)
          // This captures off-schedule INs that didn't match strict windows
          sortedLogs.filter(l => (l.type || "").toLowerCase() === 'in' && !usedIds.has(String(l.id || l.timestamp))).forEach(l => {
               const id = String(l.id || l.timestamp);
               if (!s1) { s1 = l; usedIds.add(id); }
               else if (!s3) { s3 = l; usedIds.add(id); }
               else if (!s5) { s5 = l; usedIds.add(id); }
          });

          // 3. Pair OUTs to INs (Sequential Pairing)
          // We prioritize pairing an OUT with an existing IN over strict window matching
          const findAndMarkOut = (startTs: number) => {
              const match = sortedLogs.find(l => 
                  (l.type || "").toLowerCase() === 'out' && 
                  !usedIds.has(String(l.id || l.timestamp)) && 
                  l.timestamp > startTs
              );
              if (match) {
                  usedIds.add(String(match.id || match.timestamp));
                  return match;
              }
              return null;
          };

          if (s1 && !s2) s2 = findAndMarkOut((s1 as any).timestamp) || null;
          if (s3 && !s4) s4 = findAndMarkOut((s3 as any).timestamp) || null;
          if (s5 && !s6) s6 = findAndMarkOut((s5 as any).timestamp) || null;

          // 4. Assign Remaining OUTs (Orphans)
          // Only assign to empty slots where the IN is also empty (true orphans)
          sortedLogs.filter(l => (l.type || "").toLowerCase() === 'out' && !usedIds.has(String(l.id || l.timestamp))).forEach(l => {
               const id = String(l.id || l.timestamp);
               if (!s2 && !s1 && isInWindow(l.timestamp, schedule.amIn, schedule.amOut)) { // AM OUT Orphan
                   s2 = l; usedIds.add(id); return;
               }
               if (!s4 && !s3 && isInWindow(l.timestamp, schedule.pmIn, schedule.pmOut)) { // PM OUT Orphan
                   s4 = l; usedIds.add(id); return;
               }
               if (!s6 && !s5 && isInWindow(l.timestamp, schedule.otStart, schedule.otEnd)) { // OT OUT Orphan
                   s6 = l; usedIds.add(id); return;
               }
          });

          // 4. Virtual Auto-Out for Past Dates
          const today = new Date();
          today.setHours(0,0,0,0);
          const isPastDate = date < today;

          if (isPastDate) {
              if (s1 && !s2) {
                   s2 = {
                        id: (s1 as any).id ? -Math.abs(Number((s1 as any).id)) : -Math.floor(Math.random() * 1000000),
                        idnumber: (s1 as any).idnumber,
                        type: 'out',
                        timestamp: schedule.amOut!,
                        photoDataUrl: '',
                        status: 'Pending',
                        validated_by: 'AUTO TIME OUT'
                   };
              }
              if (s3 && !s4) {
                   s4 = {
                        id: (s3 as any).id ? -Math.abs(Number((s3 as any).id)) : -Math.floor(Math.random() * 1000000),
                        idnumber: (s3 as any).idnumber,
                        type: 'out',
                        timestamp: schedule.pmOut!,
                        photoDataUrl: '',
                        status: 'Pending',
                        validated_by: 'AUTO TIME OUT'
                   };
              }
              if (s5 && !s6 && schedule.otEnd) {
                   s6 = {
                        id: (s5 as any).id ? -Math.abs(Number((s5 as any).id)) : -Math.floor(Math.random() * 1000000),
                        idnumber: (s5 as any).idnumber,
                        type: 'out',
                        timestamp: schedule.otEnd,
                        photoDataUrl: '',
                        status: 'Pending',
                        validated_by: 'AUTO TIME OUT'
                   };
              }
          }

          const calcTracked = () => {
              let total = 0;
              const add = (inLog: AttendanceEntry | null, outLog: AttendanceEntry | null, shift: 'am' | 'pm' | 'ot') => {
                  if (!inLog || !outLog) return;
                  if (inLog.status === 'Rejected' || outLog.status === 'Rejected') return;
                  total += calculateSessionDuration(inLog.timestamp, outLog.timestamp, shift, schedule);
              };
              add(s1, s2, 'am');
              add(s3, s4, 'pm');
              add(s5, s6, 'ot');
              return total;
          };

          const dayRaw = calcTracked();
          const calcApproved = (inLog: AttendanceEntry | null, outLog: AttendanceEntry | null, shift: 'am' | 'pm' | 'ot') => {
              if (!inLog || !outLog) return 0;
              if ((inLog.status || "") === 'Rejected' || (outLog.status || "") === 'Rejected') return 0;
              const inOk = ["Approved", "Validated", "VALIDATED", "OFFICIAL", "ADJUSTED", "Official"].includes(inLog.status || "");
              const outOk = ["Approved", "Validated", "VALIDATED", "OFFICIAL", "ADJUSTED", "Official"].includes(outLog.status || "");
              if (!inOk || !outOk) return 0;
              const vh = (outLog as any).validated_hours;
              if (vh !== undefined && vh !== null && Number(vh) >= 0) {
                  return Number(vh) * 3600000;
              }
              if ((outLog as any).official_time_in && (outLog as any).official_time_out) {
                  const base = new Date(inLog.timestamp);
                  const toDate = (t: string) => {
                      const [h, m, s] = t.split(":").map(Number);
                      const d = new Date(base);
                      d.setHours(h, m, s || 0, 0);
                      return d;
                  };
                  const offIn = toDate((outLog as any).official_time_in);
                  const offOut = toDate((outLog as any).official_time_out);
                  if (offOut.getTime() < offIn.getTime()) offOut.setDate(offOut.getDate() + 1);
                  return calculateHoursWithinOfficialTime(new Date(inLog.timestamp), new Date(outLog.timestamp), offIn, offOut);
              }
              return 0;
          };
          const dayVal = calcApproved(s1, s2, 'am') + calcApproved(s3, s4, 'pm') + calcApproved(s5, s6, 'ot');
          
          // Ledger-only, approval-agnostic frozen total for display
          const calcFrozen = (inLog: AttendanceEntry | null, outLog: AttendanceEntry | null) => {
              if (!inLog || !outLog) return 0;
              const vh = (outLog as any).validated_hours;
              if (vh !== undefined && vh !== null && Number(vh) >= 0) {
                  return Number(vh) * 3600000;
              }
              const offInStr = (outLog as any).official_time_in;
              const offOutStr = (outLog as any).official_time_out;
              if (offInStr && offOutStr) {
                  const base = new Date(inLog.timestamp);
                  const toDate = (t: string) => {
                      const [h, m, s] = t.split(":").map(Number);
                      const d = new Date(base);
                      d.setHours(h, m, s || 0, 0);
                      return d;
                  };
                  const offIn = toDate(offInStr);
                  const offOut = toDate(offOutStr);
                  if (offOut.getTime() < offIn.getTime()) offOut.setDate(offOut.getDate() + 1);
                  return calculateHoursWithinOfficialTime(new Date(inLog.timestamp), new Date(outLog.timestamp), offIn, offOut);
              }
              return 0;
          };
          const dayFrozenMs = calcFrozen(s1, s2) + calcFrozen(s3, s4) + calcFrozen(s5, s6);
          
          totalValidatedMs += dayVal;
          totalRawMs += dayRaw;
          
          // Capture Selected Date's Slots
          const targetDateKey = toLocalDateKey(selectedDate);
          const manilaKey = toDateKey(date);
          
          if (manilaKey === targetDateKey) {
             const otAuthLog = dayLogs.find(l => l.photoDataUrl && l.photoDataUrl.startsWith("OT_AUTH:"));
             
             // Use selectedDate for matching overtime shifts visually if needed (though we matched above via dateStr)
             const targetDateISO = toLocalDateKey(selectedDate);

             const isOvertimeAuthorized = !!overtimeLookup[`${student.idnumber}_${targetDateISO}`];

            type Session = { in: AttendanceEntry; out: AttendanceEntry | null };
            const sessions: Session[] = [];
            let currentIn: AttendanceEntry | null = null;
            for (const log of sortedLogs) {
                const t = (log.type || "").toLowerCase();
                if (t === "in") {
                    currentIn = log;
                } else if (t === "out") {
                    if (currentIn) {
                        sessions.push({ in: currentIn, out: log });
                        currentIn = null;
                    }
                }
            }
            const mapSessionToSlots = (shiftSessions: Session[]) => {
               if (shiftSessions.length === 0) return { in: null, out: null };
               const firstSession = shiftSessions[0];
               const lastSession = shiftSessions[shiftSessions.length - 1];
               return { in: firstSession.in, out: lastSession.out };
            };
            const amSlots = mapSessionToSlots(sessions.filter(s => (s.out as any)?.slot === 'AM'));
            const pmSlots = mapSessionToSlots(sessions.filter(s => (s.out as any)?.slot === 'PM'));
            const otSlots = mapSessionToSlots(sessions.filter(s => ((s.out as any)?.slot === 'OT') || s.in.is_overtime));

            todaySlots = { 
                s1: amSlots.in || s1, s2: amSlots.out || s2, 
                s3: pmSlots.in || s3, s4: pmSlots.out || s4, 
                s5: otSlots.in || s5, s6: otSlots.out || s6, 
                todayTotalMs: dayFrozenMs, otAuthLog, isOvertimeAuthorized,
                schedule
            };
          }
      });

      return {
        student,
        totalMs: totalValidatedMs,
        totalRawMs,
        pendingDays: pendingDates.size,
        todaySlots,
        logsCount: logs.length
      };
    });
  }, [filteredStudents, attendanceData, scheduleConfig, overtimeShifts, selectedDate, studentSchedules, dateOverrides]);

  // Fetch Attendance
  useEffect(() => {
    let mounted = true;
    const supervisorId = myIdnumber || localStorage.getItem("idnumber");
    
    (async () => {
      if (!supervisorId) return;

      setLoading(true);
      try {
        console.log("Fetching attendance for supervisor:", supervisorId);
        
        const res = await fetch(`/api/attendance?supervisor_id=${encodeURIComponent(supervisorId)}&limit=100000`);
        const json = await res.json();
        
        if (!res.ok) {
             console.error("Attendance fetch error:", json);
             throw new Error(json.error || "Failed to fetch attendance");
        }
        
        const data = json.entries || [];

        if (mounted) {
           console.log(`Fetched ${data.length} attendance records`);
           setRawAttendanceData(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [myIdnumber, refreshKey, internalRefresh]);

  // Map Attendance Data
  useEffect(() => {
     if (!rawAttendanceData) return;
     
     const mapped: AttendanceEntry[] = rawAttendanceData.map((e: any) => {
       const sStr = String(e.status || "").trim().toLowerCase();
       const isRejected = sStr === "rejected";
       const isApproved = sStr === "approved" || (!!e.validated_by && !isRejected);
       
       // API returns users_students object
       const joinedIdNumber = e.users_students?.idnumber;

       const student = students.find(s => String(s.id) === String(e.student_id));
       
       return {
       id: e.id,
       studentId: e.student_id,
       idnumber: joinedIdNumber || (student ? student.idnumber : 'UNKNOWN'),
       type: e.type,
       timestamp: new Date(e.logged_at).getTime(),
       photoDataUrl: e.photourl,
       status: isRejected ? "Rejected" : isApproved ? "Approved" : "Pending",
       validatedAt: e.validated_at ? Number(new Date(e.validated_at).getTime()) : undefined,
       validated_by: e.validated_by,
       is_overtime: e.is_overtime,
       rendered_hours: e.rendered_hours,
      validated_hours: e.validated_hours,
      slot: e.slot
    }});
     
     // Sort by timestamp to optimize downstream processing
     mapped.sort((a, b) => a.timestamp - b.timestamp);
     
     setAttendanceData(mapped);
  }, [rawAttendanceData, students]);

  // Validate Function
  const handleValidation = async (entry: AttendanceEntry, action: 'approve' | 'reject' | 'reset') => {
    if (!entry.id && entry.id !== 0) return;
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
        e.id === entry.id ? { ...e, status: newStatus as AttendanceEntry["status"], validatedAt: action === 'reset' ? undefined : Date.now() } : e;

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

      let res;
      if (Number(entry.id) < 0) {
          // Auto-generated entry (negative ID). Use POST to create it.
          res = await fetch("/api/attendance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              idnumber: entry.idnumber,
              type: entry.type,
              timestamp: entry.timestamp,
              validated_by: validatorId,
              status: newStatus,
              photoDataUrl: entry.photoDataUrl || "" 
            }),
          });
      } else {
          // Existing entry. Use PATCH.
          res = await fetch("/api/attendance", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              id: entry.id, 
              approve: action === 'approve', 
              reject: action === 'reject', 
              validated_by: validatorId 
            }),
          });
      }

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");

      // Update ID if created
      if (Number(entry.id) < 0 && json.id) {
          const updateId = (e: AttendanceEntry) => 
            e.id === entry.id ? { ...e, id: json.id } : e;
          
          setAttendanceData(prev => prev.map(updateId));
          if (selectedModalData) {
            setSelectedModalData(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    attendance: prev.attendance.map(updateId)
                };
            });
          }
      }

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
              scheduleConfig={scheduleConfig}
              onBack={() => setSelectedModalData(null)}
              onValidate={handleValidation}
              onRefresh={() => handleViewStudentAttendance(selectedModalData.student)}
              overtimeShifts={overtimeShifts}
          />
      );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
         
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
               onClick={() => {
                   const d = new Date(selectedDate);
                   d.setHours(0, 0, 0, 0);
                   setBulkOvertimeModal({ 
                       isOpen: true, 
                       selectedStudentIds: new Set(), 
                       date: d 
                   });
                   setOtInTime("17:00");
                   setOtHours(1);
                   setOtMinutes(0);
               }}
               className="inline-flex items-center justify-center px-3 py-1 text-[11px] font-semibold rounded-md border border-orange-500 bg-orange-500 text-white hover:bg-orange-600 hover:border-orange-600 transition-colors"
             >
               Authorize Overtime
            </button>
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

     {/* Calendar Modal */}
     <CalendarModal 
       isOpen={showCalendar} 
       onClose={() => setShowCalendar(false)} 
       onSelectDate={setSelectedDate} 
       attendanceData={attendanceData} 
     />

      {/* Date Navigation Header */}
      <div className="bg-white p-2 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <button 
            onClick={() => setSelectedDate(new Date())}
            className="px-4 py-2 text-sm font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-xl transition-colors"
          >
            Today
          </button>

          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() - 1);
                  setSelectedDate(d);
              }}
              className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors"
            >
                <ChevronLeft size={20} />
            </button>
            
            <div className="flex flex-col items-center">
              <span className="text-sm md:text-lg font-bold text-gray-900">
                  {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
              <span className="text-xs text-gray-500 font-medium md:hidden">
                  {selectedDate.getFullYear()}
              </span>
            </div>

            <button 
              onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() + 1);
                  setSelectedDate(d);
              }}
              className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors"
            >
                <ChevronRight size={20} />
            </button>
          </div>

          <button 
            onClick={() => setShowCalendar(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-xl border border-gray-200 transition-all shadow-sm hover:shadow"
          >
              <Calendar size={18} />
              <span className="hidden md:inline">Calendar</span>
          </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
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
                studentSummaries.map(({ student, totalMs, totalRawMs, todaySlots, logsCount }) => {
                  const todayMs = todaySlots?.todayTotalMs || 0;
                  const displayTotal = todayMs;
                  const renderSlot = (
                    slot: AttendanceEntry | null,
                    pairIn?: AttendanceEntry | null,
                    pairOut?: AttendanceEntry | null,
                    isInCell?: boolean,
                    isOvertime?: boolean,
                    officialStart?: number
                  ) => {
                    if (!slot) {
                      if (isOvertime && isInCell) {
                        // Check if Auth Log exists or Overtime Shift is present
                        if (todaySlots?.otAuthLog || todaySlots?.isOvertimeAuthorized) {
                             return (
                                 <td className="px-2 py-3 text-center border-r border-gray-50 text-xs bg-green-50">
                                   <div className="flex items-center justify-center gap-2">
                                     <span className="font-bold text-green-600">Authorized</span>
                                     <button
                                       onClick={() => openEditOvertimeForStudent(student.idnumber)}
                                       className="text-[10px] font-semibold text-orange-600 hover:underline"
                                       title="Edit Overtime"
                                     >
                                       Edit
                                     </button>
                                     <button
                                       onClick={() => deleteOvertimeForStudent(student.idnumber)}
                                       className="text-[10px] font-semibold text-red-600 hover:underline"
                                       title="Delete Overtime"
                                     >
                                       Delete
                                     </button>
                                   </div>
                                 </td>
                             );
                        }

                        let defaultStart = "17:00";
                        try {
                          const key = `schedule_${student.idnumber}`;
                          const saved = localStorage.getItem(key) || localStorage.getItem("schedule_default");
                          if (saved) {
                            const parsed = JSON.parse(saved);
                            defaultStart = parsed.overtimeIn || parsed.pmOut || defaultStart;
                          }
                        } catch {}

                        if (todaySlots?.s4) {
                          defaultStart = new Date(todaySlots.s4.timestamp).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                        }

                        return (
                          <td className="px-2 py-3 text-center border-r border-gray-50 text-xs text-gray-300">
                            -
                          </td>
                        );
                      }
                      return (
                        <td className="px-2 py-3 text-center border-r border-gray-50 text-xs text-gray-300">
                          -
                        </td>
                      );
                    }

                    const toDate = (t: string, baseTs: number) => {
                      const d = new Date(baseTs);
                      const parts = t.split(":").map(Number);
                      d.setHours(parts[0] || 0, parts[1] || 0, parts[2] || 0, 0);
                      return d.getTime();
                    };
                    const snapshotStart = pairOut && (pairOut as any).official_time_in 
                      ? toDate((pairOut as any).official_time_in, slot.timestamp) 
                      : officialStart;
                    const isLateTime = isInCell && slot.type === 'in' && snapshotStart ? isLate(slot.timestamp, snapshotStart) : false;

                    const status = slot.status as "Pending" | "Approved" | "Rejected" | undefined;
                    let statusLabel = "Pending";
                    let statusClass = "text-yellow-600";

                    const valBy = (slot.validated_by || "").trim();
                    if (valBy === "SYSTEM_AUTO_CLOSE" || valBy === "AUTO TIME OUT") {
                        // Completely blank for auto time-outs
                        return (
                            <td className="px-2 py-3 text-center border-r border-gray-50 text-xs text-gray-700">
                            </td>
                        );
                    } else if (status === "Approved") {
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
                            <div className="flex flex-col items-center justify-center">
                              <div className={`font-medium whitespace-nowrap text-center ${isLateTime ? "text-red-600 font-bold" : ""}`}>
                                {formatTime(slot.timestamp)}
                              </div>
                              {isLateTime ? (
                                  <div className="text-[7px] font-bold text-red-500 leading-none mt-0.5 text-center">LATE</div>
                              ) : (
                                  <div className="text-[7px] font-bold text-transparent leading-none mt-0.5 invisible text-center">LATE</div>
                              )}
                            </div>
                          </div>
                          {slot.photoDataUrl ? (
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
                          ) : null}
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
                          className="flex items-center gap-3 text-left w-full group"
                        >
                          <div className="flex-shrink-0 h-9 w-9 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
                            {student.avatar_url ? (
                              <img
                                src={student.avatar_url}
                                alt="Profile"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-gray-400">
                                <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
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
                      {renderSlot(todaySlots?.s1, todaySlots?.s1, todaySlots?.s2, true, false, todaySlots?.schedule?.amIn)}
                      {renderSlot(todaySlots?.s2, todaySlots?.s1, todaySlots?.s2, false, false)}
                      {renderSlot(todaySlots?.s3, todaySlots?.s3, todaySlots?.s4, true, false, todaySlots?.schedule?.pmIn)}
                      {renderSlot(todaySlots?.s4, todaySlots?.s3, todaySlots?.s4, false, false)}
                      {renderSlot(todaySlots?.s5, todaySlots?.s5, todaySlots?.s6, true, true, todaySlots?.schedule?.otStart)}
                      {renderSlot(todaySlots?.s6, todaySlots?.s5, todaySlots?.s6, false, true)}
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-gray-900">
                            {formatHours(displayTotal)}
                          </span>
                        </div>
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
            studentSummaries.map(({ student, totalMs, totalRawMs, todaySlots }) => {
              const todayMs = todaySlots?.todayTotalMs || 0;
              const displayTotal = todayMs;
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
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
                        {student.avatar_url ? (
                          <img
                            src={student.avatar_url}
                            alt="Profile"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-gray-400">
                            <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
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
                  <div className="mt-3">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                        Total Hours
                      </div>
                      <div className="text-sm font-bold text-gray-900 mt-1">
                        {formatHours(displayTotal)}
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

        {bulkOvertimeModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <h3 className="font-bold text-gray-900 text-sm">Authorize Overtime</h3>
                <button
                  onClick={() => setBulkOvertimeModal(prev => ({ ...prev, isOpen: false }))}
                  className="p-1 hover:bg-gray-200 rounded-full text-gray-500"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-3 space-y-3 overflow-y-auto custom-scrollbar">
                {/* Date & Time Controls */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-700 uppercase">Date</label>
                    <input 
                      type="date" 
                      value={bulkOvertimeModal.date ? (() => {
                        const d = bulkOvertimeModal.date;
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, '0');
                        const da = String(d.getDate()).padStart(2, '0');
                        return `${y}-${m}-${da}`;
                      })() : ''}
                      onChange={(e) => {
                          if (!e.target.value) {
                              setBulkOvertimeModal(prev => ({ ...prev, date: null }));
                          } else {
                              const [y, m, d] = e.target.value.split('-').map(Number);
                              // Create local date at 00:00
                              setBulkOvertimeModal(prev => ({ ...prev, date: new Date(y, m - 1, d) }));
                          }
                      }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-900 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-bold text-gray-700 uppercase">Start Time</label>
                     <input 
                       type="time" 
                       value={otInTime}
                       onChange={(e) => setOtInTime(e.target.value)}
                       className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-900 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                     />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                   <div className="space-y-1">
                     <label className="text-[10px] font-bold text-gray-700 uppercase">Hours</label>
                     <input 
                       type="number" 
                       min="0" max="12"
                       value={otHours}
                       onChange={(e) => setOtHours(Math.max(0, parseInt(e.target.value) || 0))}
                       className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-900 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                     />
                   </div>
                   <div className="space-y-1">
                     <label className="text-[10px] font-bold text-gray-700 uppercase">Minutes</label>
                     <input 
                       type="number" 
                       min="0" max="59" step="15"
                       value={otMinutes}
                       onChange={(e) => setOtMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                       className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-900 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                     />
                   </div>
                </div>

                <p className="text-xs font-medium text-gray-700 text-right">
                  Ends at:{" "}
                  <span className="font-bold text-orange-600">
                    {(() => {
                      if (!otInTime) return "--:--";
                      const [h, m] = otInTime.split(":").map(Number);
                      const date = new Date();
                      date.setHours(h, m, 0, 0);
                      date.setMinutes(date.getMinutes() + otHours * 60 + otMinutes);
                      return date.toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                    })()}
                  </span>
                </p>

                {/* Student Selection */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                   <div className="flex items-center justify-between">
                      <label className="text-[10px] font-medium text-gray-500 uppercase">Select Students</label>
                      <button 
                        onClick={() => {
                            const allIds = filteredStudents.map(s => String(s.idnumber));
                            const allSelected = allIds.every(id => bulkOvertimeModal.selectedStudentIds.has(id));
                            
                            setBulkOvertimeModal(prev => {
                                const next = new Set(prev.selectedStudentIds);
                                if (allSelected) {
                                    allIds.forEach(id => next.delete(id));
                                } else {
                                    allIds.forEach(id => next.add(id));
                                }
                                return { ...prev, selectedStudentIds: next };
                            });
                        }}
                        className="text-[10px] text-orange-600 font-medium hover:underline"
                      >
                        {filteredStudents.length > 0 && filteredStudents.every(s => bulkOvertimeModal.selectedStudentIds.has(String(s.idnumber))) ? "Deselect All" : "Select All"}
                      </button>
                   </div>
                   <div className="border border-gray-200 rounded-lg h-40 overflow-y-auto divide-y divide-gray-100 custom-scrollbar bg-gray-50">
                      {filteredStudents.length === 0 ? (
                          <div className="p-4 text-center text-xs text-gray-500">No students found.</div>
                      ) : (
                          filteredStudents.map(student => {
                              const sid = String(student.idnumber);
                              const isSelected = bulkOvertimeModal.selectedStudentIds.has(sid);
                              return (
                                  <label key={sid} className="flex items-center gap-2 p-2 hover:bg-white cursor-pointer transition-colors">
                                      <input 
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => {
                                            setBulkOvertimeModal(prev => {
                                                const next = new Set(prev.selectedStudentIds);
                                                if (next.has(sid)) next.delete(sid);
                                                else next.add(sid);
                                                return { ...prev, selectedStudentIds: next };
                                            });
                                        }}
                                        className="w-3.5 h-3.5 rounded text-orange-600 focus:ring-orange-500 border-gray-300"
                                      />
                                      <div className="text-xs">
                                          <div className="font-medium text-gray-900">{student.lastname}, {student.firstname}</div>
                                          <div className="text-[10px] text-gray-500">{student.course} • {student.section}</div>
                                      </div>
                                  </label>
                              );
                          })
                      )}
                   </div>
                   <p className="text-[10px] text-gray-400 text-right">
                      {bulkOvertimeModal.selectedStudentIds.size} student(s) selected
                   </p>
                </div>
              </div>

              <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
                <button 
                  onClick={() => setBulkOvertimeModal(prev => ({ ...prev, isOpen: false, mode: "create" }))}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={bulkOvertimeModal.mode === "edit" ? handleEditSaveOvertime : handleBulkSaveOvertime}
                  disabled={isSavingOt || bulkOvertimeModal.selectedStudentIds.size === 0 || !otInTime || (otHours === 0 && otMinutes === 0)}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-orange-600 rounded-lg hover:bg-orange-700 shadow-md shadow-orange-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSavingOt ? (
                     <>
                       <RefreshCw size={12} className="animate-spin" />
                       <span>Saving...</span>
                     </>
                  ) : (
                     <span>Authorize Overtime</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Modal */}
        {showSuccessModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
              <div className="h-14 w-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                <Check size={32} strokeWidth={3} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Success</h3>
              <p className="text-gray-600 mb-6">
                Overtime authorized successfully! The student can now time in.
              </p>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-green-200"
              >
                Okay, Got it
              </button>
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
                dateLabel: d.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: "short", day: "2-digit", year: "numeric" }),
                timeLabel: d.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: "2-digit", minute: "2-digit" }),
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
            dateLabel: d.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: "short", day: "2-digit", year: "numeric" }),
            timeLabel: d.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: "2-digit", minute: "2-digit" }),
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
                dateLabel: d.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: "short", day: "2-digit", year: "numeric" }),
                timeLabel: d.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: "2-digit", minute: "2-digit" }),
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
                dateLabel: d.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: "short", day: "2-digit", year: "numeric" }),
                timeLabel: d.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: "2-digit", minute: "2-digit" }),
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
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-col gap-4 mb-4">
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
export function ProfileView({ user, isLoading }: { user: User | null; isLoading?: boolean }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
          newPassword,
          role: "supervisor"
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500 animate-pulse">
        <svg className="w-8 h-8 mr-3 animate-spin text-[#F97316]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Loading profile...</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
      {/* Main Profile Section */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="h-40 bg-gradient-to-r from-orange-400 to-orange-600 relative">
             <div className="absolute inset-0 bg-black/10"></div>
          </div>
          <div className="px-6 pb-6 relative">
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
            
             <div className="border-t border-gray-100 pt-6 mt-6">
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
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white text-black font-medium px-4 py-2.5 text-sm pr-10 focus:border-[#F97316] focus:ring-4 focus:ring-orange-500/10 outline-none transition-all placeholder:text-gray-800 placeholder:opacity-95"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"
                    aria-label="Toggle password visibility"
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white text-black font-medium px-4 py-2.5 text-sm pr-10 focus:border-[#F97316] focus:ring-4 focus:ring-orange-500/10 outline-none transition-all placeholder:text-gray-800 placeholder:opacity-95"
                    placeholder="At least 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"
                    aria-label="Toggle password visibility"
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white text-black font-medium px-4 py-2.5 text-sm pr-10 focus:border-[#F97316] focus:ring-4 focus:ring-orange-500/10 outline-none transition-all placeholder:text-gray-800 placeholder:opacity-95"
                    placeholder="Re-enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"
                    aria-label="Toggle password visibility"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
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
