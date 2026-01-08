"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let role = "";
    let idnumber = "";
    try {
      role = localStorage.getItem("role") || "";
      idnumber = localStorage.getItem("idnumber") || "";
      if ((!role || !idnumber) && typeof document !== "undefined") {
        const cookie = document.cookie.split("; ").find((c) => c.startsWith("ojt_session="));
        if (cookie) {
          const raw = cookie.substring("ojt_session=".length);
          const decoded = decodeURIComponent(raw);
          try {
            const obj = JSON.parse(decoded);
            if (obj?.role && obj?.idnumber) {
              role = String(obj.role);
              idnumber = String(obj.idnumber);
              localStorage.setItem("role", role);
              localStorage.setItem("idnumber", idnumber);
            }
          } catch {}
        }
      }
    } catch {}
    if (!role || !idnumber) {
      router.replace("/"); 
      return;
    }

    const segments = pathname.split("/");
    const urlRole = segments[2];

    if (urlRole && urlRole.toLowerCase() !== role) {
      router.replace(`/portal/${role}`);
      return;
    }
    
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
