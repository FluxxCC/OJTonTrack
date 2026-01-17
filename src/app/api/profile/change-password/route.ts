import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
    }

    const body = await req.json();
    const { idnumber, currentPassword, newPassword } = body;

    if (!idnumber || !currentPassword || !newPassword) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    // Verify current password
    const { data: user, error: fetchError } = await admin
      .from("users")
      .select("id, password")
      .eq("idnumber", idnumber)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (String(user.password) !== String(currentPassword)) {
      return NextResponse.json({ error: "Incorrect current password" }, { status: 401 });
    }

    // Update password
    const { error: updateError } = await admin
      .from("users")
      .update({
        password: newPassword
      })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Password changed successfully" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
