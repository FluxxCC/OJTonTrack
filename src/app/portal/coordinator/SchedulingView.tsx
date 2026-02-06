"use client";

import React, { useState, useEffect } from "react";
import { Calendar, Plus, Edit2, Trash2, Clock, MapPin, AlignLeft, X, Loader2 } from "lucide-react";

type Event = {
  id: number;
  title: string;
  description: string;
  event_date: string;
  am_in: string | null;
  am_out: string | null;
  pm_in: string | null;
  pm_out: string | null;
  overtime_in: string | null;
  overtime_out: string | null;
  school_year_id: number;
  course_ids: number[] | null;
};

function MultiSelectCourses({ 
  courses, 
  selectedIds, 
  onChange 
}: { 
  courses: {id: number, name: string}[], 
  selectedIds: number[], 
  onChange: (ids: number[]) => void 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(cid => cid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === 0) return; // Already empty (Institution-wide)
    onChange([]); // Clear to set as Institution-wide
  };

  const displayText = selectedIds.length === 0 
    ? "All Courses (Institution-wide)" 
    : `${selectedIds.length} Course${selectedIds.length > 1 ? 's' : ''} Selected`;

  return (
    <div className="relative" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded-xl border border-gray-300 p-3 text-sm font-medium text-gray-900 bg-white cursor-pointer flex justify-between items-center focus:ring-2 focus:ring-[#F97316] outline-none select-none"
      >
        <span className={selectedIds.length === 0 ? "text-gray-900" : "text-[#F97316]"}>
          {displayText}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${isOpen ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6"/></svg>
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto p-2 animate-in fade-in zoom-in-95 duration-100">
          <div 
            onClick={() => { onChange([]); setIsOpen(false); }}
            className="p-2 rounded-lg cursor-pointer flex items-center gap-3 hover:bg-gray-50 text-gray-700"
          >
            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedIds.length === 0 ? "border-orange-500 bg-orange-500" : "border-gray-300 bg-white"}`}>
              {selectedIds.length === 0 && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>
            <span className="font-medium">All Courses (Institution-wide)</span>
          </div>
          
          <div className="h-px bg-gray-100 my-1" />
          
          {courses.map(course => {
            const isSelected = selectedIds.includes(course.id);
            return (
              <div 
                key={course.id}
                onClick={() => handleToggle(course.id)}
                className="p-2 rounded-lg cursor-pointer flex items-center gap-3 hover:bg-gray-50 text-gray-700"
              >
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? "border-orange-500 bg-orange-500" : "border-gray-300 bg-white"}`}>
                  {isSelected && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <span className="font-medium">{course.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SchedulingView({ courses }: { courses: {id: number, name: string}[] }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSchoolYear, setActiveSchoolYear] = useState<number | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [amIn, setAmIn] = useState("");
  const [amOut, setAmOut] = useState("");
  const [pmIn, setPmIn] = useState("");
  const [pmOut, setPmOut] = useState("");
  const [overtimeIn, setOvertimeIn] = useState("");
  const [overtimeOut, setOvertimeOut] = useState("");
  const [courseIds, setCourseIds] = useState<number[]>([]);

  const fetchActiveSchoolYear = async () => {
    try {
      const res = await fetch("/api/users?role=student"); // Or any endpoint that returns active SY
      // Ideally we should have a dedicated endpoint for active SY or pass it as prop
      // For now, let's assume we can get it from the first event or just fetch all
      // Actually, let's just fetch all events and filter client side if needed, 
      // or better, fetch the active SY first.
      
      // Let's rely on the API to filter by active SY if we pass it, 
      // but since we don't have the context of active SY here easily without a provider,
      // let's fetch all events for now.
      loadEvents();
    } catch (e) {
      console.error(e);
    }
  };

  const loadEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      if (data.events) setEvents(data.events);
    } catch (e) {
      console.error("Failed to load events", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDate("");
    setAmIn("");
    setAmOut("");
    setPmIn("");
    setPmOut("");
    setOvertimeIn("");
    setOvertimeOut("");
    setCourseIds([]);
    setEditingId(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (event: Event) => {
    setEditingId(event.id);
    setTitle(event.title);
    setDescription(event.description || "");
    setDate(event.event_date);
    setAmIn(event.am_in || "");
    setAmOut(event.am_out || "");
    setPmIn(event.pm_in || "");
    setPmOut(event.pm_out || "");
    setOvertimeIn(event.overtime_in || "");
    setOvertimeOut(event.overtime_out || "");
    setCourseIds(event.course_ids || []);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date) return;

    try {
      const payload = {
        title,
        description,
        event_date: date,
        am_in: amIn || null,
        am_out: amOut || null,
        pm_in: pmIn || null,
        pm_out: pmOut || null,
        overtime_in: overtimeIn || null,
        overtime_out: overtimeOut || null,
        course_ids: courseIds.length > 0 ? courseIds : null,
        // school_year_id: activeSchoolYear // We might need to fetch this
      };

      let res;
      if (editingId) {
        res = await fetch("/api/events", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...payload }),
        });
      } else {
        res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to save event");
      }
      
      setIsModalOpen(false);
      resetForm();
      loadEvents();
    } catch (e: any) {
      alert("Error saving event: " + e.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this event?")) return;
    try {
      const res = await fetch(`/api/events?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      loadEvents();
    } catch (e) {
      alert("Error deleting event");
    }
  };

  // Helper to format time
  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(":");
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div></div>
        <button 
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 bg-[#F97316] text-white text-sm font-bold rounded-xl hover:bg-orange-600 transition-colors shadow-sm"
        >
          <Plus size={18} strokeWidth={3} />
          Add Event
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map(event => (
            <div key={event.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow relative group">
              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleOpenEdit(event)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                  title="Edit"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => handleDelete(event.id)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="flex items-start justify-between mb-3">
                <div className="flex flex-col">
                  <h3 className="text-lg font-bold text-gray-900 leading-tight">{event.title}</h3>
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600 mt-4">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-gray-400" />
                  <span className="font-medium">
                    {new Date(event.event_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
                {(event.am_in || event.pm_in) && (
                  <div className="flex flex-col gap-1">
                    {event.am_in && (
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-gray-400" />
                        <span>
                          Morning: {formatTime(event.am_in)} - {event.am_out ? formatTime(event.am_out) : "..."}
                        </span>
                      </div>
                    )}
                    {event.pm_in && (
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-gray-400" />
                        <span>
                          Afternoon: {formatTime(event.pm_in)} - {event.pm_out ? formatTime(event.pm_out) : "..."}
                        </span>
                      </div>
                    )}
                    {event.overtime_in && (
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-gray-400" />
                        <span className="text-orange-600 font-medium">
                          Overtime: {formatTime(event.overtime_in)} - {event.overtime_out ? formatTime(event.overtime_out) : "..."}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {event.description && (
                  <div className="flex items-start gap-2 pt-2 border-t border-gray-100 mt-3">
                    <AlignLeft size={16} className="text-gray-400 mt-0.5 shrink-0" />
                    <p className="line-clamp-2">{event.description}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {events.length === 0 && (
            <div className="col-span-full py-16 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <Calendar size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No events scheduled yet.</p>
              <button onClick={handleOpenAdd} className="text-[#F97316] font-bold text-sm mt-2 hover:underline">Create your first event</button>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">{editingId ? "Edit Event" : "Add New Event"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: Basic Info */}
              <div className="flex flex-col h-full">
                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Event Details</h4>
                <div className="flex flex-col flex-1 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Event Title <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      value={title} 
                      onChange={e => setTitle(e.target.value)}
                      placeholder="e.g. University Week Opening"
                      className="w-full rounded-xl border border-gray-300 p-3 text-sm font-medium text-gray-900 focus:ring-2 focus:ring-[#F97316] outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Date <span className="text-red-500">*</span></label>
                    <input 
                      type="date" 
                      value={date} 
                      onChange={e => setDate(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 p-3 text-sm font-medium text-gray-900 focus:ring-2 focus:ring-[#F97316] outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Course Name</label>
                    <MultiSelectCourses 
                      courses={courses} 
                      selectedIds={courseIds} 
                      onChange={setCourseIds} 
                    />
                  </div>

                  <div className="flex flex-col flex-1">
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Description</label>
                    <textarea 
                      value={description} 
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Additional details about the event..."
                      className="w-full rounded-xl border border-gray-300 p-3 text-sm font-medium text-gray-900 focus:ring-2 focus:ring-[#F97316] outline-none flex-1 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Schedule */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Time Schedule</h4>
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock size={16} className="text-[#F97316]" />
                        <span className="text-sm font-bold text-gray-900">Morning Shift</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Time In</label>
                          <input 
                            type="time" 
                            value={amIn} 
                            onChange={e => setAmIn(e.target.value)}
                            className="w-full rounded-lg border border-gray-200 bg-white p-2 text-sm text-gray-900 focus:ring-2 focus:ring-[#F97316] outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Time Out</label>
                          <input 
                            type="time" 
                            value={amOut} 
                            onChange={e => setAmOut(e.target.value)}
                            className="w-full rounded-lg border border-gray-200 bg-white p-2 text-sm text-gray-900 focus:ring-2 focus:ring-[#F97316] outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock size={16} className="text-[#F97316]" />
                        <span className="text-sm font-bold text-gray-900">Afternoon Shift</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Time In</label>
                          <input 
                            type="time" 
                            value={pmIn} 
                            onChange={e => setPmIn(e.target.value)}
                            className="w-full rounded-lg border border-gray-200 bg-white p-2 text-sm text-gray-900 focus:ring-2 focus:ring-[#F97316] outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Time Out</label>
                          <input 
                            type="time" 
                            value={pmOut} 
                            onChange={e => setPmOut(e.target.value)}
                            className="w-full rounded-lg border border-gray-200 bg-white p-2 text-sm text-gray-900 focus:ring-2 focus:ring-[#F97316] outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock size={16} className="text-[#F97316]" />
                        <span className="text-sm font-bold text-orange-700">Overtime Shift</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-orange-600 uppercase mb-1">Time In</label>
                          <input 
                            type="time" 
                            value={overtimeIn} 
                            onChange={e => setOvertimeIn(e.target.value)}
                            className="w-full rounded-lg border border-orange-200 bg-white p-2 text-sm text-gray-900 focus:ring-2 focus:ring-[#F97316] outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-orange-600 uppercase mb-1">Time Out</label>
                          <input 
                            type="time" 
                            value={overtimeOut} 
                            onChange={e => setOvertimeOut(e.target.value)}
                            className="w-full rounded-lg border border-orange-200 bg-white p-2 text-sm text-gray-900 focus:ring-2 focus:ring-[#F97316] outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-span-1 md:col-span-2 flex justify-end gap-3 pt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-gray-600 text-sm font-bold hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#F97316] text-white text-sm font-bold rounded-xl hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200"
                >
                  {editingId ? "Update Event" : "Save Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
