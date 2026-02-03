"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  UserPlus, 
  Clock, 
  ShieldCheck,
  Menu, 
  LogOut,
  ChevronRight,
  BookOpen
} from "lucide-react";
import { 
  UserManagementView, 
  AddUserForm, 
  TimeEntryView, 
  SystemLogsView,
  User, 
  Course, 
  Section 
} from "./ui";
import { AcademicCatalogView } from "./AcademicCatalogView";

export default function SuperAdminPage() {
  const router = useRouter();
  
  // Data state
  const [users, setUsers] = useState<User[]>([]);
  const [adminName, setAdminName] = useState("Super Admin");
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [availableSections, setAvailableSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Layout state
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"view-account" | "new-account" | "time-entry" | "system-logs" | "academic-catalog">("view-account");
  const [isMobile, setIsMobile] = useState(false);

  // Mobile check
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load users");
      setUsers(json.users || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load users";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const res = await fetch("/api/metadata");
      const data = await res.json();
      if (data.courses) setAvailableCourses(data.courses);
      if (data.sections) setAvailableSections(data.sections);
    } catch (e) {
      console.error("Failed to fetch metadata", e);
    }
  };

  useEffect(() => {
    fetchMetadata();
    load();
  }, []);

  // Refresh metadata when switching to account tabs to ensure latest courses/sections
  useEffect(() => {
    if (activeTab === 'new-account' || activeTab === 'view-account') {
      fetchMetadata();
    }
  }, [activeTab]);

  const addUser = async (formData: any) => {
    setError(null);
    try {
      // Auto-approve students added by SuperAdmin
      const payload = { 
        ...formData, 
        signup_status: formData.role === "student" ? "APPROVED" : undefined 
      };
      
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to add user");
      await load();
      // If we added via the New Account tab, switch back to View Account
      if (activeTab === 'new-account') {
        setActiveTab('view-account');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add user";
      setError(msg);
      throw e;
    }
  };

  const saveEdit = async (id: number, updates: any) => {
    setError(null);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update user");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update user";
      setError(msg);
      throw e;
    }
  };

  const deleteUser = async (id: number, role?: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/users/${id}?role=${role || 'student'}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to delete user");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete user";
      setError(msg);
      throw e;
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      localStorage.clear();
      router.replace("/");
    } catch (e) {
      console.error("Logout failed", e);
      router.replace("/");
    }
  };

  const menuItems = [
    { id: "new-account", label: "New Account", icon: UserPlus },
    { id: "view-account", label: "View Account", icon: LayoutDashboard },
    { id: "time-entry", label: "Time Entry", icon: Clock },
    { id: "system-logs", label: "System Logs", icon: ShieldCheck },
    { id: "academic-catalog", label: "Academic Catalog", icon: BookOpen },
  ];

  return (
    <div className="flex h-screen bg-[#F6F7F9] font-sans overflow-hidden">
       {/* Sidebar Overlay */}
       {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-30 w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl lg:shadow-none lg:relative lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
         {/* Logo */}
        <div className="h-20 flex items-center gap-3 px-6 border-b border-gray-100 bg-gradient-to-r from-orange-50/50 to-transparent">
          <Image src="/icons-512.png" alt="CITE Logo" width={40} height={40} className="w-10 h-10 rounded-xl shadow-sm object-cover" />
          <div>
            <h1 className="font-extrabold text-xl text-gray-900 tracking-tight leading-none">OJTonTrack</h1>
            <p className="text-xs font-medium text-[#F97316] uppercase tracking-wider mt-0.5">Super Admin</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
           {menuItems.map((item) => {
             const isActive = activeTab === item.id;
             const Icon = item.icon;
             return (
               <button
                 key={item.id}
                 onClick={() => {
                   setActiveTab(item.id as any);
                   if (isMobile) setSidebarOpen(false);
                 }}
                 className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                   isActive 
                     ? "bg-[#F97316] text-white shadow-lg shadow-orange-200 translate-x-1" 
                     : "text-gray-600 hover:bg-orange-50 hover:text-[#F97316]"
                 }`}
               >
                 <div className="flex items-center gap-3.5">
                   <Icon size={20} className={isActive ? "text-white" : "text-gray-400 group-hover:text-[#F97316]"} strokeWidth={2.5} />
                   <span>{item.label}</span>
                 </div>
                 {isActive && <ChevronRight size={16} className="text-white/80" strokeWidth={3} />}
               </button>
             );
           })}
        </nav>

        {/* Footer / Logout */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold shadow-md overflow-hidden relative">
              {(adminName?.[0] || "A").toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{adminName || "Super Admin"}</p>
              <p className="text-xs text-gray-500 truncate">Administrator</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 h-16 flex-shrink-0 px-4 sm:px-8 flex items-center justify-between z-10">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSidebarOpen(!isSidebarOpen)}
                className="lg:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Menu size={24} />
              </button>
              <div>
                <h2 className="text-xl font-bold text-gray-900 capitalize tracking-tight">
                  {menuItems.find(i => i.id === activeTab)?.label}
                </h2>
              </div>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
           <div className="max-w-7xl mx-auto">
             {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-3 shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    {error}
                </div>
            )}

             {activeTab === 'new-account' && (
               <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                 <AddUserForm 
                   onSuccess={addUser}
                   onClose={() => setActiveTab('view-account')}
                   availableCourses={availableCourses}
                   availableSections={availableSections}
                 />
               </div>
             )}

             {activeTab === 'view-account' && (
               <UserManagementView
                  onDelete={deleteUser}
                  onEdit={saveEdit}
                  onAdd={addUser}
                  availableCourses={availableCourses}
                  availableSections={availableSections}
                />
             )}

             {activeTab === 'time-entry' && <TimeEntryView />}
             
             {activeTab === 'system-logs' && <SystemLogsView />}

             {activeTab === 'academic-catalog' && <AcademicCatalogView />}
           </div>
        </main>
      </div>
    </div>
  );
}
