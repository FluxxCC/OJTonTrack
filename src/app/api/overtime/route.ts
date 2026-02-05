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
        // Resolve student_id if it's an idnumber (string)
        let internalId = student_id;
        // Check if it's an idnumber first
        const { data: stData } = await admin
            .from("users_students")
            .select("id")
            .eq("idnumber", student_id)
            .maybeSingle();
            
        if (stData) {
            internalId = stData.id;
        }
        
        query = query.eq("student_id", internalId);
    }
    if (supervisor_id) {
        // Need to lookup ID if supervisor_id is idnumber string
        const { data: sup } = await admin.from("users_supervisors").select("id").eq("idnumber", supervisor_id).single();
        if (sup) {
             query = query.eq("created_by_id", sup.id).eq("created_by_role", "supervisor");
        } else {
             // Fallback or empty result
             query = query.eq("created_by_id", -1);
        }
    }

    const { data, error } = await query;

    if (error) throw error;
    
    // Convert timestamp strings to Number (ms)
    const safeData = data ? data.map((item: any) => ({
        ...item,
        overtime_start: new Date(item.overtime_start).getTime(),
        overtime_end: new Date(item.overtime_end).getTime()
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

    // Lookup Supervisor internal ID
    const { data: supervisorData, error: supError } = await admin
        .from("users_supervisors")
        .select("id")
        .eq("idnumber", supervisor_id)
        .single();
    
    if (supError || !supervisorData) {
        return NextResponse.json({ error: "Supervisor not found" }, { status: 404 });
    }

    // Lookup Student ID if it's a string (idnumber)
    let finalStudentId = student_id;
    if (typeof student_id === 'string' && isNaN(Number(student_id))) {
         // Assume it's an idnumber like "STUD101"
         const { data: studentData, error: stError } = await admin
            .from("users_students")
            .select("id")
            .eq("idnumber", student_id)
            .single();
         
         if (stError || !studentData) {
             return NextResponse.json({ error: `Student not found: ${student_id}` }, { status: 404 });
         }
         finalStudentId = studentData.id;
    }

    // Insert into overtime_shifts
    const { error: insertError } = await admin
        .from("overtime_shifts")
        .insert({
            shift_id: shiftId,
            overtime_start: new Date(start).toISOString(),
            overtime_end: new Date(end).toISOString(),
            effective_date: date,
            created_by_id: supervisorData.id,
            created_by_role: 'supervisor',
            student_id: finalStudentId
        });

    if (insertError) throw insertError;

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    const body = await req.json();
    const { date, start, end, supervisor_id, student_id, id } = body;

    if ((!id && (!date || !student_id || !supervisor_id)) || !start || !end) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Resolve supervisor internal ID if provided as idnumber
    let supId: number | null = null;
    if (supervisor_id) {
      const { data: sup } = await admin.from("users_supervisors").select("id").eq("idnumber", supervisor_id).maybeSingle();
      supId = sup?.id ?? null;
    }

    // Resolve student internal ID if provided as idnumber
    let stuId: number | null = null;
    if (student_id) {
      if (typeof student_id === "string" && isNaN(Number(student_id))) {
        const { data: st } = await admin.from("users_students").select("id").eq("idnumber", student_id).maybeSingle();
        stuId = st?.id ?? null;
      } else {
        stuId = Number(student_id);
      }
    }

    const payload = {
      overtime_start: new Date(start).toISOString(),
      overtime_end: new Date(end).toISOString(),
    };

    let query = admin.from("overtime_shifts").update(payload);

    if (id) {
      query = query.eq("id", id as any);
    } else {
      if (!date || !stuId || !supId) {
        return NextResponse.json({ error: "Missing keys for update" }, { status: 400 });
      }
      query = query
        .eq("effective_date", String(date))
        .eq("student_id", stuId)
        .eq("created_by_id", supId)
        .eq("created_by_role", "supervisor");
    }

    const { error } = await query;
    if (error) throw error;

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
    const idParam = searchParams.get("id");
    const date = searchParams.get("date");
    const student_id = searchParams.get("student_id");
    const supervisor_id = searchParams.get("supervisor_id");

    let del = admin.from("overtime_shifts").delete();

    if (idParam) {
      del = del.eq("id", Number(idParam));
    } else {
      if (!date || !student_id || !supervisor_id) {
        return NextResponse.json({ error: "Missing keys for delete" }, { status: 400 });
      }
      // Resolve supervisor and student internal IDs
      const { data: sup } = await admin.from("users_supervisors").select("id").eq("idnumber", supervisor_id).maybeSingle();
      const { data: stu } = await admin.from("users_students").select("id").eq("idnumber", student_id).maybeSingle();
      if (!sup?.id || !stu?.id) {
        return NextResponse.json({ error: "Supervisor or student not found" }, { status: 404 });
      }
      del = del
        .eq("effective_date", date)
        .eq("student_id", stu.id)
        .eq("created_by_id", sup.id)
        .eq("created_by_role", "supervisor");
    }

    const { error } = await del;
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
