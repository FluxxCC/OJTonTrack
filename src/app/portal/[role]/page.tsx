"use client";
import React from "react";
import { useParams, useRouter } from "next/navigation";

const allowed = new Set(["student", "instructor", "coordinator", "supervisor"]);

export default function RolePortal() {
  const params = useParams<{ role: string }>();
  const router = useRouter();
  const role = allowed.has((params?.role || "").toLowerCase()) ? (params.role!.toLowerCase()) : "student";

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
      <div className="w-full max-w-[560px] bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-6">
        <div className="text-[#1F2937] font-bold text-lg">Welcome</div>
        <p className="mt-1 text-[#1F2937] text-sm">You are signed in as <span className="font-semibold">{role}</span>.</p>
        <p className="mt-2 text-[#64748B] text-sm">This portal is a placeholder. Production dashboards will route here automatically after authentication.</p>
        <button
          type="button"
          onClick={() => router.replace("/")}
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#F97316] text-white font-semibold py-2.5 px-3.5 focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 hover:bg-[#EA580C] transition-colors"
        >
          Return to system home
        </button>
      </div>
    </div>
  );
}

