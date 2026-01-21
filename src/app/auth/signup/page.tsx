"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<{id: number, name: string}[]>([]);
  const [sections, setSections] = useState<{id: number, name: string, course_id: number}[]>([]);
  
  // Form State
  const [formData, setFormData] = useState({
    idnumber: "",
          email: "",
          firstname: "",
    lastname: "",
    password: "",
    confirmPassword: "",
    courseId: "",
    sectionId: ""
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Fetch metadata for courses and sections
    fetch("/api/metadata")
      .then(res => res.json())
      .then(data => {
        if (data.courses) setCourses(data.courses);
        if (data.sections) setSections(data.sections);
      })
      .catch(console.error);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const filteredSections = React.useMemo(() => {
    if (!formData.courseId) return [];

    // Filter by course and allow only 4A, 4B, 4C, 4D
    const allowed = sections.filter(s => 
      String(s.course_id) === String(formData.courseId) &&
      ["4A", "4B", "4C", "4D"].includes(s.name.toUpperCase())
    );

    // Remove duplicates by name
    return Array.from(new Map(allowed.map(s => [s.name.toUpperCase(), s])).values())
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sections, formData.courseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idnumber: formData.idnumber,
          email: formData.email,
          firstname: formData.firstname,
          lastname: formData.lastname,
          password: formData.password,
          courseId: Number(formData.courseId),
          sectionId: Number(formData.sectionId),
          role: "student"
        })
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Registration failed");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/credentials?role=student");
      }, 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-[420px] bg-white border rounded-2xl p-8 shadow-[0_8px_28px_rgba(0,0,0,0.06)] text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Successful!</h2>
            <p className="text-gray-600 mb-6">Your account has been created and is pending approval. You will be redirected to the login page.</p>
            <Link href="/credentials?role=student" className="text-[#F97316] font-bold hover:underline">
                Return to Login
            </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-4 font-sans">
      <div className="w-full max-w-[500px] bg-white border rounded-2xl p-8 shadow-[0_8px_28px_rgba(0,0,0,0.06)]" style={{ borderColor: "#E5E7EB" }}>
        <div className="flex flex-col items-center mb-8">
            <Image src="/icons-512.png" alt="CITE" width={64} height={64} className="h-16 w-16 rounded-lg object-cover mb-4" />
            <h1 className="text-2xl font-extrabold text-[#1F2937]">Create Account</h1>
            <p className="text-gray-500 mt-1">Student Registration</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium border border-red-100">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-[#1F2937] mb-1.5">First Name</label>
                    <input 
                        type="text" 
                        name="firstname"
                        required 
                        value={formData.firstname}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-[#1F2937] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-colors"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-[#1F2937] mb-1.5">Last Name</label>
                    <input 
                        type="text" 
                        name="lastname"
                        required 
                        value={formData.lastname}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-[#1F2937] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-colors"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-[#1F2937] mb-1.5">ID Number</label>
                <input 
                    type="text" 
                    name="idnumber"
                    required 
                    value={formData.idnumber}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-[#1F2937] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-colors"
                    placeholder="e.g. 2024-00001"
                />
            </div>

            <div>
                <label className="block text-sm font-bold text-[#1F2937] mb-1.5">Email Address</label>
                <input 
                    type="email" 
                    name="email"
                    required 
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-[#1F2937] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-colors"
                    placeholder="Enter your email address"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-[#1F2937] mb-1.5">Course</label>
                    <select 
                        name="courseId"
                        required 
                        value={formData.courseId}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-[#1F2937] bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-colors appearance-none"
                    >
                        <option value="">Select Course</option>
                        {courses.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-bold text-[#1F2937] mb-1.5">Section</label>
                    <select 
                        name="sectionId"
                        required 
                        value={formData.sectionId}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-[#1F2937] bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-colors appearance-none"
                    >
                        <option value="">Select Section</option>
                        {filteredSections.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-[#1F2937] mb-1.5">Password</label>
                <div className="relative">
                    <input 
                        type={showPassword ? "text" : "password"} 
                        name="password"
                        required 
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-[#1F2937] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-colors pr-10"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-[#1F2937] mb-1.5">Confirm Password</label>
                <div className="relative">
                    <input 
                        type={showConfirmPassword ? "text" : "password"} 
                        name="confirmPassword"
                        required 
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-[#1F2937] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-colors pr-10"
                    />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                </div>
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#F97316] hover:bg-[#EA580C] text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"
            >
                {loading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : "Create Account"}
            </button>

            <div className="text-center mt-6">
                <p className="text-gray-500 text-sm">
                    Already have an account?{" "}
                    <Link href="/credentials?role=student" className="text-[#F97316] font-bold hover:underline">
                        Sign In
                    </Link>
                </p>
            </div>
        </form>
      </div>
    </div>
  );
}
