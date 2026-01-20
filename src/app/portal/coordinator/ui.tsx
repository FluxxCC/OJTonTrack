"use client";
import React, { useState, useMemo } from "react";
import { Search } from "lucide-react";

export type RoleType = "student" | "instructor" | "supervisor" | "approval" | "assign";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className={`relative w-full max-h-[85vh] rounded-2xl bg-white shadow-2xl overflow-y-auto animate-in fade-in zoom-in duration-200 ${className || "max-w-lg md:max-w-3xl"}`}>
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 z-10 p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        {children}
      </div>
    </div>
  );
}

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
  onNoteChange
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
  const canConfirm = !noteRequired || (noteValue && noteValue.trim().length > 0);

  return (
    <Modal onClose={onCancel}>
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className={`w-20 h-20 ${currentStyle.bg} ${currentStyle.text} rounded-full flex items-center justify-center mb-6 ring-8 ${currentStyle.ring}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-500 mb-6 max-w-sm mx-auto leading-relaxed">{message}</p>
        {showNoteField && (
          <div className="w-full max-w-md mx-auto mb-6 text-left">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {noteLabel}
              {noteRequired ? " *" : ""}
            </label>
            <textarea
              value={noteValue || ""}
              onChange={e => onNoteChange && onNoteChange(e.target.value)}
              className="w-full min-h-[90px] rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all resize-none"
              placeholder={noteRequired ? "Required. Explain the reason for rejection..." : "Optional note..."}
            />
          </div>
        )}
        <div className="flex gap-4">
          <button
            onClick={onCancel}
            className="min-w-[120px] py-3 px-6 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`min-w-[120px] py-3 px-6 text-white font-bold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg ${currentStyle.btn} ${!canConfirm ? "opacity-60 cursor-not-allowed hover:scale-100" : ""}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export const ApprovalsView = ({ users, onView, onRefresh }: { 
  users: User[]; 
  onView: (user: User) => void;
  onRefresh: () => void;
}) => {
  const students = useMemo(() => users.filter(u => u.role === "student"), [users]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCourse, setFilterCourse] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterStatus, setFilterStatus] = useState("PENDING");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: "single" | "bulk";
    id?: number;
    action: "approve" | "reject";
  } | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");

  const uniqueCourses = useMemo(
    () =>
      Array.from(
        new Set(students.map(s => s.course).filter((c): c is string => !!c))
      ).sort(),
    [students]
  );

  const uniqueSections = useMemo(() => {
    const subset = filterCourse ? students.filter(s => s.course === filterCourse) : students;
    return Array.from(
      new Set(subset.map(s => s.section).filter((s): s is string => !!s))
    ).sort();
  }, [students, filterCourse]);

  const filteredStudents = useMemo(() => {
    const normalize = (s: string) => s.toLowerCase().trim();
    return students
      .filter(s => {
        const search = normalize(searchTerm);
        const name = normalize(`${s.firstname || ""} ${s.lastname || ""}`);
        const id = normalize(s.idnumber);
        const matchesSearch = !search || name.includes(search) || id.includes(search);

        const matchesCourse = !filterCourse || s.course === filterCourse;
        const matchesSection = !filterSection || s.section === filterSection;

        const status = s.signup_status || "APPROVED";
        const matchesStatus =
          filterStatus === "ALL" ? true : status === filterStatus;

        return matchesSearch && matchesCourse && matchesSection && matchesStatus;
      })
      .sort((a, b) => (a.lastname || "").localeCompare(b.lastname || ""));
  }, [students, searchTerm, filterCourse, filterSection, filterStatus]);

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const pendingStudents = filteredStudents.filter(
      s => (s.signup_status || "APPROVED") !== "APPROVED"
    );
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
          fetch(`/api/users/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              signup_status: action === "approve" ? "APPROVED" : "REJECTED",
              actorId,
              actorRole: "coordinator",
              reason: `Coordinator ${action}`,
              rejectionNote: action === "reject" ? note || "" : undefined,
            }),
          }).then(res => {
            if (!res.ok) throw new Error(`Failed to ${action} ${id}`);
            return res;
          })
        )
      );

      onRefresh();
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
    <div className="flex flex-col h-full bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 bg-white">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Account Approvals</h2>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Review and approve student account requests
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/30">
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
            onChange={e => {
              setFilterCourse(e.target.value);
              setFilterSection("");
            }}
            className="px-4 py-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm min-w-[140px]"
          >
            <option value="">All Courses</option>
            {uniqueCourses.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={filterSection}
            onChange={e => setFilterSection(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm min-w-[140px]"
          >
            <option value="">All Sections</option>
            {uniqueSections.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
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

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setConfirmAction({ type: "bulk", action: "approve" })}
                disabled={isBulkApproving}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {isBulkApproving ? "Processing..." : `Approve (${selectedIds.size})`}
              </button>
              <button
                onClick={() => setConfirmAction({ type: "bulk", action: "reject" })}
                disabled={isBulkApproving}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {isBulkApproving ? "Processing..." : `Reject (${selectedIds.size})`}
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex-1">
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
                        filteredStudents.some(s => (s.signup_status || "APPROVED") !== "APPROVED") &&
                        selectedIds.size ===
                          filteredStudents.filter(s => (s.signup_status || "APPROVED") !== "APPROVED").length &&
                        filteredStudents.filter(s => (s.signup_status || "APPROVED") !== "APPROVED").length > 0
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
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No students found
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map(s => {
                    const isPending = (s.signup_status || "APPROVED") !== "APPROVED";
                    const isSelected = selectedIds.has(s.id);
                    return (
                      <tr
                        key={s.id}
                        className={`hover:bg-gray-50/50 ${isSelected ? "bg-orange-50/30" : ""}`}
                      >
                        <td className="px-6 py-3">
                          {isPending && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelection(s.id)}
                              className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                            />
                          )}
                        </td>
                        <td className="px-6 py-3 font-medium text-gray-900">
                          <button
                            type="button"
                            onClick={() => onView(s)}
                            className="hover:text-orange-600 hover:underline text-left font-semibold"
                          >
                            {s.firstname} {s.lastname}
                          </button>
                        </td>
                        <td className="px-6 py-3 text-gray-600">{s.idnumber}</td>
                        <td className="px-6 py-3 text-gray-600">
                          {formatCourseSection(s.course, s.section)}
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                              !isPending
                                ? "bg-green-50 text-green-700 border-green-200"
                                : s.signup_status === "REJECTED"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-yellow-50 text-yellow-700 border-yellow-200"
                            }`}
                          >
                            {s.signup_status || "APPROVED"}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          {isPending && (
                            <div className="flex gap-2">
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
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden">
            {filteredStudents.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                No students found
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredStudents.map(s => {
                  const isPending = (s.signup_status || "APPROVED") !== "APPROVED";
                  const isSelected = selectedIds.has(s.id);
                  return (
                    <div
                      key={s.id}
                      className={`p-4 ${isSelected ? "bg-orange-50/30" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <button
                            onClick={() => onView(s)}
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
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                              !isPending
                                ? "bg-green-50 text-green-700 border-green-200"
                                : s.signup_status === "REJECTED"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-yellow-50 text-yellow-700 border-yellow-200"
                            }`}
                          >
                            {s.signup_status || "APPROVED"}
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
          />
        )}
      </div>
    </div>
  );
}

const MultiSelect = ({ options, value, onChange, placeholder }: { options: {id: number, name: string}[], value: number[], onChange: (val: number[]) => void, placeholder: string }) => {
  const [open, setOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button 
        type="button" 
        onClick={() => setOpen(!open)} 
        className="w-full text-left rounded-xl border border-gray-300 px-4 py-2.5 text-[#1F2937] bg-white flex justify-between items-center focus:ring-2 focus:ring-[#F97316]/20 transition-all hover:border-gray-400 group"
      >
        <span className={`text-sm ${value.length > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
          {value.length > 0 ? `${value.length} selected` : placeholder}
        </span>
        <span className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors">▼</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl p-2 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100">
          {options.map(opt => {
            const isSelected = value.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    onChange(value.filter(v => v !== opt.id));
                  } else {
                    onChange([...value, opt.id]);
                  }
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-left group/item ${isSelected ? 'bg-orange-50' : 'hover:bg-gray-50'}`}
              >
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isSelected ? 'border-orange-500 bg-orange-500' : 'border-gray-300 bg-white group-hover/item:border-orange-300'}`}>
                  {isSelected && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  )}
                </div>
                <span className={`text-sm font-medium ${isSelected ? 'text-orange-900' : 'text-[#1F2937]'}`}>{opt.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {value.length > 0 && (
        <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between mb-2.5 px-1">
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Assigned Classes</span>
            <button 
              type="button"
              onClick={() => onChange([])}
              className="text-[10px] font-extrabold text-red-500 uppercase tracking-widest hover:text-red-700 transition-colors flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
              Clear All
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {options.filter(o => value.includes(o.id)).map(o => (
              <span key={o.id} className="inline-flex items-center px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 text-xs font-bold border border-orange-100 shadow-sm transition-all hover:bg-orange-100 hover:border-orange-200 group/tag">
                {o.name}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(value.filter(v => v !== o.id));
                  }}
                  className="ml-2 p-0.5 hover:bg-orange-200 rounded-full text-orange-400 group-hover/tag:text-orange-600 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

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
    <div className="p-6 sm:p-8">
      <h2 className="text-2xl font-bold text-[#1F2937] mb-6">Add New {title}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">ID Number</span>
          <input
            value={form.idnumber}
            onChange={(e) => setForm({ ...form, idnumber: e.target.value })}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="e.g. 2021-00001"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Password</span>
          <input
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="Temporary password"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">First Name</span>
          <input
            value={form.firstname}
            onChange={(e) => setForm({ ...form, firstname: e.target.value })}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="First name"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Last Name</span>
          <input
            value={form.lastname}
            onChange={(e) => setForm({ ...form, lastname: e.target.value })}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="Last name"
          />
        </label>
        <label className="grid gap-1.5 md:col-span-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email</span>
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="Email address"
          />
        </label>
        {role === "student" && (
          <>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Course</span>
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
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all bg-white"
              >
                <option value="">Select course</option>
                {availableCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Section</span>
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
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all bg-white"
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
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Course & Section</span>
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
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Course & Section</span>
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
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Company</span>
              <input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
                placeholder="Company name"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Location</span>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
                placeholder="Location"
              />
            </label>
          </>
        )}
        {role === "student" && (
          <>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Supervisor</span>
              {form.supervisorid ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white sm:px-4 sm:py-2.5">
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
                    className="shrink-0 text-sm font-semibold text-red-600 hover:text-red-700"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowSupervisorModal(true)}
                  disabled={form.courseIds.length === 0 || form.sectionIds.length === 0}
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all bg-white text-left"
                >
                  {form.courseIds.length === 0 || form.sectionIds.length === 0 ? "Select course & section first" : "Choose supervisor"}
                </button>
              )}
            </label>
            {showSupervisorModal && (
              <Modal onClose={() => setShowSupervisorModal(false)}>
                <div className="p-6">
                  <div className="mb-4 relative">
                    <h3 className="text-lg font-bold text-gray-900">Select Supervisor</h3>
                    <p className="text-xs text-gray-500 mt-1">Search and assign an eligible supervisor</p>
                    {(() => {
                      const eligible = users.filter(u => {
                        if (String(u.role).toLowerCase() !== "supervisor") return false;
                        const studentCourseId = form.courseIds[0];
                        const studentSectionId = form.sectionIds[0];
                        if (!studentCourseId || !studentSectionId) return false;
                        const hasCourseId = u.courseIds && u.courseIds.includes(studentCourseId);
                        const hasSectionId = u.sectionIds && u.sectionIds.includes(studentSectionId);
                        if (hasCourseId && hasSectionId) return true;
                        const courseObj = availableCourses.find(c => c.id === studentCourseId);
                        const sectionObj = availableSections.find(s => s.id === studentSectionId);
                        const hasCourseName = courseObj && u.course && u.course.includes(courseObj.name);
                        const hasSectionName = sectionObj && u.section && u.section.includes(sectionObj.name);
                        return hasCourseName && hasSectionName;
                      }).filter(u => {
                        const s = supervisorSearch.trim().toLowerCase();
                        if (!s) return true;
                        const name = ((u.firstname || "") + " " + (u.lastname || "")).toLowerCase();
                        const company = (u.company || "").toLowerCase();
                        const location = (u.location || "").toLowerCase();
                        return (
                          u.idnumber?.toLowerCase().includes(s) ||
                          name.includes(s) ||
                          company.includes(s) ||
                          location.includes(s)
                        );
                      }).length;
                      return (
                        <span className="absolute right-14 top-0 mt-1 inline-flex items-center justify-center h-6 min-w-6 px-2 rounded-full bg-[#F97316] text-white text-xs font-bold">
                          {eligible}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="relative mb-4">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input
                      value={supervisorSearch}
                      onChange={(e) => setSupervisorSearch(e.target.value)}
                      placeholder="Search by name, ID, company or location..."
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] text-gray-900 transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                    {users
                      .filter(u => {
                        if (String(u.role).toLowerCase() !== "supervisor") return false;
                        const studentCourseId = form.courseIds[0];
                        const studentSectionId = form.sectionIds[0];
                        if (!studentCourseId || !studentSectionId) return false;
                        const hasCourseId = u.courseIds && u.courseIds.includes(studentCourseId);
                        const hasSectionId = u.sectionIds && u.sectionIds.includes(studentSectionId);
                        if (hasCourseId && hasSectionId) return true;
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
                        const location = (u.location || "").toLowerCase();
                        return (
                          u.idnumber?.toLowerCase().includes(s) ||
                          name.includes(s) ||
                          company.includes(s) ||
                          location.includes(s)
                        );
                      })
                      .map(u => (
                        <div key={u.id} className="w-full p-3 rounded-xl border border-gray-200 hover:border-orange-200 hover:bg-orange-50 transition-all">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-10 w-10 rounded-xl bg-orange-50 border border-orange-100 text-[#F97316] flex items-center justify-center font-bold">
                                {(((u.firstname || u.name || u.idnumber || "?")[0]) || "?").toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-gray-900 truncate">
                                  {((u.firstname || "") + " " + (u.lastname || "")).trim() || u.name || u.idnumber}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5 truncate">
                                  {u.idnumber} • {u.company || "Company N/A"} • {u.location || "Location N/A"}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setForm({ ...form, supervisorid: u.idnumber });
                                setShowSupervisorModal(false);
                              }}
                              className="px-4 py-2 rounded-xl bg-[#F97316] text-white text-sm font-bold hover:bg-[#EA580C]"
                            >
                              Select
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      onClick={() => setShowSupervisorModal(false)}
                      className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </Modal>
            )}
          </>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-3">
        {message && <div className="text-sm text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">{message}</div>}
        <button
          onClick={submit}
          disabled={loading}
          className="w-full rounded-xl bg-[#F97316] py-3.5 text-white font-bold hover:bg-[#EA580C] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-orange-200"
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
}

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
        course: form.course || undefined,
        section: form.section || undefined,
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
    <div className="p-6 sm:p-8">
      <h2 className="text-2xl font-bold text-[#1F2937] mb-6">Edit User</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">ID Number</span>
          <input
            value={form.idnumber}
            onChange={(e) => setForm({ ...form, idnumber: e.target.value })}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="e.g. 2021-00001"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">New Password (Optional)</span>
          <input
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="Leave blank to keep current"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">First Name</span>
          <input
            value={form.firstname}
            onChange={(e) => setForm({ ...form, firstname: e.target.value })}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="First name"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Last Name</span>
          <input
            value={form.lastname}
            onChange={(e) => setForm({ ...form, lastname: e.target.value })}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="Last name"
          />
        </label>
        <label className="grid gap-1.5 md:col-span-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email</span>
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="Email address"
          />
        </label>
        {user.role === "student" && (
          <>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Course</span>
              <div className="relative">
                <select
                  value={form.course}
                  onChange={(e) => {
                    const newCourse = e.target.value;
                    setForm({ ...form, course: newCourse, section: "" });
                  }}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all appearance-none bg-white"
                >
                  <option value="">Select Course</option>
                  {availableCourses.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Section</span>
              <div className="relative">
                <select
                  value={form.section}
                  onChange={(e) => setForm({ ...form, section: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all appearance-none bg-white"
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
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
            </label>
            <label className="grid gap-1.5 md:col-span-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Supervisor</span>
              {form.supervisorid ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white sm:px-4 sm:py-2.5">
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
                    className="shrink-0 text-sm font-semibold text-red-600 hover:text-red-700"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowSupervisorModal(true)}
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all bg-white text-left"
                >
                  Choose supervisor
                </button>
              )}
            </label>
          </>
        )}
        {user.role === "instructor" && (
          <label className="grid gap-1.5 md:col-span-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Course & Section</span>
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
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Company</span>
              <input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
                placeholder="Company name"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Location</span>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
                placeholder="Location"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Course & Section</span>
              <MultiSelect
                options={combinedCourseSections}
                value={form.sectionIds}
                onChange={(sectionIds) => {
                  const selectedSections = combinedCourseSections.filter(opt => sectionIds.includes(opt.id));
                  const courseIds = Array.from(new Set(selectedSections.map(opt => opt.courseId)));
                  const courseNames = courseIds
                    .map(id => availableCourses.find(c => c.id === id)?.name)
                    .filter(Boolean) as string[];
                  const sectionNames = selectedSections
                    .map(opt => availableSections.find(s => s.id === opt.id)?.name)
                    .filter(Boolean) as string[];
                  const courseStr = courseNames.join(", ");
                  const sectionStr = sectionNames.join(", ");
                  setForm({ ...form, sectionIds, courseIds, course: courseStr, section: sectionStr });
                }}
                placeholder="Select course & section"
              />
            </label>
          </>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-3">
        {message && <div className="text-sm text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">{message}</div>}
        <button
          onClick={submit}
          disabled={loading}
          className="w-full rounded-xl bg-[#F97316] py-3.5 text-white font-bold hover:bg-[#EA580C] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-orange-200"
        >
          {loading ? "Saving..." : "Save Changes"}
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

      {showSupervisorModal && (
        <Modal onClose={() => setShowSupervisorModal(false)}>
          <div className="p-6">
            <div className="mb-4 relative">
              <h3 className="text-lg font-bold text-gray-900">Select Supervisor</h3>
              <p className="text-xs text-gray-500 mt-1">Search and assign an eligible supervisor</p>
              <div className="relative mt-2">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input
                  value={supervisorSearch}
                  onChange={(e) => setSupervisorSearch(e.target.value)}
                  placeholder="Search by name, ID, or company"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] text-gray-900 transition-all shadow-sm"
                />
              </div>
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
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
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-white hover:border-orange-200 hover:shadow-sm transition-all">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-orange-50 text-[#F97316] border border-orange-100 flex items-center justify-center font-bold">
                        {(u.firstname?.[0] || u.idnumber[0]).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 truncate">
                          {((u.firstname || "") + " " + (u.lastname || "")).trim() || u.name || u.idnumber}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {u.company || "N/A"}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setForm({ ...form, supervisorid: u.idnumber });
                        setShowSupervisorModal(false);
                      }}
                      className="px-4 py-2 rounded-xl bg-[#F97316] text-white text-sm font-bold hover:bg-[#EA580C]"
                    >
                      Select
                    </button>
                  </div>
                ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowSupervisorModal(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl"
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

export function ViewUserDetails({ user, users, onClose }: { user: User; users: User[]; onClose: () => void }) {
  const supervisor = useMemo(() => {
    if (!user.supervisorid) return null;
    return users.find(u => u.role === "supervisor" && u.idnumber === user.supervisorid) || null;
  }, [users, user.supervisorid]);
  
  return (
    <div className="p-6 sm:p-8">
      <h2 className="text-2xl font-bold text-[#1F2937] mb-6">User Details</h2>
      
      <div className="space-y-6">
        <div className="flex items-center gap-5 p-5 bg-gray-50 rounded-2xl border border-gray-100">
          <div className="h-16 w-16 rounded-full bg-white text-[#F97316] border border-orange-100 flex items-center justify-center font-bold text-3xl shadow-sm">
            {(user.firstname?.[0] || user.idnumber[0]).toUpperCase()}
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">{user.firstname} {user.lastname}</h3>
            <p className="text-sm text-gray-500 capitalize font-medium">{user.role}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
            <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">ID Number</p>
            <p className="text-base font-semibold text-gray-900">{user.idnumber}</p>
          </div>
          <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
            <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Full Name</p>
            <p className="text-base font-semibold text-gray-900">{user.firstname} {user.middlename ? user.middlename + " " : ""}{user.lastname}</p>
          </div>
          {user.role === "student" && (
            <>
              <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Course</p>
                <p className="text-base font-semibold text-gray-900">{user.course || "N/A"}</p>
              </div>
              <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Section</p>
                <p className="text-base font-semibold text-gray-900">{user.section || "N/A"}</p>
              </div>
              <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Supervisor</p>
                <p className="text-base font-semibold text-gray-900">
                  {supervisor ? (supervisor.firstname || supervisor.lastname ? `${supervisor.firstname || ""} ${supervisor.lastname || ""}`.trim() : supervisor.name || supervisor.idnumber) : (user.supervisorid || "N/A")}
                </p>
              </div>
              <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Supervisor Company</p>
                <p className="text-base font-semibold text-gray-900">{supervisor?.company || "N/A"}</p>
              </div>
              <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Supervisor Location</p>
                <p className="text-base font-semibold text-gray-900">{supervisor?.location || "N/A"}</p>
              </div>
            </>
          )}
          {user.role === "instructor" && (
            <div className="col-span-1 md:col-span-2 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
              <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Assigned Classes</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {user.course ? formatCourseSection(user.course, user.section).split(', ').map((cls, idx) => (
                  <span key={idx} className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-sm font-semibold border border-orange-100 shadow-sm">
                    {cls}
                  </span>
                )) : <span className="text-gray-400 italic">No classes assigned</span>}
              </div>
            </div>
          )}
          {user.role === "supervisor" && (
            <>
              <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Company</p>
                <p className="text-base font-semibold text-gray-900">{user.company || "N/A"}</p>
              </div>
              <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Location</p>
                <p className="text-base font-semibold text-gray-900">{user.location || "N/A"}</p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-8">
        <button
          onClick={onClose}
          className="w-full rounded-xl bg-gray-100 py-3.5 text-gray-700 font-bold hover:bg-gray-200 transition-colors"
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
  const [supervisorCourseFilter, setSupervisorCourseFilter] = useState("");
  const [supervisorSectionFilter, setSupervisorSectionFilter] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());
  const [selectedSupervisorId, setSelectedSupervisorId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);

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

  const supervisorCourses = useMemo(
    () =>
      Array.from(
        new Set(
          supervisors
            .flatMap((u) => String(u.course || "").split(",").map((s) => s.trim()))
            .filter(Boolean)
        )
      ).sort(),
    [supervisors]
  );

  const supervisorSections = useMemo(() => {
    const subset = supervisorCourseFilter
      ? supervisors.filter((u) =>
          String(u.course || "")
            .split(",")
            .map((s) => s.trim())
            .includes(supervisorCourseFilter)
        )
      : supervisors;
    return Array.from(
      new Set(
        subset
          .flatMap((u) => String(u.section || "").split(",").map((s) => s.trim()))
          .filter(Boolean)
      )
    ).sort();
  }, [supervisors, supervisorCourseFilter]);

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
      if (supervisorCourseFilter) {
        const courses = String(u.course || "")
          .split(",")
          .map((s) => s.trim());
        if (!courses.includes(supervisorCourseFilter)) return false;
      }
      if (supervisorSectionFilter) {
        const sections = String(u.section || "")
          .split(",")
          .map((s) => s.trim());
        if (!sections.includes(supervisorSectionFilter)) return false;
      }
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
  }, [supervisors, supervisorSearch, supervisorCourseFilter, supervisorSectionFilter]);

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

  const handleAssign = async () => {
    if (selectedStudentIds.size === 0 || !selectedSupervisorId) {
      setAssignMessage("Select at least one student and a supervisor.");
      return;
    }
    const supervisor = supervisors.find(
      (u) => u.idnumber === selectedSupervisorId
    );
    const count = selectedStudentIds.size;
    const supervisorLabel =
      (supervisor &&
        (`${supervisor.firstname || ""} ${supervisor.lastname || ""}`.trim() ||
          supervisor.name ||
          supervisor.idnumber)) ||
      selectedSupervisorId;
    const confirmed = window.confirm(
      `Assign ${supervisorLabel} to ${count} student${count > 1 ? "s" : ""}?`
    );
    if (!confirmed) return;

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
          return;
        }
      }

      setSelectedStudentIds(new Set());
      setSelectedSupervisorId("");
      setStudentSearch("");
      setSupervisorSearch("");
      if (onRefresh) onRefresh();
    } finally {
      setAssignLoading(false);
    }
  };

  const assignDisabled =
    assignLoading ||
    selectedStudentIds.size === 0 ||
    !selectedSupervisorId ||
    filteredStudents.length === 0;

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">
          Assign Supervisor
        </h2>
      </div>

      <div className="flex-1 p-4 bg-gray-50/30 max-h-[calc(100vh-180px)] overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col min-h-[460px]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Students Without Supervisor
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {unsupervisedStudents.length} total student
                  {unsupervisedStudents.length === 1 ? "" : "s"} available
                </p>
              </div>
              <button
                onClick={toggleAllStudents}
                disabled={filteredStudents.length === 0}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Select All
              </button>
            </div>
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"
                  size={16}
                />
                <input
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search by name, ID, course or section..."
                  className="w-full pl-10 pr-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] shadow-sm"
                />
              </div>
              <div className="mt-3 flex flex-wrap sm:flex-nowrap gap-2">
                <select
                  value={studentCourseFilter}
                  onChange={(e) => {
                    setStudentCourseFilter(e.target.value);
                    setStudentSectionFilter("");
                  }}
                  className="flex-1 min-w-0 px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] shadow-sm"
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
                  className="flex-1 min-w-0 px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] shadow-sm"
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
            <div className="flex-1 overflow-y-auto mt-2 space-y-2">
              {filteredStudents.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  No students without supervisor match your filters.
                </div>
              ) : (
                filteredStudents.map((s) => {
                  const isSelected = selectedStudentIds.has(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleStudent(s.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border bg-white text-left transition-all ${
                        isSelected
                          ? "border-[#F97316] bg-orange-50/60 shadow-sm"
                          : "border-gray-200 hover:border-orange-200 hover:bg-orange-50/40"
                      }`}
                    >
                      <div
                        className={`h-5 w-5 rounded-md border flex items-center justify-center ${
                          isSelected
                            ? "border-[#F97316] bg-[#F97316]"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {isSelected && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
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
                        <div className="h-9 w-9 rounded-full bg-orange-50 text-[#F97316] border border-orange-100 flex items-center justify-center text-xs font-bold">
                          {(s.firstname?.[0] || s.idnumber[0]).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {s.firstname} {s.lastname}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
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

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col min-h-[460px]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Choose Supervisor
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {supervisors.length} supervisor
                  {supervisors.length === 1 ? "" : "s"} available
                </p>
              </div>
              <div className="text-[11px] text-gray-500 font-medium">
                {selectedStudentIds.size} selected student
                {selectedStudentIds.size === 1 ? "" : "s"}
              </div>
            </div>
            <div className="sticky top-0 z-10 bg-white px-4 py-2 border-b border-gray-100 flex flex-wrap sm:flex-nowrap justify-end gap-2">
              <button
                onClick={() => {
                  setSelectedStudentIds(new Set());
                  setSelectedSupervisorId("");
                  setStudentSearch("");
                  setSupervisorSearch("");
                  setAssignMessage(null);
                  setStudentCourseFilter("");
                  setStudentSectionFilter("");
                  setSupervisorCourseFilter("");
                  setSupervisorSectionFilter("");
                }}
                className="px-3.5 py-1.5 rounded-2xl border border-gray-300 bg-white text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Clear Selection
              </button>
              <button
                onClick={handleAssign}
                disabled={assignDisabled}
                className="px-4 py-1.5 rounded-2xl bg-[#F97316] text-white text-xs sm:text-sm font-bold hover:bg-[#EA580C] transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assignLoading ? "Assigning..." : "Assign Supervisor"}
              </button>
            </div>
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"
                  size={16}
                />
                <input
                  value={supervisorSearch}
                  onChange={(e) => setSupervisorSearch(e.target.value)}
                  placeholder="Search by name, ID, company or location..."
                  className="w-full pl-10 pr-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] shadow-sm"
                />
              </div>
              <div className="mt-3 flex flex-wrap sm:flex-nowrap gap-2">
                <select
                  value={supervisorCourseFilter}
                  onChange={(e) => {
                    setSupervisorCourseFilter(e.target.value);
                    setSupervisorSectionFilter("");
                  }}
                  className="flex-1 min-w-0 px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] shadow-sm"
                >
                  <option value="">All Courses</option>
                  {supervisorCourses.map((course) => (
                    <option key={course} value={course}>
                      {course}
                    </option>
                  ))}
                </select>
                <select
                  value={supervisorSectionFilter}
                  onChange={(e) => setSupervisorSectionFilter(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] shadow-sm"
                >
                  <option value="">All Sections</option>
                  {supervisorSections.map((section) => (
                    <option key={section} value={section}>
                      {section}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto mt-2 space-y-2">
              {filteredSupervisors.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
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
                      className={`w-full flex items-center justify-between p-3 rounded-xl border bg-white text-left transition-all ${
                        isActive
                          ? "border-[#F97316] bg-orange-50/60 shadow-sm"
                          : "border-gray-200 hover:border-orange-200 hover:bg-orange-50/40"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-orange-50 text-[#F97316] border border-orange-100 flex items-center justify-center text-xs font-bold">
                          {(u.firstname?.[0] || u.idnumber[0]).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {`${u.firstname || ""} ${u.lastname || ""}`.trim() ||
                              u.name ||
                              u.idnumber}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {u.idnumber} • {u.company || "Company N/A"}{" "}
                            {u.location && `• ${u.location}`}
                          </p>
                        </div>
                      </div>
                      {isActive && (
                        <div className="h-6 w-6 rounded-full bg-[#F97316] text-white flex items-center justify-center text-xs font-bold">
                          ✓
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {assignMessage && (
          <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
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
  const title = role.charAt(0).toUpperCase() + role.slice(1) + "s";

  const { activeUsers, pendingUsers, availableCourses: courses, availableSections: sections } = useMemo(() => {
    const s = search.toLowerCase();
    const targetRole = role.toLowerCase();
    
    // First get all users for this role
    const roleUsers = users.filter(u => u.role?.toLowerCase() === targetRole);
    
    const userCourses = Array.from(new Set(roleUsers.map(u => u.course).filter(Boolean))).sort() as string[];
    const userSections = Array.from(new Set(roleUsers.map(u => u.section).filter(Boolean))).sort() as string[];
    
    const filterFn = (u: User) => 
      (courseFilter === "" || u.course === courseFilter) &&
      (sectionFilter === "" || u.section === sectionFilter) &&
      (u.idnumber?.toLowerCase().includes(s) || 
       u.firstname?.toLowerCase().includes(s) || 
       u.lastname?.toLowerCase().includes(s));

    let active: User[] = [];
    // We don't show pending users in the main views anymore - they go to ApprovalsView (for students)
    // or are treated as active (for others who don't need approval)
    
    if (role === 'student') {
      active = roleUsers.filter(u => u.signup_status !== 'PENDING').filter(filterFn);
    } else {
      // For instructors/supervisors, show everyone in the main list as they don't need approval
      active = roleUsers.filter(filterFn);
    }

    return { 
      activeUsers: active, 
      pendingUsers: [] as User[], // Always empty to hide the pending section in main views
      availableCourses: userCourses, 
      availableSections: userSections 
    };
  }, [users, role, search, courseFilter, sectionFilter]);

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">{title} Directory</h2>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Manage and monitor {role} accounts
          </p>
        </div>
        <button
            onClick={onAdd}
            className="flex items-center justify-center gap-2 bg-[#F97316] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-[#EA580C] transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
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
            Add New {role}
          </button>
      </div>

      {/* Search & Filter */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search by name or ID...`}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-all shadow-sm"
          />
        </div>
        
        {(role === "student" || role === "instructor" || courses.length > 0 || sections.length > 0) && (
          <div className="flex gap-2">
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] text-gray-700 min-w-[140px] shadow-sm"
            >
              <option value="">All Courses</option>
              {courses.map(course => (
                <option key={course} value={course}>{course}</option>
              ))}
            </select>
            
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] text-gray-700 min-w-[140px] shadow-sm"
            >
              <option value="">All Sections</option>
              {sections.map(section => (
                <option key={section} value={section}>{section}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/30">
        {pendingUsers.length > 0 && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse"></div>
              <h3 className="text-xs font-bold text-orange-600 uppercase tracking-widest">Pending Approvals</h3>
              <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{pendingUsers.length}</span>
            </div>
            <div className="space-y-3">
              {pendingUsers.map((user) => (
                <div key={user.id} className="group flex items-center justify-between p-4 rounded-2xl bg-orange-50 border border-orange-100 shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className="flex-shrink-0 h-12 w-12 rounded-full bg-white text-[#F97316] border border-orange-200 flex items-center justify-center font-bold text-lg shadow-sm">
                      {(user.firstname?.[0] || user.idnumber[0]).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">
                          {user.firstname} {user.lastname}
                        </h3>
                        <span className="px-2 py-0.5 bg-orange-200 text-orange-800 text-[10px] font-bold rounded-md uppercase tracking-wide">Pending</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 mt-0.5">
                        <span className="font-medium bg-white/50 px-2 py-0.5 rounded-md border border-orange-100">{user.idnumber}</span>
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
                        className="px-4 py-2 bg-[#F97316] text-white text-xs font-bold rounded-xl hover:bg-[#EA580C] shadow-sm hover:shadow-orange-200 transition-all active:scale-95"
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
              activeUsers.map((user) => {
                const isInstructor = role === "instructor";
                const approvalAllowed = isInstructor
                  ? instructorApprovalStatuses?.[user.idnumber] ?? true
                  : undefined;
                return (
                  <div key={user.id} className="group flex items-center justify-between p-4 rounded-2xl bg-white border border-gray-100 hover:border-orange-200 hover:shadow-md transition-all duration-200">
                    <div className="flex items-center gap-4 overflow-hidden">
                      <div className="flex-shrink-0 h-12 w-12 rounded-full bg-orange-50 text-[#F97316] border border-orange-100 flex items-center justify-center font-bold text-lg">
                        {(user.firstname?.[0] || user.idnumber[0]).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">
                          {user.firstname} {user.lastname}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-500">
                          <span className="font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">{user.idnumber}</span>
                          {user.course && (
                            <span className="truncate">
                              • {user.role === 'instructor' 
                                  ? formatCourseSection(user.course, user.section) 
                                  : `${user.course} - ${user.section}`}
                            </span>
                          )}
                          {user.company && <span className="truncate">• {user.company}</span>}
                        </div>
                        {isInstructor && approvalAllowed !== undefined && onToggleInstructorApproval && (
                          <div className="mt-2 flex items-center gap-3">
                            <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
                              Account Approval
                            </span>
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <span className="text-[11px] text-gray-500">
                                {approvalAllowed ? "Enabled" : "Restricted"}
                              </span>
                              <div className="relative">
                                <input
                                  type="checkbox"
                                  className="sr-only peer"
                                  checked={approvalAllowed}
                                  onChange={() => onToggleInstructorApproval(user.idnumber, approvalAllowed)}
                                />
                                <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all" />
                              </div>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all duration-200">
                      <button 
                        onClick={() => onView(user)}
                        className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                        title="View Details"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      </button>
                      <button 
                        onClick={() => onEdit(user)}
                        className="p-2.5 text-gray-400 hover:text-[#F97316] hover:bg-orange-50 rounded-xl transition-colors"
                        title="Edit User"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      </button>
                      <button 
                        onClick={() => onDelete(user)}
                        className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        title="Delete User"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
