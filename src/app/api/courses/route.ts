import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  const { data, error } = await admin
    .from("courses")
    .select("*")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ courses: data });
}

export async function POST(req: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const { name, required_ojt_hours } = body;

    if (!name) {
      return NextResponse.json({ error: "Course name is required" }, { status: 400 });
    }

    // Generate a simple key/slug from the name
    const name_key = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const { data, error } = await admin
      .from("courses")
      .insert({ 
        name, 
        name_key,
        required_ojt_hours: required_ojt_hours || 486 
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating course:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ course: data });
  } catch (e) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const { id, name, required_ojt_hours } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const updates: any = {};
    if (name) updates.name = name;
    if (required_ojt_hours !== undefined) updates.required_ojt_hours = required_ojt_hours;

    const { data, error } = await admin
      .from("courses")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ course: data });
  } catch (e) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const { error } = await admin
      .from("courses")
      .delete()
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
