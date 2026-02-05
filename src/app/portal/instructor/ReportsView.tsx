"use client";
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from "@/lib/supabaseClient";
import { 
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  X
} from 'lucide-react';

// --- Types ---
export type ReportEntry = { id: number; title?: string; body?: string; text?: string; fileName?: string; fileType?: string; fileUrl?: string; submittedAt: number; instructorComment?: string; idnumber?: string; isViewedByInstructor?: boolean; week?: number; photos?: any[] };
export type User = {
  id: number;
  idnumber: string;
  role: string;
  firstname?: string;
  middlename?: string;
  lastname?: string;
  course?: string;
  section?: string;
  company?: string;
  location?: string;
  supervisorid?: string;
  courseIds?: number[];
  sectionIds?: number[];
  status?: string;
  signup_status?: string;
};

// --- Constants ---
const REPORT_SECTIONS = [
  { id: "introduction", label: "Introduction", description: "State where you are assigned and your main role this week." },
  { id: "activities", label: "Activities Performed", description: "Narrate the tasks you handled and your participation in each." },
  { id: "tools", label: "Tools and Skills Used", description: "Mention software, equipment, or skills you applied." },
  { id: "challenges", label: "Challenges Encountered", description: "Explain any problems or difficulties faced." },
  { id: "solutions", label: "Solutions and Learning", description: "Describe how the problem was solved and what you learned." },
  { id: "accomplishments", label: "Accomplishments", description: "Highlight completed work or outputs." },
  { id: "reflection", label: "Reflection", description: "Share your insights and improvements." }
];

// --- Global Cache for Reports ---
let cachedReportsData: ReportEntry[] | null = null;
let lastReportsFetchTime = 0;
const REPORTS_CACHE_DURATION = 300000; // 5 minutes
let cachedDeadlinesData: Record<string, Record<number, string>> | null = null;
const studentIdCache = new Map<number, string>();

interface ReportsViewProps {
    students: User[];
    myIdnumber: string;
}

