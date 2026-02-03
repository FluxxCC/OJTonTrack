import { getSupabaseAdmin } from "@/lib/supabaseClient";
const webPush = require("web-push");

interface PushNotificationResult {
  sent: number;
  failed: number;
  errors: any[];
}

export async function sendPushNotification(
  targetIdNumber: string,
  payload: {
    title: string;
    body: string;
    url?: string;
    icon?: string;
    tag?: string;
  }
): Promise<PushNotificationResult> {
  const result: PushNotificationResult = { sent: 0, failed: 0, errors: [] };

  try {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase admin not configured");

    const pub = process.env.VAPID_PUBLIC_KEY || "";
    const priv = process.env.VAPID_PRIVATE_KEY || "";
    
    if (!pub || !priv) {
      console.warn("[Push] VAPID keys missing");
      result.errors.push("VAPID keys missing in server environment");
      return result;
    }

    // Fetch subscriptions
    console.log(`[Push] Fetching subs for idnumber: "${targetIdNumber}"`);
    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth")
      .eq("idnumber", targetIdNumber);

    if (error) {
      console.error("[Push] DB Error:", error);
      return result;
    }

    console.log(`[Push] Found ${subs?.length || 0} subscriptions for ${targetIdNumber}`);

    if (!subs || subs.length === 0) {
      return result;
    }

    webPush.setVapidDetails(
      "mailto:onboarding@ojtontrack.site",
      pub,
      priv
    );

    const notificationPayload = JSON.stringify({
      title: payload.title || "OJTonTrack",
      body: payload.body,
      icon: payload.icon || "/icons-192.png",
      tag: payload.tag,
      url: payload.url || "/"
    });

    const promises = subs.map(async (s: any) => {
      const subscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      };

      try {
        await webPush.sendNotification(subscription, notificationPayload);
        result.sent += 1;
      } catch (err: any) {
        result.failed += 1;
        const statusCode = err?.statusCode || err?.code;
        if (statusCode === 410 || statusCode === 404) {
          try {
            await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          } catch {}
        } else {
            result.errors.push(err.message);
        }
      }
    });

    await Promise.all(promises);

  } catch (e: any) {
    console.error("[Push] Unexpected error:", e);
    result.errors.push(e.message);
  }

  return result;
}

export async function sendBatchPushNotification(
  targetIdNumbers: string[],
  payload: {
    title: string;
    body: string;
    url?: string;
    icon?: string;
    tag?: string;
  }
): Promise<PushNotificationResult> {
  const result: PushNotificationResult = { sent: 0, failed: 0, errors: [] };

  try {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase admin not configured");

    const pub = process.env.VAPID_PUBLIC_KEY || "";
    const priv = process.env.VAPID_PRIVATE_KEY || "";
    
    if (!pub || !priv) {
      console.warn("[Push] VAPID keys missing");
      return result;
    }

    if (!targetIdNumbers || targetIdNumbers.length === 0) {
      return result;
    }

    // Fetch subscriptions for all targets
    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth,idnumber")
      .in("idnumber", targetIdNumbers);

    if (error) {
      console.error("[Push] DB Error:", error);
      return result;
    }

    if (!subs || subs.length === 0) {
      return result;
    }

    webPush.setVapidDetails(
      "mailto:onboarding@ojtontrack.site",
      pub,
      priv
    );

    const notificationPayload = JSON.stringify({
      title: payload.title || "OJTonTrack",
      body: payload.body,
      icon: payload.icon || "/icons-192.png",
      tag: payload.tag,
      url: payload.url || "/"
    });

    const promises = subs.map(async (s: any) => {
      const subscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      };

      try {
        await webPush.sendNotification(subscription, notificationPayload);
        result.sent += 1;
      } catch (err: any) {
        result.failed += 1;
        const statusCode = err?.statusCode || err?.code;
        if (statusCode === 410 || statusCode === 404) {
          try {
            await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          } catch {}
        } else {
            // result.errors.push(err.message); // suppress individual errors to avoid log spam
        }
      }
    });

    await Promise.all(promises);

  } catch (e: any) {
    console.error("[Push] Unexpected error:", e);
    result.errors.push(e.message);
  }

  return result;
}
