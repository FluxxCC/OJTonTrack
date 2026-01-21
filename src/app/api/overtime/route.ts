import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export async function GET(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const student_id = searchParams.get("student_id");
    const supervisor_id = searchParams.get("supervisor_id");

    let query = admin.from("overtime_shifts").select("*");
    
    if (date) {
        query = query.eq("effective_date", date);
    }
    if (student_id) {
        query = query.eq("student_id", student_id);
    }
    if (supervisor_id) {
        query = query.eq("created_by", supervisor_id);
    }

    const { data, error } = await query;

    if (error) throw error;
    
    // Convert BigInt to Number (safe for timestamps) or String
    const safeData = data ? data.map((item: any) => ({
        ...item,
        overtime_start: Number(item.overtime_start),
        overtime_end: Number(item.overtime_end)
    })) : [];

    return NextResponse.json({ overtime_shifts: safeData });
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
    const { date, start, end, supervisor_id, student_id } = body;

    if (!date || !start || !end || !supervisor_id || !student_id) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Find the Overtime Shift ID
    let { data: shiftData, error: shiftError } = await admin
        .from("shifts")
        .select("id")
        .eq("shift_name", "Overtime Shift")
        .single();
    
    if (shiftError || !shiftData) {
        // Create "Overtime Shift" if it doesn't exist
        const { data: newShift, error: createError } = await admin
            .from("shifts")
            .insert({
                shift_name: "Overtime Shift",
                official_start: "00:00:00", // Default placeholders, not used for dynamic OT
                official_end: "00:00:00"
            })
            .select("id")
            .single();
            
        if (createError || !newShift) {
             const msg = createError ? createError.message : "Unknown error";
             return NextResponse.json({ error: `Failed to create Overtime Shift definition: ${msg}` }, { status: 500 });
        }
        shiftData = newShift;
    }

    const shiftId = shiftData.id;

    // Insert into overtime_shifts
    const { error: insertError } = await admin
        .from("overtime_shifts")
        .insert({
            shift_id: shiftId,
            overtime_start: start,
            overtime_end: end,
            effective_date: date,
            created_by: supervisor_id,
            student_id: student_id
        });

    if (insertError) throw insertError;

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
