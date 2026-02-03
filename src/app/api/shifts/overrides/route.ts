import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const supervisorIdNumber = searchParams.get("supervisor_id");

    let internalSupervisorId: number | null = null;
    if (supervisorIdNumber) {
        const { data: supervisorData } = await admin
            .from("users_supervisors")
            .select("id")
            .eq("idnumber", supervisorIdNumber)
            .maybeSingle();
        
        if (supervisorData) {
            internalSupervisorId = supervisorData.id;
        } else {
             // If ID number provided but not found, return empty
             return NextResponse.json({ overrides: {} });
        }
    }

    if (!internalSupervisorId) {
      // If no supervisor ID (or not found), fetch ALL overrides (grouped by supervisor)
      // Note: This might need adjustment if we want to show overrides for ALL supervisors, 
      // but without mapping back to idnumber it might be hard to use. 
      // For now, let's assume we only care about specific supervisor if provided.
      // If no ID provided, we might be in Superadmin view?
      // Let's keep existing logic but be careful about supervisor_id type.
      
      const { data, error } = await admin
        .from("shifts")
        .select("*")
        .like("shift_name", "OVERRIDE:::%")
        .order("shift_name", { ascending: true });

      if (error) throw error;

      const allOverrides: Record<string, Record<string, { date: string, am?: { start: string, end: string }, pm?: { start: string, end: string } }>> = {};

      // We need to map internal IDs back to idnumbers if we return them?
      // Or just return keyed by internal ID? The frontend likely expects idnumber if it passed idnumber.
      // But if no ID passed, maybe it doesn't matter.
      
      data.forEach((row: any) => {
        const sid = row.supervisor_id;
        if (!sid) return;

        const parts = row.shift_name.split(":::");
        if (parts.length !== 3) return;
        
        const date = parts[1];
        const type = parts[2];

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
      .eq("supervisor_id", internalSupervisorId)
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

    // Lookup internal ID
    const { data: supervisorData } = await admin
        .from("users_supervisors")
        .select("id")
        .eq("idnumber", supervisor_id)
        .maybeSingle();

    if (!supervisorData) {
        return NextResponse.json({ error: "Supervisor not found" }, { status: 404 });
    }
    const internalSupervisorId = supervisorData.id;

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
            supervisor_id: internalSupervisorId
        });
    }

    if (pmIn && pmOut) {
        rows.push({
            shift_name: `OVERRIDE:::${date}:::PM`,
            official_start: pmIn,
            official_end: pmOut,
            supervisor_id: internalSupervisorId
        });
    }

    // First delete existing overrides for this date to ensure clean slate (or handle removal of AM/PM)
    const { error: deleteError } = await admin
        .from("shifts")
        .delete()
        .eq("supervisor_id", internalSupervisorId)
        .like("shift_name", `OVERRIDE:::${date}:::%`);

    if (deleteError) {
        console.error("Error deleting overrides:", deleteError);
        throw deleteError;
    }

    if (rows.length > 0) {
        // Use insert since we just deleted
        const { error } = await admin
            .from("shifts")
            .insert(rows);

        if (error) {
            console.error("Error inserting overrides:", error);
            throw error;
        }
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

        // Lookup internal ID
        const { data: supervisorData } = await admin
            .from("users_supervisors")
            .select("id")
            .eq("idnumber", supervisorId)
            .maybeSingle();

        if (!supervisorData) {
            return NextResponse.json({ error: "Supervisor not found" }, { status: 404 });
        }
        const internalSupervisorId = supervisorData.id;
    
        const { error } = await admin
            .from("shifts")
            .delete()
            .eq("supervisor_id", internalSupervisorId)
            .like("shift_name", `OVERRIDE:::${date}:::%`);
        
        if (error) throw error;
        
        return NextResponse.json({ ok: true });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Unexpected error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
