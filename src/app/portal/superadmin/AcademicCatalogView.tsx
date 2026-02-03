"use client";

import React, { useState, useEffect } from "react";
import { 
  BookOpen, 
  Layers, 
  School, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Loader2 
} from "lucide-react";

// --- Types ---

type Course = {
  id: number;
  name: string;
  required_ojt_hours: number;
};

type Section = {
  id: number;
  name: string;
  course_id: number;
  courses?: { name: string };
};

type SchoolYear = {
  id: number;
  sy: string;
  code?: string;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
};

const COURSE_OPTIONS = [
  "BSCS",
  "BSIT",
  "BSIS"
];

// --- Components ---

export function AcademicCatalogView() {
  const [activeTab, setActiveTab] = useState<"courses" | "sections" | "school-years">("courses");

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <TabButton 
          active={activeTab === "courses"} 
          onClick={() => setActiveTab("courses")} 
          icon={BookOpen} 
          label="Courses" 
        />
        <TabButton 
          active={activeTab === "sections"} 
          onClick={() => setActiveTab("sections")} 
          icon={Layers} 
          label="Sections" 
        />
        <TabButton 
          active={activeTab === "school-years"} 
          onClick={() => setActiveTab("school-years")} 
          icon={School} 
          label="School Years" 
        />
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm min-h-[500px]">
        {activeTab === "courses" && <CoursesManager />}
        {activeTab === "sections" && <SectionsManager />}
        {activeTab === "school-years" && <SchoolYearsManager />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
        active 
          ? "border-[#F97316] text-[#F97316]" 
          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
      }`}
    >
      <Icon size={18} />
      {label}
    </button>
  );
}

// --- Managers ---

function CoursesManager() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Add Form State
  const [newName, setNewName] = useState("");
  const [newHours, setNewHours] = useState("486");

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editHours, setEditHours] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/courses");
      const data = await res.json();
      if (data.courses) setCourses(data.courses);
    } catch (e) {
      setError("Failed to load courses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, required_ojt_hours: Number(newHours) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add course");
      }
      
      setNewName("");
      setNewHours("486");
      load();
    } catch (e: any) {
      alert(e.message || "Error adding course");
    }
  };

  const handleEditClick = (course: Course) => {
    setEditingId(course.id);
    setEditName(course.name);
    setEditHours(course.required_ojt_hours.toString());
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editName) return;

    try {
      const res = await fetch("/api/courses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, name: editName, required_ojt_hours: Number(editHours) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update course");
      }
      
      setIsEditModalOpen(false);
      setEditingId(null);
      load();
    } catch (e: any) {
      alert(e.message || "Error updating course");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure? This might affect users linked to this course.")) return;
    try {
      const res = await fetch(`/api/courses?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      load();
    } catch (e) {
      alert("Error deleting course");
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-gray-900">All Courses</h2>
      </div>

      <form onSubmit={handleAdd} className="mb-8 p-4 bg-orange-50 rounded-xl border border-orange-100 animate-in fade-in slide-in-from-top-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Course Name</label>
            <select 
              value={newName} 
              onChange={e => setNewName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 p-2.5 text-sm font-medium text-gray-900 focus:ring-2 focus:ring-[#F97316] outline-none bg-white"
              autoFocus
            >
              <option value="" disabled>Select Course</option>
              {COURSE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Required Hours</label>
            <input 
              type="text" 
              value={newHours} 
              onChange={e => {
                const val = e.target.value;
                if (/^\d*$/.test(val)) setNewHours(val);
              }}
              className="w-full rounded-lg border border-gray-300 p-2.5 text-sm font-medium text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[#F97316] outline-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button 
            type="button" 
            onClick={() => { setNewName(""); setNewHours("486"); }} 
            className="px-3 py-1.5 text-gray-600 text-sm font-medium hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button type="submit" className="px-3 py-1.5 bg-[#F97316] text-white text-sm font-bold rounded-lg hover:bg-orange-600">
            Save Course
          </button>
        </div>
      </form>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Hours</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {courses.map(course => (
                <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{course.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{course.required_ojt_hours}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="flex justify-end items-center gap-1">
                      <button 
                        onClick={() => handleEditClick(course)}
                        className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Course"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(course.id)}
                        className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Course"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {courses.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-gray-500 text-sm">No courses found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Edit Course</h3>
            <form onSubmit={handleUpdate}>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Course Name</label>
                  <select 
                    value={editName} 
                    onChange={e => setEditName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm font-medium text-gray-900 focus:ring-2 focus:ring-[#F97316] outline-none bg-white"
                    autoFocus
                  >
                    <option value="" disabled>Select Course</option>
                    {COURSE_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Required Hours</label>
                  <input 
                    type="text" 
                    value={editHours} 
                    onChange={e => {
                      const val = e.target.value;
                      if (/^\d*$/.test(val)) setEditHours(val);
                    }}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm font-medium text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[#F97316] outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-gray-600 text-sm font-bold hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#F97316] text-white text-sm font-bold rounded-xl hover:bg-orange-600 transition-colors"
                >
                  Update Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionsManager() {
  const [sections, setSections] = useState<Section[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Add Form State
  const [newName, setNewName] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCourseId, setEditCourseId] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [secRes, courseRes] = await Promise.all([
        fetch("/api/sections"),
        fetch("/api/courses")
      ]);
      const secData = await secRes.json();
      const courseData = await courseRes.json();
      
      if (secData.sections) setSections(secData.sections);
      if (courseData.courses) setCourses(courseData.courses);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !selectedCourse) return;

    try {
      const res = await fetch("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, course_id: Number(selectedCourse) }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add section");
      }
      
      setNewName("");
      load();
    } catch (e: any) {
      alert(e.message || "Error adding section");
    }
  };

  const handleEditClick = (section: Section) => {
    setEditingId(section.id);
    setEditName(section.name);
    setEditCourseId(section.course_id.toString());
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editName || !editCourseId) return;

    try {
      const res = await fetch("/api/sections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, name: editName, course_id: Number(editCourseId) }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update section");
      }
      
      setIsEditModalOpen(false);
      setEditingId(null);
      load();
    } catch (e: any) {
      alert(e.message || "Error updating section");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure?")) return;
    try {
      const res = await fetch(`/api/sections?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      load();
    } catch (e) {
      alert("Error deleting section");
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-gray-900">All Sections</h2>
      </div>

      <form onSubmit={handleAdd} className="mb-8 p-4 bg-orange-50 rounded-xl border border-orange-100 animate-in fade-in slide-in-from-top-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Section Name</label>
            <input 
              type="text" 
              value={newName} 
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. 4A"
              className="w-full rounded-lg border border-gray-300 p-2.5 text-sm font-medium text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[#F97316] outline-none"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Course</label>
            <select 
              value={selectedCourse} 
              onChange={e => setSelectedCourse(e.target.value)}
              className="w-full rounded-lg border border-gray-300 p-2.5 text-sm font-medium text-gray-900 focus:ring-2 focus:ring-[#F97316] outline-none bg-white"
            >
              <option value="">Select Course</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button 
            type="button" 
            onClick={() => { setNewName(""); setSelectedCourse(""); }} 
            className="px-3 py-1.5 text-gray-600 text-sm font-medium hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button type="submit" className="px-3 py-1.5 bg-[#F97316] text-white text-sm font-bold rounded-lg hover:bg-orange-600">Save Section</button>
        </div>
      </form>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Section Name</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {courses.map(course => {
                const courseSections = sections.filter(s => s.course_id === course.id);
                if (courseSections.length === 0) return null;
                
                return (
                  <React.Fragment key={course.id}>
                    {/* Course Group Header */}
                    <tr className="bg-orange-50/50">
                      <td colSpan={2} className="px-6 py-2 text-xs font-bold text-[#F97316] uppercase tracking-wider border-y border-orange-100">
                        {course.name} Sections
                      </td>
                    </tr>
                    {/* Sections */}
                    {courseSections.map(section => (
                      <tr key={section.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                          {course.name} {section.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <div className="flex justify-end items-center gap-1">
                            <button 
                              onClick={() => handleEditClick(section)}
                              className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit Section"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              onClick={() => handleDelete(section.id)}
                              className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Section"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
              {sections.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-6 py-12 text-center text-gray-500 text-sm">No sections found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Edit Section</h3>
            <form onSubmit={handleUpdate}>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Section Name</label>
                  <input 
                    type="text" 
                    value={editName} 
                    onChange={e => setEditName(e.target.value)}
                    placeholder="e.g. 4A"
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm font-medium text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[#F97316] outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Course</label>
                  <select 
                    value={editCourseId} 
                    onChange={e => setEditCourseId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm font-medium text-gray-900 focus:ring-2 focus:ring-[#F97316] outline-none bg-white"
                  >
                    <option value="">Select Course</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-gray-600 text-sm font-bold hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#F97316] text-white text-sm font-bold rounded-xl hover:bg-orange-600 transition-colors"
                >
                  Update Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SchoolYearsManager() {
  const [years, setYears] = useState<SchoolYear[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingActiveId, setPendingActiveId] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSy, setEditSy] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  // Add Form State
  const [sy, setSy] = useState("");
  const [code, setCode] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/school-years");
      const data = await res.json();
      if (data.school_years) setYears(data.school_years);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sy) return;

    try {
      const res = await fetch("/api/school-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sy, code, start_date: start, end_date: end }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create school year");
      }

      setSy("");
      setCode("");
      setStart("");
      setEnd("");
      load();
    } catch (e: any) {
      alert(e.message || "Error creating school year");
    }
  };

  const handleToggleActive = (id: number, currentStatus: boolean) => {
    if (currentStatus) return; // Cannot deactivate active one directly, must activate another
    setPendingActiveId(id);
    setShowConfirmModal(true);
  };

  const handleEditClick = (year: SchoolYear) => {
    setEditingId(year.id);
    setEditSy(year.sy);
    setEditCode(year.code || "");
    setEditStart(year.start_date ? new Date(year.start_date).toISOString().split('T')[0] : "");
    setEditEnd(year.end_date ? new Date(year.end_date).toISOString().split('T')[0] : "");
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editSy) return;

    try {
      const res = await fetch("/api/school-years", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            id: editingId, 
            sy: editSy, 
            code: editCode,
            start_date: editStart, 
            end_date: editEnd 
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update school year");
      }

      setIsEditModalOpen(false);
      setEditingId(null);
      load();
    } catch (e: any) {
      alert(e.message || "Error updating school year");
    }
  };

  const confirmActivate = async () => {
    if (!pendingActiveId) return;

    try {
      const res = await fetch("/api/school-years", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pendingActiveId, is_active: true }),
      });
      if (!res.ok) {
         const data = await res.json().catch(() => ({}));
         throw new Error(data.error || "Failed to update");
      }
      load();
    } catch (e: any) {
      alert(e.message || "Error updating status");
    } finally {
      setShowConfirmModal(false);
      setPendingActiveId(null);
    }
  };

  const handleDelete = (id: number) => {
    setPendingDeleteId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    
    try {
        const res = await fetch(`/api/school-years?id=${pendingDeleteId}`, {
            method: "DELETE",
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Failed to delete");
        }

        load();
    } catch (e: any) {
        alert(e.message || "Error deleting school year");
    } finally {
        setShowDeleteModal(false);
        setPendingDeleteId(null);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-gray-900">School Years</h2>
      </div>

      <form onSubmit={handleAdd} className="mb-8 p-4 bg-orange-50 rounded-xl border border-orange-100 animate-in fade-in slide-in-from-top-2">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">School Year</label>
              <input 
                type="text" 
                value={sy} 
                onChange={e => setSy(e.target.value)}
                placeholder="e.g. 2024-2025"
                className="w-full rounded-lg border border-gray-300 p-2.5 text-sm font-medium text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[#F97316] outline-none"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Code</label>
              <input 
                type="text" 
                value={code} 
                onChange={e => setCode(e.target.value)}
                placeholder="e.g. 2425"
                className="w-full rounded-lg border border-gray-300 p-2.5 text-sm font-medium text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[#F97316] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Start Date (Optional)</label>
              <input 
                type="date" 
                value={start} 
                onChange={e => setStart(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-2.5 text-sm font-medium text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[#F97316] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">End Date (Optional)</label>
              <input 
                type="date" 
                value={end} 
                onChange={e => setEnd(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-2.5 text-sm font-medium text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[#F97316] outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={() => { setSy(""); setCode(""); setStart(""); setEnd(""); }} className="px-3 py-1.5 text-gray-600 text-sm font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" className="px-3 py-1.5 bg-[#F97316] text-white text-sm font-bold rounded-lg hover:bg-orange-600">Save School Year</button>
          </div>
        </form>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">SY</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {years.map(year => (
                <tr key={year.id} className={`hover:bg-gray-50 transition-colors ${year.is_active ? "bg-orange-50/50" : ""}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{year.sy}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{year.code || "-"}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {year.start_date && year.end_date ? (
                      `${new Date(year.start_date).toLocaleDateString()} - ${new Date(year.end_date).toLocaleDateString()}`
                    ) : <span className="text-gray-400 italic">No dates set</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {year.is_active ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                        <Check size={12} strokeWidth={3} />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="flex justify-end items-center gap-3">
                      {!year.is_active && (
                        <button 
                          onClick={() => handleToggleActive(year.id, year.is_active)}
                          className="text-[#F97316] hover:text-orange-700 text-xs font-bold hover:underline"
                        >
                          Set Active
                        </button>
                      )}
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handleEditClick(year)}
                          className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit School Year"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(year.id)}
                          className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete School Year"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {years.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 text-sm">No school years found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Activation</h3>
            <p className="text-gray-600 mb-6">
              Set this as the <span className="font-bold text-[#F97316]">ACTIVE</span> school year? This will deactivate others.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowConfirmModal(false); setPendingActiveId(null); }}
                className="px-4 py-2 text-gray-600 text-sm font-bold hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmActivate}
                className="px-4 py-2 bg-[#F97316] text-white text-sm font-bold rounded-xl hover:bg-orange-600 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Deletion</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this school year? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setPendingDeleteId(null); }}
                className="px-4 py-2 text-gray-600 text-sm font-bold hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Edit School Year</h3>
            <form onSubmit={handleUpdate}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">School Year</label>
                  <input 
                    type="text" 
                    value={editSy} 
                    onChange={e => setEditSy(e.target.value)}
                    placeholder="e.g. 2024-2025"
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm font-medium text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[#F97316] outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Code</label>
                  <input 
                    type="text" 
                    value={editCode} 
                    onChange={e => setEditCode(e.target.value)}
                    placeholder="e.g. 2425"
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm font-medium text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[#F97316] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Start Date (Optional)</label>
                  <input 
                    type="date" 
                    value={editStart} 
                    onChange={e => setEditStart(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm font-medium text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[#F97316] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">End Date (Optional)</label>
                  <input 
                    type="date" 
                    value={editEnd} 
                    onChange={e => setEditEnd(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm font-medium text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[#F97316] outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-gray-600 text-sm font-bold hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#F97316] text-white text-sm font-bold rounded-xl hover:bg-orange-600 transition-colors"
                >
                  Update School Year
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
