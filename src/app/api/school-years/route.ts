
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("school_years")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ school_years: data });
  } catch (error) {
    console.error("Error fetching school years:", error);
    return NextResponse.json(
      { error: "Failed to fetch school years" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sy, start_date, end_date, code } = body;

    if (!sy) {
      return NextResponse.json(
        { error: "School year (sy) is required" },
        { status: 400 }
      );
    }

    // Create the new school year
    const { data, error } = await supabase
      .from("school_years")
      .insert([
        { 
          sy, 
          code: code || null,
          start_date: start_date || null,
          end_date: end_date || null,
          is_active: false // Default to false
        }
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ school_year: data });
  } catch (error) {
    console.error("Error creating school year:", error);
    // Check for duplicate key violation
    if ((error as any)?.code === '23505') {
        return NextResponse.json(
            { error: "School year already exists" },
            { status: 409 }
        );
    }
    return NextResponse.json(
      { error: "Failed to create school year" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { id, is_active, sy, start_date, end_date, code } = body;

        if (!id) {
            return NextResponse.json({ error: "ID is required" }, { status: 400 });
        }

        // If setting to active, we must deactivate all others first
        if (is_active === true) {
            await supabase.from('school_years').update({ is_active: false }).neq('id', 0);
        }

        const updates: any = {};
        if (is_active !== undefined) updates.is_active = is_active;
        if (sy !== undefined) updates.sy = sy;
        if (code !== undefined) updates.code = code || null;
        if (start_date !== undefined) updates.start_date = start_date || null;
        if (end_date !== undefined) updates.end_date = end_date || null;

        const { data, error } = await supabase
            .from('school_years')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ school_year: data });

    } catch (error) {
        console.error("Error updating school year:", error);
        return NextResponse.json({ error: "Failed to update school year" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "ID is required" }, { status: 400 });
        }

        const { error } = await supabase
            .from('school_years')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting school year:", error);
        return NextResponse.json({ error: "Failed to delete school year" }, { status: 500 });
    }
}
