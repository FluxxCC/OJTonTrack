"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // 1. Check if user is logged in
    const role = localStorage.getItem("role");
    const idnumber = localStorage.getItem("idnumber");
    
    if (!role || !idnumber) {
      // Not logged in
      router.replace("/"); 
      return;
    }

    // 2. Check Role Access
    // Extract the role segment from the URL: /portal/student/... -> student
    // pathname starts with /
    const segments = pathname.split("/");
    // segments[0] is empty, segments[1] is portal, segments[2] is the role
    const urlRole = segments[2];

    // If urlRole exists and differs from logged-in role
    // Note: Some routes might not follow /portal/[role] exactly, but in this structure they do.
    // If urlRole is missing (e.g. /portal), we might want to redirect to the correct role dashboard too.
    if (urlRole && urlRole.toLowerCase() !== role) {
      router.replace(`/portal/${role}`);
      return;
    }
    
    // If accessing just /portal, redirect to specific role dashboard
    if (!urlRole) {
        router.replace(`/portal/${role}`);
        return;
    }

    setAuthorized(true);
  }, [router, pathname]);

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F7F9]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-200 border-t-[#F97316] rounded-full animate-spin"></div>
          <div className="text-[#F97316] font-medium animate-pulse">Verifying access...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
