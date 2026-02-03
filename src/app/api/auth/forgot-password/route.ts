import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { sendEmail } from "../../../../lib/email";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
    }

    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Find user by email across all roles
    const tables = [
      { name: "users_students", role: "student" },
      { name: "users_coordinators", role: "coordinator" },
      { name: "users_supervisors", role: "supervisor" },
      { name: "users_instructors", role: "instructor" },
      { name: "users_super_admins", role: "admin" } // super_admins might differ in schema
    ];

    let user: any = null;
    let userTable = "";
    let userRole = "";

    for (const t of tables) {
      // Select fields that are common or needed. super_admins might not have firstname/email_verified.
      // We'll select minimal first.
      const { data } = await admin
        .from(t.name)
        .select("id, email")
        .eq("email", email)
        .maybeSingle();
      
      if (data) {
        // Found! Now fetch details if needed
        // For security/logic, we need email_verified check for students/others if applicable.
        // Let's re-fetch with more fields if it's not super_admins
        if (t.name !== "users_super_admins") {
           const { data: detail } = await admin.from(t.name).select("id, email, email_verified, firstname, signup_status").eq("id", data.id).single();
           user = detail;
        } else {
           user = { ...data, firstname: "Admin", email_verified: true, signup_status: 'APPROVED' }; // Assume admins are verified
        }
        userTable = t.name;
        userRole = t.role;
        break;
      }
    }

    // Security Rule: Show error if email is not set or not found
    if (!user) {
      return NextResponse.json({ error: "Email not found in our records." }, { status: 404 });
    }

    // Security Rule: Forgot Password must be disabled if email_verified = false (except maybe admins)
    // FIX: Allow if account is explicitly APPROVED even if email is not verified (legacy/manual approval flow)
    const isApproved = user.signup_status === 'APPROVED' || user.signup_status === 'VALIDATED';
    if (user.email_verified === false && !isApproved) { // Explicit check for false
      return NextResponse.json({ error: "Your email is not verified. Please verify your email first." }, { status: 403 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ojtontrack.site";
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const payload = {
      t: "reset_password",
      id: user.id,
      role: userRole, // Include role for the reset endpoint
      table: userTable,
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    };
    const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
    const token = `${data}.${sig}`;
    const resetLink = `${appUrl}/auth/reset-password?token=${token}`;

    // Send email
    await sendEmail(
      email,
      "Reset your password - OJTonTrack",
      `<p>Hello ${user.firstname || "Student"},</p>
       <p>You requested a password reset. Click the link below to set a new password:</p>
       <p><a href="${resetLink}">${resetLink}</a></p>
       <p>This link expires in 1 hour.</p>
       <p>If you did not request this, please ignore this email.</p>`
    );

    return NextResponse.json({ success: true, message: "Password reset link sent" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
