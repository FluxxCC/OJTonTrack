import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { getActiveSchoolYearId } from "@/lib/school-year";
import { sendBatchPushNotification } from "@/lib/push-notifications";

export async function GET(req: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const school_year_id = searchParams.get("school_year_id");

  let query = admin
    .from("coordinator_events")
    .select("*")
    .order("event_date", { ascending: true });

  if (school_year_id) {
    query = query.eq("school_year_id", school_year_id);
  } else {
    // Default to active school year
    const activeSyId = await getActiveSchoolYearId(admin);
    if (activeSyId) {
        query = query.eq("school_year_id", activeSyId);
    }
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ events: data });
}

export async function POST(req: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const { title, description, event_date, am_in, am_out, pm_in, pm_out, overtime_in, overtime_out, type, school_year_id, course_ids } = body;

    if (!title || !event_date) {
      return NextResponse.json({ error: "Title and Date are required" }, { status: 400 });
    }

    let finalSyId = school_year_id ? Number(school_year_id) : null;
    if (!finalSyId) {
        finalSyId = await getActiveSchoolYearId(admin);
    }

    const { data, error } = await admin
      .from("coordinator_events")
      .insert({ 
        title, 
        description, 
        event_date, 
        am_in: am_in || null,
        am_out: am_out || null,
        pm_in: pm_in || null,
        pm_out: pm_out || null,
        overtime_in: overtime_in || null,
        overtime_out: overtime_out || null,
        // type: type || 'event', // Column does not exist
        school_year_id: finalSyId,
        courses_id: course_ids || null
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Trigger Push Notification & In-App Notification
    try {
        let studentQuery = admin.from("users_students").select("id, idnumber").eq("signup_status", "APPROVED");
        
        if (finalSyId) {
            studentQuery = studentQuery.eq("school_year_id", finalSyId);
        }

        if (course_ids && Array.isArray(course_ids) && course_ids.length > 0) {
            studentQuery = studentQuery.in("course_id", course_ids);
        }

        const { data: students } = await studentQuery;
        
        if (students && students.length > 0) {
            // 1. Send Push Notifications
            const ids = students.map((s: any) => s.idnumber).filter(Boolean);
            await sendBatchPushNotification(ids, {
                title: `New Event: ${title}`,
                body: description || `Check the portal for details regarding ${title}.`,
                url: "/portal/student",
                tag: `event-${data.id}`
            });

            // 2. Insert In-App Notifications
            const notifications = students.map((s: any) => ({
                recipient_id: s.id,
                recipient_role: 'student',
                title: `New Event: ${title}`,
                message: description || `Check the portal for details regarding ${title}.`,
                link: '/portal/student?tab=attendance',
                type: 'event'
            }));

            const { error: insertError } = await admin.from('notifications').insert(notifications);
            if (insertError) {
                console.error("Failed to insert notifications:", insertError);
            }
        }
    } catch (notifyErr) {
        console.error("Failed to send event notifications:", notifyErr);
        // Do not fail the request if notification fails
    }

    return NextResponse.json({ event: data });
  } catch (e) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const { id, title, description, event_date, am_in, am_out, pm_in, pm_out, overtime_in, overtime_out, type, course_ids } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (event_date !== undefined) updates.event_date = event_date;
    if (am_in !== undefined) updates.am_in = am_in || null;
    if (am_out !== undefined) updates.am_out = am_out || null;
    if (pm_in !== undefined) updates.pm_in = pm_in || null;
    if (pm_out !== undefined) updates.pm_out = pm_out || null;
    if (overtime_in !== undefined) updates.overtime_in = overtime_in || null;
    if (overtime_out !== undefined) updates.overtime_out = overtime_out || null;
    // if (type !== undefined) updates.type = type || 'event';
    if (course_ids !== undefined) updates.courses_id = course_ids || null;

    const { data, error } = await admin
      .from("coordinator_events")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    try {
      let studentQuery = admin.from("users_students").select("id, idnumber").eq("signup_status", "APPROVED");
      if (data.school_year_id) {
        studentQuery = studentQuery.eq("school_year_id", data.school_year_id);
      }
      if (data.courses_id && Array.isArray(data.courses_id) && data.courses_id.length > 0) {
        studentQuery = studentQuery.in("course_id", data.courses_id);
      }
      const { data: students } = await studentQuery;
      if (students && students.length > 0) {
        const ids = students.map((s: any) => s.idnumber).filter(Boolean);
        await sendBatchPushNotification(ids, {
          title: `Event Updated: ${data.title}`,
          body: description || `Check the portal for updates to ${data.title}.`,
          url: "/portal/student",
          tag: `event-${data.id}`
        });
        const notifications = students.map((s: any) => ({
          recipient_id: s.id,
          recipient_role: 'student',
          title: `Event Updated: ${data.title}`,
          message: description || `Check the portal for updates to ${data.title}.`,
          link: '/portal/student?tab=attendance',
          type: 'event'
        }));
        await admin.from('notifications').insert(notifications);
      }
    } catch {}

    return NextResponse.json({ event: data });
  } catch (e) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const { error } = await admin
      .from("coordinator_events")
      .delete()
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
