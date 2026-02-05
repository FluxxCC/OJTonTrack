import { NextResponse, NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { getActiveSchoolYearId } from "@/lib/school-year";
import bcrypt from "bcryptjs";
import { sendTransactionalEmail } from "@/lib/email";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id || Number.isNaN(id)) return NextResponse.json({ error: "Invalid request id" }, { status: 400 });

  const activeSyId = await getActiveSchoolYearId(admin);

  const { data: reqRow, error: getErr } = await admin
    .from("student_approval_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (getErr || !reqRow) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (reqRow.status !== "pending") return NextResponse.json({ error: "Request is not pending" }, { status: 400 });

  const first = reqRow.full_name.split(" ")[0] || "";
  const last = reqRow.full_name.split(" ").slice(1).join(" ") || "";

  const tempPassword = await bcrypt.hash(`${reqRow.school_id}-${Date.now()}`, 10);

  const { data: student, error: insErr } = await admin
    .from("users_students")
    .insert({
      idnumber: reqRow.school_id,
      email: reqRow.email,
      password: tempPassword,
      firstname: first,
      lastname: last,
      course_id: reqRow.course_id,
      section_id: reqRow.section_id,
      role: "student",
      signup_status: "APPROVED",
      school_year_id: activeSyId || null,
    })
    .select()
    .single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  await admin
    .from("student_approval_requests")
    .update({
      status: "approved",
      decided_at: new Date().toISOString(),
    })
    .eq("id", id);

  try {
    await sendTransactionalEmail({
      to: reqRow.email,
      subject: "Your Account Application Approved",
      html: `<p>Hello ${first},</p><p>Your account application has been approved.</p><p>You can now log in to the portal.</p>`,
      emailType: "APPLICATION_APPROVED",
      triggeredBy: reqRow.school_id,
    });
  } catch {}

  return NextResponse.json({ success: true, student_id: student.id });
}
