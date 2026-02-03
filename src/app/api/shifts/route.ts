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
    const supervisorIdParam = body.supervisor_id;

    // Resolve supervisor_id (string idnumber) to internal integer ID
    let internalSupervisorId: number | null = null;
    if (supervisorIdParam) {
        const { data: supervisorData, error: supervisorError } = await admin
            .from("users_supervisors")
            .select("id")
            .eq("idnumber", supervisorIdParam)
            .maybeSingle();
        
        if (supervisorError) {
             console.error("Error looking up supervisor:", supervisorError);
             return NextResponse.json({ error: "Error validating supervisor" }, { status: 500 });
        }
        if (!supervisorData) {
             return NextResponse.json({ error: "Supervisor not found" }, { status: 404 });
        }
        internalSupervisorId = supervisorData.id;
    }

    if (!amIn || !amOut || !pmIn || !pmOut) {
      return NextResponse.json({ error: "Invalid or incomplete schedule times" }, { status: 400 });
    }

    // Prepare rows for insertion
    const rows = [
      {
        shift_name: "Morning Shift",
        official_start: amIn,
        official_end: amOut,
        supervisor_id: internalSupervisorId,
      },
      {
        shift_name: "Afternoon Shift",
        official_start: pmIn,
        official_end: pmOut,
        supervisor_id: internalSupervisorId,
      },
    ];

    if (overtimeIn && overtimeOut) {
      rows.push({
        shift_name: "Overtime Shift",
        official_start: overtimeIn,
        official_end: overtimeOut,
        supervisor_id: internalSupervisorId,
      });
    }

    // Update existing rows if present; insert otherwise.
    // This avoids deleting rows referenced by foreign keys (validated_hours, overtime_shifts, student_shifts).
    const { data: existing } = await admin
      .from("shifts")
      .select("id, shift_name, supervisor_id")
      .in("shift_name", ["Morning Shift", "Afternoon Shift", "Overtime Shift"])
      .order("id", { ascending: true });

    // Helper to find an existing row by name and supervisor_id (or null for global)
    const findExisting = (name: string) => {
      return (existing || []).find((r: any) => {
        const supOk =
          internalSupervisorId != null
            ? r.supervisor_id === internalSupervisorId
            : r.supervisor_id == null;
        return r.shift_name === name && supOk;
      });
    };

    // Morning
    const morning = rows.find(r => r.shift_name === "Morning Shift")!;
    const exMorning = findExisting("Morning Shift");
    if (exMorning) {
      const { error: updErr } = await admin
        .from("shifts")
        .update({ official_start: morning.official_start, official_end: morning.official_end })
        .eq("id", exMorning.id);
      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }
    } else {
      const { error: insErr } = await admin.from("shifts").insert(morning as any);
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
    }

    // Afternoon
    const afternoon = rows.find(r => r.shift_name === "Afternoon Shift")!;
    const exAfternoon = findExisting("Afternoon Shift");
    if (exAfternoon) {
      const { error: updErr } = await admin
        .from("shifts")
        .update({ official_start: afternoon.official_start, official_end: afternoon.official_end })
        .eq("id", exAfternoon.id);
      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }
    } else {
      const { error: insErr } = await admin.from("shifts").insert(afternoon as any);
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
    }

    // Overtime (only if provided; do not delete or override existing OT if not provided)
    const otRow = rows.find(r => r.shift_name === "Overtime Shift");
    if (otRow) {
      const exOt = findExisting("Overtime Shift");
      if (exOt) {
        const { error: updErr } = await admin
          .from("shifts")
          .update({ official_start: (otRow as any).official_start, official_end: (otRow as any).official_end })
          .eq("id", exOt.id);
        if (updErr) {
          return NextResponse.json({ error: updErr.message }, { status: 500 });
        }
      } else {
        const { error: insErr } = await admin.from("shifts").insert(otRow as any);
        if (insErr) {
          return NextResponse.json({ error: insErr.message }, { status: 500 });
        }
      }
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
    const supervisorIdParam = searchParams.get("supervisor_id");
    const includeAll = searchParams.get("all") === "true";

    // Resolve supervisor_id (string idnumber) to internal integer ID
    let internalSupervisorId: number | null = null;
    if (supervisorIdParam) {
         const { data: supervisorData } = await admin
             .from("users_supervisors")
             .select("id")
             .eq("idnumber", supervisorIdParam)
             .maybeSingle();
         
         if (supervisorData) {
             internalSupervisorId = supervisorData.id;
         } else {
             // If ID number provided but not found, return empty or default?
             // Returning empty seems safer than global shifts if specific ID was requested.
             return NextResponse.json({ shifts: [] });
         }
    }

    let query = admin
      .from("shifts")
      .select("shift_name, official_start, official_end, supervisor_id")
      .order("official_start", { ascending: true });

    if (includeAll) {
      // Return all shifts (no filter)
    } else if (internalSupervisorId) {
      query = query.eq("supervisor_id", internalSupervisorId);
    } else if (supervisorIdParam) { 
       // supervisorIdParam provided but not found (already handled above, but for safety)
       return NextResponse.json({ shifts: [] });
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
