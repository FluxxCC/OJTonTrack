import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { timeStringToMinutes, calculateShiftDurations, buildSchedule, normalizeTimeString, getOfficialTimeInManila, getManilaDateParts, calculateHoursWithinOfficialTime } from "@/lib/attendance";
import { getActiveSchoolYearId } from "../../../lib/school-year";
import { sendPushNotification } from "@/lib/push-notifications";

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
    const sy = await getActiveSchoolYearId(admin);
    const url = new URL(req.url);
    const idnumber = String(url.searchParams.get("idnumber") || "").trim();
    const supervisorIdNumber = String(url.searchParams.get("supervisor_id") || "").trim();
    const limit = Number(url.searchParams.get("limit") || 1000);
    const excludePhoto = url.searchParams.get("exclude_photo") === "true";

    // Optimization: If idnumber is provided, fetch student_id first and avoid join on every row
    if (idnumber) {
      const { data: student } = await admin
        .from("users_students")
        .select("id, idnumber")
        .eq("idnumber", idnumber)
        .single();

      if (!student) {
        return NextResponse.json({ entries: [] });
      }

      // Select fields based on excludePhoto
      // We don't need to join users_students because we already know the student
      const selectFields = excludePhoto
        ? "id, student_id, type, logged_at, status, validated_by, validated_at, is_overtime, school_year_id, attendance_date, shift_id"
        : "id, student_id, type, logged_at, photourl, storage, status, validated_by, validated_at, is_overtime, school_year_id, attendance_date, shift_id";


      let query = admin
        .from("attendance")
        .select(selectFields as any)
        .eq("student_id", student.id)
        .order("logged_at", { ascending: false })
        .limit(Math.max(1, Math.min(100000, limit)));

      if (sy) {
        query = query.eq("school_year_id", sy);
      }

      const { data, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // ---------------------------------------------------------
      // NEW: Merge with validated_hours Ledger
      // ---------------------------------------------------------
      if (data && data.length > 0) {
          const studentIds = Array.from(new Set(data.map((d: any) => d.student_id)));
          const { data: ledgerData } = await admin
            .from('validated_hours')
            .select('*')
            .in('student_id', studentIds);
          
          if (ledgerData && ledgerData.length > 0) {
              const ledgerMap = new Map<string, any>();
              ledgerData.forEach((l: any) => {
                  ledgerMap.set(`${l.student_id}-${l.date}-${l.shift_id}`, l);
              });

              data.forEach((row: any) => {
                  if (row.type === 'out' && row.shift_id) {
                      const key = `${row.student_id}-${row.attendance_date}-${row.shift_id}`;
                      if (ledgerMap.has(key)) {
                          const ledgerEntry = ledgerMap.get(key);
                          row.rendered_hours = Number(ledgerEntry.hours);
                          row.validated_hours = Number(ledgerEntry.hours);
                          row.official_time_in = ledgerEntry.official_time_in;
                          row.official_time_out = ledgerEntry.official_time_out;
                      }
                  }
              });
          }
      }

      const rows = (data || []).map((row: any) => ({
        ...row,
        ts: new Date(row.logged_at).getTime(),
        idnumber: student.idnumber, // Manually inject idnumber
        role: "student",
      }));

      // Grouping logic (same as before)
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
             // Logic to find photo from previous/next... 
             // If excludePhoto is true, row.photourl is undefined, so this block might run but find nothing.
             // But since we excluded photos, we probably don't care about backfilling them for the dashboard.
             // However, if we are in dashboard, we don't display photos anyway.
             if (!excludePhoto) {
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
                if (candidate) row.photourl = candidate;
             }
          }
        }
      });

      return NextResponse.json({ entries: rows });
    }
    
    // Fallback to original logic for non-idnumber queries (e.g. admin/supervisor listing)
    // We need to join students to get idnumber if we are listing all, or filter by student idnumber
    // Use explicit FK to avoid ambiguity
    const selectFields = excludePhoto
       ? `
         id, student_id, type, logged_at, status, validated_by, validated_at, is_overtime, school_year_id, attendance_date, shift_id,
         users_students!attendance_student_id_fkey!inner (idnumber, firstname, lastname, course_id, section_id, supervisor_id)
       `
       : `
         id, student_id, type, logged_at, photourl, storage, status, validated_by, validated_at, is_overtime, school_year_id, attendance_date, shift_id,
         users_students!attendance_student_id_fkey!inner (idnumber, firstname, lastname, course_id, section_id, supervisor_id)
       `;

    let query = admin
      .from("attendance")
      .select(selectFields as any)
      .order("logged_at", { ascending: false })
      .limit(Math.max(1, Math.min(100000, limit)));

    if (sy) {
      query = query.eq("school_year_id", sy);
    }
    if (idnumber) {
      query = query.eq("users_students.idnumber", idnumber);
    }
    
    if (supervisorIdNumber) {
        const { data: sup } = await admin.from('users_supervisors').select('id').eq('idnumber', supervisorIdNumber).single();
        if (sup) {
            query = query.eq('users_students.supervisor_id', sup.id);
        } else {
            // Supervisor not found, return empty
            return NextResponse.json({ entries: [] });
        }
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // ---------------------------------------------------------
    // NEW: Merge with validated_hours Ledger
    // ---------------------------------------------------------
    if (data && data.length > 0) {
        const studentIds = Array.from(new Set(data.map((d: any) => d.student_id)));
        const { data: ledgerData } = await admin
          .from('validated_hours')
          .select('*')
          .in('student_id', studentIds);
        
        if (ledgerData && ledgerData.length > 0) {
            const ledgerMap = new Map<string, any>();
            ledgerData.forEach((l: any) => {
                ledgerMap.set(`${l.student_id}-${l.date}-${l.shift_id}`, l);
            });

            data.forEach((row: any) => {
                if (row.type === 'out' && row.shift_id) {
                    const key = `${row.student_id}-${row.attendance_date}-${row.shift_id}`;
                    if (ledgerMap.has(key)) {
                        const ledgerEntry = ledgerMap.get(key);
                        // Stop overwriting rendered_hours
                        // row.rendered_hours = Number(ledgerEntry.hours);
                        
                        row.validated_hours = Number(ledgerEntry.hours);
                        row.official_time_in = ledgerEntry.official_time_in;
                        row.official_time_out = ledgerEntry.official_time_out;
                    }
                }
            });
        }
    }

    const rows = (data || []).map((row: any) => ({
      ...row,
      ts: new Date(row.logged_at).getTime(),
      idnumber: row.users_students?.idnumber,
      role: 'student', // Attendance is always for students
      // course: ... we could fetch course name if needed, but UI might not strictly need it for history list
    }));

    // Grouping logic (same as before)
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
    const manualStatus = body?.status ? String(body.status).trim() : null;
    const ts = manualTimestamp || Date.now();

    if (!idnumber || !["in", "out"].includes(type)) {
      return NextResponse.json({ error: "idnumber and type (in|out) are required" }, { status: 400 });
    }
    
    // Require photo if not manual entry (validatedBy implies manual entry by supervisor)
    if (!photoDataUrl && !validatedBy) {
         return NextResponse.json({ error: "photoDataUrl is required for student logs" }, { status: 400 });
    }

    // Get Student
    const { data: user, error: userError } = await admin
      .from("users_students")
      .select("id, idnumber, firstname, lastname, role, course_id, section_id, school_year_id, supervisor_id")
      .eq("idnumber", idnumber)
      .limit(1)
      .maybeSingle();
      
    if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // ---------------------------------------------------------
    // NEW: Fetch Section Shifts for Logic (Rule 3)
    // ---------------------------------------------------------
    let sectionShifts: any[] = [];
    if (user.section_id) {
        const { data: sData } = await admin
            .from("shifts")
            .select("*")
            .eq("section_id", user.section_id)
            .order("official_start", { ascending: true }); // Morning -> Afternoon
        if (sData) sectionShifts = sData;
    }

    // ---------------------------------------------------------
    // NEW: Check for Coordinator Event Override (Highest Priority)
    // ---------------------------------------------------------
    try {
        const eventDateStr = new Date(ts).toISOString().split('T')[0];
        // Fetch events for this date
        // Note: Using maybeSingle might miss if there are multiple events, but usually one per day?
        // Actually, we need to find the specific one for this course.
        // Fetch all events for today
        const { data: events } = await admin
            .from("coordinator_events")
            .select("*")
            .eq("event_date", eventDateStr);

        if (events && events.length > 0) {
             let applicableEvent = null;
             
             // Priority 1: Course-specific
             if (user.course_id) {
                 applicableEvent = events.find((e: any) => 
                     e.courses_id && Array.isArray(e.courses_id) && e.courses_id.map((c: any) => String(c)).includes(String(user.course_id))
                 );
             }
             
             // Priority 2: General (Institution-wide)
             if (!applicableEvent) {
                 applicableEvent = events.find((e: any) => 
                     !e.courses_id || !Array.isArray(e.courses_id) || e.courses_id.length === 0
                 );
             }

             if (applicableEvent) {
                 // Convert Coordinator Event to "Virtual Shifts" replacing sectionShifts
                 const virtualShifts = [];
                 
                 // AM Shift
                 if (applicableEvent.am_in && applicableEvent.am_out) {
                     virtualShifts.push({
                         id: `COORD_AM_${applicableEvent.id}`,
                         shift_name: "Morning Shift",
                         official_start: applicableEvent.am_in,
                         official_end: applicableEvent.am_out,
                         section_id: user.section_id // Keep section context
                     });
                 }
                 
                 // PM Shift
                 if (applicableEvent.pm_in && applicableEvent.pm_out) {
                     virtualShifts.push({
                         id: `COORD_PM_${applicableEvent.id}`,
                         shift_name: "Afternoon Shift",
                         official_start: applicableEvent.pm_in,
                         official_end: applicableEvent.pm_out,
                         section_id: user.section_id
                     });
                 }

                 // OT Shift
                 if (applicableEvent.overtime_in && applicableEvent.overtime_out) {
                     virtualShifts.push({
                         id: `COORD_OT_${applicableEvent.id}`,
                         shift_name: "Overtime Shift",
                         official_start: applicableEvent.overtime_in,
                         official_end: applicableEvent.overtime_out,
                         section_id: user.section_id
                     });
                 }

                 if (virtualShifts.length > 0) {
                     sectionShifts = virtualShifts;
                 }
             }
        }
    } catch (err) {
        console.error("Error fetching coordinator events:", err);
    }

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

    const logged_at = new Date(ts).toISOString();

    // Check if this timestamp falls within an authorized overtime shift
    let is_overtime = false;
    let otShiftData = null;
    try {
        // overtime_shifts uses student_id (int)
        const { data: otShift } = await admin
            .from("overtime_shifts")
            .select("*")
            .eq("student_id", user.id) // Use INT id
            .lte("overtime_start", new Date(ts).toISOString()) // Schema uses timestampz
            .gte("overtime_end", new Date(ts).toISOString())
            .limit(1)
            .maybeSingle();
            
        if (otShift) {
            is_overtime = true;
            otShiftData = otShift;
        }
    } catch (err) {
        console.error("Error checking overtime status:", err);
    }

    let shift_id: string | null = null; // To be stored in DB

    // ---------------------------------------------------------
    // Rule 3: Shift Matching Logic (Time-In)
    // ---------------------------------------------------------
    if (!is_overtime && type === 'in') {
         const d = new Date(ts);
         const currentMins = d.getHours() * 60 + d.getMinutes();

         for (const shift of sectionShifts) {
             const startMins = timeStringToMinutes(shift.official_start);
             const endMins = timeStringToMinutes(shift.official_end);
             
             // Rule: student_in >= official_in - 30min AND student_in <= official_out
             let isMatch = false;
             const buffer = 30;
             
             if (startMins <= endMins) {
                 // Standard Day Shift (e.g., 08:00 - 17:00)
                 isMatch = currentMins >= (startMins - buffer) && currentMins <= endMins;
             } else {
                 // Night Shift (e.g., 22:00 - 06:00)
                 // Match if time is >= 21:30 (until midnight) OR time <= 06:00
                 const adjustedStart = startMins - buffer;
                 isMatch = currentMins >= adjustedStart || currentMins <= endMins;
             }
             
             if (isMatch) {
                 shift_id = shift.id;
                 break; // First match wins (Morning -> Afternoon)
             }
         }
    }

    if (!is_overtime) {
      try {
        // RACE CONDITION CHECK: Check if a similar record was inserted in the last 15 seconds
        const fifteenSecondsAgo = new Date(Date.now() - 15000).toISOString();
        const { data: recentLogs } = await admin
            .from("attendance")
            .select("id")
            .eq("student_id", user.id)
            .eq("type", type)
            .gte("logged_at", fifteenSecondsAgo)
            .limit(1);
        
        if (recentLogs && recentLogs.length > 0) {
            return NextResponse.json({ error: "Duplicate request detected. Please wait a moment." }, { status: 429 });
        }
      } catch (err) {
        console.error("Error checking duplicates:", err);
      }
    }

    // Calculate rendered_hours if type is OUT (Freeze History Logic)
    let rendered_hours: number | null = null;
    let snapshot_official_in: string | null = null;
    let snapshot_official_out: string | null = null;
    let computed_shift_id: string | null = null;

    if (type === "out") {
      try {
          // 1. Fetch previous IN
          const { data: lastIn } = await admin
             .from("attendance")
             .select("logged_at, status, is_overtime, shift_id")
             .eq("student_id", user.id)
             .eq("type", "in")
             .eq("attendance_date", new Date(ts).toISOString().split('T')[0])
             .order("logged_at", { ascending: false })
             .limit(1)
             .maybeSingle();

          if (lastIn) {
             const inTime = new Date(lastIn.logged_at).getTime();
             const outTime = ts;

             if (lastIn.is_overtime) {
                 // Overtime Calculation (Raw Duration)
                 rendered_hours = Math.max(0, (outTime - inTime) / 3600000);
             } else {
                 // Regular Shift Calculation (Frozen Rules)
                 let targetShift = null;

                 // A. Try to find shift from stored shift_id
                 if (lastIn.shift_id) {
                     targetShift = sectionShifts.find(s => s.id === lastIn.shift_id);
                 }

                 // B. Fallback: Try matching logic if no shift_id stored (Legacy Support)
                 if (!targetShift && sectionShifts.length > 0) {
                      const d = new Date(inTime);
                      const currentMins = d.getHours() * 60 + d.getMinutes();
                      const buffer = 30;

                      for (const shift of sectionShifts) {
                           const startMins = timeStringToMinutes(shift.official_start);
                           const endMins = timeStringToMinutes(shift.official_end);
                           let isMatch = false;

                           if (startMins <= endMins) {
                               isMatch = currentMins >= (startMins - buffer) && currentMins <= endMins;
                           } else {
                               const adjustedStart = startMins - buffer;
                               isMatch = currentMins >= adjustedStart || currentMins <= endMins;
                           }
                           
                           if (isMatch) {
                               targetShift = shift;
                               break;
                           }
                      }
                 }

                 if (targetShift) {
                    computed_shift_id = targetShift.id;
                    snapshot_official_in = targetShift.official_start;
                    snapshot_official_out = targetShift.official_end;

                    const inDate = new Date(inTime);
                    const startMins = timeStringToMinutes(targetShift.official_start);
                    const endMins = timeStringToMinutes(targetShift.official_end);

                    // Determine Official In Date (Manila Time Aware)
                    const manila = getManilaDateParts(inDate);
                    const currentManilaMins = manila.hour * 60 + manila.minute;

                    let isPrevDay = false;
                    // Handle Night Shift: if student clocked in early (e.g. 01:00) for a 22:00 shift, it was yesterday
                    if (startMins > endMins && currentManilaMins <= endMins) {
                         isPrevDay = true;
                    }

                    const officialInDate = getOfficialTimeInManila(inDate, targetShift.official_start || "00:00", false, isPrevDay);

                    // Determine Official Out Date
                    const isOutNextDay = startMins > endMins;
                    const officialOutDate = getOfficialTimeInManila(officialInDate, targetShift.official_end || "00:00", isOutNextDay, false);

                    // Ledger Formula: MAX(0, MIN(student_out, official_out) - MAX(student_in, official_in))
                    // Use shared helper to ensure consistency with PATCH/PUT
                    const ms = calculateHoursWithinOfficialTime(
                        new Date(inTime), 
                        new Date(outTime), 
                        officialInDate, 
                        officialOutDate
                    );
                    rendered_hours = ms / 3600000;
                 } else {
                    // No matching shift found -> Raw duration
                    // Also use helper but with raw times? No, just raw diff.
                    // But round to minute to be safe?
                    const cleanIn = new Date(inTime); cleanIn.setSeconds(0, 0);
                    const cleanOut = new Date(outTime); cleanOut.setSeconds(0, 0);
                    rendered_hours = Math.max(0, (cleanOut.getTime() - cleanIn.getTime()) / 3600000);
                 }
             }
          }
      } catch (calcErr) {
          console.error("Error calculating rendered hours:", calcErr);
      }
    }

    const createdat = new Date().toISOString();
    
    let dbStatus = validatedBy ? "VALIDATED" : "RAW";
    if (manualStatus) {
        if (manualStatus === "Approved") dbStatus = "VALIDATED";
        else if (manualStatus === "Rejected") dbStatus = "REJECTED";
        else if (manualStatus === "Pending") dbStatus = "RAW";
        else dbStatus = manualStatus;
    }

    const payload = {
      student_id: user.id,
      type,
      logged_at,
      photourl,
      storage: photoDataUrl ? "cloudinary" : "manual",
      status: dbStatus,
      validated_by: validatedBy,
      validated_at: validatedBy ? createdat : null,
      is_overtime,
      course_id: user.course_id,
      school_year_id: user.school_year_id,
      attendance_date: new Date(ts).toISOString().split('T')[0], // current date
      // rendered_hours REMOVED - Stored in validated_hours only
      shift_id: shift_id || computed_shift_id,
      // official_time_in REMOVED
      // official_time_out REMOVED
    };

    const insertRes = await admin.from("attendance").insert(payload).select("id").maybeSingle();
    if (insertRes.error) return NextResponse.json({ error: insertRes.error.message }, { status: 500 });

    if (type === 'out' && rendered_hours !== null) {
        let finalShiftId = shift_id || computed_shift_id;
        if (!finalShiftId) {
            const supId = user.supervisor_id;
            if (supId) {
                const { data: existingDefault } = await admin
                  .from('shifts')
                  .select('id, official_start, official_end')
                  .eq('supervisor_id', supId)
                  .eq('shift_name', 'AUTO:::DEFAULT')
                  .maybeSingle();
                if (existingDefault && existingDefault.id) {
                    finalShiftId = existingDefault.id;
                    if (!snapshot_official_in) snapshot_official_in = existingDefault.official_start || '09:00';
                    if (!snapshot_official_out) snapshot_official_out = existingDefault.official_end || '17:00';
                } else {
                    const { data: created } = await admin
                      .from('shifts')
                      .insert({
                          shift_name: 'AUTO:::DEFAULT',
                          official_start: '09:00',
                          official_end: '17:00',
                          supervisor_id: supId,
                          school_year_id: user.school_year_id
                      })
                      .select('id, official_start, official_end')
                      .maybeSingle();
                    if (created && created.id) {
                        finalShiftId = created.id;
                        if (!snapshot_official_in) snapshot_official_in = created.official_start || '09:00';
                        if (!snapshot_official_out) snapshot_official_out = created.official_end || '17:00';
                    }
                }
            }
        }
        if (finalShiftId) {
            const hoursRounded = Math.round(rendered_hours * 60) / 60;
            await admin.from('validated_hours').upsert({
                student_id: user.id,
                date: new Date(ts).toISOString().split('T')[0],
                shift_id: finalShiftId,
                school_year_id: user.school_year_id,
                hours: hoursRounded,
                official_time_in: snapshot_official_in,
                official_time_out: snapshot_official_out,
                validated_at: new Date().toISOString()
            }, { onConflict: 'student_id, date, shift_id' });
            if (!shift_id && !computed_shift_id && insertRes.data?.id) {
                await admin
                  .from('attendance')
                  .update({ shift_id: finalShiftId })
                  .eq('id', insertRes.data.id);
            }
        }
    }

    // Send Push Notification to Supervisor
    let supervisorIdInt = user.supervisor_id;
    let notificationStatus = "skipped";
    
    if (supervisorIdInt) {
      try {
        // Get supervisor idnumber from supervisors table
        const { data: supUser, error: supErr } = await admin
          .from("users_supervisors")
          .select("idnumber")
          .eq("id", supervisorIdInt)
          .maybeSingle();
        
        if (supErr) {
            console.error("[Attendance] Error fetching supervisor:", supErr);
            notificationStatus = `error_fetching_supervisor: ${supErr.message}`;
        }

        if (supUser && supUser.idnumber) {
             const cleanSupId = String(supUser.idnumber).trim();
             const action = type === 'in' ? 'clocked IN' : 'clocked OUT';
             const timeStr = new Intl.DateTimeFormat('en-US', { 
                timeZone: 'Asia/Manila', 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
             }).format(new Date(ts));
             
             const pushResult = await sendPushNotification(cleanSupId, {
                title: `Attendance Alert`,
                body: `${user.firstname} ${user.lastname} has ${action} at ${timeStr}.`,
                url: `/portal/supervisor?tab=dashboard`,
                tag: `attendance-${user.id}-${Date.now()}`
             });
             
             if (pushResult.sent > 0) {
                 notificationStatus = "sent";
             } else {
                 notificationStatus = `failed_to_send: ${pushResult.failed} failed, ${pushResult.errors.join(", ")}`;
                 if (pushResult.errors.length === 0 && pushResult.failed === 0) {
                     notificationStatus = "no_subscriptions_found";
                 }
             }
             console.log(`[Attendance] Push to ${cleanSupId}: ${notificationStatus}`);

        } else {
             notificationStatus = "supervisor_idnumber_missing";
             console.warn(`[Attendance] Supervisor ${supervisorIdInt} found but no idnumber`);
        }
      } catch (e) {
          console.error("Error sending push", e);
          notificationStatus = `exception: ${e instanceof Error ? e.message : String(e)}`;
      }
    } else {
        notificationStatus = "no_supervisor_assigned";
    }

    return NextResponse.json({ 
        success: true, 
        id: insertRes.data?.id,
        ts: ts, 
        photourl: photourl, 
        status: dbStatus,
        is_overtime,
        rendered_hours,
        notification_status: notificationStatus
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    const body = await req.json();
    const { id, ts, type, status, adminId, adminRole, revalidate } = body;

    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    const updates: any = {};
    if (ts) updates.logged_at = new Date(ts).toISOString();
    if (type) updates.type = type;
    
    // Map frontend status to DB status
    let newStatus = updates.status;
    if (status) {
        if (status === 'Official') {
            newStatus = 'OFFICIAL'; 
            updates.status = 'OFFICIAL';
            updates.validated_by = `ADMIN:${adminId}`;
            updates.validated_at = new Date().toISOString();
        } else if (status === 'Approved' || status === 'Validated') {
            newStatus = 'VALIDATED';
            updates.status = 'VALIDATED';
            updates.validated_by = `ADMIN:${adminId}`;
            updates.validated_at = new Date().toISOString();
        } else if (status === 'Rejected') {
            newStatus = 'REJECTED';
            updates.status = 'REJECTED';
            updates.validated_by = `ADMIN:${adminId}`;
            updates.validated_at = new Date().toISOString();
        } else if (status === 'Pending') {
            newStatus = 'RAW';
            updates.status = 'RAW';
            updates.validated_by = null;
            updates.validated_at = null;
        } else {
            // Fallback
            newStatus = status;
            updates.status = status;
        }
    }

    const { data: fullRecord } = await admin
      .from('attendance')
      .select('student_id, attendance_date, shift_id, logged_at, type, school_year_id')
      .eq('id', id)
      .single();

    if ((ts || type) && fullRecord?.shift_id) {
      const { data: existingLedger } = await admin
        .from('validated_hours')
        .select('id')
        .eq('student_id', fullRecord.student_id)
        .eq('date', fullRecord.attendance_date)
        .eq('shift_id', fullRecord.shift_id)
        .maybeSingle();
      if (existingLedger) {
        updates.status = 'ADJUSTED';
      }
    }

    const { error } = await admin
        .from('attendance')
        .update(updates)
        .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    
    // Log the action
    if (adminId) {
        await admin.from('system_logs').insert({
            actor_idnumber: adminId,
            actor_role: adminRole || 'superadmin',
            action: 'UPDATE_ATTENDANCE',
            target_table: 'attendance',
            target_id: id,
            reason: `Updated attendance record. Status: ${status}`,
            after_data: updates
        }).select().maybeSingle(); // fire and forget-ish
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    const body = await req.json();
    const { id, approve, reject, validated_by } = body;

    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    // Fetch current record to get details for recalculation
    const { data: currentRecord } = await admin
        .from('attendance')
        .select('type, shift_id, student_id, attendance_date, school_year_id, logged_at')
        .eq('id', id)
        .single();

    const updates: any = {};
    
    if (approve) {
        updates.status = 'VALIDATED';
        updates.validated_by = validated_by;
        updates.validated_at = new Date().toISOString();
    } else if (reject) {
        updates.status = 'REJECTED';
        updates.validated_by = validated_by;
        updates.validated_at = new Date().toISOString();
    } else {
        // Assume reset if neither approved nor rejected
        updates.status = 'RAW';
        updates.validated_by = null;
        updates.validated_at = null;
    }

    const { error } = await admin
        .from('attendance')
        .update(updates)
        .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Log the action
    if (validated_by) {
        // validated_by is usually an ID number.
        // We might want to log this action.
        // But for now, just success.
    }

    return NextResponse.json({ success: true, updates });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Patch failed" }, { status: 500 });
  }
}
