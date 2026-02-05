import { NextResponse, NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { sendTransactionalEmail } from "@/lib/email";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id || Number.isNaN(id)) return NextResponse.json({ error: "Invalid request id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const noteRaw = String(body?.note || "");
  const actorId = String(body?.actorId || "");
  const actorName = String(body?.actorName || "");
  const roleLabel = String(body?.actorRole || "Coordinator");

  const { data: reqRow, error: getErr } = await admin
    .from("student_approval_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (getErr || !reqRow) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (reqRow.status !== "pending") return NextResponse.json({ error: "Request is not pending" }, { status: 400 });

  const noteSafe = noteRaw.replace(/[<>&]/g, (c: string) => {
    const map: Record<string, string> = { "<": "&lt;", ">": "&gt;", "&": "&amp;" };
    return map[c] || "";
  });

  await admin
    .from("student_approval_requests")
    .update({
      status: "rejected",
      decided_at: new Date().toISOString(),
      rejection_note: noteRaw,
      decided_by_idnumber: actorId || null,
    })
    .eq("id", id);

  try {
    const first = reqRow.full_name.split(" ")[0] || "";
    await sendTransactionalEmail({
      to: reqRow.email,
      subject: "Your Account Application Update",
      html: `<p>Hello ${first},</p><p>Your account application has been returned/rejected.</p>${
        noteSafe ? `<p><strong>${roleLabel} note:</strong> ${noteSafe}</p>` : ""
      }${actorName ? `<p>From: ${actorName}</p>` : ""}`,
      emailType: "APPLICATION_REJECTED",
      triggeredBy: actorId || reqRow.school_id,
    });
  } catch {}

  return NextResponse.json({ success: true });
}
