import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

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

    const body = (await req.json().catch(() => ({}))) as SchedulePayload;

    const amIn = normalizeTime(body.amIn);
    const amOut = normalizeTime(body.amOut);
    const pmIn = normalizeTime(body.pmIn);
    const pmOut = normalizeTime(body.pmOut);
    const overtimeIn = normalizeTime(body.overtimeIn);
    const overtimeOut = normalizeTime(body.overtimeOut);

    if (!amIn || !amOut || !pmIn || !pmOut) {
      return NextResponse.json({ error: "Invalid or incomplete schedule times" }, { status: 400 });
    }

    const rows = [
      {
        shift_name: "Morning Shift",
        official_start: amIn,
        official_end: amOut,
      },
      {
        shift_name: "Afternoon Shift",
        official_start: pmIn,
        official_end: pmOut,
      },
    ];

    if (overtimeIn && overtimeOut) {
      rows.push({
        shift_name: "Overtime Shift",
        official_start: overtimeIn,
        official_end: overtimeOut,
      });
    } else {
      // If overtime is not provided, remove it from the database
      await admin.from("shifts").delete().eq("shift_name", "Overtime Shift");
    }

    const { error } = await admin
      .from("shifts")
      .upsert(rows, { onConflict: "shift_name" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    const { data, error } = await admin
      .from("shifts")
      .select("shift_name, official_start, official_end")
      .order("official_start", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ shifts: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

