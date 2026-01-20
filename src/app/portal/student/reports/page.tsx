"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { ReportsView, StudentHeader, StudentBottomNav } from "../ui";
import type { ReportEntry } from "../ui";
import { supabase } from "@/lib/supabaseClient";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export default function StudentReportsPage() {
  const idnumber = useMemo(() => {
    if (typeof window === "undefined") return "";
    try { return localStorage.getItem("idnumber") || ""; } catch { return ""; }
  }, []);
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [drafts, setDrafts] = useState<ReportEntry[]>([]);
  const [courseDeadlines, setCourseDeadlines] = useState<Record<string, Record<number, string>>>({});
  const [student, setStudent] = useState<any>(null);

  const fetchReports = useCallback(async () => {
    if (!idnumber) return;
    try {
        const res = await fetch(`/api/reports?idnumber=${encodeURIComponent(idnumber)}`);
        const json = await res.json();
        if (res.ok) {
          if (Array.isArray(json.reports)) setReports(json.reports);
          if (Array.isArray(json.drafts)) setDrafts(json.drafts);
          else setDrafts([]);
        }
    } catch (e) {
        console.error("Failed to fetch reports:", e);
    }
  }, [idnumber]);

  const fetchDeadlines = useCallback(async () => {
    try {
        const dRes = await fetch("/api/instructor/deadlines");
        if (dRes.ok) {
            const dJson = await dRes.json();
            setCourseDeadlines(dJson.deadlines || {});
        }
    } catch (e) {
        console.error("Failed to fetch deadlines:", e);
    }
  }, []);

  useEffect(() => {
    if (!idnumber) return;
    (async () => {
      try {
        // Fetch User to know course/section
        const uRes = await fetch("/api/users", { cache: "no-store" });
        const uJson = await uRes.json();
        if (Array.isArray(uJson.users)) {
             const me = uJson.users.find((u: any) => String(u.idnumber) === String(idnumber) && String(u.role).toLowerCase() === "student");
             if (me) setStudent(me);
        }
        await fetchReports();
        await fetchDeadlines();
      } catch (e) {
        console.error("Failed to fetch data:", e);
      }
    })();
  }, [idnumber, fetchReports, fetchDeadlines]);

  // Realtime
  useEffect(() => {
    if (!idnumber || !supabase) return;
    const channel = supabase
      .channel('student-reports-page')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'report_requirements' },
        (payload: RealtimePostgresChangesPayload<any>) => { fetchDeadlines(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        (payload: RealtimePostgresChangesPayload<any>) => { fetchReports(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'report_comments' },
        (payload: RealtimePostgresChangesPayload<any>) => { fetchReports(); }
      )
      .subscribe();
    return () => { supabase?.removeChannel(channel); };
  }, [idnumber, fetchReports, fetchDeadlines]);

  // Compute Student Deadlines (Weeks)
  const studentDeadlines = useMemo(() => {
    if (!student) return [];
    
    // Logic to find relevant keys (Course:::Section, Course:::ALL, etc)
    // Helper to normalize keys
    const normalize = (s: string) => s.trim();
    
    const keys: string[] = [];
    if (student.course && student.section) {
        keys.push(`${normalize(student.course)}:::${normalize(student.section)}`);
    }
    if (student.course) {
        keys.push(`${normalize(student.course)}:::ALL`); // Course wide
        keys.push(`${normalize(student.course)}:::`); // Fallback
    }
    keys.push("ALL:::ALL"); // Global

    const merged: Record<number, string> = {};
    keys.reverse().forEach((k) => {
      const weeks = courseDeadlines[k];
      if (!weeks) return;
      Object.keys(weeks).forEach((weekStr) => {
        const weekNum = Number(weekStr);
        if (!weekNum) return;
        merged[weekNum] = weeks[weekNum];
      });
    });

    return Object.entries(merged)
      .map(([weekStr, date]) => {
        const week = Number(weekStr);
        return { week, date };
      })
      .sort((a, b) => a.week - b.week);
  }, [student, courseDeadlines]);

  return (
    <div className="min-h-screen bg-[#F6F7F9] flex flex-col">
      <StudentHeader />
      <main className="flex-1 p-4 pb-16 md:pb-0" style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}>
        <div className="mx-auto w-full max-w-7xl">
          <ReportsView
            idnumber={idnumber}
            reports={reports}
            drafts={drafts}
            deadlines={studentDeadlines}
            onUpdate={(next) => setReports(next)}
            onDraftUpdate={(nextDrafts) => setDrafts(nextDrafts)}
          />
        </div>
      </main>
      <StudentBottomNav />
    </div>
  );
}
