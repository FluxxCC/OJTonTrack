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
  
  const courses = courseStr.split(',').map(s => s.trim());
  const sections = sectionStr.split(',').map(s => s.trim());
  
  if (courses.length > 0 && courses.length === sections.length) {
    return courses.map((c, i) => `${c}-${sections[i]}`).join(', ');
  }
  return `${courseStr} - ${sectionStr}`;
}

// --- Helper Components ---

export function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg max-h-[85vh] rounded-2xl bg-white shadow-2xl overflow-y-auto animate-in fade-in zoom-in duration-200">
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
    if (!form.idnumber || !form.password) {
      setMessage("ID Number and Password are required");
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
    </div>
  );
}

export function EditUserForm({ user, onSuccess, onClose }: { user: User; onSuccess: () => void; onClose: () => void }) {
  const [form, setForm] = useState({
    idnumber: user.idnumber || "",
    firstname: user.firstname || "",
    lastname: user.lastname || "",
    course: user.course || "",
    section: user.section || "",
    company: user.company || "",
    location: user.location || "",
    password: "",
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
        course: form.course || undefined,
        section: form.section || undefined,
        company: form.company || undefined,
        location: form.location || undefined,
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
        {(user.role === "student" || user.role === "instructor") && (
          <>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Course</span>
              <input
                value={form.course}
                onChange={(e) => setForm({ ...form, course: e.target.value })}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
                placeholder="BSIT"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Section</span>
              <input
                value={form.section}
                onChange={(e) => setForm({ ...form, section: e.target.value })}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 outline-none transition-all"
                placeholder="4A"
              />
            </label>
          </>
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

export function UsersView({ 
  role, 
  users, 
  availableCourses,
  availableSections,
  onAdd, 
  onEdit, 
  onView, 
  onDelete 
}: { 
  role: RoleType; 
  users: User[]; 
  availableCourses: Course[];
  availableSections: Section[];
  onAdd: () => void; 
  onEdit: (user: User) => void;
  onView: (user: User) => void;
  onDelete: (user: User) => void;
}) {
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const title = role.charAt(0).toUpperCase() + role.slice(1) + "s";

  const { filteredUsers, availableCourses: courses, availableSections: sections } = useMemo(() => {
    const s = search.toLowerCase();
    const targetRole = role.toLowerCase();
    
    // First get all users for this role to determine available courses/sections
    const roleUsers = users.filter(u => u.role?.toLowerCase() === targetRole);
    
    // Extract unique courses and sections from the users present (or use props if you prefer strictly metadata)
    // But typically we want to filter by what's actually there + metadata
    const userCourses = Array.from(new Set(roleUsers.map(u => u.course).filter(Boolean))).sort() as string[];
    const userSections = Array.from(new Set(roleUsers.map(u => u.section).filter(Boolean))).sort() as string[];
    
    // We can also use the availableCourses prop if we want to show options even if no user has them
    // For now, let's stick to what's in the data + maybe metadata if needed
    // The previous implementation derived it from users, let's stick to that for consistency
    
    const filtered = roleUsers.filter(u => 
      (courseFilter === "" || u.course === courseFilter) &&
      (sectionFilter === "" || u.section === sectionFilter) &&
      (u.idnumber?.toLowerCase().includes(s) || 
       u.firstname?.toLowerCase().includes(s) || 
       u.lastname?.toLowerCase().includes(s))
    );

    return { filteredUsers: filtered, availableCourses: userCourses, availableSections: userSections };
  }, [users, role, search, courseFilter, sectionFilter]);

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
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
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
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

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
        {filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <div className="p-4 rounded-full bg-gray-100 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
            <p className="font-medium">No {role}s found matching your criteria.</p>
          </div>
        ) : (
          filteredUsers.map((user) => (
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
                    {user.course && (
                      <span className="truncate">
                        • {user.role === 'instructor' 
                            ? formatCourseSection(user.course, user.section) 
                            : `${user.course} - ${user.section}`}
                      </span>
                    )}
                    {user.company && <span className="truncate">• {user.company}</span>}
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
