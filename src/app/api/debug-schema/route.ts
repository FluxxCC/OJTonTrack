import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "No admin" }, { status: 500 });
  const checks: Record<string, any> = {};
  const tables = ["students", "evaluation_status", "attendance", "shifts", "student_shifts"];
  for (const t of tables) {
    const { data, error } = await admin.from(t).select("count", { count: "exact", head: true });
    if (error) {
      checks[t] = { ok: false, error: { code: (error as any).code, message: (error as any).message, hint: (error as any).hint, details: (error as any).details } };
    } else {
      checks[t] = { ok: true };
    }
  }
  return NextResponse.json({ checks });
}
