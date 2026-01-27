import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = 'force-dynamic';

type SchedulePayload = {
  amIn?: string;
  amOut?: string;
  pmIn?: string;
  pmOut?: string;
  overtimeIn?: string;
  overtimeOut?: string;
};

function normalizeTime(raw: string | undefined): string | null {
  if (!raw) return null;
  const parts = raw.split(":");
  if (parts.length < 2) return null;
  const h = parts[0]?.padStart(2, "0");
  const m = parts[1]?.padStart(2, "0");
  if (!h || !m) return null;
  return `${h}:${m}`;
}

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    const body = (await req.json().catch(() => ({}))) as SchedulePayload & { supervisor_id?: string };

    const amIn = normalizeTime(body.amIn);
    const amOut = normalizeTime(body.amOut);
    const pmIn = normalizeTime(body.pmIn);
    const pmOut = normalizeTime(body.pmOut);
    const overtimeIn = normalizeTime(body.overtimeIn);
    const overtimeOut = normalizeTime(body.overtimeOut);
    const supervisorId = body.supervisor_id;

    if (!amIn || !amOut || !pmIn || !pmOut) {
      return NextResponse.json({ error: "Invalid or incomplete schedule times" }, { status: 400 });
    }

    // Prepare rows for insertion
    const rows = [
      {
        shift_name: "Morning Shift",
        official_start: amIn,
        official_end: amOut,
        supervisor_id: supervisorId || null,
      },
      {
        shift_name: "Afternoon Shift",
        official_start: pmIn,
        official_end: pmOut,
        supervisor_id: supervisorId || null,
      },
    ];

    if (overtimeIn && overtimeOut) {
      rows.push({
        shift_name: "Overtime Shift",
        official_start: overtimeIn,
        official_end: overtimeOut,
        supervisor_id: supervisorId || null,
      });
    } else {
      // If overtime is not provided, remove it from the database for this supervisor
      let query = admin.from("shifts").delete().eq("shift_name", "Overtime Shift");
      if (supervisorId) {
        query = query.eq("supervisor_id", supervisorId);
      } else {
        query = query.is("supervisor_id", null);
      }
      await query;
    }

    // Use a composite key for onConflict if supervisor_id is provided, otherwise fallback to shift_name
    // Note: The unique constraint in DB must match this. 
    // We assume the constraint is (shift_name, supervisor_id).
    const { error } = await admin
      .from("shifts")
      .upsert(rows, { onConflict: "shift_name,supervisor_id" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const supervisorId = searchParams.get("supervisor_id");
    const includeAll = searchParams.get("all") === "true";

    let query = admin
      .from("shifts")
      .select("shift_name, official_start, official_end, supervisor_id")
      .order("official_start", { ascending: true });

    if (includeAll) {
      // Return all shifts (no filter)
    } else if (supervisorId) {
      query = query.eq("supervisor_id", supervisorId);
    } else {
      // If no supervisor_id is provided, return global shifts (where supervisor_id is null)
      query = query.is("supervisor_id", null);
    }

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json({ shifts: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

