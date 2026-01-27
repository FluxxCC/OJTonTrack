import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    const { data, error } = await admin
      .from("student_shift_schedules")
      .select("*");

    if (error) throw error;

    // Map by student_id (idnumber)
    const schedules: Record<string, any> = {};
    data.forEach((row: any) => {
        if (row.student_id) {
            schedules[row.student_id] = row;
        }
    });

    return NextResponse.json({ schedules });
  } catch (e) {
    console.error("Failed to fetch student schedules", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
