"use client";
import React, { useState, useEffect } from "react";
import { Loader2, Clock, Save, Calendar, Plus, CheckCircle2, Trash2, XCircle } from "lucide-react";

interface CourseWithHours {
  id: number;
  name: string;
  required_ojt_hours: number;
}

interface SchoolYear {
  id: number;
  sy: string;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
}

export function SettingsView() {
  const [courses, setCourses] = useState<CourseWithHours[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  
  // School Year States
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [loadingSY, setLoadingSY] = useState(true);
  const [newSY, setNewSY] = useState("");
  const [creatingSY, setCreatingSY] = useState(false);

  useEffect(() => {
    fetchCourses();
    fetchSchoolYears();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoadingCourses(true);
      const res = await fetch("/api/courses");
      const data = await res.json();
      if (data.courses) setCourses(data.courses);
    } catch (e) {
      console.error("Failed to fetch courses", e);
    } finally {
      setLoadingCourses(false);
    }
  };

  const fetchSchoolYears = async () => {
    try {
        setLoadingSY(true);
        const res = await fetch("/api/school-years");
        const data = await res.json();
        if (data.school_years) setSchoolYears(data.school_years);
    } catch (e) {
        console.error("Failed to fetch school years", e);
    } finally {
        setLoadingSY(false);
    }
  };

  const handleCreateSY = async () => {
      if (!newSY.trim()) return;
      
      try {
          setCreatingSY(true);
          const res = await fetch("/api/school-years", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sy: newSY })
          });
          
          if (!res.ok) {
              const err = await res.json();
              alert(err.error || "Failed to create school year");
              return;
          }
          
          const data = await res.json();
          if (data.school_year) {
              setSchoolYears(prev => [data.school_year, ...prev]);
              setNewSY("");
          }
      } catch (e) {
          console.error(e);
          alert("Failed to create school year");
      } finally {
          setCreatingSY(false);
      }
  };

  const handleToggleActive = async (id: number, currentState: boolean) => {
      // Optimistic update
      const oldState = [...schoolYears];
      
      // If we are activating one, we must deactivate all others
      if (!currentState) { // Switching to Active
        setSchoolYears(prev => prev.map(sy => ({
            ...sy,
            is_active: sy.id === id
        })));
      } else {
        // Just deactivating current one
        setSchoolYears(prev => prev.map(sy => 
            sy.id === id ? { ...sy, is_active: false } : sy
        ));
      }

      try {
          const res = await fetch("/api/school-years", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id, is_active: !currentState })
          });

          if (!res.ok) throw new Error("Failed to update");
          
          // Refetch to ensure sync (especially for the "deactivate others" logic side effects on server)
          fetchSchoolYears();

      } catch (e) {
          console.error(e);
          alert("Failed to update status");
          setSchoolYears(oldState);
      }
  };

  const handleUpdateCourseHours = async (id: number, hours: number) => {
    try {
      const res = await fetch("/api/courses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, required_ojt_hours: hours }),
      });
      if (!res.ok) throw new Error("Failed to update hours");
      // Optimistic update or refetch
      setCourses(prev => prev.map(c => c.id === id ? { ...c, required_ojt_hours: hours } : c));
    } catch (e) {
      console.error(e);
      alert("Failed to update course hours");
      throw e; // Re-throw to let component know it failed
    }
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden pt-4">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">System Settings</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* School Year Management */}
        <section>
            <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#F97316]" />
                    School Year Management
                </h3>
                <p className="text-sm text-gray-500 mt-1">Create and manage academic years. Set the active school year for the system.</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <div className="flex gap-3 mb-6">
                    <input 
                        type="text" 
                        placeholder="e.g. 2023-2024" 
                        value={newSY}
                        onChange={(e) => setNewSY(e.target.value)}
                        className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                    />
                    <button 
                        onClick={handleCreateSY}
                        disabled={creatingSY || !newSY.trim()}
                        className="px-4 py-2 bg-[#F97316] text-white rounded-lg font-medium hover:bg-[#EA580C] disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                        {creatingSY ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Add School Year
                    </button>
                </div>

                <div className="space-y-3">
                    {loadingSY ? (
                        <div className="flex justify-center py-4"><Loader2 className="animate-spin text-gray-400" /></div>
                    ) : schoolYears.length === 0 ? (
                        <div className="text-center text-gray-500 py-4 italic">No school years created yet.</div>
                    ) : (
                        schoolYears.map((sy) => (
                            <div key={sy.id} className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${sy.is_active ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'}`}>
                                <div>
                                    <div className="font-bold text-gray-900">{sy.sy}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                        {sy.is_active ? (
                                            <span className="text-green-600 font-medium flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" /> Active School Year
                                            </span>
                                        ) : "Inactive"}
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleToggleActive(sy.id, sy.is_active)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${sy.is_active ? 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50' : 'bg-green-600 text-white hover:bg-green-700'}`}
                                >
                                    {sy.is_active ? "Deactivate" : "Set Active"}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </section>

        {/* OJT Required Hours */}
        <section>
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#F97316]" />
              OJT Required Hours
            </h3>
            <p className="text-sm text-gray-500 mt-1">Set the required OJT hours for each course.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingCourses ? (
              <div className="col-span-full p-8 flex justify-center">
                <Loader2 className="animate-spin text-gray-400" />
              </div>
            ) : courses.length === 0 ? (
              <div className="col-span-full p-8 text-center text-gray-500 border border-dashed rounded-xl">
                No courses found.
              </div>
            ) : (
              courses.map((course) => (
                <CourseItem 
                  key={course.id} 
                  course={course} 
                  onUpdate={handleUpdateCourseHours} 
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function CourseItem({ course, onUpdate }: { course: CourseWithHours; onUpdate: (id: number, hours: number) => Promise<void> }) {
  const [hours, setHours] = useState(course.required_ojt_hours.toString());
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setHours(course.required_ojt_hours.toString());
    setIsDirty(false);
  }, [course.required_ojt_hours]);

  const handleSave = async () => {
    const val = parseInt(hours);
    if (isNaN(val)) return;
    
    setSaving(true);
    try {
      await onUpdate(course.id, val);
      setIsDirty(false);
    } catch (e) {
      // Error handling is done in parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex flex-col gap-3">
        <div className="font-bold text-gray-900">{course.name}</div>
        <div className="flex items-end gap-2">
            <div className="flex-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Hours Required</label>
                <input
                    type="number"
                    value={hours}
                    onChange={(e) => {
                        setHours(e.target.value);
                        setIsDirty(true);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave();
                    }}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
            </div>
            <button 
                onClick={handleSave}
                disabled={!isDirty || saving}
                className="h-[38px] w-[38px] flex items-center justify-center bg-[#F97316] text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#EA580C] transition-colors shadow-sm"
                title="Save"
            >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            </button>
        </div>
      </div>
    </div>
  );
}
