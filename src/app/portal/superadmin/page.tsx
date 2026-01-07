"use client";
import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import citeLogo from "../../../../assets/CITE.png";
import { useRouter } from "next/navigation";

type User = {
  id: number;
  idnumber: string;
  role: "student" | "instructor" | "supervisor" | "coordinator" | "superadmin";
  name?: string;
  course?: string;
  section?: string;
  courseIds?: number[];
  sectionIds?: number[];
  company?: string;
  location?: string;
  supervisorid?: string;
  firstname?: string;
  middlename?: string;
  lastname?: string;
};

const roles = ["student", "instructor", "supervisor", "coordinator", "superadmin"] as const;
const roleTabs = ["student", "instructor", "supervisor", "coordinator"] as const;

type Course = { id: number; name: string; name_key: string };
type Section = { id: number; name: string; code: string; course_id: number };

const MultiSelect = ({ options, value, onChange, placeholder }: { options: {id: number, name: string}[], value: number[], onChange: (val: number[]) => void, placeholder: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="w-full text-left rounded-xl border px-3 py-2 text-[#1F2937] bg-white flex justify-between items-center" style={{ borderColor: "#E5E7EB" }}>
        <span className="truncate block text-sm">
          {value.length > 0 
            ? options.filter(o => value.includes(o.id)).map(o => o.name).join(", ") 
            : <span className="text-[#94A3B8]">{placeholder}</span>}
        </span>
        <span className="text-xs text-[#94A3B8]">▼</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-white border rounded-xl shadow-lg p-2 flex flex-col gap-1" style={{ borderColor: "#E5E7EB" }}>
            {options.map(opt => (
              <label key={opt.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
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

export default function SuperAdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [availableSections, setAvailableSections] = useState<Section[]>([]);

  // Derived combined options for Instructors
  const combinedCourseSections = useMemo(() => {
    return availableSections.map(s => {
      const c = availableCourses.find(c => c.id === s.course_id);
      return {
        id: s.id, // We use section ID as the value
        name: `${c?.name || "Unknown"} ${s.name}`,
        courseId: s.course_id
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [availableCourses, availableSections]);

  const [filter, setFilter] = useState<"all" | typeof roleTabs[number]>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [query, setQuery] = useState<string>("");
  const activeIndex = useMemo(() => Math.max(0, ["all", ...roleTabs].indexOf(filter)), [filter]);
  const [dateText, setDateText] = useState<string>("");
  useEffect(() => {
    try {
      const d = new Date();
      setDateText(d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }));
    } catch {}
  }, []);

  const [form, setForm] = useState<{
    idnumber: string;
    role: typeof roles[number];
    password: string;
    firstname?: string;
    middlename?: string;
    lastname?: string;
    course?: string;
    section?: string;
    courseIds: number[];
    sectionIds: number[];
    company?: string;
    location?: string;
    supervisorid?: string;
  }>({
    idnumber: "",
    role: "student",
    password: "",
    firstname: "",
    middlename: "",
    lastname: "",
    course: "",
    section: "",
    courseIds: [],
    sectionIds: [],
    company: "",
    location: "",
    supervisorid: "",
  });

  useEffect(() => {
    fetch("/api/metadata")
      .then(res => res.json())
      .then(data => {
        if (data.courses) setAvailableCourses(data.courses);
        if (data.sections) setAvailableSections(data.sections);
      })
      .catch(console.error);
  }, []);
  const [editing, setEditing] = useState<Record<number, Partial<User>>>({});

  const filtered = useMemo(() => {
    let base = users.filter((u) => {
      const r = String(u.role || "").toLowerCase();
      return r !== "superadmin" && r !== "super_admin";
    });
    if (filter !== "all") base = base.filter((u) => u.role === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      base = base.filter(
        (u) =>
          (u.name || "").toLowerCase().includes(q) ||
          (u.firstname || "").toLowerCase().includes(q) ||
          (u.lastname || "").toLowerCase().includes(q) ||
          (u.idnumber || "").toLowerCase().includes(q)
      );
    }
    return base;
  }, [users, filter, query]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load users");
      setUsers(json.users || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load users";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const idStr = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    const id = idStr ? Number(idStr) : null;
    setUserId(id);
    load();
  }, []);

  const addUser = async () => {
    if (!form.idnumber || !form.password) return;
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to add user");
      setShowAdd(false);
      setForm({
        idnumber: "",
        role: "student",
        password: "",
        firstname: "",
        middlename: "",
        lastname: "",
        course: "",
        section: "",
        courseIds: [],
        sectionIds: [],
        company: "",
        location: "",
        supervisorid: "",
      });
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add user";
      setError(msg);
    }
  };

  const saveEdit = async (id: number) => {
    const data = editing[id];
    if (!data) return;
    setError(null);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update user");
      const next = { ...editing };
      delete next[id];
      setEditing(next);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update user";
      setError(msg);
    }
  };

  const deleteUser = async (id: number) => {
    setError(null);
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to delete user");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete user";
      setError(msg);
    }
  };

  const logout = () => {
    try {
      localStorage.removeItem("userId");
      localStorage.removeItem("idnumber");
      localStorage.removeItem("role");
      localStorage.removeItem("name");
      localStorage.removeItem("firstname");
      localStorage.removeItem("lastname");
    } catch {}
    router.replace("/");
  };

  return (
    <div className="min-h-screen bg-[#F6F7F9]">
      <header className="w-full bg-gradient-to-b from-[#F97316] to-[#EA580C] text-white">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 md:px-8 pt-4 pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image src={citeLogo} alt="CITE" width={40} height={40} className="h-10 w-10 rounded-md object-cover" />
              <div className="text-white font-extrabold text-[1.25rem] tracking-wide">OJTonTrack • Super Admin</div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {dateText && (
                <div className="hidden sm:block text-xs sm:text-sm opacity-80">
                  {dateText}
                </div>
              )}
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold px-3 py-1.5"
              >
                Logout
              </button>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-xs opacity-80">Welcome Super Admin</div>
          </div>
        </div>
      </header>
      <main className="px-4 -mt-6">
        <div className="mx-auto w-full max-w-[1400px]">
          <div className="mt-6">
            <section className="w-full rounded-2xl bg-white shadow-[0_10px_30px_rgba(0,0,0,0.08)] border px-5 pt-5 pb-6" style={{ borderColor: "#E5E7EB" }}>
              <div className="text-[#1F2937] font-medium text-sm">Super Admin • Manage Users</div>
              <div
                className="mt-3 relative"
                role="tablist"
                aria-label="Manage users by role"
                onKeyDown={(e) => {
                  const list: Array<"all" | typeof roleTabs[number]> = ["all", ...roleTabs];
                  if (e.key === "ArrowRight") {
                    const i = activeIndex + 1 >= list.length ? 0 : activeIndex + 1;
                    setFilter(list[i]);
                  } else if (e.key === "ArrowLeft") {
                    const i = activeIndex - 1 < 0 ? list.length - 1 : activeIndex - 1;
                    setFilter(list[i]);
                  }
                }}
              >
                <div className="relative">
                  <div className="flex">
                    {(["all", ...roleTabs] as Array<"all" | typeof roleTabs[number]>).map((r) => {
                      const isActive = filter === r;
                      return (
                        <button
                          key={String(r)}
                          role="tab"
                          aria-selected={isActive}
                          tabIndex={isActive ? 0 : -1}
                          onClick={() => setFilter(r)}
                          className={`w-1/5 text-center px-3 py-1.5 text-sm md:text-base font-semibold ${
                            isActive ? "text-[#F97316]" : "text-[#64748B] hover:text-[#1F2937]"
                          } focus:outline-none focus:ring-2 focus:ring-[#F97316]/30`}
                        >
                          {String(r).charAt(0).toUpperCase() + String(r).slice(1)}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-1 h-[2px] bg-[#E5E7EB]" />
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="rounded-lg border px-3 py-2 text-sm md:text-base text-[#1F2937] bg-white"
                    style={{ borderColor: "#E5E7EB" }}
                    placeholder="Search by name or ID"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdd(true)}
                  className="inline-flex items-center justify-center rounded-lg bg-[#F97316] text-white font-semibold py-2.5 px-3.5 focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 w-full sm:w-auto hover:bg-[#EA580C] transition-colors"
                >
                  + Add User
                </button>
              </div>

              {error && <div className="mt-3 text-[#B91C1C] bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg px-3 py-2 text-sm">{error}</div>}

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm md:text-base">
                  <thead>
                    <tr className="text-left text-[#64748B]">
                      <th className="py-2 px-2">ID Number</th>
                      <th className="py-2 px-2">Name</th>
                      <th className="py-2 px-2">Role</th>
                      <th className="py-2 px-2">Course</th>
                      <th className="py-2 px-2">Section</th>
                      <th className="py-2 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td className="py-4 px-2 text-[#64748B]" colSpan={6}>Loading…</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td className="py-4 px-2 text-[#64748B]" colSpan={6}>No users found</td></tr>
                    ) : (
                      filtered.map((u) => {
                        const edit = editing[u.id] || {};
                        const isEditing = !!editing[u.id];
                        return (
                          <tr key={u.id} className="border-t" style={{ borderColor: "#E5E7EB" }}>
                            <td className="py-2 px-2">
                              {isEditing ? (
                                <input
                                  value={edit.idnumber ?? u.idnumber}
                                  onChange={(e) => setEditing({ ...editing, [u.id]: { ...edit, idnumber: e.target.value } })}
                                  className="rounded-md border px-2 py-1 text-[#1F2937] placeholder:text-[#94A3B8] bg-white"
                                  style={{ borderColor: "#E5E7EB" }}
                                />
                              ) : (
                                <span className="text-[#0F172A]">{u.idnumber}</span>
                              )}
                            </td>
                            <td className="py-2 px-2">
                              {isEditing ? (
                                <input
                                  value={edit.name ?? u.name ?? ""}
                                  onChange={(e) => setEditing({ ...editing, [u.id]: { ...edit, name: e.target.value } })}
                                  className="rounded-md border px-2 py-1 text-[#1F2937] placeholder:text-[#94A3B8] bg-white"
                                  style={{ borderColor: "#E5E7EB" }}
                                />
                              ) : (
                                <span className="text-[#0F172A]">{u.name || ""}</span>
                              )}
                            </td>
                            <td className="py-2 px-2">
                              {isEditing ? (
                                <select
                                  value={edit.role ?? u.role}
                                  onChange={(e) => setEditing({ ...editing, [u.id]: { ...edit, role: e.target.value as User["role"] } })}
                                  className="rounded-md border px-2 py-1 text-[#1F2937] bg-white"
                                  style={{ borderColor: "#E5E7EB" }}
                                >
                                  {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                                </select>
                              ) : (
                                <span className="text-[#0F172A]">{u.role}</span>
                              )}
                            </td>
                            <td className="py-2 px-2">
                              {isEditing ? (
                                (edit.role === "student" || edit.role === "coordinator" || edit.role === "instructor" || edit.role === "supervisor") ? (
                                  (edit.role === "coordinator") ? (
                                    <MultiSelect
                                      options={availableCourses}
                                      value={edit.courseIds || u.courseIds || []}
                                      onChange={(ids) => setEditing({ ...editing, [u.id]: { ...edit, courseIds: ids } })}
                                      placeholder="Select courses"
                                    />
                                  ) : (edit.role === "instructor" || edit.role === "supervisor") ? (
                                    <MultiSelect
                                      options={combinedCourseSections}
                                      value={edit.sectionIds || u.sectionIds || []}
                                      onChange={(sectionIds) => {
                                        const selectedSections = combinedCourseSections.filter(opt => sectionIds.includes(opt.id));
                                        const courseIds = Array.from(new Set(selectedSections.map(opt => opt.courseId)));
                                        setEditing({ ...editing, [u.id]: { ...edit, sectionIds, courseIds } });
                                      }}
                                      placeholder="Select course & section"
                                    />
                                  ) : (
                                    <select
                                      value={edit.courseIds?.[0] || u.courseIds?.[0] || ""}
                                      onChange={(e) => {
                                        const id = Number(e.target.value);
                                        const course = availableCourses.find(c => c.id === id);
                                        setEditing({
                                          ...editing,
                                          [u.id]: {
                                            ...edit,
                                            courseIds: id ? [id] : [],
                                            course: course?.name || ""
                                          }
                                        });
                                      }}
                                      className="rounded-md border px-2 py-1 text-[#1F2937] bg-white"
                                      style={{ borderColor: "#E5E7EB" }}
                                    >
                                      <option value="">Select course</option>
                                      {availableCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                  )
                                ) : (
                                  <input
                                    value={edit.course ?? u.course ?? ""}
                                    onChange={(e) => setEditing({ ...editing, [u.id]: { ...edit, course: e.target.value } })}
                                    className="rounded-md border px-2 py-1 text-[#1F2937] placeholder:text-[#94A3B8] bg-white"
                                    style={{ borderColor: "#E5E7EB" }}
                                  />
                                )
                              ) : (
                                <span className="text-[#0F172A]">{u.course || ""}</span>
                              )}
                            </td>
                            <td className="py-2 px-2">
                              {isEditing ? (
                                (edit.role === "coordinator" || edit.role === "instructor" || edit.role === "supervisor") ? null : (
                                  (edit.role === "student") ? (
                                      <select
                                         value={edit.sectionIds?.[0] || u.sectionIds?.[0] || ""}
                                         onChange={(e) => {
                                           const id = Number(e.target.value);
                                           const section = availableSections.find(s => s.id === id);
                                           setEditing({
                                             ...editing,
                                             [u.id]: {
                                               ...edit,
                                               sectionIds: id ? [id] : [],
                                               section: section?.name || ""
                                             }
                                           });
                                         }}
                                         className="rounded-md border px-2 py-1 text-[#1F2937] bg-white"
                                         style={{ borderColor: "#E5E7EB" }}
                                       >
                                         <option value="">
                                           {(edit.courseIds || u.courseIds || []).length === 0 ? "Select course first" : "Select section"}
                                         </option>
                                         {availableSections
                                           .filter(s => {
                                             const cIds = edit.courseIds || u.courseIds || [];
                                             return cIds.length > 0 && cIds.includes(s.course_id);
                                           })
                                           .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                       </select>
                                  ) : (
                                    <input
                                      value={edit.section ?? u.section ?? ""}
                                      onChange={(e) => setEditing({ ...editing, [u.id]: { ...edit, section: e.target.value } })}
                                      className="rounded-md border px-2 py-1 text-[#1F2937] placeholder:text-[#94A3B8] bg-white"
                                      style={{ borderColor: "#E5E7EB" }}
                                    />
                                  )
                                )
                              ) : (
                                <span className="text-[#0F172A]">{u.section || ""}</span>
                              )}
                            </td>
                            <td className="py-2 px-2">
                              {isEditing ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => saveEdit(u.id)}
                                    className="rounded-lg bg-[#F97316] text-white text-xs font-semibold py-1.5 px-2.5 hover:bg-[#EA580C] transition-colors"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = { ...editing };
                                      delete next[u.id];
                                      setEditing(next);
                                    }}
                                    className="rounded-lg bg-white border text-[#1F2937] text-xs font-semibold py-1.5 px-2.5 hover:bg-[#F3F4F6] transition-colors"
                                    style={{ borderColor: "#E5E7EB" }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditing({ ...editing, [u.id]: { ...u } })}
                                    className="rounded-lg bg-white border text-[#1F2937] text-xs font-semibold py-1.5 px-2.5 hover:bg-[#F3F4F6] transition-colors"
                                    style={{ borderColor: "#E5E7EB" }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteUser(u.id)}
                                    className="rounded-lg bg-[#B91C1C] text-white text-xs font-semibold py-1.5 px-2.5 hover:bg-[#991B1B] transition-colors"
                                  >
                                    Delete
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

              {showAdd && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-6">
                  <div className="absolute inset-0 bg-black/40" onClick={() => setShowAdd(false)} aria-hidden="true" />
                  <div
                    className="relative w-full max-w-[95vw] sm:max-w-[600px] md:max-w-[640px] rounded-xl md:rounded-2xl bg-white border shadow-lg p-4 sm:p-6 max-h-[85vh] overflow-y-auto"
                    style={{ borderColor: "#E5E7EB" }}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Add New User"
                  >
                    <div className="text-[#1F2937] font-semibold text-base">Add New User</div>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                      <label className="grid gap-1">
                        <span className="text-[12px] text-[#1F2937] font-medium">ID Number</span>
                        <input
                          value={form.idnumber}
                          onChange={(e) => setForm({ ...form, idnumber: e.target.value })}
                          className="rounded-xl border px-3 py-2 text-[#1F2937] placeholder:text-[#94A3B8] bg-white"
                          style={{ borderColor: "#E5E7EB" }}
                          placeholder="e.g. 2021-00001"
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="text-[12px] text-[#1F2937] font-medium">First Name</span>
                        <input
                          value={form.firstname || ""}
                          onChange={(e) => setForm({ ...form, firstname: e.target.value })}
                          className="rounded-xl border px-3 py-2 text-[#1F2937] placeholder:text-[#94A3B8] bg-white"
                          style={{ borderColor: "#E5E7EB" }}
                          placeholder="First name"
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="text-[12px] text-[#1F2937] font-medium">Middle Name</span>
                        <input
                          value={form.middlename || ""}
                          onChange={(e) => setForm({ ...form, middlename: e.target.value })}
                          className="rounded-xl border px-3 py-2 text-[#1F2937] placeholder:text-[#94A3B8] bg-white"
                          style={{ borderColor: "#E5E7EB" }}
                          placeholder="Middle name (optional)"
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="text-[12px] text-[#1F2937] font-medium">Last Name</span>
                        <input
                          value={form.lastname || ""}
                          onChange={(e) => setForm({ ...form, lastname: e.target.value })}
                          className="rounded-xl border px-3 py-2 text-[#1F2937] placeholder:text-[#94A3B8] bg-white"
                          style={{ borderColor: "#E5E7EB" }}
                          placeholder="Last name"
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="text-[12px] text-[#1F2937] font-medium">Role</span>
                        <select
                          value={form.role}
                          onChange={(e) => setForm({ ...form, role: e.target.value as typeof roles[number] })}
                          className="rounded-xl border px-3 py-2 text-[#1F2937] bg-white"
                          style={{ borderColor: "#E5E7EB" }}
                        >
                          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </label>
                      <label className="grid gap-1">
                         <span className="text-[12px] text-[#1F2937] font-medium">
                           {(form.role === "instructor" || form.role === "supervisor") ? "Course & Section" : "Course"}
                         </span>
                         {(form.role === "student" || form.role === "coordinator" || form.role === "instructor" || form.role === "supervisor") ? (
                           (form.role === "coordinator") ? (
                             <MultiSelect
                               options={availableCourses}
                               value={form.courseIds}
                               onChange={(ids) => setForm({ ...form, courseIds: ids })}
                               placeholder="Select courses"
                             />
                           ) : (form.role === "instructor" || form.role === "supervisor") ? (
                             <MultiSelect
                               options={combinedCourseSections}
                               value={form.sectionIds}
                               onChange={(sectionIds) => {
                                 // Derive unique course IDs from selected sections
                                 const selectedSections = combinedCourseSections.filter(opt => sectionIds.includes(opt.id));
                                 const courseIds = Array.from(new Set(selectedSections.map(opt => opt.courseId)));
                                 setForm({ ...form, sectionIds, courseIds });
                               }}
                               placeholder="Select course & section"
                             />
                           ) : (
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
                               className="rounded-xl border px-3 py-2 text-[#1F2937] bg-white"
                               style={{ borderColor: "#E5E7EB" }}
                             >
                               <option value="">Select course</option>
                               {availableCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                             </select>
                           )
                         ) : (
                           <input
                             value={form.course || ""}
                             onChange={(e) => setForm({ ...form, course: e.target.value })}
                             className="rounded-xl border px-3 py-2 text-[#1F2937] placeholder:text-[#94A3B8] bg-white"
                             style={{ borderColor: "#E5E7EB" }}
                             placeholder="Course"
                           />
                         )}
                       </label>
                       
                       {form.role !== "coordinator" && form.role !== "instructor" && form.role !== "supervisor" && (
                         <label className="grid gap-1">
                           <span className="text-[12px] text-[#1F2937] font-medium">Section</span>
                           {(form.role === "student") ? (
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
                                 className="rounded-xl border px-3 py-2 text-[#1F2937] bg-white"
                                 style={{ borderColor: "#E5E7EB" }}
                               >
                                 <option value="">{form.courseIds.length === 0 ? "Select course first" : "Select section"}</option>
                                 {availableSections
                                   .filter(s => form.courseIds.length > 0 && form.courseIds.includes(s.course_id))
                                   .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                               </select>
                           ) : (
                             <input
                               value={form.section || ""}
                               onChange={(e) => setForm({ ...form, section: e.target.value })}
                               className="rounded-xl border px-3 py-2 text-[#1F2937] placeholder:text-[#94A3B8] bg-white"
                               style={{ borderColor: "#E5E7EB" }}
                               placeholder="Section"
                             />
                           )}
                         </label>
                       )}
                      {form.role === "supervisor" && (
                        <>
                          <label className="grid gap-1">
                            <span className="text-[12px] text-[#1F2937] font-medium">Company</span>
                            <input
                              value={form.company || ""}
                              onChange={(e) => setForm({ ...form, company: e.target.value })}
                              className="rounded-xl border px-3 py-2 text-[#1F2937] placeholder:text-[#94A3B8] bg-white"
                              style={{ borderColor: "#E5E7EB" }}
                              placeholder="Company (optional)"
                            />
                          </label>
                          <label className="grid gap-1">
                            <span className="text-[12px] text-[#1F2937] font-medium">Location</span>
                            <input
                              value={form.location || ""}
                              onChange={(e) => setForm({ ...form, location: e.target.value })}
                              className="rounded-xl border px-3 py-2 text-[#1F2937] placeholder:text-[#94A3B8] bg-white"
                              style={{ borderColor: "#E5E7EB" }}
                              placeholder="Location (optional)"
                            />
                          </label>
                        </>
                      )}
                      {form.role === "student" && (
                        <label className="grid gap-1">
                          <span className="text-[12px] text-[#1F2937] font-medium">Supervisor</span>
                          <select
                            value={form.supervisorid || ""}
                            onChange={(e) => setForm({ ...form, supervisorid: e.target.value })}
                            className="rounded-xl border px-3 py-2 text-[#1F2937] bg-white"
                            style={{ borderColor: "#E5E7EB" }}
                          >
                            <option value="">
                              {form.courseIds.length === 0 || form.sectionIds.length === 0 ? "Select course & section first" : "Select supervisor"}
                            </option>
                            {users
                              .filter(u => {
                                if (u.role !== "supervisor") return false;
                                const studentCourseId = form.courseIds[0];
                                const studentSectionId = form.sectionIds[0];
                                
                                if (!studentCourseId || !studentSectionId) return false;

                                // Check if supervisor is assigned to this course and section (New Data)
                                const hasCourseId = u.courseIds && u.courseIds.includes(studentCourseId);
                                const hasSectionId = u.sectionIds && u.sectionIds.includes(studentSectionId);
                                
                                if (hasCourseId && hasSectionId) return true;

                                // Fallback: String matching for legacy data
                                const courseObj = availableCourses.find(c => c.id === studentCourseId);
                                const sectionObj = availableSections.find(s => s.id === studentSectionId);
                                
                                const hasCourseName = courseObj && u.course && u.course.includes(courseObj.name);
                                const hasSectionName = sectionObj && u.section && u.section.includes(sectionObj.name);
                                
                                return hasCourseName && hasSectionName;
                              })
                              .map(u => (
                                <option key={u.id} value={u.idnumber}>{u.name || u.idnumber}</option>
                              ))
                            }
                          </select>
                        </label>
                      )}
                      <label className="grid gap-1">
                        <span className="text-[12px] text-[#1F2937] font-medium">Password</span>
                        <input
                          type="password"
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          className="rounded-xl border px-3 py-2 text-[#1F2937] placeholder:text-[#94A3B8] bg-white"
                          style={{ borderColor: "#E5E7EB" }}
                          placeholder="Temporary password"
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={addUser}
                        className="inline-flex items-center justify-center rounded-xl bg-[#F97316] text-white font-semibold py-2.5 px-3.5 focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 w-full sm:w-auto hover:bg-[#EA580C] transition-colors"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAdd(false)}
                        className="inline-flex items-center justify-center rounded-xl bg-white text-[#1F2937] font-semibold py-2.5 px-3.5 border w-full sm:w-auto hover:bg-[#F3F4F6] transition-colors"
                        style={{ borderColor: "#E5E7EB" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
