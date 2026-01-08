"use client";
import React, { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = {
  prompt: () => void;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS] = useState(() => /iPad|iPhone|iPod/.test(navigator.userAgent));
  const allowRef = React.useRef<boolean>(false);

  useEffect(() => {
    const isReload = (() => {
      try {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
        return !!nav && nav.type === "reload";
      } catch {
        const t = (performance as unknown as { navigation?: { type?: number } })?.navigation?.type;
        return t === 1;
      }
    })();

    const alreadyShown = (() => {
      try { return sessionStorage.getItem("install_prompt_done") === "1"; } catch { return false; }
    })();
    allowRef.current = isReload && !alreadyShown;

    const handler = (e: unknown) => {
      const ev = e as Event & BeforeInstallPromptEvent;
      ev.preventDefault?.();
      // Only show during a reload session, and only once per session
      if (allowRef.current) {
        setDeferredPrompt(ev as BeforeInstallPromptEvent);
        setShow(true);
        try { sessionStorage.setItem("install_prompt_done", "1"); } catch {}
        allowRef.current = false;
      }
    };

    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler as EventListener);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShow(false);
  };

  const isStandalone = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
  if (isStandalone) return null;
  if (!show && !isIOS) return null;
  if (isIOS && !show) return null;
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
          <button onClick={() => setShow(false)} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
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
