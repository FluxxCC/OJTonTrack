"use client";
import React, { useState, useMemo } from "react";

export type RoleType = "student" | "instructor" | "supervisor";

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

// --- Helper Components ---

export function Modal({ children, onClose, className }: { children: React.ReactNode; onClose: () => void; className?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className={`relative w-full max-h-[85vh] rounded-2xl bg-white shadow-2xl overflow-y-auto animate-in fade-in zoom-in duration-200 ${className || "max-w-lg"}`}>
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

export function SuccessModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-6 ring-8 ring-green-50/50">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Successfully Added!</h3>
        <p className="text-gray-500 mb-8 max-w-sm mx-auto leading-relaxed">{message}</p>
        <button
          onClick={onClose}
          className="min-w-[120px] py-3 px-6 bg-[#F97316] hover:bg-[#ea6a12] text-white font-bold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-orange-500/20"
        >
          Continue
        </button>
      </div>
    </Modal>
  );
}

export function ConfirmationModal({ 
  message, 
  onConfirm, 
  onCancel,
  title = "Are you sure?",
  confirmLabel = "Yes, Add User",
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
      btn: "bg-[#F97316] hover:bg-[#ea6a12] shadow-orange-500/20"
    },
    danger: {
      bg: "bg-red-50",
      text: "text-red-500",
      ring: "ring-red-50/50",
      btn: "bg-red-600 hover:bg-red-700 shadow-red-500/20"
    },
    success: {
      bg: "bg-green-50",
      text: "text-green-500",
      ring: "ring-green-50/50",
      btn: "bg-green-600 hover:bg-green-700 shadow-green-500/20"
    }
  };
  
  const currentStyle = styles[variant] || styles.warning;

  const showNoteField = Boolean(noteLabel);
  const canConfirm = !noteRequired || (noteValue && noteValue.trim().length > 0);

  return (
    <Modal onClose={() => !isLoading && onCancel()}>
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className={`w-20 h-20 ${currentStyle.bg} ${currentStyle.text} rounded-full flex items-center justify-center mb-6 ring-8 ${currentStyle.ring}`}>
          {isLoading ? (
             <svg className="w-10 h-10 animate-spin" fill="none" viewBox="0 0 24 24">
               <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
               <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
             </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          )}
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{isLoading ? "Processing..." : title}</h3>
        <p className="text-gray-500 mb-6 max-w-sm mx-auto leading-relaxed">
          {isLoading ? "Please wait while we process your request." : message}
        </p>
        {showNoteField && !isLoading && (
          <div className="w-full max-w-md mx-auto mb-6 text-left">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {noteLabel}{noteRequired ? " *" : ""}
            </label>
            <textarea
              value={noteValue || ""}
              onChange={e => onNoteChange && onNoteChange(e.target.value)}
              className="w-full min-h-[90px] rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all resize-none"
              placeholder={noteRequired ? "Required. Explain the reason for rejection..." : "Optional note..."}
              disabled={isLoading}
            />
          </div>
        )}
        <div className="flex gap-4">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="min-w-[120px] py-3 px-6 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm || isLoading}
            className={`min-w-[120px] py-3 px-6 text-white font-bold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg ${currentStyle.btn} ${(!canConfirm || isLoading) ? "opacity-60 cursor-not-allowed hover:scale-100" : ""}`}
          >
            {isLoading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function AlertModal({ 
  message, 
  onClose,
  title = "Notice",
  btnLabel = "Close",
  variant = "warning"
}: { 
  message: string; 
  onClose: () => void; 
  title?: string;
  btnLabel?: string;
  variant?: "warning" | "danger" | "success";
}) {
  const styles = {
    warning: {
      bg: "bg-orange-50",
      text: "text-orange-500",
      ring: "ring-orange-50/50",
      btn: "bg-[#F97316] hover:bg-[#ea6a12] shadow-orange-500/20"
    },
    danger: {
      bg: "bg-red-50",
      text: "text-red-500",
      ring: "ring-red-50/50",
      btn: "bg-red-600 hover:bg-red-700 shadow-red-500/20"
    },
    success: {
      bg: "bg-green-50",
      text: "text-green-500",
      ring: "ring-green-50/50",
      btn: "bg-green-600 hover:bg-green-700 shadow-green-500/20"
    }
  };
  
  const currentStyle = styles[variant] || styles.warning;

  return (
    <Modal onClose={onClose}>
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className={`w-20 h-20 ${currentStyle.bg} ${currentStyle.text} rounded-full flex items-center justify-center mb-6 ring-8 ${currentStyle.ring}`}>
          {variant === 'success' ? (
             <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          ) : (
             <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          )}
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-500 mb-8 max-w-sm mx-auto leading-relaxed">{message}</p>
        <button
          onClick={onClose}
          className={`min-w-[120px] py-3 px-6 text-white font-bold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg ${currentStyle.btn}`}
        >
          {btnLabel}
        </button>
      </div>
    </Modal>
  );
}

const MultiSelect = ({ options, value, onChange, placeholder }: { options: {id: number, name: string}[], value: number[], onChange: (val: number[]) => void, placeholder: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="w-full text-left rounded-xl border border-gray-300 px-3 py-2.5 text-[#1F2937] bg-white flex justify-between items-center focus:ring-2 focus:ring-[#F97316]/20 transition-all">
        <span className="truncate block text-sm">
          {value.length > 0 
            ? options.filter(o => value.includes(o.id)).map(o => o.name).join(", ") 
            : <span className="text-gray-400">{placeholder}</span>}
        </span>
        <span className="text-xs text-gray-400">▼</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-white border rounded-xl shadow-lg p-2 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100" style={{ borderColor: "#E5E7EB" }}>
            {options.map(opt => (
              <label key={opt.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-orange-50 rounded-lg cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={value.includes(opt.id)}
                  onChange={(e) => {
                    if (e.target.checked) onChange([...value, opt.id]);
                    else onChange(value.filter(v => v !== opt.id));
                  }}
                  className="rounded border-gray-300 text-[#F97316] focus:ring-[#F97316]"
                />
                <span className="text-sm text-[#1F2937]">{opt.name}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// --- Forms ---

export function AddUserForm({ role, onSuccess, onClose, availableCourses, availableSections, users, allowedCourses, allowedSections }: { 
  role: RoleType; 
  onSuccess: () => void; 
  onClose: () => void;
  availableCourses: Course[];
  availableSections: Section[];
  users: User[];
  allowedCourses: Course[];
  allowedSections: Section[];
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
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSupervisorPicker, setShowSupervisorPicker] = useState(false);
  const [supervisorSearch, setSupervisorSearch] = useState("");
  const title = role.charAt(0).toUpperCase() + role.slice(1);

  // Instructor-specific logic: Only use allowed courses/sections
  // Filter sections based on selected course (if any)
  const visibleSections = useMemo(() => {
     if (form.courseIds.length === 0) return [];
     const selectedCourseId = form.courseIds[0];
     return allowedSections.filter(s => s.course_id === selectedCourseId);
  }, [form.courseIds, allowedSections]);

  const eligibleSupervisors = useMemo(() => {
    const q = supervisorSearch.toLowerCase().trim();
    return users
      .filter(u => String(u.role).toLowerCase() === "supervisor")
      .filter(u => {
        if (!q) return true;
        const name = `${u.firstname || ""} ${u.lastname || ""}`.toLowerCase();
        const id = (u.idnumber || "").toLowerCase();
        const company = (u.company || "").toLowerCase();
        const location = (u.location || "").toLowerCase();
        return name.includes(q) || id.includes(q) || company.includes(q) || location.includes(q);
      });
  }, [users, supervisorSearch]);

  const handleSubmitInit = () => {
    if (!form.idnumber || !form.password) {
      setMessage("ID Number and Password are required");
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setShowConfirm(false);
    setLoading(true);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = {
        role,
        idnumber: form.idnumber.trim(),
        password: form.password,
        firstname: form.firstname || undefined,
        lastname: form.lastname || undefined,
        course: form.course || undefined,
        section: form.section || undefined,
        courseIds: form.courseIds.length > 0 ? form.courseIds : undefined,
        sectionIds: form.sectionIds.length > 0 ? form.sectionIds : undefined,
        supervisorid: form.supervisorid || undefined,
        company: form.company || undefined,
        location: form.location || undefined,
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
      {showConfirm && (
        <ConfirmationModal 
          message={`Are you sure you want to add this ${role}? This action will create a new account.`}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}
      <h2 className="text-2xl font-bold text-[#1F2937] mb-6">Add New {title}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">ID Number</span>
          <input
            value={form.idnumber}
            onChange={(e) => setForm({ ...form, idnumber: e.target.value })}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-black placeholder-gray-600 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="e.g. 2021-00001"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Password</span>
          <input
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-black placeholder-gray-600 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="Temporary password"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">First Name</span>
          <input
            value={form.firstname}
            onChange={(e) => setForm({ ...form, firstname: e.target.value })}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-black placeholder-gray-600 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="First name"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Last Name</span>
          <input
            value={form.lastname}
            onChange={(e) => setForm({ ...form, lastname: e.target.value })}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-black placeholder-gray-600 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="Last name"
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
                  const course = allowedCourses.find(c => c.id === id);
                  setForm({
                    ...form,
                    courseIds: id ? [id] : [],
                    course: course?.name || "",
                    sectionIds: [],
                    section: ""
                  });
                }}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-black focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all bg-white"
              >
                <option value="">Select course</option>
                {allowedCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Section</span>
              <select
                value={form.sectionIds[0] || ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  const section = allowedSections.find(s => s.id === id);
                  setForm({
                    ...form,
                    sectionIds: id ? [id] : [],
                    section: section?.name || ""
                  });
                }}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-black focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all bg-white"
              >
                <option value="">{form.courseIds.length === 0 ? "Select course first" : "Select section"}</option>
                {visibleSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          </>
        )}
        {role === "supervisor" && (
          <>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Assigned Courses</span>
              <MultiSelect 
                options={allowedCourses} 
                value={form.courseIds} 
                onChange={(ids) => {
                  const names = allowedCourses.filter(c => ids.includes(c.id)).map(c => c.name).join(", ");
                  setForm({...form, courseIds: ids, course: names});
                }} 
                placeholder="Select courses" 
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Assigned Sections</span>
              <MultiSelect 
                options={allowedSections.filter(s => form.courseIds.includes(s.course_id))}
                value={form.sectionIds} 
                onChange={(ids) => {
                  const names = allowedSections.filter(s => ids.includes(s.id)).map(s => s.name).join(", ");
                  setForm({...form, sectionIds: ids, section: names});
                }} 
                placeholder="Select sections" 
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Company</span>
              <input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-black placeholder-gray-600 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
                placeholder="Company name"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Location</span>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-black placeholder-gray-600 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
                placeholder="Location"
              />
            </label>
          </>
        )}
        {role === "student" && (
          <div className="grid gap-1.5">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Supervisor</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowSupervisorPicker(true)}
                disabled={form.courseIds.length === 0 || form.sectionIds.length === 0}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm transition-all ${
                  form.courseIds.length === 0 || form.sectionIds.length === 0
                    ? "border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed"
                    : "border-gray-300 text-[#1F2937] bg-white hover:border-orange-300 hover:bg-orange-50"
                }`}
              >
                {form.supervisorid
                  ? (() => {
                      const u = users.find(x => x.role.toLowerCase() === "supervisor" && x.idnumber === form.supervisorid);
                      const name = u ? `${u.firstname || ""} ${u.lastname || ""}`.trim() || (u.name || u.idnumber) : form.supervisorid;
                      return `Selected: ${name}`;
                    })()
                  : (form.courseIds.length === 0 || form.sectionIds.length === 0 ? "Select course & section first" : "Choose Supervisor")}
              </button>
              {form.supervisorid && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, supervisorid: "" })}
                  className="px-3 py-2 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            {showSupervisorPicker && (
              <Modal onClose={() => setShowSupervisorPicker(false)}>
                <div className="p-6 sm:p-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">Select Supervisor</h3>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                      {eligibleSupervisors.length}
                    </span>
                  </div>
                  <div className="grid gap-3 mb-4">
                    <input
                      type="text"
                      value={supervisorSearch}
                      onChange={(e) => setSupervisorSearch(e.target.value)}
                      placeholder="Search by name, ID, company or location..."
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-black placeholder-gray-600 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {eligibleSupervisors.length === 0 ? (
                      <div className="p-6 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500 text-sm">
                        No supervisors match the selected course and section.
                      </div>
                    ) : (
                      eligibleSupervisors.map((u) => (
                        <div key={u.id} className="flex items-center justify-between p-4 rounded-xl bg-white border border-gray-200 hover:border-orange-200 hover:bg-orange-50/40 transition-all">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold flex-shrink-0">
                              {(u.firstname?.[0] || u.lastname?.[0] || u.idnumber?.[0] || "S").toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-gray-900 truncate">
                                {u.firstname} {u.lastname}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {u.idnumber} • {u.company || "No company"} • {u.location || "No location"}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => { setForm({ ...form, supervisorid: u.idnumber }); setShowSupervisorPicker(false); }}
                            className="px-3 py-2 rounded-lg text-sm font-bold bg-[#F97316] text-white hover:bg-[#EA580C] transition-colors"
                          >
                            Select
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </Modal>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-3">
        {message && <div className="text-sm text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">{message}</div>}
        <button
          onClick={handleSubmitInit}
          disabled={loading}
          className="w-full rounded-xl bg-[#F97316] py-3.5 text-white font-bold hover:bg-[#EA580C] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-orange-200"
        >
          {loading ? "Adding..." : "Add User"}
        </button>
      </div>
    </div>
  );
}

export function EditUserForm({ user, onSuccess, onClose, availableCourses = [], availableSections = [] }: { 
  user: User; 
  onSuccess: () => void; 
  onClose: () => void;
  availableCourses?: Course[];
  availableSections?: Section[];
}) {
  const [form, setForm] = useState<{
    idnumber: string;
    firstname: string;
    lastname: string;
    course: string;
    section: string;
    company: string;
    location: string;
    password: string;
    courseIds: number[];
    sectionIds: number[];
  }>({
    idnumber: user.idnumber || "",
    firstname: user.firstname || "",
    lastname: user.lastname || "",
    course: user.course || "",
    section: user.section || "",
    company: user.company || "",
    location: user.location || "",
    password: "",
    courseIds: user.courseIds || [],
    sectionIds: user.sectionIds || [],
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = {
        idnumber: form.idnumber.trim(),
        firstname: form.firstname || undefined,
        lastname: form.lastname || undefined,
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
        courseIds: form.courseIds,
        sectionIds: form.sectionIds,
      };
      if (form.password) payload.password = form.password;

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
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-black placeholder-gray-600 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="e.g. 2021-00001"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">New Password (Optional)</span>
          <input
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-black placeholder-gray-600 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="Leave blank to keep current"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">First Name</span>
          <input
            value={form.firstname}
            onChange={(e) => setForm({ ...form, firstname: e.target.value })}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-black placeholder-gray-600 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="First name"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Last Name</span>
          <input
            value={form.lastname}
            onChange={(e) => setForm({ ...form, lastname: e.target.value })}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-black placeholder-gray-600 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
            placeholder="Last name"
          />
        </label>
        {user.role === "supervisor" && (
          <>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Assigned Courses</span>
              <MultiSelect 
                options={availableCourses} 
                value={form.courseIds} 
                onChange={(ids) => {
                  const names = availableCourses.filter(c => ids.includes(c.id)).map(c => c.name).join(", ");
                  setForm({...form, courseIds: ids, course: names});
                }} 
                placeholder="Select courses" 
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Assigned Sections</span>
              <MultiSelect 
                options={availableSections.filter(s => form.courseIds.includes(s.course_id))}
                value={form.sectionIds} 
                onChange={(ids) => {
                  const names = availableSections.filter(s => ids.includes(s.id)).map(s => s.name).join(", ");
                  setForm({...form, sectionIds: ids, section: names});
                }} 
                placeholder="Select sections" 
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Company</span>
              <input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-black placeholder-gray-600 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
                placeholder="Company name"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Location</span>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-black placeholder-gray-600 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
                placeholder="Location"
              />
            </label>
          </>
        )}
        {(user.role === "student" || user.role === "instructor") && (
          <>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Course</span>
              <input
                value={form.course}
                onChange={(e) => setForm({ ...form, course: e.target.value })}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-black placeholder-gray-600 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
                placeholder="BSIT"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Section</span>
              <input
                value={form.section}
                onChange={(e) => setForm({ ...form, section: e.target.value })}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-black placeholder-gray-600 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
                placeholder="4A"
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
          {(user.role === "student" || user.role === "instructor") && (
            <>
              <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Course</p>
                <p className="text-base font-semibold text-gray-900">{user.course || "N/A"}</p>
              </div>
              <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Section</p>
                <p className="text-base font-semibold text-gray-900">{user.section || "N/A"}</p>
              </div>
              {user.role === "student" && (
                <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Supervisor</p>
                  <p className="text-base font-semibold text-gray-900">
                    {supervisor ? (supervisor.firstname || supervisor.lastname ? `${supervisor.firstname || ""} ${supervisor.lastname || ""}`.trim() : supervisor.name || supervisor.idnumber) : (user.supervisorid || "N/A")}
                  </p>
                </div>
              )}
              {user.role === "student" && (
                <>
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
            </>
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

export function UsersView({ 
  role, 
  users, 
  attendanceSummary,
  onAdd, 
  onEdit, 
  onView, 
  onDelete,
  onApprove,
  hideAddButton = false,
  onRefresh
}: {  
  role: RoleType; 
  users: User[]; 
  attendanceSummary?: Record<string, number>;
  onAdd: () => void; 
  onEdit: (user: User) => void;
  onView: (user: User) => void;
  onDelete: (user: User) => void;
  onApprove?: (user: User) => void;
  hideAddButton?: boolean;
  onRefresh?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [confirmAction, setConfirmAction] = useState<{
    type: "single";
    id: number;
    action: "reject";
    user: User;
  } | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const title = role.charAt(0).toUpperCase() + role.slice(1) + "s";

  const performRejection = async (id: number, note: string) => {
    setActionLoading(id);
    try {
      const actorId = typeof window !== "undefined" ? localStorage.getItem("idnumber") || "SYSTEM" : "SYSTEM";
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signup_status: "REJECTED",
          actorId,
          actorRole: "instructor",
          reason: "Instructor Rejection",
          rejectionNote: note
        }),
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to reject");
      }
      
      if (onRefresh) onRefresh();
    } catch (e: any) {
      alert(e.message || "Failed to reject student");
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
      setRejectionNote("");
    }
  };

  const { activeUsers, pendingUsers } = useMemo(() => {
    const s = search.toLowerCase();
    const targetRole = role.toLowerCase();
    
    const roleUsers = users.filter(u => u.role?.toLowerCase() === targetRole);
    
    const filterFn = (u: User) => 
      (u.idnumber?.toLowerCase().includes(s) || 
       u.firstname?.toLowerCase().includes(s) || 
       u.lastname?.toLowerCase().includes(s));

    const pending = roleUsers.filter(u => u.signup_status === 'PENDING').filter(filterFn);
    const active = roleUsers.filter(u => u.signup_status !== 'PENDING').filter(filterFn);

    return { activeUsers: active, pendingUsers: pending };
  }, [users, role, search]);

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white">
        <div>
          <h2 className="text-base font-bold text-gray-900 tracking-tight">{title} Directory</h2>
          <p className="text-[10px] text-gray-500 font-medium">
            Manage and monitor {role} accounts
          </p>
        </div>
        {!hideAddButton && (
          <button 
            onClick={onAdd}
            className="flex items-center justify-center gap-2 bg-[#F97316] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#EA580C] transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add New {role}
          </button>
        )}
      </div>

      {/* Search */}
      <div className="px-3 py-1.5 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search by name or ID...`}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] text-black transition-all shadow-sm"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-0 space-y-0 bg-gray-50/30">
        {/* Pending Section */}
        {pendingUsers.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3 px-2">
              <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse"></div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Pending Approval ({pendingUsers.length})</h3>
            </div>
            <div className="space-y-3">
              {pendingUsers.map((user) => (
                <div key={user.id} className="group flex items-center justify-between p-4 rounded-2xl bg-orange-50 border border-orange-200 shadow-sm">
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className="flex-shrink-0 h-12 w-12 rounded-full bg-white text-[#F97316] border border-orange-100 flex items-center justify-center font-bold text-lg">
                      {(user.firstname?.[0] || user.idnumber[0]).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">
                          {user.firstname} {user.lastname}
                        </h3>
                        <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 text-xs font-bold">PENDING</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500">
                        <span className="font-medium text-gray-600 bg-white/50 px-2 py-0.5 rounded-md">{user.idnumber}</span>
                        {user.course && <span className="truncate">{user.course} - {user.section}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {onApprove && (
                      <button 
                        onClick={() => onApprove(user)}
                        className="px-4 py-2 bg-[#F97316] text-white text-sm font-bold rounded-xl hover:bg-[#EA580C] shadow-sm hover:shadow transition-all"
                      >
                        Approve
                      </button>
                    )}
                    <button 
                      onClick={() => onDelete(user)}
                      className="px-4 py-2 bg-white border border-red-200 text-red-600 text-sm font-bold rounded-xl hover:bg-red-50 transition-all"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="my-6 border-t border-gray-200/60 dashed"></div>
          </div>
        )}

        {/* Active Users */}
        {activeUsers.length === 0 && pendingUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <div className="p-4 rounded-full bg-gray-100 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
            <p className="font-medium">No {role}s found matching your criteria.</p>
          </div>
        ) : (
          activeUsers.map((user) => (
            <div key={user.id} className="group flex items-center justify-between p-4 rounded-2xl bg-white border border-gray-100 hover:border-orange-200 hover:shadow-md transition-all duration-200">
              <div className="flex items-center gap-4 overflow-hidden">
                <div className="flex-shrink-0 h-12 w-12 rounded-full bg-orange-50 text-[#F97316] border border-orange-100 flex items-center justify-center font-bold text-lg">
                  {(user.firstname?.[0] || user.idnumber[0]).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">
                    {user.firstname} {user.lastname}
                  </h3>
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500">
                    <span className="font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">{user.idnumber}</span>
                    {user.course && <span className="truncate">{user.course} - {user.section}</span>}
                    {user.company && <span className="truncate">{user.company}</span>}
                    {role === 'student' && attendanceSummary && (
                        <span className="font-bold text-[#F97316] bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100 whitespace-nowrap">
                           {((attendanceSummary[user.idnumber] || 0) / (1000 * 60 * 60)).toFixed(2)} hrs
                        </span>
                    )}
                  </div>
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
          ))
        )}
      </div>
    </div>
  );
}
