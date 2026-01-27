import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const supervisorId = searchParams.get("supervisor_id");

    if (!supervisorId) {
      // If no supervisor ID, fetch ALL overrides (grouped by supervisor)
      const { data, error } = await admin
        .from("shifts")
        .select("*")
        .like("shift_name", "OVERRIDE:::%")
        .order("shift_name", { ascending: true });

      if (error) throw error;

      // Structure: SupervisorID -> { Date -> Override }
      const allOverrides: Record<string, Record<string, { date: string, am?: { start: string, end: string }, pm?: { start: string, end: string } }>> = {};

      data.forEach((row: any) => {
        const sid = row.supervisor_id;
        if (!sid) return;

        const parts = row.shift_name.split(":::");
        if (parts.length !== 3) return;
        
        const date = parts[1]; // YYYY-MM-DD
        const type = parts[2]; // AM or PM

        if (!allOverrides[sid]) {
            allOverrides[sid] = {};
        }

        if (!allOverrides[sid][date]) {
          allOverrides[sid][date] = { date, am: undefined, pm: undefined };
        }

        if (type === "AM") {
          allOverrides[sid][date].am = { start: row.official_start, end: row.official_end };
        } else if (type === "PM") {
          allOverrides[sid][date].pm = { start: row.official_start, end: row.official_end };
        }
      });

      return NextResponse.json({ overrides: allOverrides });
    }

    // Fetch all shifts that start with OVERRIDE::: for this supervisor
    const { data, error } = await admin
      .from("shifts")
      .select("*")
      .eq("supervisor_id", supervisorId)
      .like("shift_name", "OVERRIDE:::%")
      .order("shift_name", { ascending: true });

    if (error) throw error;

    // Parse the overrides
    // Structure: OVERRIDE:::YYYY-MM-DD:::AM or PM
    const overrides: Record<string, { date: string, am?: { start: string, end: string }, pm?: { start: string, end: string } }> = {};

    data.forEach((row: any) => {
      const parts = row.shift_name.split(":::");
      if (parts.length !== 3) return;
      
      const date = parts[1]; // YYYY-MM-DD
      const type = parts[2]; // AM or PM

      if (!overrides[date]) {
        overrides[date] = { date, am: undefined, pm: undefined };
      }

      if (type === "AM") {
        overrides[date].am = { start: row.official_start, end: row.official_end };
      } else if (type === "PM") {
        overrides[date].pm = { start: row.official_start, end: row.official_end };
      }
    });

    return NextResponse.json({ overrides: Object.values(overrides) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    const body = await req.json();
    const { supervisor_id, date, amIn, amOut, pmIn, pmOut } = body;

    if (!supervisor_id || !date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }

    const rows = [];

    if (amIn && amOut) {
        rows.push({
            shift_name: `OVERRIDE:::${date}:::AM`,
            official_start: amIn,
            official_end: amOut,
            supervisor_id
        });
    }

    if (pmIn && pmOut) {
        rows.push({
            shift_name: `OVERRIDE:::${date}:::PM`,
            official_start: pmIn,
            official_end: pmOut,
            supervisor_id
        });
    }

    // First delete existing overrides for this date to ensure clean slate (or handle removal of AM/PM)
    await admin
        .from("shifts")
        .delete()
        .eq("supervisor_id", supervisor_id)
        .like("shift_name", `OVERRIDE:::${date}:::%`);

    if (rows.length > 0) {
        const { error } = await admin
            .from("shifts")
            .upsert(rows, { onConflict: "shift_name,supervisor_id" });

        if (error) throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
    try {
        const admin = getSupabaseAdmin();
        if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
    
        const { searchParams } = new URL(req.url);
        const supervisorId = searchParams.get("supervisor_id");
        const date = searchParams.get("date");
    
        if (!supervisorId || !date) {
          return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }
    
        const { error } = await admin
            .from("shifts")
            .delete()
            .eq("supervisor_id", supervisorId)
            .like("shift_name", `OVERRIDE:::${date}:::%`);
        
        if (error) throw error;
        
        return NextResponse.json({ ok: true });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Unexpected error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
