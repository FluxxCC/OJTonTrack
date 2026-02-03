"use client";
import React, { useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

// Using server-side API for authentication to avoid client RLS issues

function CredentialsForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const role = searchParams.get("role") || "student";
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [idnumber, setIdnumber] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keepSignedIn, setKeepSignedIn] = useState<boolean>(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    (async () => {
      try {
        setError(null);
        setInfo(null);
        const idTrim = idnumber.trim();
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            idnumber: idTrim, 
            password,
            expectedRole: role.toLowerCase(),
            keepSignedIn
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error || "Authentication failed.");
        }
        const user = json.user;
        const normalizedRole = String(user?.role || "").toLowerCase();
        try {
          const storage = keepSignedIn ? localStorage : sessionStorage;
          // Clear both first to avoid conflicts
          localStorage.removeItem("idnumber");
          localStorage.removeItem("role");
          localStorage.removeItem("keepSignedIn");
          localStorage.removeItem("userId");
          localStorage.removeItem("firstname");
          localStorage.removeItem("lastname");
          localStorage.removeItem("avatar_url");
          sessionStorage.removeItem("idnumber");
          sessionStorage.removeItem("role");
          sessionStorage.removeItem("keepSignedIn");
          sessionStorage.removeItem("userId");
          sessionStorage.removeItem("firstname");
          sessionStorage.removeItem("lastname");
          sessionStorage.removeItem("avatar_url");

          storage.setItem("idnumber", user.idnumber);
          storage.setItem("role", normalizedRole);
          storage.setItem("keepSignedIn", keepSignedIn ? "1" : "0");
          if (user.id) storage.setItem("userId", String(user.id));
          if (user.firstname) storage.setItem("firstname", user.firstname);
          if (user.lastname) storage.setItem("lastname", user.lastname);
          if (user.avatar_url) storage.setItem("avatar_url", user.avatar_url);
        } catch {}
        router.push(`/portal/${normalizedRole}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Authentication failed.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  };

  const handleForgotPassword = () => {
    if (role !== "student") return;
    setError(null);
    setInfo(null);
    setForgotEmail("");
    setForgotOpen(true);
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setError("Email is required.");
      return;
    }
    setForgotLoading(true);
    (async () => {
      try {
        setError(null);
        setInfo(null);
        const trimmed = forgotEmail.trim();
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error || "Failed to send reset link.");
        }
        setInfo("If your email is registered and verified, a reset link has been sent.");
        setForgotOpen(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to send reset link.";
        setError(msg);
      } finally {
        setForgotLoading(false);
      }
    })();
  };

  return (
    <div className="w-full max-w-[420px] bg-white border rounded-2xl p-8 shadow-[0_8px_28px_rgba(0,0,0,0.06)] relative" style={{ borderColor: "#E5E7EB" }}>
        <div className="flex flex-col items-center mb-8">
            <Image src="/icons-512.png" alt="CITE" width={64} height={64} className="h-16 w-16 rounded-lg object-cover mb-4" />
            <h1 className="text-2xl font-extrabold text-[#1F2937]">Sign In</h1>
            <div className="mt-2 px-3 py-1 rounded-full bg-[#FFF7ED] border border-[#F97316]/20 text-[#F97316] text-sm font-medium capitalize">
                {role} Portal
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
                      placeholder="e.g. 2021-00001"
                  />
              </div>
              
              <div>
                  <div className="flex justify-between mb-1.5">
                    <label className="block text-sm font-bold text-[#1F2937]">Password</label>
                    {role === "student" && (
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-xs text-[#F97316] font-semibold hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input 
                        type={showPassword ? "text" : "password"} 
                        required 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-[#1F2937] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-colors pr-10"
                        placeholder="••••••••"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
              </div>

              <div className="flex items-center">
                  <input
                      id="keepSignedIn"
                      type="checkbox"
                      checked={keepSignedIn}
                      onChange={(e) => setKeepSignedIn(e.target.checked)}
                      className="h-4 w-4 text-[#F97316] focus:ring-[#F97316] border-gray-300 rounded cursor-pointer"
                  />
                  <label htmlFor="keepSignedIn" className="ml-2 block text-sm text-gray-700 cursor-pointer select-none">
                      Keep me signed in
                  </label>
              </div>
              
              {error && (
                <div className="text-[#B91C1C] bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg px-3 py-2 text-sm">
                  {error}
                </div>
              )}

              {info && (
                <div className="text-[#166534] bg-[#DCFCE7] border border-[#86EFAC] rounded-lg px-3 py-2 text-sm">
                  {info}
                </div>
              )}

              <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#F97316] hover:bg-[#EA580C] text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                  {loading ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : "Sign In"}
              </button>

              {role === 'student' && (
                <div className="text-center mt-4">
                  <p className="text-gray-500 text-sm">
                    Don't have an account?{" "}
                    <Link href="/auth/signup" className="text-[#F97316] font-bold hover:underline">
                      Sign Up
                    </Link>
                  </p>
                </div>
              )}
        </form>

        <div className="mt-8 text-center">
            <button 
                type="button"
                onClick={() => router.push("/")}
                className="text-sm text-[#64748B] hover:text-[#1F2937] font-medium transition-colors"
            >
                ← Back to role selection
            </button>
        </div>
        {forgotOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-[#E5E7EB] p-6">
              <div className="mb-4">
                <h2 className="text-lg font-extrabold text-[#1F2937]">Forgot password</h2>
                <p className="text-sm text-[#6B7280] mt-1">
                  Enter your registered email address to receive a reset link.
                </p>
              </div>
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-[#1F2937] mb-1.5">Email address</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-[#1F2937] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-colors"
                    placeholder="name@example.com"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotOpen(false)}
                    className="px-4 py-2 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                    disabled={forgotLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-bold transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {forgotLoading ? "Sending..." : "Send reset link"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
}

export default function CredentialsPage() {
  return (
    <div className="min-h-screen bg-[#F6F7F9] flex items-center justify-center px-4">
      <Suspense fallback={<div className="text-[#F97316]">Loading...</div>}>
        <CredentialsForm />
      </Suspense>
    </div>
  );
}
