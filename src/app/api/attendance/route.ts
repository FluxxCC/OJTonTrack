import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getSupabaseAdmin } from "../../../lib/supabaseClient";
const webPush: any = require("web-push");

function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
  const apiKey = process.env.CLOUDINARY_API_KEY || "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET || "";
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary not configured");
  }
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
}

export async function GET(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
    const url = new URL(req.url);
    const idnumber = String(url.searchParams.get("idnumber") || "").trim();
    const limit = Number(url.searchParams.get("limit") || 50);
    if (!idnumber) {
      return NextResponse.json({ error: "idnumber is required" }, { status: 400 });
    }
    const { data, error } = await admin
      .from("attendance")
      .select("id,idnumber,role,course,type,ts,photourl,status,createdat,approvedby,approvedat")
      .eq("idnumber", idnumber)
      .order("ts", { ascending: false })
      .limit(Math.max(1, Math.min(200, limit)));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ entries: data || [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
    configureCloudinary();
    const body = await req.json().catch(() => ({}));
    const idnumber = String(body?.idnumber || "").trim();
    const type = String(body?.type || "").trim().toLowerCase();
    const photoDataUrl = String(body?.photoDataUrl || "");
    if (!idnumber || !photoDataUrl || !["in", "out"].includes(type)) {
      return NextResponse.json({ error: "idnumber, type (in|out), and photoDataUrl are required" }, { status: 400 });
    }
    const userRes = await admin
      .from("users")
      .select("idnumber, role, course, supervisorid, firstname, lastname")
      .eq("idnumber", idnumber)
      .limit(1)
      .maybeSingle();
    if (userRes.error) return NextResponse.json({ error: userRes.error.message }, { status: 500 });
    const user = userRes.data;
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const uploadRes = await cloudinary.uploader.upload(photoDataUrl, {
      folder: "ojtontrack/attendance",
      overwrite: false,
      resource_type: "image",
    });
    const photourl = uploadRes.secure_url || uploadRes.url;
    if (!photourl) {
      return NextResponse.json({ error: "Failed to upload photo" }, { status: 500 });
    }

    const ts = Date.now();
    const createdat = new Date().toISOString();
    const payload = {
      idnumber,
      role: String(user.role || "student"),
      course: String(user.course || ""),
      type,
      ts,
      photourl,
      storage: "cloudinary",
      status: "Pending",
      createdat,
      approvedby: null,
      approvedat: null,
    };

    const insertRes = await admin.from("attendance").insert(payload).select("id").maybeSingle();
    if (insertRes.error) return NextResponse.json({ error: insertRes.error.message }, { status: 500 });

    // Send Push Notification to Supervisor
        const supervisorId = String(user.supervisorid || "").trim();
        console.log(`[Attendance] Processing Push for Supervisor ID: '${supervisorId}'`);

    if (supervisorId) {
      try {
        const pub = process.env.VAPID_PUBLIC_KEY || "";
        const priv = process.env.VAPID_PRIVATE_KEY || "";
        if (pub && priv) {
          const { data: subs, error: subError } = await admin
            .from("push_subscriptions")
            .select("endpoint,p256dh,auth")
            .eq("idnumber", supervisorId);

          if (subError) console.error(`[Attendance] Sub fetch error:`, subError);
          console.log(`[Attendance] Found ${subs?.length || 0} subscriptions for ${supervisorId}`);

          if (subs && subs.length > 0) {
            webPush.setVapidDetails("mailto:admin@ojtontrack.local", pub, priv);
            const studentName = `${user.firstname || ""} ${user.lastname || ""}`.trim() || idnumber;
            const typeLabel = type === "in" ? "Times in" : "Times out";
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
            const absoluteUrl = appUrl ? `${appUrl.replace(/\/$/, "")}/portal/supervisor?tab=attendance` : "/portal/supervisor?tab=attendance";
            const pushPayload = JSON.stringify({
              title: "Attendance Update",
              body: `${studentName} ${typeLabel}`,
              icon: "/icons-192.png",
              tag: `attendance-${idnumber}-${ts}`,
              url: absoluteUrl,
            });

            for (const s of subs) {
              try {
                await webPush.sendNotification(
                  {
                    endpoint: s.endpoint,
                    keys: { p256dh: s.p256dh, auth: s.auth },
                  } as any,
                  pushPayload
                );
                console.log(`[Attendance] Push sent to ${s.endpoint.slice(0, 20)}...`);
              } catch (err: any) {
                console.error(`[Attendance] Push failed:`, err);
                if (err?.statusCode === 410 || err?.statusCode === 404) {
                  await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
                }
              }
            }
          }
        } else {
          console.warn("[Attendance] VAPID keys missing");
        }
      } catch (e) {
        console.error("Failed to send push notification", e);
      }
    } else {
      console.log("[Attendance] No Supervisor ID found for user");
    }

    return NextResponse.json({ ok: true, ts, photourl, id: insertRes.data?.id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
    const body = await req.json().catch(() => ({}));
    const id = Number(body?.id || 0);
    const approve = !!body?.approve;
    const approvedby = String(body?.approvedby || "").trim();
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    if (approve && !approvedby) return NextResponse.json({ error: "approvedby is required when approving" }, { status: 400 });
    const updates: Record<string, unknown> = {};
    if (approve) {
      updates.status = "Approved";
      updates.approvedby = approvedby;
      updates.approvedat = new Date().toISOString();
    } else {
      updates.status = "Pending";
      updates.approvedby = null;
      updates.approvedat = null;
    }
    const { data: attendanceData, error } = await admin.from("attendance").update(updates).eq("id", id).select("idnumber, type, ts").single();
    
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Create Notification if approved
    if (approve && attendanceData) {
      try {
        const dateStr = new Date(attendanceData.ts).toLocaleDateString();
        const typeStr = attendanceData.type === 'in' ? "Time In" : "Time Out";
        await admin.from("notifications").insert({
          idnumber: attendanceData.idnumber,
          title: "Attendance Approved",
          message: `Your ${typeStr} for ${dateStr} has been approved by your supervisor.`,
          type: "attendance_approved",
          is_read: false,
          created_at: new Date().toISOString()
        });
      } catch (err) {
        console.error("Failed to create notification:", err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
