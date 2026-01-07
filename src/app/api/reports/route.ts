import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getSupabaseAdmin } from "../../../lib/supabaseClient";

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

type ReportFile = { name?: string; type?: string; url?: string } | null;
type ReportFiles = ReportFile[] | ReportFile | undefined;
type ReportRow = {
  id: number;
  title?: string | null;
  text?: string | null;
  files?: ReportFiles;
  ts?: number | null;
  submittedat?: string | null;
  instructor_comment?: string | null;
};

export async function GET(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    const url = new URL(req.url);
    const idnumber = String(url.searchParams.get("idnumber") || "").trim();

    if (!idnumber) {
      return NextResponse.json({ error: "idnumber is required" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("reports")
      .select("id, title, text, files, ts, submittedat, status")
      .eq("idnumber", idnumber)
      .order("ts", { ascending: false });

    if (error) {
      console.error("Error fetching reports:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch instructor comments for these reports
    const reportIds = (data || []).map((r: any) => String(r.id));
    let commentsMap: Record<string, string> = {};
    
    if (reportIds.length > 0) {
        const { data: comments } = await admin
            .from("report_comments")
            .select("reportid, text, ts")
            .in("reportid", reportIds)
            .eq("byrole", "instructor")
            .order("ts", { ascending: true }); // Get latest by overwriting in map
            
        if (comments) {
            comments.forEach((c: any) => {
                commentsMap[c.reportid] = c.text;
            });
        }
    }

    const reports = (data || []).map((row: ReportRow) => {
      // Parse files jsonb
      let fileName = undefined;
      let fileType = undefined;
      let fileUrl = undefined;
      if (row.files && Array.isArray(row.files) && row.files.length > 0) {
        const f = row.files[0] as ReportFile;
        fileName = f?.name;
        fileType = f?.type;
        fileUrl = f?.url;
      } else if (row.files && typeof row.files === "object") {
        const f = row.files as ReportFile;
        fileName = f?.name;
        fileType = f?.type;
        fileUrl = f?.url;
      }

      return {
        id: row.id,
        title: row.title || "(Untitled)",
        body: row.text,
        fileName,
        fileType,
        fileUrl,
        instructorComment: commentsMap[String(row.id)] || null,
        submittedAt: row.ts ? Number(row.ts) : (row.submittedat ? new Date(row.submittedat).getTime() : Date.now()),
        status: (row as any).status,
      };
    });

    const allReports = reports;
    const submittedReports = allReports.filter((r: any) => r.status !== 'draft');
    const drafts = allReports.filter((r: any) => r.status === 'draft');

    return NextResponse.json({ reports: submittedReports, drafts });
  } catch (e) {
    console.error("Unexpected error in GET /api/reports:", e);
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    const body = await req.json();
    const { id, instructorComment, instructorId } = body;

    if (!id) {
      return NextResponse.json({ error: "Report ID is required" }, { status: 400 });
    }

    // Fetch report to get student idnumber
    const { data: reportData, error: reportError } = await admin
        .from("reports")
        .select("idnumber")
        .eq("id", id)
        .single();

    if (reportError || !reportData) {
        console.error("Error fetching report for comment:", reportError);
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const { error } = await admin
      .from("report_comments")
      .insert({
        reportid: String(id),
        idnumber: reportData.idnumber,
        text: instructorComment,
        byid: instructorId || "instructor", // Fallback if not provided
        byrole: "instructor",
        ts: Date.now(),
        unreadforstudent: true
      });

    if (error) {
      console.error("Error adding report comment:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Create Notification
    try {
      await admin.from("notifications").insert({
        idnumber: reportData.idnumber,
        title: "New Report Comment",
        message: "An instructor has commented on your report.",
        type: "report_comment",
        is_read: false,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to create notification:", err);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Unexpected error in PATCH /api/reports:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
        console.error("Supabase admin not configured");
        return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    console.log("Received report submission:", JSON.stringify(body, null, 2));

    const { id, idnumber, title, body: text, fileName, fileType, fileData, isDraft } = body;

    if (!idnumber) {
      console.error("Missing idnumber in report submission");
      return NextResponse.json({ error: "idnumber is required" }, { status: 400 });
    }

    // Handle File Upload
    let fileUrl = undefined;
    if (fileData && fileName) {
        configureCloudinary(); // Will throw if missing credentials
        
        try {
            console.log("Uploading file to Cloudinary...");
            const uploadRes = await cloudinary.uploader.upload(fileData, {
                folder: "ojt_reports",
                resource_type: "auto",
                public_id: `report_${idnumber}_${Date.now()}_${fileName.replace(/\s+/g, '_')}`
            });
            fileUrl = uploadRes.secure_url;
            console.log("File uploaded:", fileUrl);
        } catch (err) {
            console.error("Cloudinary upload failed:", err);
            return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
        }
    }

    // Fetch user to get course
    const { data: user, error: userError } = await admin
        .from("users")
        .select("course")
        .eq("idnumber", idnumber)
        .maybeSingle();

    if (userError) console.warn("Could not fetch user course:", userError);

    const files = fileName ? [{ name: fileName, type: fileType, url: fileUrl }] : [];
    const ts = Date.now();
    const submittedat = new Date().toISOString();
    const status = isDraft ? "draft" : "submitted";

    const payload = {
      idnumber,
      title: title || (isDraft ? "" : "(Untitled)"),
      text: text || "",
      files: files,
      ts,
      submittedat,
      status,
      course: user?.course || null,
      createdat: submittedat,
    };
    
    let resultData;
    let resultError;

    if (id) {
        // Update existing report/draft by ID
        console.log(`Updating existing report/draft ${id} with status ${status}`);
        
        const { data, error } = await admin
            .from("reports")
            .update(payload)
            .eq("id", id)
            .eq("idnumber", idnumber) // Security check
            .select("id, title, text, files, ts, status")
            .single();
            
        resultData = data;
        resultError = error;
    } else {
        // Insert new report/draft
        console.log(`Inserting new report with status ${status}`);
        const { data, error } = await admin
          .from("reports")
          .insert(payload)
          .select("id, title, text, files, ts, status")
          .single();
          
        resultData = data;
        resultError = error;
    }

    if (resultError || !resultData) {
      console.error("Error saving report:", resultError);
      return NextResponse.json({ error: resultError?.message || "Failed to save report" }, { status: 500 });
    }
    
    console.log("Report saved successfully:", resultData.id);

    return NextResponse.json({
        report: {
            id: resultData.id,
            title: resultData.title,
            body: resultData.text,
            fileName: resultData.files?.[0]?.name,
            fileType: resultData.files?.[0]?.type,
            submittedAt: resultData.ts,
            status: resultData.status
        }
    });
  } catch (e) {
    console.error("Unexpected error in POST /api/reports:", e);
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await admin.from("reports").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
