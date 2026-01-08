import { NextResponse } from "next/server";
const webPush: any = require("web-push");

export async function GET() {
  const pub = process.env.VAPID_PUBLIC_KEY || "";
  const priv = process.env.VAPID_PRIVATE_KEY || "";
  if (!pub || !priv) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }
  return NextResponse.json({ publicKey: pub });
}
