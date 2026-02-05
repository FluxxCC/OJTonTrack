import { NextResponse } from "next/server";

export async function GET() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "";
  if (!pub) {
    return NextResponse.json({ error: "VAPID public key not configured" }, { status: 500 });
  }
  return NextResponse.json({ publicKey: pub });
}
