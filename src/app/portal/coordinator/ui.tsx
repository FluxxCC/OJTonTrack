"use client";
import React, { useState, useMemo, useEffect } from "react";
import { MultiSelect } from "@/app/portal/superadmin/ui";
import { Search, Users, Clock, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { calculateSessionDuration, buildSchedule, formatHours } from "@/lib/attendance";

export type RoleType = "student" | "instructor" | "supervisor" | "approval" | "assign" | "settings" | "academic-catalog" | "scheduling" | "profile";

export interface User {
  id: number;
  idnumber: string;
  role: string;
  name?: string;
  firstname?: string;
  lastname?: string;
  middlename?: string;
  course?: string;
  section?: string;
  password?: string;
  company?: string;
  location?: string;
  email?: string;
  courseIds?: number[];
  sectionIds?: number[];
  supervisorid?: string;
  signup_status?: string;
}

export interface Course {
  id: number;
  name: string;
}

export interface Section {
  id: number;
  name: string;
  course_id: number;
}

type ConfirmAction =
  | { type: "single" | "bulk"; id?: number; action: "approve" | "reject" }
  | null;

function formatCourseSection(courseStr?: string, sectionStr?: string): string {
  if (!courseStr) return "";
  if (!sectionStr) return courseStr;
  
  const courses = courseStr.split(",").map(s => s.trim());
  const sections = sectionStr.split(",").map(s => s.trim());
  
  if (courses.length > 0 && courses.length === sections.length) {
    return courses.map((c, i) => `${c}-${sections[i]}`).join(", ");
  }
  return `${courseStr} - ${sectionStr}`;
}

// --- Helper Components ---

export function Modal({ children, onClose, className }: { children: React.ReactNode; onClose: () => void; className?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm">
      <div className={`relative w-full max-h-[85vh] rounded-lg bg-white shadow-2xl overflow-y-auto animate-in fade-in zoom-in duration-200 ${className || "max-w-lg md:max-w-3xl"}`}>
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 z-10 p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        {children}
      </div>
    </div>
  );
};

function ConfirmationModal({ 
  message, 
  onConfirm, 
  onCancel,
  title = "Are you sure?",
  confirmLabel = "Yes, Continue",
  variant = "warning",
  noteLabel,
  noteRequired,
  noteValue,
  onNoteChange,
  isLoading
}: { 
  message: string; 
  onConfirm: () => void; 
  onCancel: () => void;
  title?: string;
  confirmLabel?: string;
  variant?: "warning" | "danger" | "success";
  noteLabel?: string;
  noteRequired?: boolean;
  noteValue?: string;
  onNoteChange?: (value: string) => void;
  isLoading?: boolean;
}) {
  const styles = {
    warning: {
      bg: "bg-orange-50",
      text: "text-orange-500",
      ring: "ring-orange-50/50",
      btn: "bg-[#F97316] hover:bg-[#ea6a12] shadow-orange-500/20",
    },
    danger: {
      bg: "bg-red-50",
      text: "text-red-500",
      ring: "ring-red-50/50",
      btn: "bg-red-600 hover:bg-red-700 shadow-red-500/20",
    },
    success: {
      bg: "bg-green-50",
      text: "text-green-500",
      ring: "ring-green-50/50",
      btn: "bg-green-600 hover:bg-green-700 shadow-green-500/20",
    },
  };

  const currentStyle = styles[variant] || styles.warning;

  const showNoteField = Boolean(noteLabel);
  const canConfirm = (!noteRequired || (noteValue && noteValue.trim().length > 0)) && !isLoading;

  return (
    <Modal onClose={isLoading ? () => {} : onCancel}>
      <div className="flex flex-col items-center justify-center p-4 text-center">
        <div className={`w-12 h-12 ${currentStyle.bg} ${currentStyle.text} rounded-full flex items-center justify-center mb-3 ring-4 ${currentStyle.ring}`}>
          {isLoading ? (
            <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          )}
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">{isLoading ? "Processing..." : title}</h3>
        <p className="text-gray-500 mb-4 max-w-sm mx-auto leading-relaxed text-xs">
          {isLoading ? "Please wait while we update the database and send notification emails. This may take a few seconds." : message}
        </p>
        {showNoteField && !isLoading && (
          <div className="w-full max-w-md mx-auto mb-4 text-left">
            <label className="block text-[10px] font-semibold text-gray-700 mb-1">
              {noteLabel}
              {noteRequired ? " *" : ""}
            </label>
            <textarea
              value={noteValue || ""}
              onChange={e => onNoteChange && onNoteChange(e.target.value)}
              className="w-full min-h-[60px] rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all resize-none"
              placeholder={noteRequired ? "Required. Explain the reason for rejection..." : "Optional note..."}
              disabled={isLoading}
            />
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="min-w-[80px] py-1.5 px-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`min-w-[80px] py-1.5 px-3 text-white font-bold rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-sm text-xs ${currentStyle.btn} ${!canConfirm ? "opacity-60 cursor-not-allowed hover:scale-100" : ""}`}
          >
            {isLoading ? (
               <span className="flex items-center gap-2">
                 <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg>
                 Processing
               </span>
            ) : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
 
export function CoordinatorProfileView() {
  const [loading, setLoading] = useState(false);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const idnumber = localStorage.getItem("idnumber") || "";
        if (!idnumber) {
          setMessage("Unable to load profile.");
          return;
        }
        const res = await fetch(`/api/users?idnumber=${encodeURIComponent(idnumber)}&role=coordinator`);
        const json = await res.json();
        if (Array.isArray(json.users) && json.users.length > 0) {
          setMyProfile(json.users[0]);
        } else {
          setMessage("Profile not found.");
        }
      } catch (e) {
        setMessage("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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
          newPassword,
          role: "coordinator"
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500 p-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden h-full">
          <div className="h-40 bg-gradient-to-r from-orange-400 to-orange-600 relative">
            <div className="absolute inset-0 bg-black/10"></div>
          </div>
          <div className="px-8 pb-8 relative">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 -mt-16 mb-6">
              <div className="h-32 w-32 rounded-2xl border-4 border-white bg-white shadow-md flex items-center justify-center text-4xl font-bold text-gray-800 shrink-0">
                {(myProfile?.firstname?.[0] || myProfile?.lastname?.[0] || "C").toUpperCase()}
              </div>
              <div className="text-center sm:text-left mb-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  {myProfile ? `${myProfile.firstname || ""} ${myProfile.middlename ? myProfile.middlename + " " : ""}${myProfile.lastname || ""}`.trim() : "Coordinator"}
                </h1>
                <p className="text-gray-500 font-medium">{myProfile?.idnumber || ""}</p>
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
                  <div className="text-gray-900 font-semibold capitalize">Coordinator</div>
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
                  {myProfile?.course ? (
                    formatCourseSection(myProfile.course, myProfile.section).split(", ").map((cls, idx) => (
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
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden sticky top-8">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F97316]"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              Security
            </h3>
            <p className="text-xs text-gray-500 mt-1">Manage your account password.</p>
          </div>
          <div className="p-6 space-y-4">
            {message && (
              <div className={`text-sm rounded-xl p-4 border ${message.includes("success") ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                <span>{message}</span>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white text-black placeholder:text-gray-700 placeholder:opacity-90 focus:border-[#F97316] focus:ring-4 focus:ring-orange-500/10 outline-none transition-all shadow-sm px-4 py-2.5 text-sm pr-10"
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
                <label className="block text-xs font-semibold text-gray-700 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white text-black placeholder:text-gray-700 placeholder:opacity-90 focus:border-[#F97316] focus:ring-4 focus:ring-orange-500/10 outline-none transition-all shadow-sm px-4 py-2.5 text-sm pr-10"
                    placeholder="Enter new password"
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
                <label className="block text-xs font-semibold text-gray-700 mb-1">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white text-black placeholder:text-gray-700 placeholder:opacity-90 focus:border-[#F97316] focus:ring-4 focus:ring-orange-500/10 outline-none transition-all shadow-sm px-4 py-2.5 text-sm pr-10"
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
            </div>
            <div>
              <button
                onClick={changePassword}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 bg-[#F97316] text-white px-4 py-2 rounded-xl hover:bg-[#EA580C] transition-colors font-semibold shadow-sm active:scale-95 text-sm disabled:opacity-50"
              >
                Save Password
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type ApprovalsViewProps = {
  users: User[];
  onView: (user: User) => void;
  onRefresh: () => void;
};

export function ApprovalsView({ users, onView, onRefresh }: ApprovalsViewProps) {
  type RequestItem = {
    id: number;
    full_name: string;
    email: string;
    school_id: string;
    course?: string;
    section?: string;
    status: "pending" | "approved" | "rejected";
  };
  const [requests, setRequests] = useState<RequestItem[]>([]);
  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await fetch("/api/student-approval-requests?limit=2000&status=pending");
        const json = await res.json();
        if (res.ok && Array.isArray(json.requests)) {
          setRequests(json.requests);
        } else {
          setRequests([]);
        }
      } catch {
        setRequests([]);
      }
    };
    fetchRequests();
  }, [onRefresh]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCourse, setFilterCourse] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterStatus, setFilterStatus] = useState("PENDING");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [actionLoading, setActionLoading] = useState(null as number | null);
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [rejectionNote, setRejectionNote] = useState("");

  const uniqueCourses = useMemo(() => {
    const courses = requests.map(s => s.course).filter(c => !!c) as string[];
    return Array.from(new Set(courses)).sort();
  }, [requests]);

  const uniqueSections = useMemo(() => {
    const subset = filterCourse ? requests.filter(s => s.course === filterCourse) : requests;
    const sections = subset.map(s => s.section).filter(s => !!s) as string[];
    return Array.from(new Set(sections)).sort();
  }, [requests, filterCourse]);

  const filteredStudents = useMemo(() => {
    const normalize = (s: string) => s.toLowerCase().trim();
    return requests
      .filter(s => {
        const search = normalize(searchTerm);
        const name = normalize(s.full_name || "");
        const id = normalize(s.school_id || "");
        const matchesSearch = !search || name.includes(search) || id.includes(search);

        const matchesCourse = !filterCourse || s.course === filterCourse;
        const matchesSection = !filterSection || s.section === filterSection;

        const status = String(s.status || "pending").toUpperCase();
        const matchesStatus =
          filterStatus === "ALL" ? true : status === filterStatus;

        return matchesSearch && matchesCourse && matchesSection && matchesStatus;
      })
      .sort((a, b) => {
        const lnameA = (a.full_name || "").trim().split(" ").slice(-1)[0] || "";
        const lnameB = (b.full_name || "").trim().split(" ").slice(-1)[0] || "";
        const fnameA = (a.full_name || "").trim().split(" ")[0] || "";
        const fnameB = (b.full_name || "").trim().split(" ")[0] || "";
        return (
          lnameA.localeCompare(lnameB, undefined, { sensitivity: "base" }) ||
          fnameA.localeCompare(fnameB, undefined, { sensitivity: "base" }) ||
          (a.school_id || "").localeCompare(b.school_id || "", undefined, { sensitivity: "base" })
        );
      });
  }, [requests, searchTerm, filterCourse, filterSection, filterStatus]);

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const pendingStudents = filteredStudents.filter(s => String(s.status).toUpperCase() === "PENDING");
    if (pendingStudents.length === 0) {
      setSelectedIds(new Set());
      return;
    }
    const allSelected =
      selectedIds.size === pendingStudents.length && pendingStudents.length > 0;
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingStudents.map(s => s.id)));
    }
  };

  const performAction = async (ids: number[], action: "approve" | "reject", note?: string) => {
    try {
      const actorId =
        typeof window !== "undefined"
          ? localStorage.getItem("idnumber") || "SYSTEM"
          : "SYSTEM";

      if (ids.length === 1) setActionLoading(ids[0]);
      else setIsBulkApproving(true);

      await Promise.all(
        ids.map(id =>
          fetch(`/api/student-approval-requests/${id}/${action}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              actorId,
              actorRole: "coordinator",
              actorName: `${localStorage.getItem("firstname") || ""} ${localStorage.getItem("lastname") || ""}`.trim(),
              note: action === "reject" ? note || "" : undefined,
            }),
          }).then(async res => {
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error || `Failed to ${action} request ${id}`);
            }
            return res;
          })
        )
      );

      try {
        const res = await fetch("/api/student-approval-requests?limit=2000&status=pending");
        const json = await res.json();
        if (res.ok && Array.isArray(json.requests)) {
          setRequests(json.requests);
        }
      } catch {}
      setSelectedIds(new Set());
    } catch (e: any) {
      alert(e.message || `Failed to ${action} one or more students`);
    } finally {
      setActionLoading(null);
      setIsBulkApproving(false);
      setConfirmAction(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden pt-4">
      <div className="px-3 py-2 border-b border-gray-100 flex flex-wrap items-center gap-2 bg-white">
        <h2 className="text-sm font-bold text-gray-900 whitespace-nowrap mr-auto">Account Approvals</h2>

        <div className="relative w-full sm:w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-all"
            />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <select
            value={filterCourse}
            onChange={e => {
              setFilterCourse(e.target.value);
              setFilterSection("");
            }}
            className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] text-gray-700 min-w-[80px]"
          >
            <option value="">Course</option>
            {uniqueCourses.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={filterSection}
            onChange={e => setFilterSection(e.target.value)}
            className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] text-gray-700 min-w-[60px]"
          >
            <option value="">Section</option>
            {uniqueSections.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] text-gray-700 min-w-[80px]"
          >
            <option value="ALL">Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        {selectedIds.size > 0 && (
            <div className="flex items-center gap-1.5 animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setConfirmAction({ type: "bulk", action: "approve" })}
                disabled={isBulkApproving}
                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {isBulkApproving ? "..." : `Approve (${selectedIds.size})`}
              </button>
              <button
                onClick={() => setConfirmAction({ type: "bulk", action: "reject" })}
                disabled={isBulkApproving}
                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {isBulkApproving ? "..." : `Reject (${selectedIds.size})`}
              </button>
            </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-white custom-scrollbar">
        <div className="h-full">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-1.5 w-8">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 w-3.5 h-3.5"
                      onChange={toggleAll}
                      checked={
                        filteredStudents.some(s => String(s.status).toUpperCase() === "PENDING") &&
                        selectedIds.size ===
                          filteredStudents.filter(s => String(s.status).toUpperCase() === "PENDING").length &&
                        filteredStudents.filter(s => String(s.status).toUpperCase() === "PENDING").length > 0
                      }
                    />
                  </th>
                  <th className="px-3 py-1.5">Student</th>
                  <th className="px-3 py-1.5">ID Number</th>
                  <th className="px-3 py-1.5">Email</th>
                  <th className="px-3 py-1.5">Course & Section</th>
                  <th className="px-3 py-1.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                      No students found
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map(s => {
                    const isPending = String(s.status).toUpperCase() === "PENDING";
                    const isSelected = selectedIds.has(s.id);
                    return (
                      <tr
                        key={s.id}
                        className={`hover:bg-gray-50/50 ${isSelected ? "bg-orange-50/30" : ""}`}
                      >
                        <td className="px-3 py-1">
                          {isPending && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelection(s.id)}
                              className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 w-3.5 h-3.5"
                            />
                          )}
                        </td>
                        <td className="px-3 py-1 font-medium text-gray-900">
                          <button
                            type="button"
                            onClick={() => onView({
                              id: s.id,
                              idnumber: s.school_id,
                              role: "student",
                              firstname: s.full_name.split(" ")[0],
                              lastname: s.full_name.split(" ").slice(-1)[0],
                              email: s.email,
                              course: s.course,
                              section: s.section,
                              signup_status: "PENDING",
                            })}
                            className="hover:text-orange-600 hover:underline text-left font-semibold"
                          >
                            {s.full_name.trim().split(" ").slice(-1)[0] || ""}{", "}{s.full_name.trim().split(" ")[0] || ""}
                          </button>
                        </td>
                        <td className="px-3 py-1 text-gray-600">{s.school_id}</td>
                        <td className="px-3 py-1 text-gray-600">{s.email ? s.email : "-"}</td>
                        <td className="px-3 py-1 text-gray-600">
                          {formatCourseSection(s.course, s.section)}
                        </td>
                        <td className="px-3 py-1">
                          {isPending && (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() =>
                                  setConfirmAction({
                                    type: "single",
                                    id: s.id,
                                    action: "approve",
                                  })
                                }
                                disabled={actionLoading === s.id}
                                className="px-2 py-0.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition-colors disabled:opacity-50"
                              >
                                {actionLoading === s.id ? "..." : "Approve"}
                              </button>
                              <button
                                onClick={() =>
                                  setConfirmAction({
                                    type: "single",
                                    id: s.id,
                                    action: "reject",
                                  })
                                }
                                disabled={actionLoading === s.id}
                                className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition-colors disabled:opacity-50"
                              >
                                {actionLoading === s.id ? "..." : "Reject"}
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

          <div className="md:hidden">
            {filteredStudents.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                No students found
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredStudents.map(s => {
                  const isPending = String(s.status).toUpperCase() === "PENDING";
                  const isSelected = selectedIds.has(s.id);
                  return (
                    <div
                      key={s.id}
                      className={`p-3 ${isSelected ? "bg-orange-50/30" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <button
                            onClick={() => onView({
                              id: s.id,
                              idnumber: s.school_id,
                              role: "student",
                              firstname: s.full_name.split(" ")[0],
                              lastname: s.full_name.split(" ").slice(-1)[0],
                              email: s.email,
                              course: s.course,
                              section: s.section,
                              signup_status: "PENDING",
                            })}
                            className="text-sm font-bold text-gray-900 hover:text-orange-600 hover:underline text-left"
                          >
                            {s.full_name.trim().split(" ").slice(-1)[0] || ""}{", "}{s.full_name.trim().split(" ")[0] || ""}
                          </button>
                          <div className="text-xs text-gray-600 mt-0.5">
                            {s.school_id}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {formatCourseSection(s.course, s.section)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
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
                            onClick={() =>
                              setConfirmAction({
                                type: "single",
                                id: s.id,
                                action: "approve",
                              })
                            }
                            disabled={actionLoading === s.id}
                            className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
                          >
                            {actionLoading === s.id ? "..." : "Approve"}
                          </button>
                          <button
                            onClick={() =>
                              setConfirmAction({
                                type: "single",
                                id: s.id,
                                action: "reject",
                              })
                            }
                            disabled={actionLoading === s.id}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
                          >
                            {actionLoading === s.id ? "..." : "Reject"}
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

        {confirmAction && (
          <ConfirmationModal
            title={
              confirmAction.action === "approve"
                ? "Approve Student Account(s)?"
                : "Reject Student Account(s)?"
            }
            message={
              confirmAction.type === "bulk"
                ? `Are you sure you want to ${confirmAction.action} ${selectedIds.size} selected student(s)?`
                : `Are you sure you want to ${confirmAction.action} this student account?`
            }
            confirmLabel={`Yes, ${
              confirmAction.action === "approve" ? "Approve" : "Reject"
            }`}
            variant={confirmAction.action === "approve" ? "warning" : "danger"}
            noteLabel={confirmAction.action === "reject" ? "Rejection note" : undefined}
            noteRequired={confirmAction.action === "reject"}
            noteValue={confirmAction.action === "reject" ? rejectionNote : ""}
            onNoteChange={value => {
              if (confirmAction.action === "reject") {
                setRejectionNote(value);
              }
            }}
            onConfirm={() => {
              if (
                confirmAction.action === "reject" &&
                (!rejectionNote || !rejectionNote.trim())
              ) {
                return;
              }
              if (confirmAction.type === "bulk") {
                performAction(Array.from(selectedIds), confirmAction.action, rejectionNote);
              } else if (confirmAction.id) {
                performAction([confirmAction.id], confirmAction.action, rejectionNote);
              }
              if (confirmAction.action === "reject") {
                setRejectionNote("");
              }
            }}
            onCancel={() => {
              setConfirmAction(null);
              setRejectionNote("");
            }}
            isLoading={actionLoading !== null || isBulkApproving}
          />
        )}
      </div>
    </div>
  );
}

 

// --- Forms ---

export function AddUserForm({ role, onSuccess, onClose, availableCourses, availableSections, users }: { 
  role: RoleType; 
  onSuccess: () => void; 
  onClose: () => void;
  availableCourses: Course[];
  availableSections: Section[];
  users: User[];
}) {
  const [form, setForm] = useState<{
    idnumber: string;
    password: string;
    firstname: string;
    lastname: string;
    course: string;
    section: string;
    courseIds: number[];
    sectionIds: number[];
    supervisorid: string;
    company: string;
    location: string;
    email: string;
  }>({
    idnumber: "",
    password: "",
    firstname: "",
    lastname: "",
    course: "",
    section: "",
    courseIds: [],
    sectionIds: [],
    supervisorid: "",
    company: "",
    location: "",
    email: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [assignmentConflict, setAssignmentConflict] = useState<string | null>(null);
  const title = role.charAt(0).toUpperCase() + role.slice(1);
  const [showSupervisorModal, setShowSupervisorModal] = useState(false);
  const [supervisorSearch, setSupervisorSearch] = useState("");

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
    if (role === "instructor" && form.sectionIds.length > 0) {
      const instructors = users.filter(u => String(u.role).toLowerCase() === "instructor");
      const conflicts: string[] = [];
      const seen = new Set<string>();

      form.sectionIds.forEach(secId => {
        const sectionObj = availableSections.find(s => s.id === secId);
        if (!sectionObj) return;
        const courseObj = availableCourses.find(c => c.id === sectionObj.course_id);
        const sectionLabel = `${courseObj?.name || "Course"} ${sectionObj.name}`;

        const conflictInst = instructors.find(inst => {
          const instSectionIds = Array.isArray(inst.sectionIds) ? inst.sectionIds : [];
          if (instSectionIds.includes(secId)) return true;

          const instCourse = inst.course;
          const instSection = inst.section;
          if (!instCourse || !instSection || !courseObj) return false;

          const courseParts = String(instCourse).split(",").map(s => s.trim());
          const sectionParts = String(instSection).split(",").map(s => s.trim());
          const len = Math.max(courseParts.length, sectionParts.length);
          for (let i = 0; i < len; i++) {
            if (courseParts[i] === courseObj.name && sectionParts[i] === sectionObj.name) {
              return true;
            }
          }
          return false;
        });

        if (conflictInst) {
          const instructorLabel = `${(conflictInst.firstname || "")} ${(conflictInst.lastname || "")}`.trim() || conflictInst.name || conflictInst.idnumber;
          const key = `${sectionObj.id}-${conflictInst.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            conflicts.push(`${sectionLabel} (Instructor: ${instructorLabel})`);
          }
        }
      });

      if (conflicts.length > 0) {
        setAssignmentConflict(`An instructor is already assigned in ${conflicts.join(", ")}`);
        return;
      }
    }

    if (!form.idnumber || !form.password || !form.email) {
      setMessage("ID Number, Password, and Email are required");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = {
        role,
        idnumber: form.idnumber.trim(),
        password: form.password,
        firstname: form.firstname || undefined,
        lastname: form.lastname || undefined,
        email: form.email || undefined,
        course: form.course || undefined,
        section: form.section || undefined,
        courseIds: form.courseIds.length > 0 ? form.courseIds : undefined,
        sectionIds: form.sectionIds.length > 0 ? form.sectionIds : undefined,
        supervisorid: form.supervisorid || undefined,
        company: form.company || undefined,
        location: form.location || undefined,
        signup_status: role === "student" ? "APPROVED" : undefined,
      };
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to add user");
      onSuccess();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add user";
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-base font-bold text-gray-900 mb-3">Add New {title}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="grid gap-1">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">ID Number</span>
          <input
            value={form.idnumber}
            onChange={(e) => setForm({ ...form, idnumber: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="e.g. 2021-00001"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Password</span>
          <input
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="Temporary password"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">First Name</span>
          <input
            value={form.firstname}
            onChange={(e) => setForm({ ...form, firstname: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="First name"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Last Name</span>
          <input
            value={form.lastname}
            onChange={(e) => setForm({ ...form, lastname: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="Last name"
          />
        </label>
        <label className="grid gap-1 md:col-span-2">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Email</span>
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="Email address"
          />
        </label>
        {role === "student" && (
          <>
            <label className="grid gap-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Course</span>
              <select
                value={form.courseIds[0] || ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  const course = availableCourses.find(c => c.id === id);
                  setForm({
                    ...form,
                    courseIds: id ? [id] : [],
                    course: course?.name || ""
                  });
                }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all bg-white"
              >
                <option value="">Select course</option>
                {availableCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Section</span>
              <select
                value={form.sectionIds[0] || ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  const section = availableSections.find(s => s.id === id);
                  setForm({
                    ...form,
                    sectionIds: id ? [id] : [],
                    section: section?.name || ""
                  });
                }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all bg-white"
              >
                <option value="">{form.courseIds.length === 0 ? "Select course first" : "Select section"}</option>
                {availableSections
                  .filter(s => form.courseIds.length > 0 && form.courseIds.includes(s.course_id))
                  .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          </>
        )}
        {role === "instructor" && (
          <label className="grid gap-1">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Course & Section</span>
            <MultiSelect
              options={combinedCourseSections}
              value={form.sectionIds}
              onChange={(sectionIds) => {
                const selectedSections = combinedCourseSections.filter(opt => sectionIds.includes(opt.id));
                const courseIds = Array.from(new Set(selectedSections.map(opt => opt.courseId)));
                setForm({ ...form, sectionIds, courseIds });
              }}
              placeholder="Select course & section"
            />
          </label>
        )}
        {role === "supervisor" && (
          <>
            <label className="grid gap-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Company</span>
              <input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
                placeholder="Company name"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Location</span>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
                placeholder="Location"
              />
            </label>
          </>
        )}
        
      </div>

      <div className="mt-5 flex flex-col gap-2">
        {message && <div className="text-xs text-red-500 bg-red-50 p-2.5 rounded-lg border border-red-100">{message}</div>}
        <button
          onClick={submit}
          disabled={loading}
          className="w-full rounded-lg bg-[#F97316] py-2 text-white text-xs font-bold hover:bg-[#EA580C] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-orange-200"
        >
          {loading ? "Adding..." : "Add User"}
        </button>
      </div>

      {assignmentConflict && (
        <Modal onClose={() => setAssignmentConflict(null)}>
          <div className="p-6 sm:p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Instructor already assigned</h3>
            <p className="text-sm text-gray-600 mb-4">
              {assignmentConflict}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setAssignmentConflict(null)}
                className="px-4 py-2.5 rounded-xl bg-[#F97316] text-white text-sm font-bold hover:bg-[#EA580C] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export function EditUserForm({ user, onSuccess, onClose, availableCourses, availableSections, users }: { user: User; onSuccess: () => void; onClose: () => void; availableCourses: Course[]; availableSections: Section[]; users: User[] }) {
  const [form, setForm] = useState({
    idnumber: user.idnumber || "",
    firstname: user.firstname || "",
    lastname: user.lastname || "",
    course: user.course || "",
    section: user.section || "",
    company: user.company || "",
    location: user.location || "",
    password: "",
    courseIds: Array.isArray(user.courseIds) ? user.courseIds : [],
    sectionIds: Array.isArray(user.sectionIds) ? user.sectionIds : [],
    supervisorid: user.supervisorid || "",
    email: user.email || "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [assignmentConflict, setAssignmentConflict] = useState<string | null>(null);
  const [showSupervisorModal, setShowSupervisorModal] = useState(false);
  const [supervisorSearch, setSupervisorSearch] = useState("");
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
    if (user.role === "instructor" && form.sectionIds.length > 0) {
      const instructors = users.filter(u => String(u.role).toLowerCase() === "instructor" && u.id !== user.id);
      const conflicts: string[] = [];
      const seen = new Set<string>();

      form.sectionIds.forEach(secId => {
        const sectionObj = availableSections.find(s => s.id === secId);
        if (!sectionObj) return;
        const courseObj = availableCourses.find(c => c.id === sectionObj.course_id);
        const sectionLabel = `${courseObj?.name || "Course"} ${sectionObj.name}`;

        const conflictInst = instructors.find(inst => {
          const instSectionIds = Array.isArray(inst.sectionIds) ? inst.sectionIds : [];
          if (instSectionIds.includes(secId)) return true;

          const instCourse = inst.course;
          const instSection = inst.section;
          if (!instCourse || !instSection || !courseObj) return false;

          const courseParts = String(instCourse).split(",").map(s => s.trim());
          const sectionParts = String(instSection).split(",").map(s => s.trim());
          const len = Math.max(courseParts.length, sectionParts.length);
          for (let i = 0; i < len; i++) {
            if (courseParts[i] === courseObj.name && sectionParts[i] === sectionObj.name) {
              return true;
            }
          }
          return false;
        });

        if (conflictInst) {
          const instructorLabel = `${(conflictInst.firstname || "")} ${(conflictInst.lastname || "")}`.trim() || conflictInst.name || conflictInst.idnumber;
          const key = `${sectionObj.id}-${conflictInst.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            conflicts.push(`${sectionLabel} (Instructor: ${instructorLabel})`);
          }
        }
      });

      if (conflicts.length > 0) {
        setAssignmentConflict(`An instructor is already assigned in ${conflicts.join(", ")}`);
        return;
      }
    }

    setLoading(true);
    setMessage(null);
    try {
      let actorId = "SYSTEM";
      try {
        actorId = localStorage.getItem("idnumber") || "SYSTEM";
      } catch {}

      const payload: Record<string, unknown> = {
        idnumber: form.idnumber.trim(),
        firstname: form.firstname || undefined,
        lastname: form.lastname || undefined,
        email: form.email || undefined,
        // For students, we must send IDs for course/section, not names
        course: (() => {
          if (user.role === 'student') {
            const c = availableCourses.find(c => c.name === form.course);
            return c ? c.id : form.course;
          }
          return form.course || undefined;
        })(),
        section: (() => {
           if (user.role === 'student') {
             const c = availableCourses.find(c => c.name === form.course);
             const s = availableSections.find(s => s.name === form.section && (c ? s.course_id === c.id : true));
             return s ? s.id : form.section;
           }
           return form.section || undefined;
        })(),
        company: form.company || undefined,
        location: form.location || undefined,
        actorId,
        actorRole: "coordinator",
        reason: form.password ? "Coordinator changed password" : "Coordinator updated user",
      };
      if (form.password) payload.password = form.password;
      if (form.courseIds && form.courseIds.length > 0) payload.courseIds = form.courseIds;
      if (form.sectionIds && form.sectionIds.length > 0) payload.sectionIds = form.sectionIds;
      if (form.supervisorid) payload.supervisorid = form.supervisorid;

      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update user");
      onSuccess();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update user";
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-base font-bold text-[#1F2937] mb-3">Edit User</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <label className="grid gap-1">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">ID Number</span>
          <input
            value={form.idnumber}
            onChange={(e) => setForm({ ...form, idnumber: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="e.g. 2021-00001"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">New Password (Optional)</span>
          <input
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="Leave blank to keep current"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">First Name</span>
          <input
            value={form.firstname}
            onChange={(e) => setForm({ ...form, firstname: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="First name"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Last Name</span>
          <input
            value={form.lastname}
            onChange={(e) => setForm({ ...form, lastname: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="Last name"
          />
        </label>
        <label className="grid gap-1 md:col-span-2">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Email</span>
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="Email address"
          />
        </label>
        {user.role === "student" && (
          <>
            <label className="grid gap-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Course</span>
              <div className="relative">
                <select
                  value={form.course}
                  onChange={(e) => {
                    const newCourse = e.target.value;
                    setForm({ ...form, course: newCourse, section: "" });
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all appearance-none bg-white"
                >
                  <option value="">Select Course</option>
                  {availableCourses.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
            </label>
            <label className="grid gap-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Section</span>
              <div className="relative">
                <select
                  value={form.section}
                  onChange={(e) => setForm({ ...form, section: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all appearance-none bg-white"
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
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
            </label>
            <label className="grid gap-1 md:col-span-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Supervisor</span>
              {form.supervisorid ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 bg-white">
                      <span className="block truncate">
                        {(() => {
                          const sup = users.find(u => u.idnumber === form.supervisorid);
                          const name = sup ? ((sup.firstname || "") + " " + (sup.lastname || "")).trim() || sup.name || sup.idnumber : form.supervisorid;
                          return `Selected: ${name}`;
                        })()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setForm({ ...form, supervisorid: "" })}
                    className="shrink-0 text-[10px] font-bold text-red-600 hover:text-red-700 uppercase tracking-wide"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowSupervisorModal(true)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all bg-white text-left"
                >
                  Choose supervisor
                </button>
              )}
            </label>
          </>
        )}
        {user.role === "instructor" && (
          <label className="grid gap-1 md:col-span-2">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Course & Section</span>
            <MultiSelect
              options={combinedCourseSections}
              value={form.sectionIds}
              onChange={(sectionIds) => {
                const selectedSections = combinedCourseSections.filter(opt => sectionIds.includes(opt.id));
                const courseIds = Array.from(new Set(selectedSections.map(opt => opt.courseId)));
                setForm({ ...form, sectionIds, courseIds });
              }}
              placeholder="Select course & section"
            />
          </label>
        )}
        {user.role === "supervisor" && (
          <>
            <label className="grid gap-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Company</span>
              <input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
                placeholder="Company name"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Location</span>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
                placeholder="Location"
              />
            </label>
          </>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {message && <div className="text-xs text-red-500 bg-red-50 p-3 rounded-lg border border-red-100">{message}</div>}
        <button
          onClick={submit}
          disabled={loading}
          className="w-full rounded-lg bg-[#F97316] py-2 text-xs font-bold hover:bg-[#EA580C] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg text-white"
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {assignmentConflict && (
        <Modal onClose={() => setAssignmentConflict(null)}>
          <div className="p-5 sm:p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Instructor already assigned</h3>
            <p className="text-xs text-gray-600 mb-4">
              {assignmentConflict}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setAssignmentConflict(null)}
                className="px-3 py-2 rounded-lg bg-[#F97316] text-white text-xs font-bold hover:bg-[#EA580C] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showSupervisorModal && (
        <Modal onClose={() => setShowSupervisorModal(false)}>
          <div className="p-4">
            <div className="mb-3 relative">
              <h3 className="text-base font-bold text-gray-900">Select Supervisor</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">Search and assign an eligible supervisor</p>
              <div className="relative mt-2">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input
                  value={supervisorSearch}
                  onChange={(e) => setSupervisorSearch(e.target.value)}
                  placeholder="Search by name, ID, or company"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] text-gray-900 transition-all shadow-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
              {users
                .filter(u => {
                  if (String(u.role).toLowerCase() !== "supervisor") return false;
                  
                  // If student has no course/section set, show all supervisors
                  if (!form.course && !form.section && (!form.courseIds.length || !form.sectionIds.length)) return true;

                  const studentCourseId = form.courseIds[0] || availableCourses.find(c => c.name === form.course)?.id;
                  const studentSectionId = form.sectionIds[0] || availableSections.find(s => {
                    const c = availableCourses.find(cc => cc.name === form.course);
                    return c && s.course_id === c.id && s.name === form.section;
                  })?.id;

                  // If we can't resolve IDs but have names, try name matching or default to true to avoid blocking
                  if (!studentCourseId || !studentSectionId) return true;

                  const hasCourseId = u.courseIds && u.courseIds.includes(studentCourseId);
                  const hasSectionId = u.sectionIds && u.sectionIds.includes(studentSectionId);
                  
                  if (hasCourseId && hasSectionId) return true;

                  // Legacy string matching fallback
                  const courseObj = availableCourses.find(c => c.id === studentCourseId);
                  const sectionObj = availableSections.find(s => s.id === studentSectionId);
                  const hasCourseName = courseObj && u.course && u.course.includes(courseObj.name);
                  const hasSectionName = sectionObj && u.section && u.section.includes(sectionObj.name);

                  return hasCourseName && hasSectionName;
                })
                .filter(u => {
                  const s = supervisorSearch.trim().toLowerCase();
                  if (!s) return true;
                  const name = ((u.firstname || "") + " " + (u.lastname || "")).toLowerCase();
                  const company = (u.company || "").toLowerCase();
                  return u.idnumber.toLowerCase().includes(s) || name.includes(s) || company.includes(s);
                })
                .map(u => (
                  <div key={u.id} className="flex items-center justify-between p-2 rounded-lg border border-gray-200 bg-white hover:border-orange-200 hover:shadow-sm transition-all">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-orange-50 text-[#F97316] border border-orange-100 flex items-center justify-center font-bold text-xs">
                        {(u.firstname?.[0] || u.idnumber[0]).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 truncate text-xs">
                          {((u.firstname || "") + " " + (u.lastname || "")).trim() || u.name || u.idnumber}
                        </div>
                        <div className="text-[10px] text-gray-500 truncate">
                          {u.company || "N/A"}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setForm({ ...form, supervisorid: u.idnumber });
                        setShowSupervisorModal(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#F97316] text-white text-[10px] font-bold hover:bg-[#EA580C]"
                    >
                      Select
                    </button>
                  </div>
                ))}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setShowSupervisorModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function ViewUserDetails({ user, users, onClose }: { user: User; users: User[]; onClose: () => void; }) {
  const supervisor = useMemo(() => {
    if (!user.supervisorid) return null;
    return users.find(u => u.role === "supervisor" && u.idnumber === user.supervisorid) || null;
  }, [users, user.supervisorid]);

  const [attendanceStats, setAttendanceStats] = useState<{total: number, validated: number} | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string>(user.course || "");
  const [selectedSection, setSelectedSection] = useState<string>(user.section || "");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [allStudents, setAllStudents] = useState<User[]>([]);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [availableSections, setAvailableSections] = useState<Section[]>([]);
  const courseOptions = useMemo(() => {
    return availableCourses
      .map((c) => (c.name || "").replace(/\s+/g, " ").trim())
      .filter((n) => !!n)
      .sort((a, b) => a.localeCompare(b));
  }, [availableCourses]);
  const sectionOptions = useMemo(() => {
    const norm = (x?: string) => (x || "").replace(/\s+/g, " ").trim();
    const map = new Map<string, string>();
    let catalogSections = availableSections;
    if (selectedCourse) {
      const courseObj = availableCourses.find((c) => norm(c.name) === norm(selectedCourse));
      catalogSections = catalogSections.filter((s) => {
        return courseObj ? Number(s.course_id) === Number(courseObj.id) : false;
      });
    }
    catalogSections.forEach((s) => {
      const name = norm(s.name);
      if (!name) return;
      const key = name.toLowerCase();
      if (!map.has(key)) map.set(key, name);
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [availableSections, availableCourses, selectedCourse]);
  useEffect(() => {
    setSelectedSection("");
  }, [selectedCourse]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const metaRes = await fetch("/api/metadata");
        const meta = await metaRes.json();
        if (!cancelled) {
          if (meta.courses) setAvailableCourses(meta.courses);
          if (meta.sections) setAvailableSections(meta.sections);
        }
        const res = await fetch("/api/users?role=student&limit=2000&approvedOnly=true");
        const json = await res.json();
        if (!cancelled && Array.isArray(json.users)) {
          setAllStudents(json.users);
        }
      } catch {
        if (!cancelled) setAllStudents([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (user.role !== 'student') return;

    const fetchStats = async () => {
      if (!supabase) return;
      
      let query = supabase.from('attendance').select('*').eq('idnumber', user.idnumber);
      
      const [{ data: logs }, { data: otShifts }, { data: shiftsData }] = await Promise.all([
        query,
        supabase.from('overtime_shifts').select('*').eq('student_id', user.idnumber),
        supabase.from('shifts').select('*')
      ]);

      if (!logs) return;

      // Default config
      let config = {
          amIn: "08:00", amOut: "12:00",
          pmIn: "13:00", pmOut: "17:00",
          otIn: "17:00", otOut: "18:00"
      };

      if (shiftsData) {
          const am = shiftsData.find((s: any) => s.shift_name === 'Morning Shift');
          const pm = shiftsData.find((s: any) => s.shift_name === 'Afternoon Shift');
          const ot = shiftsData.find((s: any) => s.shift_name === 'Overtime Shift');
          
          if (am) { config.amIn = am.official_start?.slice(0, 5) || "08:00"; config.amOut = am.official_end?.slice(0, 5) || "12:00"; }
          if (pm) { config.pmIn = pm.official_start?.slice(0, 5) || "13:00"; config.pmOut = pm.official_end?.slice(0, 5) || "17:00"; }
          if (ot) { config.otIn = ot.official_start?.slice(0, 5) || "17:00"; config.otOut = ot.official_end?.slice(0, 5) || "18:00"; }
      }

      const grouped = new Map<string, any[]>();
      logs.forEach(log => {
        const d = new Date(log.timestamp);
        const key = d.toDateString();
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(log);
      });

      let total = 0;
      let validated = 0;

      grouped.forEach((dayLogs) => {
        const dayDate = new Date(dayLogs[0].timestamp);
        const dateStr = dayDate.getFullYear() + "-" + 
                       String(dayDate.getMonth() + 1).padStart(2, '0') + "-" + 
                       String(dayDate.getDate()).padStart(2, '0');
        
        const dynamicOt = otShifts?.find((s: any) => s.effective_date === dateStr); // Note: effective_date in DB is usually YYYY-MM-DD
        
        const schedule = buildSchedule(dayDate, config, dynamicOt ? { start: Number(dynamicOt.overtime_start), end: Number(dynamicOt.overtime_end) } : undefined);

        const sessions: {in: any, out: any}[] = [];
        let currentIn: any = null;
        dayLogs.sort((a, b) => a.timestamp - b.timestamp).forEach(log => {
            if (log.type === 'in') currentIn = log;
            else if (log.type === 'out' && currentIn) {
                sessions.push({in: currentIn, out: log});
                currentIn = null;
            }
        });

        sessions.forEach(s => {
            const am = calculateSessionDuration(s.in.timestamp, s.out.timestamp, 'am', schedule);
            const pm = calculateSessionDuration(s.in.timestamp, s.out.timestamp, 'pm', schedule);
            const ot = calculateSessionDuration(s.in.timestamp, s.out.timestamp, 'ot', schedule);
            
            const sessionTotal = am + pm + ot;
            total += sessionTotal;

            const isVal = (s.in.status === 'Approved' || s.in.status === 'Validated' || s.in.validated_by) &&
                          (s.out.status === 'Approved' || s.out.status === 'Validated' || s.out.validated_by);
            
            if (isVal) validated += sessionTotal;
        });
      });

      setAttendanceStats({ total, validated });
    };

    fetchStats();
  }, [user]);


  
  return (
    <div className="p-4 sm:p-5">
      <h2 className="text-lg font-bold text-[#1F2937] mb-4">User Details</h2>
      
      {user.role === "student" && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-4">
          <div className="flex flex-wrap items-center gap-2 px-2 py-2 border-b border-gray-100 bg-gray-50">
            <div className="text-[10px] font-bold text-gray-800">Account Monitoring</div>
            <div className="flex gap-2 flex-1">
              <select 
                value={selectedCourse}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedCourse(val);
                  if (!val) setSelectedSection("");
                }}
                className="flex-1 min-w-0 px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] shadow-sm"
              >
                <option value="">All Courses</option>
                {courseOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select 
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                disabled={!selectedCourse}
                className="flex-1 min-w-0 px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] shadow-sm disabled:opacity-50"
              >
                <option value="">{!selectedCourse ? "Select course first" : "All Sections"}</option>
                {sectionOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] text-gray-700 min-w-[80px]"
              >
                <option value="ALL">Status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <div className="h-10 w-10 rounded-full bg-white text-[#F97316] border border-orange-100 flex items-center justify-center font-bold text-lg shadow-sm">
            {(user.firstname?.[0] || user.idnumber[0]).toUpperCase()}
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">{user.firstname} {user.lastname}</h3>
            <p className="text-[10px] text-gray-500 capitalize font-medium">{user.role}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="p-2.5 bg-white border border-gray-100 rounded-lg shadow-sm">
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-0.5">ID Number</p>
            <p className="text-xs font-semibold text-gray-900">{user.idnumber}</p>
          </div>
          <div className="p-2.5 bg-white border border-gray-100 rounded-lg shadow-sm">
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-0.5">Full Name</p>
            <p className="text-xs font-semibold text-gray-900">{user.firstname} {user.middlename ? user.middlename + " " : ""}{user.lastname}</p>
          </div>
          <div className="p-2.5 bg-white border border-gray-100 rounded-lg shadow-sm">
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-0.5">Email</p>
            <p className="text-xs font-semibold text-gray-900">{user.email || "N/A"}</p>
          </div>

          {user.role === "student" && (
            <>
              <div className="p-2.5 bg-white border border-gray-100 rounded-lg shadow-sm">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-0.5">Course</p>
                <p className="text-xs font-semibold text-gray-900">{user.course || "N/A"}</p>
              </div>
              <div className="p-2.5 bg-white border border-gray-100 rounded-lg shadow-sm">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-0.5">Section</p>
                <p className="text-xs font-semibold text-gray-900">{user.section || "N/A"}</p>
              </div>
              <div className="p-2.5 bg-white border border-gray-100 rounded-lg shadow-sm">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-0.5">Supervisor</p>
                <p className="text-xs font-semibold text-gray-900">
                  {supervisor ? (supervisor.firstname || supervisor.lastname ? `${supervisor.firstname || ""} ${supervisor.lastname || ""}`.trim() : supervisor.name || supervisor.idnumber) : (user.supervisorid || "N/A")}
                </p>
              </div>
              <div className="p-2.5 bg-white border border-gray-100 rounded-lg shadow-sm">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-0.5">Supervisor Company</p>
                <p className="text-xs font-semibold text-gray-900">{supervisor?.company || "N/A"}</p>
              </div>
              <div className="p-2.5 bg-white border border-gray-100 rounded-lg shadow-sm">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-0.5">Supervisor Location</p>
                <p className="text-xs font-semibold text-gray-900">{supervisor?.location || "N/A"}</p>
              </div>
            </>
          )}
          {user.role === "instructor" && (
            <div className="col-span-1 md:col-span-2 p-2.5 bg-white border border-gray-100 rounded-lg shadow-sm">
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-0.5">Assigned Classes</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {user.course ? formatCourseSection(user.course, user.section).split(', ').map((cls, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded-md text-[10px] font-semibold border border-orange-100 shadow-sm">
                    {cls}
                  </span>
                )) : <span className="text-gray-400 italic text-[10px]">No classes assigned</span>}
              </div>
            </div>
          )}
          {user.role === "supervisor" && (
            <>
              <div className="p-2.5 bg-white border border-gray-100 rounded-lg shadow-sm">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-0.5">Company</p>
                <p className="text-xs font-semibold text-gray-900">{user.company || "N/A"}</p>
              </div>
              <div className="p-2.5 bg-white border border-gray-100 rounded-lg shadow-sm">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-0.5">Location</p>
                <p className="text-xs font-semibold text-gray-900">{user.location || "N/A"}</p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-5">
        <button
          onClick={onClose}
          className="w-full rounded-lg bg-gray-100 py-2 text-gray-700 text-xs font-bold hover:bg-gray-200 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export function AssignSupervisorView({
  users,
  onRefresh,
}: {
  users: User[];
  onRefresh?: () => void;
}) {
  const [studentSearch, setStudentSearch] = useState("");
  const [supervisorSearch, setSupervisorSearch] = useState("");
  const [studentCourseFilter, setStudentCourseFilter] = useState("");
  const [studentSectionFilter, setStudentSectionFilter] = useState("");

  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());
  const [selectedSupervisorId, setSelectedSupervisorId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const unsupervisedStudents = useMemo(
    () =>
      users.filter(
        (u) =>
          String(u.role || "").toLowerCase() === "student" &&
          (u.signup_status || "APPROVED") !== "PENDING" &&
          (!u.supervisorid || u.supervisorid.trim() === "")
      ),
    [users]
  );

  const supervisors = useMemo(
    () => users.filter((u) => String(u.role || "").toLowerCase() === "supervisor"),
    [users]
  );

  const studentCourses = useMemo(
    () =>
      Array.from(
        new Set(
          unsupervisedStudents
            .map((s) => s.course)
            .filter((c): c is string => !!c)
        )
      ).sort(),
    [unsupervisedStudents]
  );

  const studentSections = useMemo(
    () => {
      const subset = studentCourseFilter
        ? unsupervisedStudents.filter((s) => s.course === studentCourseFilter)
        : unsupervisedStudents;
      return Array.from(
        new Set(
          subset
            .map((s) => s.section)
            .filter((s): s is string => !!s)
        )
      ).sort();
    },
    [unsupervisedStudents, studentCourseFilter]
  );



  const filteredStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    return unsupervisedStudents.filter((s) => {
      if (studentCourseFilter && s.course !== studentCourseFilter) return false;
      if (studentSectionFilter && s.section !== studentSectionFilter) return false;
      if (!term) return true;
      const name = `${s.firstname || ""} ${s.lastname || ""}`.toLowerCase();
      const id = s.idnumber?.toLowerCase() || "";
      const course = (s.course || "").toLowerCase();
      const section = (s.section || "").toLowerCase();
      return (
        id.includes(term) ||
        name.includes(term) ||
        course.includes(term) ||
        section.includes(term)
      );
    });
  }, [unsupervisedStudents, studentSearch, studentCourseFilter, studentSectionFilter]);

  const filteredSupervisors = useMemo(() => {
    const term = supervisorSearch.trim().toLowerCase();
    return supervisors.filter((u) => {
      if (!term) return true;
      const name = `${u.firstname || ""} ${u.lastname || ""}`.toLowerCase();
      const company = (u.company || "").toLowerCase();
      const location = (u.location || "").toLowerCase();
      const id = u.idnumber?.toLowerCase() || "";
      return (
        id.includes(term) ||
        name.includes(term) ||
        company.includes(term) ||
        location.includes(term)
      );
    });
  }, [supervisors, supervisorSearch]);

  const toggleStudent = (id: number) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllStudents = () => {
    setSelectedStudentIds((prev) => {
      const ids = filteredStudents.map((s) => s.id);
      if (ids.length === 0) return new Set<number>();
      const allSelected = ids.every((id) => prev.has(id));
      if (allSelected) return new Set<number>();
      return new Set<number>(ids);
    });
  };

  const executeAssign = async () => {
    try {
      setAssignLoading(true);
      setAssignMessage(null);
      let actorId = "SYSTEM";
      try {
        actorId = localStorage.getItem("idnumber") || "SYSTEM";
      } catch {}

      for (const id of Array.from(selectedStudentIds)) {
        try {
          const res = await fetch(`/api/users/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              supervisorid: selectedSupervisorId,
              actorId,
              actorRole: "coordinator",
              reason: "Bulk supervisor assignment",
            }),
          });
          const json = await res.json();
          if (!res.ok) {
            throw new Error(json?.error || "Failed to assign supervisor");
          }
        } catch (e) {
          const msg =
            e instanceof Error ? e.message : "Failed to assign supervisor";
          setAssignMessage(msg);
          setAssignLoading(false);
          setShowConfirmModal(false);
          return;
        }
      }

      setSelectedStudentIds(new Set());
      setSelectedSupervisorId("");
      setStudentSearch("");
      setSupervisorSearch("");
      setShowConfirmModal(false);
      if (onRefresh) onRefresh();
    } finally {
      setAssignLoading(false);
    }
  };

  const handleAssign = () => {
    if (selectedStudentIds.size === 0 || !selectedSupervisorId) {
      setAssignMessage("Select at least one student and a supervisor.");
      return;
    }
    setAssignMessage(null);
    setShowConfirmModal(true);
  };

  const assignDisabled =
    assignLoading ||
    selectedStudentIds.size === 0 ||
    !selectedSupervisorId ||
    filteredStudents.length === 0;

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden pt-4">
      <div className="px-3 py-1.5 border-b border-gray-100 bg-white">
        <h2 className="text-base font-bold text-gray-900 whitespace-nowrap">
          Assign Supervisor
        </h2>
      </div>

      <div className="flex-1 bg-gray-50/30 overflow-hidden min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 h-full divide-x divide-gray-200">
          <div className="bg-white flex flex-col h-full overflow-hidden">
            <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  STUDENTS WITHOUT SUPERVISOR
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {unsupervisedStudents.length} total student
                  {unsupervisedStudents.length === 1 ? "" : "s"} available
                </p>
              </div>
              <button
                onClick={toggleAllStudents}
                disabled={filteredStudents.length === 0}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
              >
                Select All
              </button>
            </div>
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                  size={14}
                />
                <input
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search by name, ID, course or section..."
                  className="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-300 rounded-lg text-xs placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] shadow-sm"
                />
                {studentSearch && (
                  <button
                    onClick={() => setStudentSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap sm:flex-nowrap gap-2">
                <select
                  value={studentCourseFilter}
                  onChange={(e) => {
                    setStudentCourseFilter(e.target.value);
                    setStudentSectionFilter("");
                  }}
                  className="flex-1 min-w-0 px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] shadow-sm"
                >
                  <option value="">All Courses</option>
                  {studentCourses.map((course) => (
                    <option key={course} value={course}>
                      {course}
                    </option>
                  ))}
                </select>
                <select
                  value={studentSectionFilter}
                  onChange={(e) => setStudentSectionFilter(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] shadow-sm"
                >
                  <option value="">All Sections</option>
                  {studentSections.map((section) => (
                    <option key={section} value={section}>
                      {section}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto mt-1.5 space-y-1.5 px-2 custom-scrollbar">
              {filteredStudents.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  No students without supervisor match your filters.
                </div>
              ) : (
                filteredStudents.map((s) => {
                  const isSelected = selectedStudentIds.has(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleStudent(s.id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg border bg-white text-left transition-all ${
                        isSelected
                          ? "border-[#F97316] bg-orange-50/60 shadow-sm"
                          : "border-gray-200 hover:border-orange-200 hover:bg-orange-50/40"
                      }`}
                    >
                      <div
                        className={`h-4 w-4 rounded border flex items-center justify-center ${
                          isSelected
                            ? "border-[#F97316] bg-[#F97316]"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {isSelected && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="white"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        )}
                      </div>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-orange-50 text-[#F97316] border border-orange-100 flex items-center justify-center text-xs font-bold">
                          {(s.firstname?.[0] || s.idnumber[0]).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">
                            {s.firstname} {s.lastname}
                          </p>
                          <p className="text-[10px] text-gray-500 truncate">
                            {s.idnumber}{" "}
                            {s.course && s.section && (
                              <span className="ml-1">
                                • {s.course} {s.section}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <div className="bg-white flex flex-col h-full overflow-hidden">
            <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  CHOOSE SUPERVISOR
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {supervisors.length} supervisor
                  {supervisors.length === 1 ? "" : "s"} available
                </p>
              </div>
              <div className="text-[10px] text-gray-500 font-medium">
                {selectedStudentIds.size} selected student
                {selectedStudentIds.size === 1 ? "" : "s"}
              </div>
            </div>
            
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                  size={14}
                />
                <input
                  value={supervisorSearch}
                  onChange={(e) => setSupervisorSearch(e.target.value)}
                  placeholder="Search by name, ID, company..."
                  className="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-300 rounded-lg text-xs placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] shadow-sm"
                />
                {supervisorSearch && (
                  <button
                    onClick={() => setSupervisorSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                )}
              </div>
              <div className="mt-2">
                <button
                  onClick={handleAssign}
                  disabled={assignDisabled}
                  className="w-full flex items-center justify-center px-4 py-2 rounded-lg bg-[#F97316] text-white text-xs font-bold hover:bg-[#EA580C] transition-colors shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Assign Supervisor
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto mt-1.5 space-y-1.5 px-2 custom-scrollbar">
              {filteredSupervisors.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  No supervisors match your search.
                </div>
              ) : (
                filteredSupervisors.map((u) => {
                  const isActive = selectedSupervisorId === u.idnumber;
                  return (
                    <button
                      key={u.id}
                      onClick={() =>
                        setSelectedSupervisorId(
                          selectedSupervisorId === u.idnumber ? "" : u.idnumber
                        )
                      }
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg border bg-white text-left transition-all ${
                        isActive
                          ? "border-[#F97316] bg-orange-50/60 shadow-sm"
                          : "border-gray-200 hover:border-orange-200 hover:bg-orange-50/40"
                      }`}
                    >
                      <div
                        className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          isActive
                            ? "border-[#F97316] bg-[#F97316]"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {isActive && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="white"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        )}
                      </div>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-orange-50 text-[#F97316] border border-orange-100 flex items-center justify-center text-xs font-bold">
                          {(u.firstname?.[0] || u.idnumber[0]).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">
                            {`${u.firstname || ""} ${u.lastname || ""}`.trim() ||
                              u.name ||
                              u.idnumber}
                          </p>
                          <p className="text-[10px] text-gray-500 truncate">
                            {u.idnumber} • {u.company || "Company N/A"}{" "}
                            {u.location && `• ${u.location}`}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {showConfirmModal && (
          <ConfirmationModal
            title="Confirm Assignment"
            message={`Assign ${(() => {
              const s = supervisors.find(
                (u) => u.idnumber === selectedSupervisorId
              );
              return (
                (s &&
                  (`${s.firstname || ""} ${s.lastname || ""}`.trim() ||
                    s.name ||
                    s.idnumber)) ||
                selectedSupervisorId
              );
            })()} to ${selectedStudentIds.size} student${
              selectedStudentIds.size > 1 ? "s" : ""
            }?`}
            confirmLabel="Assign"
            onConfirm={executeAssign}
            onCancel={() => setShowConfirmModal(false)}
            isLoading={assignLoading}
          />
        )}

        {assignMessage && (
          <div className="mt-4 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">
            {assignMessage}
          </div>
        )}
      </div>
    </div>
  );
}

export function UsersView({ 
  role, 
  users, 
  availableCourses,
  availableSections,
  onAdd, 
  onEdit, 
  onView, 
  onDelete,
  onApprove,
  instructorApprovalStatuses,
  onToggleInstructorApproval,
}: { 
  role: RoleType; 
  users: User[]; 
  availableCourses: Course[];
  availableSections: Section[];
  onAdd: () => void; 
  onEdit: (user: User) => void;
  onView: (user: User) => void;
  onDelete: (user: User) => void;
  onApprove?: (user: User) => void;
  instructorApprovalStatuses?: Record<string, boolean>;
  onToggleInstructorApproval?: (idnumber: string, current: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [showAssignedStudentsModal, setShowAssignedStudentsModal] = useState(false);
  const [assignedStudents, setAssignedStudents] = useState<User[]>([]);
  const [assignedSearch, setAssignedSearch] = useState("");
  const [assignedCourseFilter, setAssignedCourseFilter] = useState("");
  const [assignedSectionFilter, setAssignedSectionFilter] = useState("");
  const title = role.charAt(0).toUpperCase() + role.slice(1) + "s";

  const viewAssignedStudents = (supervisorId: string) => {
    const assigned = users.filter(u => u.supervisorid === supervisorId && u.role === "student");
    setAssignedStudents(assigned);
    setAssignedSearch("");
    setAssignedCourseFilter("");
    setAssignedSectionFilter("");
    setShowAssignedStudentsModal(true);
  };

  const { activeUsers, pendingUsers, availableCourses: courses, availableSections: sections } = useMemo(() => {
    const s = search.toLowerCase();
    const targetRole = role.toLowerCase();
    
    // First get all users for this role
    const roleUsers = users.filter(u => u.role?.toLowerCase() === targetRole);

    const filterFn = (u: User) => 
      (courseFilter === "" || u.course === courseFilter) &&
      (sectionFilter === "" || u.section === sectionFilter) &&
      (u.idnumber?.toLowerCase().includes(s) || 
       u.firstname?.toLowerCase().includes(s) || 
       u.lastname?.toLowerCase().includes(s) ||
       u.company?.toLowerCase().includes(s));

    let active: User[] = [];
    // We don't show pending users in the main views anymore - they go to ApprovalsView (for students)
    // or are treated as active (for others who don't need approval)
    
    if (role === 'student') {
      active = roleUsers.filter(u => u.signup_status !== 'PENDING').filter(filterFn);
      // Sort students alphabetically by lastname
      active.sort((a, b) => (a.lastname || "").localeCompare(b.lastname || ""));
    } else {
      // For instructors/supervisors, show everyone in the main list as they don't need approval
      active = roleUsers.filter(filterFn);
      // Sort others alphabetically too
      active.sort((a, b) => (a.lastname || "").localeCompare(b.lastname || ""));
    }

    // Build course/section options from ACTIVE users only (only show with data)
    const norm = (x?: string) => (x || "").replace(/\s+/g, " ").trim();
    const courseMap = new Map<string, string>();
    active.forEach(u => {
      const n = norm(u.course);
      if (!n) return;
      const key = n.toLowerCase();
      if (!courseMap.has(key)) courseMap.set(key, n);
    });
    const sectionMap = new Map<string, string>();
    const sectionSource = courseFilter ? active.filter(u => norm(u.course) === courseFilter) : active;
    sectionSource.forEach(u => {
      const n = norm(u.section);
      if (!n) return;
      const key = n.toLowerCase();
      if (!sectionMap.has(key)) sectionMap.set(key, n);
    });
    const userCourses = Array.from(courseMap.values()).sort((a, b) => a.localeCompare(b));
    const userSections = Array.from(sectionMap.values()).sort((a, b) => a.localeCompare(b));

    return { 
      activeUsers: active, 
      pendingUsers: [] as User[], // Always empty to hide the pending section in main views
      availableCourses: userCourses, 
      availableSections: userSections 
    };
  }, [users, role, search, courseFilter, sectionFilter]);

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden pt-4">
      {/* Combined Header & Toolbar */}
      <div className="px-3 py-1.5 border-b border-gray-100 flex flex-wrap items-center gap-2 bg-white">
        <h2 className="text-base font-bold text-gray-900 whitespace-nowrap mr-auto">{title} Directory</h2>

        {/* Search */}
        <div className="relative w-full sm:w-60 md:w-72">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search...`}
            className="w-full pl-8 pr-8 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-all placeholder-gray-500 text-gray-900"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-200 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          )}
        </div>

        {/* Filters */}
        {role !== "supervisor" && (role === "student" || role === "instructor" || courses.length > 0 || sections.length > 0) && (
          <div className="flex gap-1.5">
            <select
              value={courseFilter}
              onChange={(e) => {
                setCourseFilter(e.target.value);
                if (e.target.value === "") setSectionFilter("");
              }}
              className="flex-1 min-w-0 px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] shadow-sm"
            >
              <option value="">All Courses</option>
              {courses.map(course => (
                <option key={course} value={course}>{course}</option>
              ))}
            </select>
            
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="flex-1 min-w-0 px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] shadow-sm"
            >
              <option value="">All Sections</option>
              {sections.map(section => (
                <option key={section} value={section}>{section}</option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={onAdd}
          className="flex items-center justify-center gap-1.5 bg-[#F97316] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#EA580C] transition-all shadow-sm active:scale-95 whitespace-nowrap"
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
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add New
        </button>
      </div>

      <div className="flex-1 bg-white">

        {pendingUsers.length > 0 && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse"></div>
              <h3 className="text-xs font-bold text-orange-600 uppercase tracking-widest">Pending Approvals</h3>
              <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{pendingUsers.length}</span>
            </div>
            <div className="space-y-3">
              {pendingUsers.map((user) => (
                <div key={user.id} className="group flex items-center justify-between p-3 rounded-lg bg-orange-50 border border-orange-100 shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-white text-[#F97316] border border-orange-200 flex items-center justify-center font-bold text-base shadow-sm">
                      {(user.firstname?.[0] || user.idnumber[0]).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 text-xs sm:text-sm truncate">
                          {user.firstname} {user.lastname}
                        </h3>
                        <span className="px-1.5 py-0.5 bg-orange-200 text-orange-800 text-[10px] font-bold rounded uppercase tracking-wide">Pending</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] sm:text-xs text-gray-600 mt-0.5">
                        <span className="font-medium bg-white/50 px-1.5 py-0.5 rounded border border-orange-100">{user.idnumber}</span>
                        {user.course && (
                          <span className="truncate">
                            • {user.role === 'instructor' 
                                ? formatCourseSection(user.course, user.section) 
                                : `${user.course} - ${user.section}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {onApprove && (
                      <button 
                        onClick={() => onApprove(user)}
                        className="px-3 py-1.5 bg-[#F97316] text-white text-[10px] font-bold rounded-lg hover:bg-[#EA580C] shadow-sm hover:shadow-orange-200 transition-all active:scale-95"
                      >
                        Approve
                      </button>
                    )}
                    <button 
                      onClick={() => onDelete(user)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      title="Reject / Delete"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          {pendingUsers.length > 0 && activeUsers.length > 0 && (
             <div className="flex items-center gap-2 mb-3 px-1 mt-2">
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Active Accounts</h3>
             </div>
          )}
          
          <div className="space-y-3">
            {activeUsers.length === 0 && pendingUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <div className="p-4 rounded-full bg-gray-100 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
                <p className="font-medium">No {role}s found matching your criteria.</p>
              </div>
            ) : (
              <>
                {role === 'student' && (
                  <div className="bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px] sticky top-0 z-10">
                          <tr>
                            <th className="px-3 py-1.5 whitespace-nowrap">Student</th>
                            <th className="px-3 py-1.5 whitespace-nowrap">Course & Section</th>
                            <th className="px-3 py-1.5 whitespace-nowrap">Supervisor</th>
                            <th className="px-3 py-1.5 whitespace-nowrap">Company & Location</th>
                            <th className="px-3 py-1.5 text-right whitespace-nowrap">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {activeUsers.map((user) => {
                             const supervisor = user.supervisorid ? users.find(u => u.idnumber === user.supervisorid) : null;
                             return (
                            <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group">
                              <td className="px-3 py-1.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-8 w-8 rounded-full bg-orange-50 text-[#F97316] border border-orange-100 flex items-center justify-center font-bold text-[10px] shrink-0">
                                    {(user.firstname?.[0] || user.idnumber[0]).toUpperCase()}
                                  </div>
                                  <div className="flex flex-col">
                                      <div className="font-bold text-gray-900 whitespace-nowrap">
                                        {user.lastname}, {user.firstname}
                                      </div>
                                      <div className="text-xs text-gray-500 font-mono">
                                        {user.idnumber}
                                      </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-1.5 text-gray-600">
                                {formatCourseSection(user.course, user.section)}
                              </td>
                              <td className="px-3 py-1.5 text-gray-600">
                                {supervisor ? (
                                    <div className="flex flex-col">
                                        <span className="font-medium text-gray-900">{supervisor.firstname} {supervisor.lastname}</span>
                                        <span className="text-[10px] text-gray-400">{supervisor.idnumber}</span>
                                    </div>
                                ) : <span className="text-gray-400 italic">Not Assigned</span>}
                              </td>
                              <td className="px-3 py-1.5 text-gray-600">
                                <div className="flex flex-col max-w-[200px]">
                                    <span className="font-medium text-gray-900 truncate" title={user.company || supervisor?.company}>
                                      {user.company || supervisor?.company || "Not Assigned"}
                                    </span>
                                    <span className="text-[10px] text-gray-500 truncate" title={user.location || supervisor?.location}>
                                      {user.location || supervisor?.location || ""}
                                    </span>
                                </div>
                              </td>
                              <td className="px-3 py-1.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button 
                                    onClick={() => onEdit(user)}
                                    className="p-1.5 text-gray-400 hover:text-[#F97316] hover:bg-orange-50 rounded-lg transition-colors"
                                    title="Edit User"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                  </button>
                                  <button 
                                    onClick={() => onDelete(user)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete User"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                {role === 'instructor' && (
                  <div className="bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px] sticky top-0 z-10">
                          <tr>
                            <th className="px-3 py-1.5 whitespace-nowrap">Instructor</th>
                            <th className="px-3 py-1.5 whitespace-nowrap">Department</th>
                            <th className="px-3 py-1.5 whitespace-nowrap">Account Approval</th>
                            <th className="px-3 py-1.5 text-right whitespace-nowrap">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {activeUsers.map((user) => {
                             const approvalAllowed = instructorApprovalStatuses?.[user.idnumber] ?? true;
                             return (
                            <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group">
                              <td className="px-3 py-1.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-8 w-8 rounded-full bg-orange-50 text-[#F97316] border border-orange-100 flex items-center justify-center font-bold text-[10px] shrink-0">
                                    {(user.firstname?.[0] || user.idnumber[0]).toUpperCase()}
                                  </div>
                                  <div className="flex flex-col">
                                      <div className="font-bold text-gray-900 whitespace-nowrap">
                                        {user.lastname}, {user.firstname}
                                      </div>
                                      <div className="text-xs text-gray-500 font-mono">
                                        {user.idnumber}
                                      </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-1.5 text-gray-600">
                                {formatCourseSection(user.course, user.section)}
                              </td>
                              <td className="px-3 py-1.5 text-gray-600">
                                {onToggleInstructorApproval && (
                                  <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                      <span className="text-[10px] text-gray-500">
                                        {approvalAllowed ? "Enabled" : "Restricted"}
                                      </span>
                                      <div className="relative">
                                        <input
                                          type="checkbox"
                                          className="sr-only peer"
                                          checked={approvalAllowed}
                                          onChange={() => onToggleInstructorApproval(user.idnumber, approvalAllowed)}
                                        />
                                        <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all" />
                                      </div>
                                    </label>
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-1.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button 
                                    onClick={() => onEdit(user)}
                                    className="p-1.5 text-gray-400 hover:text-[#F97316] hover:bg-orange-50 rounded-lg transition-colors"
                                    title="Edit User"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                  </button>
                                  <button 
                                    onClick={() => onDelete(user)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete User"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {role === 'supervisor' && (
                  <div className="bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px] sticky top-0 z-10">
                          <tr>
                            <th className="px-3 py-1.5 whitespace-nowrap">Supervisor</th>
                            <th className="px-3 py-1.5 whitespace-nowrap">Company & Location</th>
                            <th className="px-3 py-1.5 whitespace-nowrap">Assigned Students</th>
                            <th className="px-3 py-1.5 text-right whitespace-nowrap">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {activeUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group">
                              <td className="px-3 py-1.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-8 w-8 rounded-full bg-orange-50 text-[#F97316] border border-orange-100 flex items-center justify-center font-bold text-[10px] shrink-0">
                                    {(user.firstname?.[0] || user.idnumber[0]).toUpperCase()}
                                  </div>
                                  <div className="flex flex-col">
                                      <div className="font-bold text-gray-900 whitespace-nowrap">
                                        {user.lastname}, {user.firstname}
                                      </div>
                                      <div className="text-xs text-gray-500 font-mono">
                                        {user.idnumber}
                                      </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-1.5 text-gray-600">
                                <div className="flex flex-col max-w-[200px]">
                                    <span className="font-medium text-gray-900 truncate" title={user.company}>
                                      {user.company || "Not Assigned"}
                                    </span>
                                    <span className="text-[10px] text-gray-500 truncate" title={user.location}>
                                      {user.location || ""}
                                    </span>
                                </div>
                              </td>
                              <td className="px-3 py-1.5 text-gray-600">
                                <button
                                  onClick={() => viewAssignedStudents(user.idnumber)}
                                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors border border-blue-100"
                                >
                                  <Users size={14} />
                                  View Students
                                </button>
                              </td>
                              <td className="px-3 py-1.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button 
                                    onClick={() => onEdit(user)}
                                    className="p-1.5 text-gray-400 hover:text-[#F97316] hover:bg-orange-50 rounded-lg transition-colors"
                                    title="Edit User"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                  </button>
                                  <button 
                                    onClick={() => onDelete(user)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete User"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                <div className={(role === 'student' || role === 'instructor' || role === 'supervisor') ? 'hidden' : 'space-y-2'}>
                  {activeUsers.map((user) => {
                const isInstructor = role === "instructor";
                const approvalAllowed = isInstructor
                  ? instructorApprovalStatuses?.[user.idnumber] ?? true
                  : undefined;
                return (
                  <div key={user.id} className="group flex items-center justify-between p-3 rounded-lg bg-white border border-gray-100 hover:border-orange-200 hover:shadow-sm transition-all duration-200">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-orange-50 text-[#F97316] border border-orange-100 flex items-center justify-center font-bold text-base">
                        {(user.firstname?.[0] || user.idnumber[0]).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 text-xs sm:text-sm truncate">
                          {user.firstname} {user.lastname}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-xs text-gray-500">
                          <span className="font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{user.idnumber}</span>
                          {user.course && user.role !== 'supervisor' && (
                            <span className="truncate">
                              • {user.role === 'instructor' 
                                  ? formatCourseSection(user.course, user.section) 
                                  : `${user.course} - ${user.section}`}
                            </span>
                          )}
                          {user.company && <span className="truncate">• {user.company}</span>}
                        </div>
                        {isInstructor && approvalAllowed !== undefined && onToggleInstructorApproval && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                              Account Approval
                            </span>
                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
                              <span className="text-[10px] text-gray-500">
                                {approvalAllowed ? "Enabled" : "Restricted"}
                              </span>
                              <div className="relative">
                                <input
                                  type="checkbox"
                                  className="sr-only peer"
                                  checked={approvalAllowed}
                                  onChange={() => onToggleInstructorApproval(user.idnumber, approvalAllowed)}
                                />
                                <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all" />
                              </div>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all duration-200">
                      {user.role === "supervisor" && (
                        <button
                          onClick={() => viewAssignedStudents(user.idnumber)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Assigned Students"
                        >
                          <Users size={16} />
                        </button>
                      )}
                      <button 
                        onClick={() => onView(user)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      </button>
                      <button 
                        onClick={() => onEdit(user)}
                        className="p-1.5 text-gray-400 hover:text-[#F97316] hover:bg-orange-50 rounded-lg transition-colors"
                        title="Edit User"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      </button>
                      <button 
                        onClick={() => onDelete(user)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete User"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  </div>
                );
              })
            }
          </div>
        </>
      )}
      </div>
    </div>
  </div>
      
      {showAssignedStudentsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Assigned Students</h3>
                  <p className="text-xs text-gray-500">
                    {assignedStudents.length} student{assignedStudents.length !== 1 ? 's' : ''} assigned
                  </p>
                </div>
                <button
                  onClick={() => setShowAssignedStudentsModal(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={assignedSearch}
                  onChange={(e) => setAssignedSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm text-gray-700"
                />
              </div>

              <div className="flex gap-2 mt-2.5">
                <select
                  value={assignedCourseFilter}
                  onChange={(e) => setAssignedCourseFilter(e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 flex-1"
                >
                  <option value="">All Courses</option>
                  {Array.from(new Set(assignedStudents.map(u => u.course).filter(Boolean))).sort().map(course => (
                    <option key={course as string} value={course as string}>{course as string}</option>
                  ))}
                </select>
                <select
                  value={assignedSectionFilter}
                  onChange={(e) => setAssignedSectionFilter(e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 flex-1"
                >
                  <option value="">All Sections</option>
                  {Array.from(new Set(assignedStudents.map(u => u.section).filter(Boolean))).sort().map(section => (
                    <option key={section as string} value={section as string}>{section as string}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="overflow-y-auto p-4">
              {assignedStudents.filter(s => 
                (assignedCourseFilter === "" || s.course === assignedCourseFilter) &&
                (assignedSectionFilter === "" || s.section === assignedSectionFilter) &&
                (s.firstname?.toLowerCase().includes(assignedSearch.toLowerCase()) ||
                s.lastname?.toLowerCase().includes(assignedSearch.toLowerCase()) ||
                s.idnumber?.toLowerCase().includes(assignedSearch.toLowerCase()))
              ).length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No students found.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {assignedStudents
                    .filter(s => 
                      (assignedCourseFilter === "" || s.course === assignedCourseFilter) &&
                      (assignedSectionFilter === "" || s.section === assignedSectionFilter) &&
                      (s.firstname?.toLowerCase().includes(assignedSearch.toLowerCase()) ||
                      s.lastname?.toLowerCase().includes(assignedSearch.toLowerCase()) ||
                      s.idnumber?.toLowerCase().includes(assignedSearch.toLowerCase()))
                    )
                    .map((student) => (
                    <div key={student.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                      <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                        {(student.firstname?.[0] || student.idnumber[0]).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 text-sm truncate">
                          {student.firstname} {student.lastname}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-gray-700">
                          <span className="bg-white border border-gray-300 px-1.5 py-0.5 rounded">{student.idnumber}</span>
                          <span className="truncate">{student.course} - {student.section}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-3 border-t border-gray-100 bg-gray-50 rounded-b-lg flex justify-end">
              <button
                onClick={() => setShowAssignedStudentsModal(false)}
                className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
