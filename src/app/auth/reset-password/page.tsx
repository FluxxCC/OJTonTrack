"use client";
import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!token) {
      setError("Missing reset token.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to reset password");
      setMessage("Password reset successfully. Redirecting to login...");
      setTimeout(() => {
        router.push("/credentials");
      }, 2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to reset password";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="w-full max-w-md p-6 bg-white rounded-xl shadow-lg border border-red-100 text-center">
        <div className="text-red-600 font-bold mb-2">Invalid Link</div>
        <p className="text-gray-600 text-sm mb-4">This password reset link is invalid or missing a token.</p>
        <button onClick={() => router.push("/credentials")} className="text-[#F97316] hover:underline text-sm font-semibold">
          Back to Login
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[420px] bg-white border rounded-2xl p-8 shadow-[0_8px_28px_rgba(0,0,0,0.06)]" style={{ borderColor: "#E5E7EB" }}>
      <div className="flex flex-col items-center mb-8">
        {/* Placeholder for logo or just text */}
        <div className="h-16 w-16 bg-gray-200 rounded-lg mb-4 flex items-center justify-center text-gray-400">
             Logo
        </div>
        <h1 className="text-2xl font-extrabold text-[#1F2937]">Set New Password</h1>
        <p className="text-sm text-gray-500 mt-2">Enter your new password below.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-bold text-[#1F2937] mb-1.5">New Password</label>
          <div className="relative">
            <input
                type={showNewPassword ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-[#1F2937] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-colors pr-10"
                placeholder="Min. 6 characters"
            />
            <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
            >
                {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-[#1F2937] mb-1.5">Confirm Password</label>
          <div className="relative">
            <input
                type={showConfirmPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-[#1F2937] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-colors pr-10"
                placeholder="Re-enter password"
            />
            <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
            >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            {error}
          </div>
        )}

        {message && (
          <div className="p-3 rounded-lg bg-green-50 text-green-600 text-sm font-medium border border-green-100 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#F97316] hover:bg-[#EA580C] text-white font-bold py-3.5 rounded-xl transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed mt-2"
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-4">
      <Suspense fallback={<div className="text-[#F97316]">Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
