import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export async function GET(req: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get("course_id");

  let query = admin.from("sections").select("*, courses(name)").order("name");
  
  if (courseId) {
    query = query.eq("course_id", courseId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ sections: data });
}

export async function POST(req: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const { name, course_id } = body;

    if (!name || !course_id) {
      return NextResponse.json({ error: "Section name and Course ID are required" }, { status: 400 });
    }

    // Generate a unique code (e.g. "123-4A")
    const code = `${course_id}-${name.replace(/\s+/g, '-')}`;

    const { data, error } = await admin
      .from("sections")
      .insert({ name, course_id, code })
      .select()
      .single();

    if (error) {
      console.error("Error creating section:", error);
      // Handle unique constraint violation (duplicate code)
      if (error.code === '23505') {
        return NextResponse.json({ error: "Section already exists for this course" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ section: data });
  } catch (e) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const { id, name, course_id } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const updates: any = {};
    if (name) updates.name = name;
    if (course_id) updates.course_id = course_id;

    const { data, error } = await admin
      .from("sections")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ section: data });
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
      .from("sections")
      .delete()
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
