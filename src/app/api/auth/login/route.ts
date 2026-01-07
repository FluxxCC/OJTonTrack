import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
    }
    const body = await req.json().catch(() => ({}));
    const idnumber = String(body?.idnumber || "").trim();
    const password = String(body?.password || "");
    const expectedRole = String(body?.expectedRole || "").trim().toLowerCase();

    if (!idnumber || !password) {
      return NextResponse.json({ error: "ID number and password are required" }, { status: 400 });
    }
    const { data, error } = await admin
      .from("users")
      .select("id, idnumber, password, role, firstname, lastname, email, email_verified")
      .eq("idnumber", idnumber)
      .limit(1)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Invalid ID number" }, { status: 404 });
    }
    if (String(data.password) !== String(password)) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }
    
    const normalizedRole = String(data.role || "").toLowerCase().replace(/[_\s]+/g, "");
    
    // Strict Role Enforcement
    if (expectedRole && normalizedRole !== expectedRole) {
      return NextResponse.json({ 
        error: `Access Denied: You are trying to log in to the ${expectedRole} portal, but your account is registered as a ${normalizedRole}.` 
      }, { status: 403 });
    }

    return NextResponse.json({
      user: {
        id: data.id,
        idnumber: data.idnumber,
        role: normalizedRole,
        firstname: data.firstname || "",
        lastname: data.lastname || "",
        email: data.email || null,
        email_verified: !!data.email_verified,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