const ReportsView = React.memo(({ students, myIdnumber }: ReportsViewProps) => {
    const [allReports, setAllReports] = useState<ReportEntry[]>(cachedReportsData || []);
    const [loading, setLoading] = useState(!cachedReportsData);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCourse, setFilterCourse] = useState("");
    const [filterSection, setFilterSection] = useState("");
    const [selectedReport, setSelectedReport] = useState<ReportEntry | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [commentText, setCommentText] = useState("");
    const [isSavingComment, setIsSavingComment] = useState(false);
    const [isEditingComment, setIsEditingComment] = useState(false);

    useEffect(() => {
        // Subscribe to realtime changes for reports
        if (!supabase) return;
        const ch = supabase
            .channel('instructor_reports_global')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, (payload) => {
                // Optimistically update if it's an INSERT or UPDATE
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                   const newReport = payload.new as any;
                   
                   let week = undefined;
                   if (newReport.files) {
                       const files = newReport.files;
                       if (Array.isArray(files)) {
                           for (const f of files) {
                               if (f && typeof f === 'object' && 'week' in f) week = Number(f.week);
                           }
                       } else if (typeof files === 'object') {
                           if ('week' in files) week = Number(files.week);
                       }
                   }

                   const resolveIdnumber = async (): Promise<string | undefined> => {
                       const sid = Number(newReport.student_id);
                       if (!sid || Number.isNaN(sid)) return undefined;
                       if (!supabase) return undefined;
                       if (studentIdCache.has(sid)) return studentIdCache.get(sid);
                       try {
                           const { data } = await supabase
                             .from('users_students')
                             .select('idnumber')
                             .eq('id', sid)
                             .maybeSingle();
                           const idnum = data?.idnumber ? String(data.idnumber).trim() : undefined;
                           if (idnum) studentIdCache.set(sid, idnum);
                           return idnum;
                       } catch {
                           return undefined;
                       }
                   };

                   const applyUpdate = (prevReports: ReportEntry[], idnum?: string) => {
                       const exists = prevReports.find(r => r.id === newReport.id);
                       // Preserve comment as reports table update doesn't include it
                       const comment = exists?.instructorComment;
                       const isViewed = !!newReport.reviewed_by_id;
                       const photos = Array.isArray(newReport.files) 
                           ? newReport.files
                               .filter((f: any) => f?.category === 'photo' || (f?.type || '').startsWith('image/'))
                               .map((f: any) => ({ name: f.name, url: f.url, type: f.type }))
                           : [];

                       const mapped: ReportEntry = {
                            id: newReport.id,
                            title: newReport.title,
                            body: newReport.content,
                            fileName: undefined,
                            fileType: undefined,
                            fileUrl: undefined,
                            submittedAt: newReport.submitted_at ? new Date(newReport.submitted_at).getTime() : (newReport.created_at ? new Date(newReport.created_at).getTime() : Date.now()),
                            instructorComment: comment,
                            idnumber: idnum,
                            isViewedByInstructor: isViewed,
                            week,
                            photos
                       };

                       let newReports;
                       if (exists) {
                           newReports = prevReports.map(r => r.id === mapped.id ? mapped : r);
                       } else {
                           newReports = [...prevReports, mapped];
                       }
                       cachedReportsData = newReports;
                       return newReports;
                   };

                   // Resolve idnumber asynchronously then update state
                   resolveIdnumber().then(idnum => {
                      setAllReports(prev => applyUpdate(prev, idnum));
                   });
                } else if (payload.eventType === 'DELETE') {
                    setAllReports(prev => {
                        const newReports = prev.filter(r => r.id !== payload.old.id);
                        cachedReportsData = newReports;
                        return newReports;
                    });
                }
            })
            .subscribe();

        return () => {
            supabase?.removeChannel(ch);
        };
    }, []);

    const fetchReports = (force = false, silent = false) => {
        const now = Date.now();
        if (!force && cachedReportsData && (now - lastReportsFetchTime < REPORTS_CACHE_DURATION)) {
            if (!silent) setLoading(false);
            setAllReports(cachedReportsData);
            return;
        }
        
        if (!silent) setLoading(true);
        fetch('/api/reports', { cache: "no-store" })
          .then(res => res.json())
          .then(data => {
              if(data.reports && Array.isArray(data.reports)) {
                  const mapped: ReportEntry[] = data.reports.map((r: any) => ({
                      id: r.id,
                      title: r.title,
                      body: r.body,
                      fileName: r.fileName,
                      fileType: r.fileType,
                      fileUrl: r.fileUrl,
                      submittedAt: Number(r.submittedAt || r.ts),
                      instructorComment: r.instructorComment,
                      idnumber: r.idnumber,
                      isViewedByInstructor: !!r.reviewedby,
                      week: r.week,
                      photos: r.photos
                  }));
                  cachedReportsData = mapped;
                  lastReportsFetchTime = now;
                  setAllReports(mapped);
              }
          })
          .catch(err => console.error("Error fetching reports:", err))
          .finally(() => {
              if (!silent) setLoading(false);
          });
    };

    useEffect(() => {
        fetchReports();
    }, []);

    // --- Deadline Logic (Local State for Instructor View) ---
    const [courseDeadlines, setCourseDeadlines] = useState<Record<string, Record<number, string>>>(cachedDeadlinesData || {});
    const [deadlinesLoading, setDeadlinesLoading] = useState(!cachedDeadlinesData);
    const [editingDeadline, setEditingDeadline] = useState<{ week: number, date: string } | null>(null);
    
    // Refresh trigger for deadlines
    const [deadlinesRefreshTrigger, setDeadlinesRefreshTrigger] = useState(0);

    const WEEKS_PER_PAGE = 5;
    const TOTAL_WEEKS = 20; // Assuming 20 weeks max for now
    const [weekOffset, setWeekOffset] = useState(0);

    // Filter Logic
    const activeStudents = useMemo(() => students.filter(s => s.signup_status !== 'PENDING'), [students]);
    const uniqueCourses = useMemo(() => Array.from(new Set(activeStudents.flatMap(s => (s.course || "").split(",").map(c => c.trim()).filter(Boolean)))).sort(), [activeStudents]);
    
    // Initialize filters with first available option if not set
    useEffect(() => {
        if (!filterCourse && uniqueCourses.length > 0) {
            setFilterCourse(uniqueCourses[0]);
        }
    }, [uniqueCourses, filterCourse]);

    const uniqueSections = useMemo(() => {
        let relevantStudents = activeStudents;
        if (filterCourse) {
            relevantStudents = activeStudents.filter(s => s.course === filterCourse);
        }
        return Array.from(new Set(relevantStudents.flatMap(s => (s.section || "").split(",").map(se => se.trim()).filter(Boolean)))).sort();
    }, [activeStudents, filterCourse]);

    // Initialize section filter when course changes or on initial load
    useEffect(() => {
        if (!filterSection && uniqueSections.length > 0) {
            setFilterSection(uniqueSections[0]);
        } else if (filterSection && !uniqueSections.includes(filterSection) && uniqueSections.length > 0) {
             setFilterSection(uniqueSections[0]);
        }
    }, [uniqueSections, filterSection]);

    const fetchDeadlines = useCallback(async (force = false) => {
        if (!force && cachedDeadlinesData) {
            setCourseDeadlines(cachedDeadlinesData);
            setDeadlinesLoading(false);
            return;
        }

        try {
            const res = await fetch("/api/instructor/deadlines", { cache: "no-store" });
            if (res.ok) {
                const json = await res.json();
                const newDeadlines = json.deadlines || {};
                
                // Helper: Populate ALL:::ALL key for when no course is filtered
                if (!newDeadlines["ALL:::ALL"]) {
                    newDeadlines["ALL:::ALL"] = {};
                }
                
                // If we don't have a deadline for ALL:::ALL, try to infer it from existing course deadlines
                // This handles the case where the user set a deadline for "All Courses" (which saves to each course individually)
                // but the UI is looking for the "ALL:::ALL" key.
                for (const key in newDeadlines) {
                    if (key === "ALL:::ALL") continue;
                    const parts = key.split(":::");
                    if (parts.length === 2 && parts[1] === "ALL") {
                        // This is a generic course deadline (e.g. BSIT:::ALL)
                        const weeks = newDeadlines[key];
                        for (const w in weeks) {
                            // If ALL:::ALL doesn't have a value for this week, use this one
                            if (!newDeadlines["ALL:::ALL"][w]) {
                                newDeadlines["ALL:::ALL"][w] = weeks[w];
                            }
                        }
                    }
                }

                cachedDeadlinesData = newDeadlines;
                setCourseDeadlines(newDeadlines);
            }
        } catch (e) {
            console.error("Failed to fetch deadlines", e);
        } finally {
            setDeadlinesLoading(false);
        }
    }, [deadlinesRefreshTrigger]);

    useEffect(() => {
        fetchDeadlines();
    }, [fetchDeadlines]);

    const handleSaveDeadline = async (course: string, section: string, week: number, date: string) => {
        try {
            const res = await fetch("/api/instructor/deadlines", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ course, section, week, date })
            });
            if (res.ok) {
                await fetchDeadlines(true);
                setDeadlinesRefreshTrigger(prev => prev + 1); // Force re-render of deadline components
                setEditingDeadline(null);
            } else {
                const json = await res.json();
                console.error("Failed to save deadline:", json);
                alert(`Failed to save deadline: ${json.error || "Unknown error"}`);
            }
        } catch (e) {
            console.error("Error saving deadline", e);
            alert(`Error saving deadline: ${e instanceof Error ? e.message : "Unknown error"}`);
        }
    };

    const studentReportsMap = useMemo(() => {
        const map = new Map<string, ReportEntry[]>();
        allReports.forEach(r => {
             const id = String(r.idnumber || "").trim();
             if (!id) return;
             // Only consider submitted reports for the grid
             if (!r.submittedAt) return;
             
             if (!map.has(id)) map.set(id, []);
             map.get(id)?.push(r);
        });
        // Sort by date ascending
        map.forEach(reports => {
            reports.sort((a, b) => a.submittedAt - b.submittedAt);
        });
        return map;
    }, [allReports]);

    const filteredStudents = useMemo(() => {
        console.log(`[Instructor] Filtering students. Total: ${students.length}, FilterCourse: ${filterCourse}, FilterSection: ${filterSection}`);
        return students.filter(s => {
            if (s.signup_status === 'PENDING') return false;
            
            if (filterCourse && s.course !== filterCourse) return false;
            if (filterSection && s.section !== filterSection) return false;

            if (!searchTerm) return true;
            
            const lowerSearch = searchTerm.toLowerCase();
            const nameMatch = `${s.firstname} ${s.lastname}`.toLowerCase().includes(lowerSearch);
            const idMatch = String(s.idnumber || "").toLowerCase().includes(lowerSearch);
            
            if (nameMatch || idMatch) return true;

            const reports = studentReportsMap.get(String(s.idnumber || "").trim());
            if (reports?.some(r => (r.title || "").toLowerCase().includes(lowerSearch))) return true;

            return false;
        }).sort((a, b) => (a.lastname || "").localeCompare(b.lastname || ""));
    }, [students, filterCourse, filterSection, searchTerm, studentReportsMap]);

    const visibleWeeks = useMemo(() => {
        const start = weekOffset;
        const end = Math.min(start + WEEKS_PER_PAGE, TOTAL_WEEKS);
        return Array.from({ length: end - start }, (_, i) => start + i + 1);
    }, [weekOffset]);

    const handlePrevWeeks = () => {
        setWeekOffset(prev => Math.max(0, prev - WEEKS_PER_PAGE));
    };

    const handleNextWeeks = () => {
        setWeekOffset(prev => Math.min(TOTAL_WEEKS - WEEKS_PER_PAGE, prev + WEEKS_PER_PAGE));
    };

    // --- Comment Logic ---
    useEffect(() => {
        if (selectedReport) {
            setCommentText(selectedReport.instructorComment || "");
        } else {
            setCommentText("");
        }
    }, [selectedReport]);

    const handleMarkAsViewed = async () => {
        if (!selectedReport) return;
        
        if (!myIdnumber) {
            alert("Instructor ID missing. Please refresh the page.");
            return;
        }

        setIsSavingComment(true);
        try {
            const res = await fetch("/api/reports", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    id: selectedReport.id, 
                    instructorComment: commentText,
                    instructorId: myIdnumber
                })
            });
            
            if (res.ok) {
                // Update local state immediately
                setAllReports(prev => prev.map(r => r.id === selectedReport.id ? { 
                    ...r, 
                    instructorComment: commentText,
                    isViewedByInstructor: true 
                } : r));
                setSelectedReport(null); // Close the modal
                
                // Update cache
                if (cachedReportsData) {
                    cachedReportsData = cachedReportsData.map(r => r.id === selectedReport.id ? {
                        ...r,
                        instructorComment: commentText,
                        isViewedByInstructor: true
                    } : r);
                }
            } else {
                alert("Failed to save review");
            }
        } catch (e) {
            console.error("Error saving review", e);
            alert("Error saving review");
        } finally {
            setIsSavingComment(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-3">
                <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <select 
                            value={filterCourse}
                            onChange={e => { setFilterCourse(e.target.value); setFilterSection(""); }}
                            className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-gray-50 hover:bg-white transition-all cursor-pointer min-w-[140px]"
                            disabled={activeStudents.length === 0}
                        >
                            {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select 
                            value={filterSection}
                            onChange={e => setFilterSection(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-gray-50 hover:bg-white transition-all cursor-pointer min-w-[140px]"
                            disabled={activeStudents.length === 0}
                        >
                            {uniqueSections.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                            <input 
                                type="text" 
                                placeholder="Search reports..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-900 placeholder-gray-500 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm"
                            />
                        </div>
                        <button 
                            onClick={() => fetchReports(true)}
                            className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-300 transition-all bg-white shadow-sm"
                            title="Refresh Reports"
                        >
                            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>

                <div className="h-px w-full bg-gray-100" />
            </div>
            
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col">
                <div className="flex-1 overflow-auto custom-scrollbar">
                    {loading ? (
                         <div className="p-8 text-center text-gray-500">Loading reports...</div>
                    ) : filteredStudents.length === 0 ? (
                         <div className="p-8 text-center text-gray-500">No students found</div>
                    ) : (
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-gray-50 text-gray-900 font-bold border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 border-r border-gray-200 min-w-[200px]">
                                        Name
                                    </th>
                                    {visibleWeeks.map((week, idx) => (
                                        <th key={week} className="px-2 py-3 text-center border-r border-gray-200 min-w-[120px] align-top">
                                            <div className="flex flex-col gap-2 items-center">
                                                <div className="flex items-center justify-center gap-1 w-full">
                                                    {idx === 0 && weekOffset > 0 && (
                                                        <button 
                                                            onClick={handlePrevWeeks}
                                                            className="p-1 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
                                                        >
                                                            <ChevronLeft size={16} />
                                                        </button>
                                                    )}
                                                    <span className="text-sm font-bold">{week}</span>
                                                    {idx === visibleWeeks.length - 1 && weekOffset + WEEKS_PER_PAGE < TOTAL_WEEKS && (
                                                        <button 
                                                            onClick={handleNextWeeks}
                                                            className="p-1 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
                                                        >
                                                            <ChevronRight size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                                
                                                {/* Deadline Setter */}
                                                {(() => {
                                                     const courseKey = filterCourse || "ALL";
                                                     const sectionKey = filterSection || "ALL";
                                                     const specificKey = `${courseKey}:::${sectionKey}`;
                                                     const genericKey = `${courseKey}:::ALL`;
                                                     
                                                     const currentDeadline = courseDeadlines[specificKey]?.[week] || (sectionKey === "ALL" ? courseDeadlines[genericKey]?.[week] : undefined);
                                                     const isEditing = editingDeadline?.week === week;
                                                     
                                                     return (
                                                         <div className="relative w-full flex justify-center">
                                                            {isEditing ? (
                                                                <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-white p-3 rounded-xl shadow-xl border border-gray-200 z-50 min-w-[220px] animate-in zoom-in-95 duration-200 text-left">
                                                                    <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-2">
                                                                        Deadline ({filterCourse || "All"} {filterSection ? `- ${filterSection}` : ""})
                                                                    </div>
                                                                    <input 
                                                                        type="date" 
                                                                        defaultValue={currentDeadline ? currentDeadline.split('T')[0] : ""}
                                                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm mb-2"
                                                                        id={`deadline-input-${week}`}
                                                                    />
                                                                    <div className="flex gap-2">
                                                                        <button 
                                                                            onClick={() => {
                                                                                const val = (document.getElementById(`deadline-input-${week}`) as HTMLInputElement).value;
                                                                                if (val) handleSaveDeadline(filterCourse || "ALL", filterSection, week, val);
                                                                            }}
                                                                            className="flex-1 bg-orange-600 text-white text-xs font-bold py-1.5 rounded-lg hover:bg-orange-700"
                                                                        >
                                                                            Save
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => setEditingDeadline(null)}
                                                                            className="flex-1 bg-gray-100 text-gray-600 text-xs font-bold py-1.5 rounded-lg hover:bg-gray-200"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <button 
                                                                    onClick={() => setEditingDeadline({ week, date: currentDeadline || "" })}
                                                                    className={`text-xs px-2 py-1 rounded-md border ${currentDeadline ? "bg-orange-50 border-orange-200 text-orange-700" : "bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-600"}`}
                                                                >
                                                                    {currentDeadline ? new Date(currentDeadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "Set Due"}
                                                                </button>
                                                            )}
                                                         </div>
                                                     );
                                                })()}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredStudents.map(student => {
                                    const studentId = String(student.idnumber || "").trim();
                                    const studentReports = studentReportsMap.get(studentId) || [];
                                    
                                    return (
                                        <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-4 py-3 border-r border-gray-200">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900">{student.lastname}, {student.firstname}</span>
                                                    <span className="text-xs text-gray-500">{student.course} - {student.section}</span>
                                                </div>
                                            </td>
                                            {visibleWeeks.map(week => {
                                                const report = studentReports.find(r => r.week === week);
                                                const isSubmitted = !!report;
                                                
                                                const courseKey = filterCourse || "ALL";
                                                const sectionKey = filterSection || "ALL";
                                                const specificKey = `${courseKey}:::${sectionKey}`;
                                                const genericKey = `${courseKey}:::ALL`;
                                                const deadlineStr = courseDeadlines[specificKey]?.[week] || (sectionKey === "ALL" ? courseDeadlines[genericKey]?.[week] : undefined);
                                                
                                                let status = "missing";
                                                if (isSubmitted) {
                                                    if (deadlineStr) {
                                                        const deadline = new Date(deadlineStr);
                                                        deadline.setHours(23, 59, 59, 999);
                                                        if (report.submittedAt > deadline.getTime()) status = "late";
                                                        else status = "ontime";
                                                    } else {
                                                        status = "ontime";
                                                    }
                                                } else {
                                                    if (deadlineStr) {
                                                        const deadline = new Date(deadlineStr);
                                                        deadline.setHours(23, 59, 59, 999);
                                                        if (Date.now() > deadline.getTime()) status = "overdue";
                                                        else status = "pending";
                                                    } else {
                                                        status = "pending";
                                                    }
                                                }

                                                    const isUnread = report ? !report.isViewedByInstructor : false;

                                                    return (
                                                        <td key={week} className="px-2 py-3 border-r border-gray-200 text-center align-top h-full">
                                                            <div className="flex flex-col items-center justify-center h-full gap-1">
                                                                {isSubmitted ? (
                                                                    <button 
                                                                        onClick={() => setSelectedReport(report)}
                                                                        className={`relative group flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all
                                                                            ${status === 'late' 
                                                                                ? "bg-white border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300" 
                                                                                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900"}
                                                                            ${isUnread ? "shadow-sm" : "opacity-80 hover:opacity-100"}
                                                                        `}
                                                                    >
                                                                        {isUnread && (
                                                                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white shadow-sm" />
                                                                        )}
                                                                        <span>Submitted</span>
                                                                        {status === 'late' && (
                                                                            <span className="ml-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">
                                                                                LATE
                                                                            </span>
                                                                        )}
                                                                    </button>
                                                                ) : (
                                                                    <div className={`text-[10px] font-medium px-2 py-1 rounded-full
                                                                        ${status === 'overdue' ? "text-red-500 bg-red-50" : "text-gray-400 bg-gray-50"}
                                                                    `}>
                                                                        {status === 'overdue' ? "Overdue" : "-"}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Report Details Modal */}
            {selectedReport && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setSelectedReport(null);
                    }}
                >
                    <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-100 bg-white shrink-0 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-50 rounded-full text-green-600">
                                    <MessageSquare size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">
                                        Report Details
                                    </h3>
                                    <p className="text-xs text-gray-500 font-medium">
                                        Week {selectedReport.week}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setSelectedReport(null)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white">
                            {/* Week Title & Status */}
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-1">Week {selectedReport.week}</h2>
                                    <p className="text-sm text-gray-500">
                                        Submitted on {new Date(selectedReport.submittedAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' })}
                                    </p>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs font-bold border ${selectedReport.isViewedByInstructor ? "bg-slate-800 text-white border-transparent" : "bg-orange-50 text-orange-600 border-orange-200"}`}>
                                    {selectedReport.isViewedByInstructor ? "Reviewed" : "Under review"}
                                </div>
                            </div>

                            {/* Photo Evidence (Horizontal Scroll) */}
                            {selectedReport.photos && selectedReport.photos.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Photo Evidence</h4>
                                    <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                                        {selectedReport.photos.map((photo: any, i: number) => {
                                            const raw = typeof photo === 'string' ? photo : (photo.url || photo.fileUrl || photo.secure_url || photo.photourl);
                                            const url = raw && String(raw).startsWith('//') ? `https:${raw}` : raw;
                                            if (!url) return null;
                                            return (
                                                <button 
                                                    key={i} 
                                                    onClick={() => setSelectedImage(url)}
                                                    className="relative h-28 w-28 flex-shrink-0 rounded-xl overflow-hidden border border-gray-200 hover:ring-2 hover:ring-orange-500 transition-all group bg-white shadow-sm"
                                                >
                                                    <img src={url} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Report Content */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Report Content</h4>
                                <div className="space-y-6">
                                    {(() => {
                                        let parsed: any = {};
                                        try {
                                            if (selectedReport.body) parsed = JSON.parse(selectedReport.body);
                                        } catch (e) {
                                            parsed = { introduction: selectedReport.body }; 
                                        }
                                        
                                        if (!selectedReport.body) return <p className="text-gray-400 italic text-sm">No content submitted.</p>;

                                        return REPORT_SECTIONS.map((section, idx) => {
                                            const content = parsed[section.id];
                                            if (!content) return null;
                                            return (
                                                <div key={section.id} className="group">
                                                    <h5 className="text-sm font-bold text-gray-900 mb-2 group-hover:text-orange-600 transition-colors">
                                                        {idx + 1}. {section.label}
                                                    </h5>
                                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                                                        {content}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                                
                                {/* Attachments */}
                                {selectedReport.fileUrl && (
                                    <div className="mt-6 pt-6 border-t border-gray-100">
                                        <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                                            Additional Files
                                        </h5>
                                        <a 
                                            href={selectedReport.fileUrl} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors text-sm font-medium text-blue-600 hover:underline"
                                        >
                                            <span>View Attached Document</span>
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Instructor Feedback */}
                            <div className="space-y-3 pt-6 border-t border-gray-100">
                                <div className="flex items-center gap-2 text-orange-600 mb-2">
                                    <MessageSquare size={16} />
                                    <h4 className="text-sm font-bold uppercase tracking-wider">
                                        {selectedReport.isViewedByInstructor ? "Instructor Feedback" : "Add Feedback"}
                                    </h4>
                                </div>
                                <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ring-1 transition-all
                                    ${selectedReport.isViewedByInstructor && !isEditingComment 
                                        ? "border-gray-200 ring-gray-100 bg-gray-50" 
                                        : "border-orange-200 ring-orange-100 bg-white"}`}
                                >
                                    <textarea 
                                        className={`w-full text-sm border-0 focus:ring-0 p-4 text-gray-700 placeholder-gray-400 resize-none bg-transparent
                                            ${selectedReport.isViewedByInstructor && !isEditingComment ? "text-gray-500 cursor-not-allowed" : ""}`}
                                        rows={4}
                                        placeholder={selectedReport.isViewedByInstructor ? "No feedback provided." : "Write your feedback here..."}
                                        value={commentText}
                                        onChange={e => setCommentText(e.target.value)}
                                        disabled={selectedReport.isViewedByInstructor && !isEditingComment}
                                    />
                                </div>
                                <div className="flex justify-end pt-2 gap-2">
                                    {selectedReport.isViewedByInstructor ? (
                                        isEditingComment ? (
                                            <>
                                                <button 
                                                    onClick={() => {
                                                        setIsEditingComment(false);
                                                        setCommentText(selectedReport.instructorComment || "");
                                                    }}
                                                    disabled={isSavingComment}
                                                    className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200 transition-all"
                                                >
                                                    Cancel
                                                </button>
                                                <button 
                                                    onClick={async () => {
                                                        await handleMarkAsViewed();
                                                        setIsEditingComment(false);
                                                    }}
                                                    disabled={isSavingComment}
                                                    className="px-4 py-2 bg-orange-600 text-white text-xs font-bold rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-all shadow-sm flex items-center gap-2"
                                                >
                                                    {isSavingComment ? "Saving..." : "Save Changes"}
                                                </button>
                                            </>
                                        ) : (
                                            <button 
                                                onClick={() => setIsEditingComment(true)}
                                                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2"
                                            >
                                                Edit Comment
                                            </button>
                                        )
                                    ) : (
                                        <button 
                                            onClick={handleMarkAsViewed}
                                            disabled={isSavingComment}
                                            className="px-4 py-2 bg-orange-600 text-white text-xs font-bold rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-all shadow-sm flex items-center gap-2"
                                        >
                                            {isSavingComment ? "Saving..." : "Mark as Viewed"}
                                        </button>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* Image Preview Modal */}
            {selectedImage && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedImage(null)}>
                    <div className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center">
                        <button 
                            onClick={() => setSelectedImage(null)}
                            className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white transition-colors"
                        >
                            <X size={32} />
                        </button>
                        <img 
                            src={selectedImage} 
                            alt="Evidence Fullscreen" 
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()} 
                        />
                    </div>
                </div>
            )}
        </div>
    );
});

ReportsView.displayName = "ReportsView";

export default ReportsView;
