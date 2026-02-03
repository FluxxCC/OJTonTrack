"use client";
import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

type Role = "student" | "instructor" | "coordinator" | "supervisor";

const ROLES: { id: Role; label: string; hint: string }[] = [
  { id: "coordinator", label: "Coordinator", hint: "Program coordination and oversight" },
  { id: "instructor", label: "Instructor", hint: "Academic supervision and grading" },
  { id: "supervisor", label: "Supervisor", hint: "Industry mentorship and approvals" },
  { id: "student", label: "Student", hint: "Log attendance and submit reports" },
];

export default function Home() {
  const router = useRouter();
  const [selected, setSelected] = useState<Role>("student");
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    const checkSession = async () => {
      let role = "";
      let idnumber = "";
      try {
        // Check session storage first (for "Keep me signed in: OFF")
        role = sessionStorage.getItem("role") || "";
        idnumber = sessionStorage.getItem("idnumber") || "";
        
        // If not in session storage, check local storage (for "Keep me signed in: ON")
        if (!role || !idnumber) {
            role = localStorage.getItem("role") || "";
            idnumber = localStorage.getItem("idnumber") || "";
        }
      } catch {}

      if ((!role || !idnumber) && typeof navigator !== "undefined" && navigator.onLine) {
        try {
          const res = await fetch("/api/auth/check-session");
          if (res.ok) {
            const data = await res.json();
            if (data.role && data.idnumber) {
              role = data.role;
              idnumber = data.idnumber;
              // Default to sessionStorage if recovered from server session without context, 
              // but ideally server session implies persistence. 
              // For now, let's just use what we have.
              sessionStorage.setItem("role", role);
              sessionStorage.setItem("idnumber", idnumber);
            }
          }
        } catch {}
      }

      if (role && idnumber) {
        router.replace(`/portal/${role}`);
      }
    };
    checkSession();
  }, [router]);

  const onSubmit = () => {
    setLoading(true);
    try {
      localStorage.setItem("role", selected);
    } catch {}
    setTimeout(() => {
      router.replace(`/credentials?role=${selected}`);
    }, 250);
  };

  return (
    <div className="min-h-screen bg-[#F6F7F9] flex items-center justify-center px-4">
      <div
        className="w-full max-w-[500px] bg-white border rounded-2xl"
        style={{ borderColor: "#E5E7EB", boxShadow: "0 8px 28px rgba(0,0,0,0.06)" }}
      >
        <div className="px-6 py-5 border-b flex items-center gap-3" style={{ borderColor: "#E5E7EB" }}>
          <Image
            src="/icons-512.png"
            alt="OJTonTrack"
            width={42}
            height={42}
            className="h-10.5 w-10.5 rounded-md object-cover"
          />
          <div className="text-[#1F2937] font-extrabold text-[1.25rem] tracking-wide">OJTonTrack</div>
        </div>
        <div className="h-[2px] bg-[#F97316]/30" />

        <div className="px-6 pt-6 pb-8">
          <div className="text-[#1F2937] font-bold text-sm mt-2">College of Information Technology Educators</div>
          <div className="text-[#1F2937] font-medium text-sm mt-3">Select your professional role</div>

          <fieldset className="mt-4 grid gap-2">
            {ROLES.map((r) => {
              const active = selected === r.id;
              return (
                <label
                  key={r.id}
                  className={`role-link cursor-pointer flex items-center justify-between w-full rounded-xl bg-white text-[#1F2937] font-medium py-3.5 px-4 border transition-colors ${
                    active ? "bg-[#FFF7ED] border-[#F97316]" : "border-[#E5E7EB] hover:border-[#F97316]/50"
                  }`}
                >
                  <span className="flex flex-col">
                    <span>{r.label}</span>
                    <span className="text-[12px] text-[#64748B]">{r.hint}</span>
                  </span>
                  <input
                    type="radio"
                    name="role"
                    value={r.id}
                    checked={selected === r.id}
                    onChange={() => setSelected(r.id)}
                    className="h-4 w-4 rounded-full appearance-none border border-[#E5E7EB] checked:border-[#F97316] checked:bg-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 transition-all"
                    aria-label={r.label}
                  />
                </label>
              );
            })}
          </fieldset>

          <button
            type="button"
            onClick={onSubmit}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold py-4 px-4 focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 transition-colors"
            aria-busy={loading}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>

          <div className="mt-6 pt-4 border-t text-[#64748B] text-xs" style={{ borderColor: "#E5E7EB" }}>
            Authorized use only. Activity may be monitored for academic compliance.
          </div>
        </div>
      </div>
    </div>
  );
}
