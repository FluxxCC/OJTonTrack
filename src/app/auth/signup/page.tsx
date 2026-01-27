"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowLeft, X, FileText, Camera, User as UserIcon, Move, ZoomIn, ZoomOut } from "lucide-react";
import Cropper from "react-easy-crop";
import getCroppedImg from "@/lib/cropImage";

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
  const [step, setStep] = useState<'REGISTER' | 'AVATAR' | 'SUCCESS'>('REGISTER');
  const [registeredUser, setRegisteredUser] = useState<{id: number, idnumber: string} | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Avatar State
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

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

    if (!termsAccepted) {
      setError("You must agree to the Terms and Conditions & Privacy Policy to register.");
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

      setRegisteredUser(json.user);
      setStep('AVATAR');

    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError("File size too large (max 5MB)");
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarSubmit = async () => {
    if (!avatarFile || !registeredUser) {
        setStep('SUCCESS'); // Skip if no file
        return;
    }

    setUploadingAvatar(true);
    try {
        let finalImageBase64 = avatarPreview;

        if (avatarPreview && croppedAreaPixels) {
             try {
                const cropped = await getCroppedImg(avatarPreview, croppedAreaPixels);
                if (cropped) finalImageBase64 = cropped;
             } catch (e) {
                console.error("Cropping failed, falling back to original", e);
             }
        }

        if (!finalImageBase64) throw new Error("No image data to upload");

        const res = await fetch("/api/profile/avatar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                idnumber: registeredUser.idnumber,
                fileData: finalImageBase64
            })
        });
        
        if (!res.ok) throw new Error("Failed to upload avatar");
        setStep('SUCCESS');
    } catch (e) {
        console.error(e);
        // Even if upload fails, proceed to success but maybe warn?
        // For now, just proceed to success to avoid blocking the user.
        setStep('SUCCESS');
    } finally {
        setUploadingAvatar(false);
    }
  };

  if (step === 'SUCCESS') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-300">
        <div className="w-full max-w-[480px] bg-white border rounded-2xl p-8 shadow-2xl text-center scale-100 animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-blue-50/50">
                <FileText size={40} strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Account Under Review</h2>
            <div className="space-y-4 text-gray-600 mb-8">
                <p>
                    Thank you for setting up your profile. Your account is currently under review by the Coordinator.
                </p>
                <p className="text-sm bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-100">
                    You will be notified via email once your registration has been approved. Please check back later or contact your instructor for updates.
                </p>
            </div>
            <Link 
                href="/credentials?role=student" 
                className="inline-flex w-full items-center justify-center px-6 py-3.5 text-base font-bold text-white transition-all bg-[#F97316] rounded-xl shadow-lg shadow-orange-500/20 hover:bg-[#EA580C] active:scale-95"
            >
                Return to Login
            </Link>
        </div>
      </div>
    );
  }

  if (step === 'AVATAR') {
     return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-4 font-sans">
            <div className="w-full max-w-[420px] bg-white border rounded-2xl p-8 shadow-[0_8px_28px_rgba(0,0,0,0.06)]" style={{ borderColor: "#E5E7EB" }}>
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-extrabold text-[#1F2937]">Setup Profile</h1>
                    <p className="text-gray-500 mt-2">Upload a professional photo for your ID.</p>
                </div>

                <div className="flex flex-col items-center gap-6 mb-8">
                    {avatarPreview ? (
                        <div className="w-full animate-in fade-in zoom-in-95 duration-300">
                            <div className="relative w-full h-[300px] bg-gray-900 rounded-xl overflow-hidden mb-6 shadow-inner ring-1 ring-black/5">
                                <Cropper
                                    image={avatarPreview}
                                    crop={crop}
                                    zoom={zoom}
                                    aspect={1}
                                    onCropChange={setCrop}
                                    onCropComplete={onCropComplete}
                                    onZoomChange={setZoom}
                                    cropShape="round"
                                    showGrid={false}
                                    style={{
                                        containerStyle: { background: '#111827' },
                                        cropAreaStyle: { border: '2px solid rgba(255, 255, 255, 0.5)' }
                                    }}
                                />
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs font-medium px-4 py-2 rounded-full flex items-center gap-2 pointer-events-none backdrop-blur-sm border border-white/10 shadow-lg z-50">
                                    <Move size={14} />
                                    <span>Drag to Reposition</span>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-4 px-2 mb-4">
                                <ZoomOut size={18} className="text-gray-400 shrink-0" />
                                <input
                                    type="range"
                                    value={zoom}
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    aria-labelledby="Zoom"
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#F97316]"
                                />
                                <ZoomIn size={18} className="text-gray-400 shrink-0" />
                            </div>

                            <div className="flex justify-center">
                                <button 
                                    onClick={() => {
                                        setAvatarPreview(null);
                                        setAvatarFile(null);
                                        setZoom(1);
                                        setCrop({ x: 0, y: 0 });
                                    }}
                                    className="text-sm text-red-500 font-medium hover:text-red-600 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                >
                                    <X size={14} /> Change Photo
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-6 w-full py-8">
                            <div className="relative group cursor-pointer">
                                <div className="w-40 h-40 rounded-full overflow-hidden bg-gray-50 border-4 border-white shadow-xl ring-1 ring-gray-100 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                                    <UserIcon size={64} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
                                </div>
                                <label className="absolute inset-0 flex items-center justify-center cursor-pointer">
                                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                    <div className="absolute bottom-2 right-2 bg-white text-gray-700 p-3 rounded-full shadow-lg border border-gray-100 group-hover:scale-110 transition-transform">
                                        <Camera size={22} className="text-[#F97316]" />
                                    </div>
                                </label>
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-semibold text-gray-900">No photo selected</p>
                                <p className="text-xs text-gray-500 mt-1">Click the camera icon to upload</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    <button
                        onClick={handleAvatarSubmit}
                        disabled={!avatarFile || uploadingAvatar}
                        className="w-full bg-[#F97316] hover:bg-[#EA580C] text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                        {uploadingAvatar ? (
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        ) : "Save Profile Photo"}
                    </button>
                    {!avatarFile && (
                        <button
                            onClick={() => setStep('SUCCESS')}
                            className="w-full bg-white text-gray-500 font-bold py-3.5 px-4 rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            Skip for now
                        </button>
                    )}
                </div>
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

            <div className="flex items-start gap-3 mt-4 mb-6">
                <div className="flex items-center h-5">
                    <input
                        id="terms"
                        name="terms"
                        type="checkbox"
                        required
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-[#F97316] focus:ring-[#F97316] cursor-pointer"
                    />
                </div>
                <div className="text-sm">
                    <label htmlFor="terms" className="font-medium text-gray-700 cursor-pointer">I agree to the </label>
                    <button
                        type="button"
                        onClick={() => setShowTermsModal(true)}
                        className="font-bold text-[#F97316] hover:underline focus:outline-none ml-1"
                    >
                        Terms and Conditions & Privacy Policy
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
      
      {showTermsModal && <TermsModal onClose={() => setShowTermsModal(false)} />}
    </div>
  );
}

// Terms and Conditions Modal Component
function TermsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white rounded-t-2xl z-10">
            <div>
                <h3 className="text-xl font-bold text-gray-900">Terms & Privacy Policy</h3>
                <p className="text-sm text-gray-500">Last updated: January 2026</p>
            </div>
            <button 
                onClick={onClose} 
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
            >
                <X size={24} />
            </button>
        </div>
        
        <div className="p-6 overflow-y-auto text-gray-600 space-y-6 text-sm leading-relaxed scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
            
            <section>
                <h4 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <FileText size={20} className="text-[#F97316]" />
                    TERMS AND CONDITIONS
                </h4>
                
                <div className="space-y-4 pl-1">
                    <div>
                        <h5 className="font-bold text-gray-800 mb-1">1. Introduction</h5>
                        <p>Welcome to <strong>OJTonTrack</strong>, a Student OJT Attendance and Progress Monitoring System. By accessing or using OJTonTrack (the "Platform"), you agree to comply with and be bound by these Terms and Conditions. If you do not agree, please do not use the Platform.</p>
                    </div>

                    <div>
                        <h5 className="font-bold text-gray-800 mb-1">2. Purpose of the Platform</h5>
                        <p className="mb-2">OJTonTrack is designed to:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Track student attendance and validated hours</li>
                            <li>Monitor OJT progress and performance</li>
                            <li>Facilitate supervisor evaluations and reports</li>
                            <li>Support institutional compliance and documentation</li>
                        </ul>
                    </div>

                    <div>
                        <h5 className="font-bold text-gray-800 mb-1">3. User Roles</h5>
                        <p className="mb-2">OJTonTrack supports the following defined user roles with specific responsibilities:</p>
                        <ul className="list-disc pl-5 space-y-2">
                            <li><strong>Coordinator:</strong> Acts as the system-level administrator responsible for user management. The Coordinator approves student account registrations, manages user access, and oversees overall system integrity.</li>
                            <li><strong>Instructor:</strong> Monitors student attendance records (time-in/time-out without photo capture), reviews submitted student reports, and views supervisor evaluations. Instructors do not validate attendance but use the data for academic monitoring and grading purposes.</li>
                            <li><strong>Supervisor:</strong> Validates student attendance records using <strong>photo-based verification at the workplace</strong>. Supervisors are responsible for evaluating student performance. Supervisor evaluations are visible <strong>only to the assigned Instructor</strong>.</li>
                            <li><strong>Student:</strong> Records attendance using <strong>photo-based time-in and time-out</strong>, submits required reports, and complies with OJT attendance and reporting requirements. Student reports are submitted directly to the Instructor.</li>
                        </ul>
                        <p className="mt-2 italic">Each role is granted access only to features and data necessary for their official responsibilities.</p>
                    </div>

                    <div>
                        <h5 className="font-bold text-gray-800 mb-1">4. User Responsibilities</h5>
                        <p className="mb-2">By using OJTonTrack, you agree to:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Provide accurate and truthful information</li>
                            <li>Maintain the confidentiality of your login credentials</li>
                            <li>Use the Platform solely for legitimate academic and institutional purposes</li>
                            <li>Refrain from falsifying attendance, reports, evaluations, or records</li>
                        </ul>
                        <p className="mt-2 text-red-600 font-medium">Any misuse may result in suspension or termination of access.</p>
                    </div>

                    <div>
                        <h5 className="font-bold text-gray-800 mb-1">5. Attendance, Overtime, and Reports</h5>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Attendance entries, overtime logs, and reports must reflect actual work performed</li>
                            <li>Submitted records may require supervisor or administrator approval</li>
                            <li>OJTonTrack reserves the right to flag, audit, or invalidate suspicious or non-compliant entries</li>
                        </ul>
                    </div>

                    <div>
                        <h5 className="font-bold text-gray-800 mb-1">6. Evaluations</h5>
                        <p className="mb-2">Supervisor evaluations are official academic records. Users agree that:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Evaluations must be fair, accurate, and unbiased</li>
                            <li>Once submitted and finalized, evaluations may be locked or restricted from editing</li>
                        </ul>
                    </div>

                    <div>
                        <h5 className="font-bold text-gray-800 mb-1">7. System Availability</h5>
                        <p>While we aim for high availability, OJTonTrack does not guarantee uninterrupted access. Maintenance, updates, or technical issues may result in temporary downtime.</p>
                    </div>

                    <div>
                        <h5 className="font-bold text-gray-800 mb-1">8. Intellectual Property</h5>
                        <p>All system content, design, features, and source code are the intellectual property of OJTonTrack unless otherwise stated. Unauthorized copying, modification, or distribution is prohibited.</p>
                    </div>

                    <div>
                        <h5 className="font-bold text-gray-800 mb-1">9. Termination</h5>
                        <p className="mb-2">OJTonTrack may suspend or terminate access if a user:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Violates these Terms</li>
                            <li>Engages in fraudulent or harmful activities</li>
                            <li>Compromises system security or data integrity</li>
                        </ul>
                    </div>

                    <div>
                        <h5 className="font-bold text-gray-800 mb-1">10. Limitation of Liability</h5>
                        <p className="mb-2">OJTonTrack shall not be liable for:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Loss of data due to user error</li>
                            <li>Delays caused by third-party services</li>
                            <li>Indirect or consequential damages arising from system use</li>
                        </ul>
                    </div>
                </div>
            </section>

            <div className="h-px bg-gray-200 my-4"></div>

            <section>
                <h4 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <FileText size={20} className="text-[#F97316]" />
                    PRIVACY POLICY
                </h4>
                
                <div className="space-y-4 pl-1">
                    <div>
                        <h5 className="font-bold text-gray-800 mb-1">1. Information We Collect</h5>
                        <p className="mb-2">OJTonTrack may collect the following information:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Personal details (name, ID number, email, role)</li>
                            <li>Attendance timestamps and validated hours</li>
                            <li>Reports, evaluations, and comments</li>
                            <li>Profile information</li>
                        </ul>
                    </div>

                    <div>
                        <h5 className="font-bold text-gray-800 mb-1">2. How We Use Information</h5>
                        <p className="mb-2">Collected data is used to:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Monitor OJT attendance and compliance</li>
                            <li>Generate academic and administrative reports</li>
                            <li>Enable evaluations and progress tracking</li>
                            <li>Maintain system security and integrity</li>
                        </ul>
                    </div>

                    <div>
                        <h5 className="font-bold text-gray-800 mb-1">3. Data Sharing</h5>
                        <p className="mb-2">OJTonTrack does <strong>not</strong> sell or trade personal data. Information may only be shared with:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Authorized school administrators</li>
                            <li>Assigned supervisors and instructors</li>
                            <li>System service providers strictly for operational needs</li>
                        </ul>
                    </div>

                    <div>
                        <h5 className="font-bold text-gray-800 mb-1">4. Data Security</h5>
                        <p className="mb-2">We implement appropriate technical and organizational measures to protect user data, including:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Role-based access control</li>
                            <li>Secure authentication mechanisms</li>
                            <li>Activity logging and monitoring</li>
                        </ul>
                        <p className="mt-2 text-sm text-gray-500">Despite safeguards, no system is completely secure. Users acknowledge inherent risks of online platforms.</p>
                    </div>

                    <div>
                        <h5 className="font-bold text-gray-800 mb-1">5. Data Retention</h5>
                        <p>User data is retained only for as long as necessary to fulfill academic, legal, and institutional requirements.</p>
                    </div>

                    <div>
                        <h5 className="font-bold text-gray-800 mb-1">6. User Rights</h5>
                        <p className="mb-2">Users may have the right to:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Access their personal data</li>
                            <li>Request corrections to inaccurate records</li>
                            <li>Request account deactivation, subject to institutional policies</li>
                        </ul>
                    </div>

                    <div>
                        <h5 className="font-bold text-gray-800 mb-1">7. Compliance with Philippine Data Privacy Act</h5>
                        <p>OJTonTrack complies with <strong>Republic Act No. 10173 (Data Privacy Act of 2012)</strong> and its implementing rules and regulations.</p>
                    </div>

                    <div>
                        <h5 className="font-bold text-gray-800 mb-1">8. Cookies and Tracking</h5>
                        <p className="mb-2">OJTonTrack may use essential cookies or local storage to:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Maintain sessions</li>
                            <li>Improve user experience</li>
                        </ul>
                        <p>No intrusive tracking or advertising cookies are used.</p>
                    </div>

                    <div>
                        <h5 className="font-bold text-gray-800 mb-1">9. Changes to Privacy Policy</h5>
                        <p>This Privacy Policy may be updated periodically. Changes will take effect upon posting within the Platform.</p>
                    </div>

                    <div>
                        <h5 className="font-bold text-gray-800 mb-1">10. Contact</h5>
                        <p>For questions, concerns, or data-related requests regarding these Terms or Privacy Policy, please contact the system administrator through official institutional channels.</p>
                    </div>
                </div>
            </section>
        </div>

        <div className="p-4 border-t bg-gray-50 rounded-b-2xl flex justify-end gap-3">
            <button 
                onClick={onClose} 
                className="bg-[#F97316] hover:bg-[#EA580C] text-white font-bold py-2.5 px-8 rounded-xl transition-colors shadow-lg shadow-orange-500/20 active:scale-95"
            >
                I Understand
            </button>
        </div>
      </div>
    </div>
  );
}

