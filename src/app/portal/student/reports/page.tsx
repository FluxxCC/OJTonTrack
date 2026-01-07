"use client";
import React, { useEffect, useMemo, useState } from "react";
import { ReportsView, StudentHeader, StudentBottomNav } from "../ui";
import type { ReportEntry } from "../ui";

export default function StudentReportsPage() {
  const idnumber = useMemo(() => {
    if (typeof window === "undefined") return "";
    try { return localStorage.getItem("idnumber") || ""; } catch { return ""; }
  }, []);
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [drafts, setDrafts] = useState<ReportEntry[]>([]);

  useEffect(() => {
    if (!idnumber) return;
    (async () => {
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
    })();
  }, [idnumber]);

  return (
    <div className="min-h-screen bg-[#F6F7F9] flex flex-col">
      <StudentHeader />
      <main className="flex-1 p-4 pb-16 md:pb-0" style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}>
        <div className="mx-auto w-full max-w-7xl">
          <ReportsView
            idnumber={idnumber}
            reports={reports}
            drafts={drafts}
            onUpdate={(next) => setReports(next)}
            onDraftUpdate={(nextDrafts) => setDrafts(nextDrafts)}
          />
        </div>
      </main>
      <StudentBottomNav />
    </div>
  );
}
