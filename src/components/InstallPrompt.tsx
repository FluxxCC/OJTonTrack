"use client";
import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = {
  prompt: () => void;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallPrompt() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: unknown) => {
      const ev = e as Event & BeforeInstallPromptEvent;
      ev.preventDefault?.();
      setDeferredPrompt(ev as BeforeInstallPromptEvent);
    };

    if (pathname !== "/") return;

    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem("install_prompt_done") === "1";
    } catch {}

    if (alreadyShown) return;
    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, [pathname]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      handleDismiss();
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setDismissed(true);
    try { sessionStorage.setItem("install_prompt_done", "1"); } catch {}
  };

  const handleDismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem("install_prompt_done", "1"); } catch {}
  };

  const isStandalone = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
  if (pathname !== "/") return null;
  if (isStandalone) return null;
  if (dismissed) return null;
  if (!deferredPrompt) return null;

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
          <button onClick={handleDismiss} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
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
