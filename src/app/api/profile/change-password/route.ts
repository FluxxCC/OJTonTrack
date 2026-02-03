import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
    }

    const body = await req.json();
    let { idnumber, currentPassword, newPassword } = body;

    if (!idnumber || !currentPassword || !newPassword) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    // Normalize idnumber
    idnumber = String(idnumber).trim();

    // Verify current password across tables
    // Use correct table names
    const tables = ["users_students", "users_coordinators", "users_supervisors", "users_instructors", "users_super_admins"];
    let user = null;
    let userTable = "";

    for (const t of tables) {
        const { data } = await admin.from(t).select("id, password").eq("idnumber", idnumber).maybeSingle();
        if (data) {
            user = data;
            userTable = t;
            break;
        }
    }
    
    // Check if user exists
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Password Verification Logic (Shared with Login)
    let passwordMatch = false;
    const storedPassword = String(user.password);
    
    if (storedPassword.startsWith("$2")) {
        passwordMatch = await bcrypt.compare(currentPassword, storedPassword);
    } else {
        if (storedPassword === currentPassword) {
            passwordMatch = true;
        }
    }

    if (!passwordMatch) {
      return NextResponse.json({ error: "Incorrect current password" }, { status: 401 });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    const { error: updateError } = await admin
      .from(userTable)
      .update({
        password: hashedPassword
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
