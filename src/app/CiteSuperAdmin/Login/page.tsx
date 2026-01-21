"use client";
import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function SuperAdminLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [idnumber, setIdnumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    (async () => {
      try {
        setError(null);
        const idTrim = idnumber.trim();
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            idnumber: idTrim, 
            password,
            expectedRole: "superadmin" 
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error || "Authentication failed.");
        }
        const user = json.user;
        const normalizedRole = String(user?.role || "").toLowerCase();
        
        // Strict check for superadmin
        if (normalizedRole !== "superadmin") {
          throw new Error("Unauthorized: access restricted to Super Administrators.");
        }

        try {
          localStorage.setItem("idnumber", user.idnumber);
          localStorage.setItem("role", normalizedRole);
          if (user.id) localStorage.setItem("userId", String(user.id));
          if (user.firstname) localStorage.setItem("firstname", user.firstname);
          if (user.lastname) localStorage.setItem("lastname", user.lastname);
        } catch {}
        
        router.push(`/portal/superadmin`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Authentication failed.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <div className="min-h-screen bg-[#F6F7F9] flex items-center justify-center px-4">
      <div className="w-full max-w-[420px] bg-white border rounded-2xl p-8 shadow-[0_8px_28px_rgba(0,0,0,0.06)]" style={{ borderColor: "#E5E7EB" }}>
          <div className="flex flex-col items-center mb-8">
              <Image src="/icons-512.png" alt="CITE" width={64} height={64} className="h-16 w-16 rounded-lg object-cover mb-4" />
              <h1 className="text-2xl font-extrabold text-[#1F2937]">Super Admin</h1>
              <div className="mt-2 px-3 py-1 rounded-full bg-[#FFF7ED] border border-[#F97316]/20 text-[#F97316] text-sm font-medium capitalize">
                  Restricted Access
              </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                  <label className="block text-sm font-bold text-[#1F2937] mb-1.5">ID Number</label>
                  <input 
                      type="text" 
                      name="idnumber"
                      autoComplete="username"
                      required 
                      value={idnumber}
                      onChange={(e) => setIdnumber(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-[#1F2937] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-colors"
                      placeholder="Super Admin ID"
                  />
              </div>
              
              <div>
                  <label className="block text-sm font-bold text-[#1F2937] mb-1.5">Password</label>
                  <input 
                      type="password" 
                      required 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-[#1F2937] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-colors"
                      placeholder="••••••••"
                  />
              </div>
              
              {error && (
                <div className="text-[#B91C1C] bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg px-3 py-2 text-sm">
                  {error}
                </div>
              )}

              <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#F97316] hover:bg-[#EA580C] text-white font-bold py-3.5 rounded-xl transition-colors mt-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                  {loading ? "Verifying Access..." : "Login to Console"}
              </button>
          </form>
      </div>
    </div>
  );
}
