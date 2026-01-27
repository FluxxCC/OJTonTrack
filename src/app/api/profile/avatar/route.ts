import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
  const apiKey = process.env.CLOUDINARY_API_KEY || "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET || "";
  if (!cloudName || !apiKey || !apiSecret) {
    console.error("Cloudinary credentials missing");
    throw new Error("Cloudinary credentials missing");
  }
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
  return true;
}

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
        return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
    }

    const body = await req.json();
    const { idnumber, fileData } = body;

    if (!idnumber || !fileData) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Handle File Upload
    configureCloudinary();
    
    let avatarUrl = "";
    try {
        console.log("Uploading avatar to Cloudinary...");
        const uploadRes = await cloudinary.uploader.upload(fileData, {
            folder: "ojt_avatars",
            resource_type: "image",
            public_id: `avatar_${idnumber}_${Date.now()}`,
            transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }]
        });
        avatarUrl = uploadRes.secure_url;
        console.log("Avatar uploaded:", avatarUrl);
    } catch (err) {
        console.error("Cloudinary upload failed:", err);
        return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
    }

    // Update User
    const { error: updateError } = await admin
        .from("users")
        .update({
            avatar_url: avatarUrl
        })
        .eq("idnumber", idnumber);

    if (updateError) {
        console.error("Failed to update user avatar:", updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, avatarUrl });
  } catch (e) {
    console.error("Unexpected error in POST /api/profile/avatar:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const idnumber = searchParams.get("idnumber");
        
        if (!idnumber) {
            return NextResponse.json({ error: "Missing idnumber" }, { status: 400 });
        }

        const admin = getSupabaseAdmin();
        if (!admin) {
            return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
        }

        // Get current avatar url to delete from Cloudinary (optional optimization)
        // For now, just clearing the DB is enough as Cloudinary storage is cheap/managed elsewhere
        // or we can extract public_id if needed.

        const { error } = await admin
            .from("users")
            .update({ avatar_url: null })
            .eq("idnumber", idnumber);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
