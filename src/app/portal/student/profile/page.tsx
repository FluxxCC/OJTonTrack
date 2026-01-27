"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { ProfileView, StudentHeader, StudentBottomNav, User } from "../ui";

export default function StudentProfilePage() {
  const idnumber = useMemo(() => {
    if (typeof window === "undefined") return "";
    try { return localStorage.getItem("idnumber") || ""; } catch { return ""; }
  }, []);
  const [student, setStudent] = useState<User | null>(null);
  const [supervisor, setSupervisor] = useState<User | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const json = await res.json();
      if (Array.isArray(json.users)) {
        const me = json.users.find((u: User) => String(u.idnumber) === String(idnumber) && String(u.role).toLowerCase() === "student");
        if (me) {
          setStudent(me);
          if (me.supervisorid) {
            const sup = json.users.find((u: User) => String(u.role).toLowerCase() === "supervisor" && String(u.id) === String(me.supervisorid));
            if (sup) setSupervisor(sup);
          }
        }
      }
    } catch {}
  }, [idnumber]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-[#F6F7F9] flex flex-col">
      <StudentHeader />
      <main className="flex-1 p-4 pb-16 md:pb-0" style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}>
        <div className="mx-auto w-full max-w-7xl">
          <ProfileView student={student} supervisor={supervisor} onUpdate={fetchData} />
        </div>
      </main>
      <StudentBottomNav />
    </div>
  );
}
