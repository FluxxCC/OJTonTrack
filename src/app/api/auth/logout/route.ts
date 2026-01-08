import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });
  
  // Clear the session cookie
  response.cookies.set("ojt_session", "", {
    path: "/",
    expires: new Date(0),
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
