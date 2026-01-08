"use client";
import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import citeLogo from "../../../../assets/CITE.png";
import { 
  Users, 
  GraduationCap, 
  Briefcase, 
  Menu, 
  LogOut, 
  LayoutDashboard,
  Settings
} from 'lucide-react';
import { 
  UsersView, 
  AddUserForm, 
  EditUserForm, 
  ViewUserDetails, 
  Modal, 
  User, 
  RoleType, 
  Course, 
  Section 
} from "./ui";

export default function CoordinatorPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === "accepted") {
          setDeferredPrompt(null);
        }
      });
    }
  };

  const [activeTab, setActiveTab] = useState<RoleType>("student");
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Data State
  const [users, setUsers] = useState<User[]>([]);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [availableSections, setAvailableSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals State
  const [showAddModal, setShowAddModal] = useState<RoleType | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [coordinatorName, setCoordinatorName] = useState("");

  // Check screen size
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch Data
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.users) setUsers(data.users);
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    
    // Fetch metadata
    fetch("/api/metadata")
      .then(res => res.json())
      .then(data => {
        if (data.courses) setAvailableCourses(data.courses);
        if (data.sections) setAvailableSections(data.sections);
      })
      .catch(console.error);

    const fname = localStorage.getItem("firstname");
    const lname = localStorage.getItem("lastname");
    if (fname || lname) {
      setCoordinatorName(`${fname || ""} ${lname || ""}`.trim());
    }

    // Handle URL-based tab selection if needed (legacy support)
    try {
      const p = pathname || "";
      if (p.endsWith("/instructors")) setActiveTab("instructor");
      else if (p.endsWith("/supervisors")) setActiveTab("supervisor");
      else if (p.endsWith("/students")) setActiveTab("student");
    } catch {}
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      localStorage.clear();
    } catch (e) {
      console.error("Logout failed", e);
    }
    router.replace("/");
  };

  const navItems = [
    { id: "student", label: "Students", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { id: "instructor", label: "Instructors", icon: GraduationCap, color: "text-orange-600", bg: "bg-orange-50" },
    { id: "supervisor", label: "Supervisors", icon: Briefcase, color: "text-purple-600", bg: "bg-purple-50" },
  ] as const;

  return (
    <div className="min-h-screen bg-[#F6F7F9] flex overflow-hidden font-sans">
      {/* Mobile Overlay */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl lg:shadow-none lg:relative lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="h-20 flex items-center gap-3 px-6 border-b border-gray-100 bg-gradient-to-r from-orange-50/50 to-transparent">
          <Image src={citeLogo} alt="CITE Logo" width={40} height={40} className="w-10 h-10 rounded-xl shadow-sm object-cover" />
          <div>
            <h1 className="font-extrabold text-xl text-gray-900 tracking-tight leading-none">OJTonTrack</h1>
            <p className="text-xs font-medium text-[#F97316] uppercase tracking-wider mt-0.5">Coordinator</p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider px-4 mb-2">Management</div>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (isMobile) setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? "bg-[#F97316] text-white shadow-md shadow-orange-200" 
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${
                  isActive ? "bg-white/20 text-white" : `${item.bg} ${item.color} group-hover:bg-gray-200`
                }`}>
                  <item.icon size={20} />
                </div>
                <span className="font-semibold text-sm">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold shadow-md">
              {(coordinatorName?.[0] || "C").toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{coordinatorName || "Coordinator"}</p>
              <p className="text-xs text-gray-500 truncate">Administrator</p>
            </div>
          </div>
          {deferredPrompt && (
            <button
              onClick={handleInstallClick}
              className="w-full flex items-center justify-center gap-2 text-[#F97316] hover:bg-orange-50 p-2 rounded-lg transition-colors text-sm font-semibold mb-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>Install App</span>
            </button>
          )}
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors text-sm font-semibold"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-6 z-20 sticky top-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu size={24} />
            </button>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Management
              </h2>
              <p className="text-sm text-gray-500 hidden sm:block">
                View and manage {activeTab} accounts
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-hidden p-4 sm:p-6 lg:p-8 bg-[#F6F7F9] relative">
           <div className="h-full max-w-7xl mx-auto w-full animate-in fade-in zoom-in-95 duration-300">
             <UsersView 
               role={activeTab}
               users={users}
               availableCourses={availableCourses}
               availableSections={availableSections}
               onAdd={() => setShowAddModal(activeTab)}
               onEdit={setEditingUser}
               onView={setViewingUser}
               onDelete={setDeletingUser}
             />
           </div>
        </main>
      </div>

      {/* Modals */}
      {showAddModal && (
        <Modal onClose={() => setShowAddModal(null)}>
          <AddUserForm 
            role={showAddModal} 
            onSuccess={fetchUsers} 
            onClose={() => setShowAddModal(null)} 
            availableCourses={availableCourses}
            availableSections={availableSections}
            users={users}
          />
        </Modal>
      )}

      {editingUser && (
        <Modal onClose={() => setEditingUser(null)}>
          <EditUserForm 
            user={editingUser} 
            onSuccess={fetchUsers} 
            onClose={() => setEditingUser(null)} 
            availableCourses={availableCourses}
            availableSections={availableSections}
          />
        </Modal>
      )}

      {viewingUser && (
        <Modal onClose={() => setViewingUser(null)}>
          <ViewUserDetails 
            user={viewingUser}
            users={users}
            onClose={() => setViewingUser(null)} 
          />
        </Modal>
      )}
      
      {deletingUser && (
        <Modal onClose={() => setDeletingUser(null)}>
          <div className="p-6 sm:p-8">
            <div className="h-12 w-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4 mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Delete User</h2>
            <p className="text-sm text-gray-500 text-center mb-6">
              Are you sure you want to delete <span className="font-semibold text-gray-900">{deletingUser.firstname} {deletingUser.lastname}</span>? This action cannot be undone.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setDeletingUser(null)}
                className="w-full rounded-xl bg-gray-100 py-3 text-gray-700 font-bold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!deletingUser) return;
                  try {
                    const res = await fetch(`/api/users/${deletingUser.id}`, { method: "DELETE" });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json?.error || "Failed to delete user");
                    setDeletingUser(null);
                    await fetchUsers();
                  } catch {
                    setDeletingUser(null);
                  }
                }}
                className="w-full rounded-xl bg-red-600 py-3 text-white font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
