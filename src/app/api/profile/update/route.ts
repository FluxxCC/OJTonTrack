import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
    }

    const body = await req.json();
    let { idnumber, company, location } = body;

    if (!idnumber) {
      return NextResponse.json({ error: "User ID number is required" }, { status: 400 });
    }

    // Normalize idnumber
    idnumber = String(idnumber).trim();

    // Check if user exists in students table (assuming profile update is for students)
    // If needed for other roles, we should pass 'role' in the body
    const tableName = body.role === 'supervisor' ? 'users_supervisors' : 
                      body.role === 'coordinator' ? 'users_coordinators' : 
                      body.role === 'instructor' ? 'users_instructors' : 'users_students';

    const { data: user, error: fetchError } = await admin
      .from(tableName)
      .select("id")
      .eq("idnumber", idnumber)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update details
    const updates: any = {};
    if (company !== undefined) updates.company = company;
    if (location !== undefined) updates.location = location;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true, message: "No changes to save" });
    }

    const { error: updateError } = await admin
      .from(tableName)
      .update(updates)
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Profile updated successfully" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
