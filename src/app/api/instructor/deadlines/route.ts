import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export async function GET(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    const { data, error } = await admin.from("report_requirements").select("*");

    if (error) {
       // If table doesn't exist yet, return empty
       if (error.code === '42P01') {
         return NextResponse.json({ deadlines: {} });
       }
       return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map to frontend structure: { "BSIT:::4A": { 1: "2023-..." }, "BSIT:::ALL": { ... } }
    // Key format: "COURSE:::SECTION" (use "ALL" for empty/generic)
    const deadlines: Record<string, Record<number, string>> = {};

    (data || []).forEach((row: any) => {
        const c = row.course || "ALL";
        // If section is empty string or null, treat as "ALL" for frontend key
        const s = row.section ? row.section : "ALL"; 
        
        const key = `${c}:::${s}`;
        const w = row.week_number;
        
        if (!deadlines[key]) deadlines[key] = {};
        if (w) deadlines[key][w] = row.due_at;
    });

    return NextResponse.json({ deadlines });
  } catch (e) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    const body = await req.json();
    const { course, section, week, date } = body;

    if (!course || !week || !date) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const courseKey = course === "All Courses" ? "ALL" : course;
    // If section is "All Sections" or empty/null, store as empty string in DB
    const sectionKey = (!section || section === "All Sections") ? "" : section;

    // Check if exists
    const { data: existing } = await admin
        .from("report_requirements")
        .select("id")
        .eq("course", courseKey)
        .eq("section", sectionKey)
        .eq("week_number", week)
        .single();

    if (existing) {
        // Update
        const { error } = await admin
            .from("report_requirements")
            .update({ due_at: date })
            .eq("id", existing.id);
            
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
        // Insert
        const { error } = await admin
            .from("report_requirements")
            .insert({
                course: courseKey,
                section: sectionKey,
                week_number: week,
                due_at: date,
                title: `Week ${week} Report` // Default title
            });
            
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}