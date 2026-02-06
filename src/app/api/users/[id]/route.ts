import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { sendTransactionalEmail } from "@/lib/email";
import bcrypt from "bcryptjs";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  
  const { searchParams } = new URL(req.url);
  const roleParam = searchParams.get('role');
  
  const body = await req.json().catch(() => ({}));
  
  const userRole = roleParam || body.role || 'student'; // Default to student if not specified
  let tableName = "users_students";
  if (userRole === 'coordinator') tableName = 'users_coordinators';
  else if (userRole === 'supervisor') tableName = 'users_supervisors';
  else if (userRole === 'instructor') tableName = 'users_instructors';
  else if (userRole === 'admin' || userRole === 'superadmin') tableName = 'users_super_admins';

  // Resolve actor name for email "From: ..."
  let actorName: string | null = null;
  try {
    const actorIdNum = String(body.actorId || "").trim();
    const actorRole = String(body.actorRole || "").toLowerCase();
    let actorTable = "";
    if (actorIdNum) {
      if (actorRole === "coordinator") actorTable = "users_coordinators";
      else if (actorRole === "instructor") actorTable = "users_instructors";
      else if (actorRole === "supervisor") actorTable = "users_supervisors";
      else if (actorRole === "admin" || actorRole === "superadmin") actorTable = "users_super_admins";
      else actorTable = "users_coordinators";
      const { data: actor } = await admin
        .from(actorTable)
        .select("firstname, lastname")
        .eq("idnumber", actorIdNum)
        .maybeSingle();
      if (actor) {
        const fn = String(actor.firstname || "").trim();
        const ln = String(actor.lastname || "").trim();
        actorName = `${fn} ${ln}`.trim();
      }
    }
  } catch {}

  // Fetch current state for audit log
  const { data: beforeData } = await admin.from(tableName).select("*").eq("id", id).single();

  const updates: Record<string, unknown> = {};
  const fields = ["idnumber", "email", "role", "password", "name", "firstname", "middlename", "lastname", "course", "section", "company", "location", "supervisorid", "signup_status"];
  for (const f of fields) {
    if (body?.[f] !== undefined) {
      if (tableName === 'users_students') {
         if (f === 'course') updates['course_id'] = body[f];
         else if (f === 'section') updates['section_id'] = body[f];
         else if (f === 'supervisorid') {
             const val = body[f];
             // Check if it's a string that looks like an ID Number (not a pure number)
             // or if we just want to be safe, always try to resolve if it's a string.
             if (typeof val === 'string' && isNaN(Number(val))) {
                 const { data: sup } = await admin
                    .from('users_supervisors')
                    .select('id')
                    .eq('idnumber', val)
                    .maybeSingle();
                 
                 if (sup) {
                     updates['supervisor_id'] = sup.id;
                 } else {
                     // If we can't find the supervisor by ID Number, we can't assign.
                     // We could throw an error or just ignore. 
                     // Ignoring might mean it doesn't update.
                     console.warn(`Could not resolve supervisor ID number: ${val}`);
                 }
             } else {
                 // It's already a number or a numeric string
                 updates['supervisor_id'] = val;
             }
         }
         else updates[f] = body[f];
      } else {
         // For other roles, ignore student-specific fields
         if (['course', 'section', 'supervisorid', 'company', 'location'].includes(f)) continue;
         updates[f] = body[f];
      }
    }
  }

  // Hash password if present
  if (updates['password']) {
    updates['password'] = await bcrypt.hash(String(updates['password']), 10);
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await admin.from(tableName).update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Handle courseIds/sectionIds if present (Legacy or Instructor specific)
  if (tableName !== 'users_students') {
    if (body?.courseIds !== undefined && Array.isArray(body.courseIds)) {
      if (tableName === 'users_coordinators') {
         // Delete existing
         await admin.from("coordinator_courses").delete().eq("coordinator_id", id);
         // Insert new
         if (body.courseIds.length > 0) {
           const inserts = body.courseIds.map((cid: number) => ({ coordinator_id: id, course_id: cid }));
           await admin.from("coordinator_courses").insert(inserts);
         }
      } else {
        // Delete existing
        await admin.from("user_courses").delete().eq("user_id", id);
        // Insert new
        if (body.courseIds.length > 0) {
          const inserts = body.courseIds.map((cid: number) => ({ user_id: id, course_id: cid }));
          await admin.from("user_courses").insert(inserts);
        }
      }
    }

    if (body?.sectionIds !== undefined && Array.isArray(body.sectionIds)) {
      if (tableName === 'users_instructors') {
          // Delete existing
          await admin.from("instructor_sections").delete().eq("instructor_id", id);
          // Insert new
          if (body.sectionIds.length > 0) {
            const inserts = body.sectionIds.map((sid: number) => ({ instructor_id: id, section_id: sid }));
            await admin.from("instructor_sections").insert(inserts);
          }
      }
    }
  }

  // Audit Log
  if (body.actorId && body.actorRole) {
    try {
      const { data: afterData } = await admin.from(tableName).select("*").eq("id", id).single();
      await admin.from("system_audit_logs").insert({
        actor_idnumber: body.actorId,
        actor_role: body.actorRole,
        action: "UPDATE_USER",
        target_table: tableName,
        target_id: id,
        before_data: beforeData,
        after_data: afterData,
        reason: body.reason || "User update via API",
      });

      const prevStatus = beforeData?.signup_status || null;
      const newStatus = afterData?.signup_status || null;

      // Send email on status change
      if (prevStatus !== newStatus && newStatus) {
         if (newStatus === 'APPROVED') {
            await sendTransactionalEmail({
               to: afterData.email,
               subject: 'Your Account Has Been Approved',
               html: `<p>Hello ${afterData.firstname},</p><p>Your account has been approved. You can now login.</p>`,
               emailType: 'APPLICATION_APPROVED',
               userId: id,
               triggeredBy: body.actorId
            });
         } else if (newStatus === 'REJECTED') {
            const noteRaw = typeof body.rejectionNote === 'string' ? body.rejectionNote : '';
            const noteSafe = noteRaw.replace(/[<>&]/g, (c: string) => {
              const map: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;' };
              return map[c] || '';
            });
            const actorRoleLabel = String(body.actorRole || '')
              .toLowerCase() === 'instructor' ? 'Instructor' : 'Coordinator';
             await sendTransactionalEmail({
               to: afterData.email,
               subject: 'Your Account Application Update',
              html: `<p>Hello ${afterData.firstname},</p><p>Your account application has been returned/rejected.</p>${noteSafe ? `<p><strong>${actorRoleLabel} note:</strong> ${noteSafe}</p>` : ''}${actorName ? `<p>From: ${actorName}</p>` : ''}`,
               emailType: 'APPLICATION_REJECTED',
               userId: id,
               triggeredBy: body.actorId
            });
         }
      }

    } catch (auditError) {
      console.error("Audit Log Error:", auditError);
      // Don't fail the request just because audit log failed
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const roleRaw = searchParams.get('role');
  const role = roleRaw ? String(roleRaw).toLowerCase() : null;
  
  let tableName = "users_students";
  if (role) {
    if (role === 'student') tableName = "users_students";
    else if (role === 'coordinator') tableName = "users_coordinators";
    else if (role === 'supervisor') tableName = "users_supervisors";
    else if (role === 'instructor') tableName = "users_instructors";
    else if (role === 'admin' || role === 'superadmin') tableName = "users_super_admins";
  }
  
  const { data: existingRow } = await admin.from(tableName).select("id").eq("id", id).maybeSingle();
  if (!existingRow) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  
  // First delete related records if necessary (though ON DELETE CASCADE should handle this if foreign keys are set up correctly)
  if (tableName === 'users_students') {
      try {
        // Fetch idnumber for cross-table cleanup (push_subscriptions, student_shift_schedules)
        const { data: stuRow } = await admin
          .from('users_students')
          .select('idnumber')
          .eq('id', id)
          .maybeSingle();
        const idnumber = stuRow?.idnumber ? String(stuRow.idnumber).trim() : null;
        
        // Remove dependent rows referencing the student_id to satisfy FKs
        await admin.from('attendance').delete().eq('student_id', id);
        await admin.from('validated_hours').delete().eq('student_id', id);
        await admin.from('overtime_shifts').delete().eq('student_id', id);
        await admin.from('student_shifts').delete().eq('student_id', id);
        await admin.from('evaluation_status').delete().eq('student_id', id);
        await admin.from('reports').delete().eq('student_id', id);

        // Clean up non-FK tables keyed by idnumber
        if (idnumber) {
          try {
            await admin.from('push_subscriptions').delete().eq('idnumber', idnumber);
            await admin.from('student_shift_schedules').delete().eq('student_id', idnumber);
          } catch {}
        }
      } catch (cleanupErr) {
        const msg = cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr);
        console.error('Student cleanup before delete failed:', msg);
        // Continue to attempt deletion; if FKs still prevent, DB will return error
      }
  } else if (tableName === 'users_coordinators') {
      await admin.from('coordinator_courses').delete().eq('coordinator_id', id);
  } else if (tableName === 'users_instructors') {
      await admin.from('instructor_courses').delete().eq('instructor_id', id);
      await admin.from('instructor_sections').delete().eq('instructor_id', id);
  } else if (tableName === 'users_supervisors') {
      // Detach students from this supervisor to avoid FK constraint errors
      await admin.from('users_students').update({ supervisor_id: null }).eq('supervisor_id', id);
      try {
        const { data: shiftRows } = await admin
          .from('shifts')
          .select('id')
          .eq('supervisor_id', id);
        const shiftIds = (shiftRows || []).map((r: any) => r.id).filter((x: any) => x != null);
        if (shiftIds.length > 0) {
          try {
            await admin.from('student_shifts').delete().in('shift_id', shiftIds);
          } catch {}
          try {
            await admin.from('overtime_shifts').delete().in('shift_id', shiftIds);
          } catch {}
          try {
            await admin.from('attendance').delete().in('shift_id', shiftIds);
          } catch {}
          try {
            await admin.from('validated_hours').delete().in('shift_id', shiftIds);
          } catch {}
        }
        await admin.from('shifts').delete().eq('supervisor_id', id);
      } catch {}
      // Remove overtime shifts created by this supervisor (creator FK)
      try {
        await admin.from('overtime_shifts').delete().eq('created_by_id', id).eq('created_by_role', 'supervisor');
      } catch {}
      // Remove notifications targeted to this supervisor (recipient FK, if any)
      try {
        await admin.from('notifications').delete().eq('recipient_id', id).eq('recipient_role', 'supervisor');
      } catch {}
      // Clean up push subscriptions tied to this supervisor's idnumber (if available)
      try {
        const { data: supRow } = await admin.from('users_supervisors').select('idnumber').eq('id', id).maybeSingle();
        const idnumber = supRow?.idnumber ? String(supRow.idnumber).trim() : null;
        if (idnumber) {
          await admin.from('push_subscriptions').delete().eq('idnumber', idnumber);
        }
      } catch {}
  }

  const { error } = await admin.from(tableName).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  const { data: stillThere } = await admin.from(tableName).select("id").eq("id", id).maybeSingle();
  if (stillThere) {
    return NextResponse.json({ error: "Deletion failed due to constraints or mismatched role" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
