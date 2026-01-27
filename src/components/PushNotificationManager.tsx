"use client";

import { useEffect, useRef } from "react";

export default function PushNotificationManager() {
  const isSubscribing = useRef(false);
  const lastSubscribedId = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    // 1. Request permission immediately on mount (First time open)
    if (Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") {
          checkAndSubscribe();
        }
      });
    } else if (Notification.permission === "granted") {
      checkAndSubscribe();
    }

    // 2. Poll for login status (idnumber in localStorage)
    const interval = setInterval(() => {
      if (Notification.permission === "granted") {
        checkAndSubscribe();
      } else if (Notification.permission === "default" && localStorage.getItem("idnumber")) {
         Notification.requestPermission().then(perm => {
             if (perm === "granted") checkAndSubscribe();
         });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const checkAndSubscribe = async () => {
    if (isSubscribing.current) return;
    if (!("serviceWorker" in navigator)) return;

    const idnumber = localStorage.getItem("idnumber");
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
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idnumber, subscription: sub })
        });
        lastSubscribedId.current = idnumber;
      }
    } catch (e) {
      console.error("Push subscription error:", e);
    } finally {
      isSubscribing.current = false;
    }
  };

  return null;
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
