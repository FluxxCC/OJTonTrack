import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
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
    const limit = Number(url.searchParams.get("limit") || 1000);
    
    let query = admin
      .from("attendance")
      .select("id,idnumber,role,course,type,ts,photourl,status,createdat,validated_by,validated_at,is_overtime")
      .order("ts", { ascending: false })
      .limit(Math.max(1, Math.min(10000, limit)));

    if (idnumber) {
      query = query.eq("idnumber", idnumber);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data || []).map((row: any) => ({ ...row }));

    const byDay = new Map<string, any[]>();
    rows.forEach((row: any) => {
      const d = new Date(row.ts);
      const key = `${row.idnumber || ""}-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(row);
    });

    Array.from(byDay.values()).forEach(group => {
      group.sort((a, b) => Number(a.ts) - Number(b.ts));
      const n = group.length;
      for (let i = 0; i < n; i++) {
        const row = group[i];
        if (!row.photourl && row.type === "out") {
          let candidate: string | null = null;
          for (let j = i - 1; j >= 0; j--) {
            if (group[j].photourl) {
              candidate = group[j].photourl;
              break;
            }
          }
          if (!candidate) {
            for (let j = i + 1; j < n; j++) {
              if (group[j].photourl) {
                candidate = group[j].photourl;
                break;
              }
            }
          }
          if (candidate) {
            row.photourl = candidate;
          }
        }
      }
    });

    const entries = rows.map((row: any) => {
      const rawType = String(row.type || "").trim().toLowerCase();
      let type: "in" | "out" = "in";
      if (rawType.includes("out")) {
        type = "out";
      } else if (rawType.includes("in")) {
        type = "in";
      }

      return {
        ...row,
        type,
        approvedby: row.validated_by,
        approvedat: row.validated_at,
        status:
          row.status === "VALIDATED"
            ? "Approved"
            : row.status === "REJECTED"
            ? "Rejected"
            : row.status === "RAW"
            ? "Pending"
            : row.status,
      };
    });

    return NextResponse.json({ entries });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
    const body = await req.json().catch(() => ({}));
    const idnumber = String(body?.idnumber || "").trim();
    const type = String(body?.type || "").trim().toLowerCase();
    const photoDataUrl = String(body?.photoDataUrl || "");
    const manualTimestamp = body?.timestamp ? Number(body.timestamp) : null;
    const validatedBy = body?.validated_by ? String(body.validated_by).trim() : null;

    if (!idnumber || !["in", "out"].includes(type)) {
      return NextResponse.json({ error: "idnumber and type (in|out) are required" }, { status: 400 });
    }
    
    // Require photo if not manual entry (validatedBy implies manual entry by supervisor)
    if (!photoDataUrl && !validatedBy) {
         return NextResponse.json({ error: "photoDataUrl is required for student logs" }, { status: 400 });
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

    let photourl = "";
    if (photoDataUrl) {
      try {
        configureCloudinary();
        const uploadRes = await cloudinary.uploader.upload(photoDataUrl, {
          folder: "ojtontrack/attendance",
          overwrite: false,
          resource_type: "image",
        });
        photourl = uploadRes.secure_url || uploadRes.url || photoDataUrl;
      } catch (e) {
        console.error("Cloudinary upload failed, falling back to raw data URL", e);
        photourl = photoDataUrl;
      }
    }

    const ts = manualTimestamp || Date.now();

    // Check if this timestamp falls within an authorized overtime shift
    let is_overtime = false;
    try {
        // We look for a shift where start <= ts <= end
        // overtime_shifts stores start/end as BigInt/Number timestamps
        const { data: otShift } = await admin
            .from("overtime_shifts")
            .select("id")
            .eq("student_id", idnumber)
            .lte("overtime_start", ts)
            .gte("overtime_end", ts)
            .limit(1)
            .maybeSingle();
            
        if (otShift) {
            is_overtime = true;
        }
    } catch (err) {
        console.error("Error checking overtime status:", err);
    }

    const createdat = new Date().toISOString();
    const payload = {
      idnumber,
      role: String(user.role || "student"),
      course: String(user.course || ""),
      type,
      ts,
      photourl,
      storage: photoDataUrl ? "cloudinary" : "manual",
      status: validatedBy ? "VALIDATED" : "RAW",
      validated_by: validatedBy,
      validated_at: validatedBy ? createdat : null,
      createdat,
      is_overtime
    };

    const insertRes = await admin.from("attendance").insert(payload).select("id").maybeSingle();
    if (insertRes.error) return NextResponse.json({ error: insertRes.error.message }, { status: 500 });

    // Send Push Notification to Supervisor
    let supervisorId = String(user.supervisorid || "").trim();
    console.log(`[Attendance] Processing Push for Supervisor ID (UUID): '${supervisorId}'`);

    if (supervisorId) {
      try {
        // Resolve UUID to ID Number if needed
        const { data: supUser } = await admin
          .from("users")
          .select("idnumber")
          .eq("id", supervisorId) // Assuming supervisorId is the UUID
          .maybeSingle();
        
        if (supUser && supUser.idnumber) {
            console.log(`[Attendance] Resolved Supervisor UUID ${supervisorId} to ID Number ${supUser.idnumber}`);
            supervisorId = supUser.idnumber;
        } else {
            console.log(`[Attendance] Could not resolve Supervisor UUID ${supervisorId} to ID Number. Using as is.`);
        }

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

export async function PUT(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
    
    const body = await req.json().catch(() => ({}));
    const { id, ts, type, adminId, adminRole, status } = body;
    
    if (!id || !ts || !type || !adminId) {
      return NextResponse.json({ error: "Missing required fields (id, ts, type, adminId)" }, { status: 400 });
    }

    // 1. Get old record
    const { data: oldRecord, error: fetchError } = await admin
      .from("attendance")
      .select("*")
      .eq("id", id)
      .single();
    
    if (fetchError || !oldRecord) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    // Determine new status
    // If status is provided by admin, map it to DB status:
    // "Approved" -> "VALIDATED"
    // "Rejected" -> "REJECTED"
    // "Pending" -> "RAW" (or keep as is if not changing)
    let newDbStatus = "ADJUSTED";
    if (status) {
        if (status === "Approved") newDbStatus = "VALIDATED";
        else if (status === "Rejected") newDbStatus = "REJECTED";
        else if (status === "Pending") newDbStatus = "RAW";
        else newDbStatus = status; // Fallback
    }

    // 2. Update record
    const { error: updateError } = await admin
      .from("attendance")
      .update({ ts, type, status: newDbStatus }) 
      .eq("id", id);
    
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 3. Log the change
    const changes = [];
    if (oldRecord.ts !== ts) changes.push(`Time: ${new Date(oldRecord.ts).toLocaleString()} -> ${new Date(ts).toLocaleString()}`);
    if (oldRecord.type !== type) changes.push(`Type: ${oldRecord.type} -> ${type}`);
    // Check if status effectively changed (map old DB status to UI terms for comparison, or just log if newDbStatus != oldRecord.status)
    if (oldRecord.status !== newDbStatus) changes.push(`Status: ${oldRecord.status} -> ${newDbStatus}`);

    await admin.from("system_audit_logs").insert({
      actor_idnumber: adminId,
      actor_role: adminRole || "superadmin",
      action: "EDIT_ATTENDANCE",
      target_table: "attendance",
      target_id: Number(id),
      before_data: { ts: oldRecord.ts, type: oldRecord.type, status: oldRecord.status },
      after_data: { ts, type, status: newDbStatus },
      reason: changes.join(", ")
    });

    return NextResponse.json({ ok: true });
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
    const reject = !!body?.reject;
    const validated_by = String(body?.validated_by || body?.approvedby || "").trim();
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    if ((approve || reject) && !validated_by) return NextResponse.json({ error: "validated_by is required when validating" }, { status: 400 });
    const updates: Record<string, unknown> = {};
    if (approve) {
      updates.status = "VALIDATED";
      updates.validated_by = validated_by;
      updates.validated_at = new Date().toISOString();
    } else if (reject) {
      updates.status = "REJECTED";
      updates.validated_by = validated_by;
      updates.validated_at = new Date().toISOString();
    } else {
      updates.status = "RAW";
      updates.validated_by = null;
      updates.validated_at = null;
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

        // Send Push to Student
        const pub = process.env.VAPID_PUBLIC_KEY || "";
        const priv = process.env.VAPID_PRIVATE_KEY || "";
        if (pub && priv) {
          const { data: subs } = await admin
            .from("push_subscriptions")
            .select("endpoint,p256dh,auth")
            .eq("idnumber", attendanceData.idnumber);

          if (subs && subs.length > 0) {
            webPush.setVapidDetails("mailto:admin@ojtontrack.local", pub, priv);
            const pushPayload = JSON.stringify({
              title: "Attendance Approved",
              body: `Your ${typeStr} for ${dateStr} has been approved.`,
              icon: "/icons-192.png",
              url: "/portal/student/attendance"
            });

            for (const s of subs) {
              try {
                await webPush.sendNotification({
                  endpoint: s.endpoint,
                  keys: { p256dh: s.p256dh, auth: s.auth }
                }, pushPayload);
              } catch (e: any) {
                if (e?.statusCode === 410 || e?.statusCode === 404) {
                  await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to create notification or send push:", err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
