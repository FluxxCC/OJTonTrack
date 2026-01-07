import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseClient";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  const fields = ["idnumber", "role", "password", "name", "firstname", "middlename", "lastname", "course", "section", "company", "location", "supervisorid"];
  for (const f of fields) {
    if (body?.[f] !== undefined) updates[f] = body[f];
  }
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

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const { error } = await admin.from("users").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
