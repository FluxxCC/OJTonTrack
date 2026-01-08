"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      let role = "";
      let idnumber = "";
      
      try {
        role = localStorage.getItem("role") || "";
        idnumber = localStorage.getItem("idnumber") || "";
      } catch {}

      // 1. Try Client Cookie if missing
      if (!role || !idnumber) {
        try {
           const match = document.cookie.match(/(^|;)\s*ojt_session=([^;]+)/);
           if (match) {
             const obj = JSON.parse(decodeURIComponent(match[2]));
             if (obj?.role && obj?.idnumber) {
               role = obj.role;
               idnumber = obj.idnumber;
               localStorage.setItem("role", role);
               localStorage.setItem("idnumber", idnumber);
             }
           }
        } catch {}
      }

      // 2. Try Server Cookie (Async Fallback) if still missing
      if ((!role || !idnumber) && navigator.onLine) {
        try {
          const res = await fetch("/api/auth/check-session");
          if (res.ok) {
            const data = await res.json();
            if (data.role && data.idnumber) {
              role = data.role;
              idnumber = data.idnumber;
              localStorage.setItem("role", role);
              localStorage.setItem("idnumber", idnumber);
            }
          }
        } catch (e) {
          console.error("Session check failed", e);
        }
      }

      if (!mounted) return;

      // 3. Final Validation
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
      
      setAuthorized(true);
      setChecking(false);
    };

    check();
    return () => { mounted = false; };
  }, [pathname, router]);

  if (checking || !authorized) {
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
