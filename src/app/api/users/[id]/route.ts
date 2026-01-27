import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { sendTransactionalEmail } from "@/lib/email";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  
  const body = await req.json().catch(() => ({}));
  
  // Fetch current state for audit log
  const { data: beforeData } = await admin.from("users").select("*").eq("id", id).single();

  const updates: Record<string, unknown> = {};
  const fields = ["idnumber", "email", "role", "password", "name", "firstname", "middlename", "lastname", "course", "section", "company", "location", "supervisorid", "signup_status"];
  for (const f of fields) {
    if (body?.[f] !== undefined) updates[f] = body[f];
  }

  // Handle specific logic for REJECTED status
  // Note: rejection_reason and rejected_at columns might not exist in the schema yet,
  // so we rely on audit logs and emails for tracking rejection details.
  /*
  if (updates.signup_status === 'REJECTED') {
    if (body.rejectionNote) {
      updates.rejection_reason = body.rejectionNote;
    }
    updates.rejected_at = new Date().toISOString();
  }
  */

  if (Object.keys(updates).length > 0) {
    const { error } = await admin.from("users").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Handle courseIds/sectionIds if present
  if (body?.courseIds !== undefined && Array.isArray(body.courseIds)) {
    // Delete existing
    await admin.from("user_courses").delete().eq("user_id", id);
    // Insert new
    if (body.courseIds.length > 0) {
      const inserts = body.courseIds.map((cid: number) => ({ user_id: id, course_id: cid }));
      await admin.from("user_courses").insert(inserts);
    }
  }

  if (body?.sectionIds !== undefined && Array.isArray(body.sectionIds)) {
    // Delete existing
    await admin.from("user_sections").delete().eq("user_id", id);
    // Insert new
    if (body.sectionIds.length > 0) {
      const inserts = body.sectionIds.map((sid: number) => ({ user_id: id, section_id: sid }));
      await admin.from("user_sections").insert(inserts);
    }
  }

  // Audit Log
  if (body.actorId && body.actorRole) {
    try {
      const { data: afterData } = await admin.from("users").select("*").eq("id", id).single();
      await admin.from("system_audit_logs").insert({
        actor_idnumber: body.actorId,
        actor_role: body.actorRole,
        action: "UPDATE_USER",
        target_table: "users",
        target_id: id,
        before_data: beforeData,
        after_data: afterData,
        reason: body.reason || "User update via API",
      });

      const prevStatus = beforeData?.signup_status || null;
      const newStatus = afterData?.signup_status || null;
      const email = afterData?.email as string | null;
      const role = afterData?.role as string | null;
      const userId = afterData?.id as number | undefined;
      const studentName =
        `${afterData?.firstname || ""} ${afterData?.lastname || ""}`.trim() ||
        afterData?.name ||
        afterData?.idnumber ||
        "";

      let actorName = body.actorId as string;
      try {
        const { data: actor } = await admin
          .from("users")
          .select("firstname, lastname, name, idnumber")
          .eq("idnumber", body.actorId)
          .maybeSingle();
        if (actor) {
          actorName =
            `${actor.firstname || ""} ${actor.lastname || ""}`.trim() ||
            actor.name ||
            actor.idnumber ||
            actorName;
        }
      } catch (e) {
        console.error("Failed to resolve actor name for email:", e);
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ojtontrack.site";

      if (email && role === "student") {
        if (prevStatus !== newStatus && newStatus === "APPROVED") {
          if (!afterData?.email_verified) {
            try {
              await admin.from("users").update({ email_verified: true }).eq("id", id);
            } catch (e) {
              console.error("Failed to set email_verified on approval:", e);
            }
          }
          const html = `
            <p>Hi ${studentName || "Student"},</p>
            <p>Your OJTonTrack account has been approved.</p>
            <p>You can now sign in using your ID number and password.</p>
            <p><a href="${appUrl}">Login here</a></p>
            <p>Approved by: ${actorName}</p>
          `;
          // Non-blocking email sending
          sendTransactionalEmail({
            to: email,
            subject: "Your OJTonTrack Account Has Been Approved",
            html,
            emailType: "APPLICATION_APPROVED",
            userId: userId ?? null,
            triggeredBy: String(body.actorId),
          }).catch(err => console.error("Failed to send approval email:", err));
        }

        if (prevStatus !== newStatus && newStatus === "REJECTED") {
          const noteSource =
            typeof body.rejectionNote === "string" && body.rejectionNote.trim()
              ? body.rejectionNote.trim()
              : typeof body.note === "string" && body.note.trim()
              ? body.note.trim()
              : typeof body.reason === "string" && body.reason.trim()
              ? body.reason.trim()
              : "";
          const instructorNote = noteSource || "No additional note was provided.";
          const nextAction =
            typeof body.nextAction === "string" && body.nextAction.trim()
              ? body.nextAction.trim()
              : "Please contact your instructor or coordinator for next steps or to re-apply if allowed.";

          const html = `
            <p>Hi ${studentName || "Student"},</p>
            <p>Your OJTonTrack account application was not approved.</p>
            <p><strong>Note from ${actorName}:</strong></p>
            <p>${instructorNote}</p>
            <p><strong>Next steps:</strong> ${nextAction}</p>
          `;

          sendTransactionalEmail({
            to: email,
            subject: "Your OJTonTrack Application Requires Action",
            html,
            emailType: "APPLICATION_REJECTED",
            userId: userId ?? null,
            triggeredBy: String(body.actorId),
          }).catch(err => console.error("Failed to send rejection email:", err));
        }

        if (body.password && typeof body.password === "string" && body.password.trim()) {
          const html = `
            <p>Hi ${studentName || "Student"},</p>
            <p>Your OJTonTrack account password was changed by ${actorName}.</p>
            <p>If you did not request or expect this change, sign in as soon as possible and update your password.</p>
            <p>If you suspect any unauthorized access, contact your coordinator or the system administrator immediately.</p>
          `;

          sendTransactionalEmail({
            to: email,
            subject: "Your OJTonTrack Password Has Been Changed",
            html,
            emailType: "PASSWORD_CHANGED",
            userId: userId ?? null,
            triggeredBy: String(body.actorId),
          }).catch(err => console.error("Failed to send password change email:", err));
        }
      }
    } catch (e) {
      console.error("Audit log or approval email flow failed:", e);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  // 1. Fetch User to get idnumber
  const { data: user, error: fetchError } = await admin
    .from("users")
    .select("idnumber")
    .eq("id", id)
    .single();

  if (fetchError || !user) {
     return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const idnumber = user.idnumber;

  // 2. Manual Cascade Delete (Clean up dependencies)
  try {
    // A. Clean up Reports and related Comments
    // Fetch report IDs to delete comments on those reports
    const { data: userReports } = await admin.from("reports").select("id").eq("idnumber", idnumber);
    const reportIds = userReports?.map((r: { id: any }) => r.id) || [];

    if (reportIds.length > 0) {
        await admin.from("report_comments").delete().in("reportid", reportIds);
    }
    // Also delete comments MADE by the user (if any)
    await admin.from("report_comments").delete().eq("idnumber", idnumber);
    await admin.from("reports").delete().eq("idnumber", idnumber);

    // B. Clean up other idnumber-based tables
    await Promise.all([
      admin.from("attendance").delete().eq("idnumber", idnumber),
      admin.from("evaluation_forms").delete().eq("student_id", idnumber),
      admin.from("notifications").delete().eq("idnumber", idnumber),
      admin.from("push_subscriptions").delete().eq("idnumber", idnumber),
    ]);

    // C. Clean up id-based tables
    await Promise.all([
      admin.from("user_courses").delete().eq("user_id", id),
      admin.from("user_sections").delete().eq("user_id", id),
    ]);

  } catch (cleanupError) {
    console.error("Error cleaning up user dependencies:", cleanupError);
    // Proceed to try deleting user anyway, though it might fail if cleanup failed
  }

  // 3. Delete User
  const { error } = await admin.from("users").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  return NextResponse.json({ ok: true });
}
