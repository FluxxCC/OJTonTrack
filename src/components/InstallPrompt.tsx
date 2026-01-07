"use client";
import React, { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if iOS
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setShow(false);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    // We've used the prompt, and can't use it again, discard it
    setDeferredPrompt(null);
    setShow(false);
  };

  if (!show && !isIOS) return null;

  // iOS Instructions (simplified)
  if (isIOS && !show) {
    // You might want to show iOS instructions here or return null if you only want to support native prompt
    return null; 
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-xl shadow-2xl border border-orange-100 p-4 flex items-center gap-4 max-w-sm">
        <div className="bg-orange-100 p-2 rounded-lg text-[#F97316]">
          <Download size={24} />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 text-sm">Install OJTonTrack</h3>
          <p className="text-xs text-gray-500">Add to home screen for quick access</p>
        </div>
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setShow(false)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
                <X size={20} />
            </button>
            <button
                onClick={handleInstallClick}
                className="bg-[#F97316] hover:bg-orange-600 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors shadow-lg shadow-orange-200"
            >
                Install
            </button>
        </div>
      </div>
    </div>
  );
}
