import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export async function GET(req: Request) {
  try {
    const cookieName = "ojt_session";
    const cookies = req.headers.get("cookie");
    
    if (!cookies) {
      return NextResponse.json({ error: "No cookies" }, { status: 401 });
    }

    const match = cookies.match(new RegExp(`(^|;)\\s*${cookieName}=([^;]+)`));
    if (!match) {
      return NextResponse.json({ error: "Session cookie not found" }, { status: 401 });
    }

    const raw = match[2];
    const decoded = decodeURIComponent(raw);
    const obj = JSON.parse(decoded);

    if (obj?.role && obj?.idnumber) {
      return NextResponse.json({ 
        role: String(obj.role), 
        idnumber: String(obj.idnumber) 
      });
    }

    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  } catch (e) {
    return NextResponse.json({ error: "Session verification failed" }, { status: 401 });
  }
}