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

    // Find user by email
    const { data: user, error: fetchError } = await admin
      .from("users")
      .select("id, email, email_verified, firstname")
      .eq("email", email)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Security Rule: Show error if email is not set or not found (User requirement: "Show a clear error if email is not yet set")
    if (!user) {
      return NextResponse.json({ error: "Email not found in our records." }, { status: 404 });
    }

    // Security Rule: Forgot Password must be disabled if email_verified = false
    if (!user.email_verified) {
      return NextResponse.json({ error: "Your email is not verified. Please verify your email first." }, { status: 403 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ojtontrack.site";
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const payload = {
      t: "reset_password",
      id: user.id,
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
