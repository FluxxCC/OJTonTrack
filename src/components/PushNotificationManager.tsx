"use client";

import { useEffect, useRef } from "react";

export default function PushNotificationManager() {
  const isSubscribing = useRef(false);

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
    // Since we don't use Supabase Auth for sessions, we check localStorage
    const interval = setInterval(() => {
      if (Notification.permission === "granted") {
        checkAndSubscribe();
      } else if (Notification.permission === "default" && localStorage.getItem("idnumber")) {
         // If user logged in but permission is still default, ask again
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
    // If not logged in, we can't associate subscription, so skip
    if (!idnumber) return;

    // Check if already marked as subscribed in this session to avoid spamming API
    // We can use a session storage flag or just rely on getSubscription
    try {
      isSubscribing.current = true;
      const reg = await navigator.serviceWorker.ready;
      
      // Check existing subscription
      const existingSub = await reg.pushManager.getSubscription();
      
      // Fetch public key
      const res = await fetch("/api/push/public-key");
      if (!res.ok) throw new Error("Failed to fetch public key");
      const { publicKey } = await res.json();
      if (!publicKey) throw new Error("No public key");

      let sub = existingSub;
      
      if (!sub) {
        // Subscribe
        const convertedKey = urlBase64ToUint8Array(publicKey);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey
        });
      } else {
        // Verify if the existing subscription uses the same key (optional, but good practice)
        // For now, just assume it's valid and re-send to backend to ensure it's linked to current user
      }

      if (sub) {
        // Send to backend to link with user
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idnumber, subscription: sub })
        });
        // Optional: Mark as synced in sessionStorage to avoid repeated calls?
        // But the user said "all users login will allow", so ensuring it matches the current user is good.
        // The API should handle upserts/duplicates gracefully.
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
