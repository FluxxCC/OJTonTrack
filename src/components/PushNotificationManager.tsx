"use client";

import { useEffect, useRef, useState } from "react";

export default function PushNotificationManager() {
  const isSubscribing = useRef(false);
  const lastSubscribedId = useRef<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    // 1. Check permission on mount
    if (Notification.permission === "default") {
       // Chrome requires user interaction, so we show a UI prompt instead of auto-requesting
       const dismissed = sessionStorage.getItem("push_prompt_dismissed");
       if (!dismissed) {
           setShowPrompt(true);
       }
    } else if (Notification.permission === "granted") {
      checkAndSubscribe();
    }

    // 2. Poll for login status (idnumber in storage)
    const interval = setInterval(() => {
      const hasId = localStorage.getItem("idnumber") || sessionStorage.getItem("idnumber");
      
      if (Notification.permission === "granted") {
        checkAndSubscribe();
      } else if (Notification.permission === "default" && hasId) {
         const dismissed = sessionStorage.getItem("push_prompt_dismissed");
         if (!dismissed) {
             setShowPrompt(true);
         }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleEnable = () => {
    Notification.requestPermission().then((perm) => {
        setShowPrompt(false);
        if (perm === "granted") {
            checkAndSubscribe();
        }
    });
  };

  const handleDismiss = () => {
      setShowPrompt(false);
      sessionStorage.setItem("push_prompt_dismissed", "1");
  };

  const checkAndSubscribe = async () => {
    if (isSubscribing.current) return;
    if (!("serviceWorker" in navigator)) return;

    const idnumber = localStorage.getItem("idnumber") || sessionStorage.getItem("idnumber");
    if (!idnumber) {
        lastSubscribedId.current = null;
        return;
    }

    // If we already subscribed for this user in this session, skip
    if (lastSubscribedId.current === idnumber) return;

    try {
      isSubscribing.current = true;
      const reg = await navigator.serviceWorker.ready;
      
      const existingSub = await reg.pushManager.getSubscription();
      
      const res = await fetch("/api/push/public-key");
      if (!res.ok) return; // Silent fail

      const { publicKey } = await res.json();
      if (!publicKey) return;

      let sub = existingSub;
      
      if (!sub) {
        const convertedKey = urlBase64ToUint8Array(publicKey);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey
        });
      }

      if (sub) {
        // Determine role if possible, but the API handles it or defaults
        // For now, we send idnumber. The API might need role but often infers it or it's just for ID mapping.
        // The original code just sent { idnumber, subscription: sub }
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idnumber, subscription: sub })
        });
        lastSubscribedId.current = idnumber;
      }
    } catch (e: any) {
      if (e?.message?.includes("push service not available") || e?.name === 'AbortError') {
        console.warn("Push notifications not available:", e.message);
        return;
      }
      console.error("Push subscription error:", e);
    } finally {
      isSubscribing.current = false;
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-500 w-[90%] max-w-md">
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1 text-center sm:text-left">
          <h3 className="font-semibold text-gray-900">Allow Notifications?</h3>
          <p className="text-sm text-gray-500">Stay updated with real-time attendance alerts.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={handleDismiss} 
            className="flex-1 sm:flex-none px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            Later
          </button>
          <button
            onClick={handleEnable}
            className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md shadow-sm transition-colors"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
