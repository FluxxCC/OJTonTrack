import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
    }

    const body = await req.json();
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      return NextResponse.json({ error: "Token and new password are required" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const parts = String(token).split(".");
    if (parts.length !== 2) {
      return NextResponse.json({ error: "Invalid token format" }, { status: 400 });
    }
    const [data, sig] = parts;
    const expected = crypto.createHmac("sha256", secret).update(data).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return NextResponse.json({ error: "Invalid token signature" }, { status: 400 });
    }
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (!payload || payload.t !== "reset_password") {
      return NextResponse.json({ error: "Invalid token type" }, { status: 400 });
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return NextResponse.json({ error: "Reset token has expired" }, { status: 400 });
    }

    // Update password
    const { error: updateError } = await admin
      .from("users")
      .update({
        password: newPassword,
      })
      .eq("id", payload.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Password has been reset successfully" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
