import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { getActiveSchoolYearId } from "../../../lib/school-year";
import { sendPushNotification } from "@/lib/push-notifications";

export const dynamic = 'force-dynamic';

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

function sanitizeSegment(s: string) {
  return String(s || "UNKNOWN")
    .replace(/[\/\\]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_\-]/g, "")
    .trim();
}

type ReportFile = { name?: string; type?: string; url?: string } | null;
type ReportFiles = ReportFile[] | ReportFile | undefined;
type ReportRow = {
  id: number;
  title?: string | null;
  content?: string | null;
  files?: any;
  created_at?: string | null;
  submitted_at?: string | null;
  status?: string | null;
  student_id: number;
  reviewed_by_id?: number | null;
  users_students?: { idnumber: string } | { idnumber: string }[] | null;
  students?: { idnumber: string } | null;
  school_year_id?: number | null;
};

export async function GET(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

    const url = new URL(req.url);
    const idnumber = String(url.searchParams.get("idnumber") || "").trim();
    const syParam = url.searchParams.get("school_year_id");

    let targetSyId: number | null = null;
    if (syParam) {
      targetSyId = parseInt(syParam);
    } else {
      targetSyId = await getActiveSchoolYearId(admin);
    }

    let query = admin
      .from("reports")
      .select(`
        id, 
        title, 
        content, 
        files, 
        created_at, 
        submitted_at, 
        status, 
        student_id, 
        reviewed_by_id, 
        school_year_id,
        users_students (
          idnumber
        )
      `)
      .order("created_at", { ascending: false });

    if (targetSyId) {
      query = query.eq("school_year_id", targetSyId);
    }

    if (idnumber) {
      // Look up student ID first (robust, ignoring spaces/hyphens)
      const normalize = (s: string) => String(s || "").toLowerCase().replace(/[\s\-]/g, "");
      let studentIdResolved: number | null = null;
      const { data: exact } = await admin.from("users_students").select("id, idnumber, course_id, section_id").eq("idnumber", idnumber).maybeSingle();
      if (exact?.id) {
        studentIdResolved = exact.id;
      } else {
        const { data: ci } = await admin.from("users_students").select("id, idnumber, course_id, section_id").ilike("idnumber", idnumber).maybeSingle();
        if (ci?.id) {
          studentIdResolved = ci.id;
        } else {
          const upper = idnumber.toUpperCase();
          const lower = idnumber.toLowerCase();
          const { data: up } = await admin.from("users_students").select("id, idnumber, course_id, section_id").eq("idnumber", upper).maybeSingle();
          if (up?.id) {
            studentIdResolved = up.id;
          } else {
            const { data: low } = await admin.from("users_students").select("id, idnumber, course_id, section_id").eq("idnumber", lower).maybeSingle();
            if (low?.id) {
              studentIdResolved = low.id;
            } else {
              const { data: candidates } = await admin
                .from("users_students")
                .select("id, idnumber")
                .ilike("idnumber", `%${idnumber.slice(0, Math.max(3, Math.min(6, idnumber.length))) }%`)
                .limit(200);
              if (Array.isArray(candidates)) {
                const target = candidates.find((c: any) => normalize(c.idnumber) === normalize(idnumber));
                if (target?.id) studentIdResolved = target.id;
              }
            }
          }
        }
      }
      if (studentIdResolved) {
        query = query.eq("student_id", studentIdResolved);
      } else {
        return NextResponse.json({ reports: [], drafts: [] });
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching reports:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch instructor comments for these reports
    const reportIds = (data || []).map((r: any) => r.id);
    const commentsMap: Record<string, string> = {};
    const viewedMap: Record<string, boolean> = {};
    
    if (reportIds.length > 0) {
        const { data: comments } = await admin
            .from("report_comments")
            .select("report_id, content, created_at")
            .in("report_id", reportIds)
            .eq("author_role", "instructor")
            .order("created_at", { ascending: true }); // Get latest by overwriting in map
            
        if (comments) {
            comments.forEach((c: any) => {
                commentsMap[String(c.report_id)] = c.content;
                viewedMap[String(c.report_id)] = true;
            });
        }
    }

    const reports = (data || []).map((row: ReportRow) => {
      // Parse files jsonb
      let fileName: string | undefined = undefined;
      let fileType: string | undefined = undefined;
      let fileUrl: string | undefined = undefined;
      let week: number | undefined = undefined;

      const extractWeek = (obj: any) => {
        if (obj && typeof obj === 'object' && 'week' in obj) return Number(obj.week);
        return undefined;
      };

      let photoName: string | undefined = undefined;
      let photoUrl: string | undefined = undefined;
      const photos: { name: string; url: string; type: string }[] = [];

      if (row.files && Array.isArray(row.files)) {
        row.files.forEach((f: any) => {
            const w = extractWeek(f);
            if (w) week = w;
            
            if (f.category === 'photo' || (f.type && f.type.startsWith('image/'))) {
                // Add to photos array
                photos.push({
                    name: f.name,
                    url: f.url,
                    type: f.type || 'image/jpeg'
                });

                // Keep legacy fields pointing to the first photo (or last, depending on preference, but first is safer for "main" photo)
                if (!photoName) {
                    photoName = f.name;
                    photoUrl = f.url;
                }
            } else if (f.name) {
                fileName = f.name;
                fileType = f.type;
                fileUrl = f.url;
            }
        });
      } else if (row.files && typeof row.files === "object") {
        const f = row.files as any;
        fileName = f?.name;
        fileType = f?.type;
        fileUrl = f?.url;
        week = extractWeek(f);
      }

      return {
        id: row.id,
        week,
        title: row.title || "(Untitled)",
        body: row.content, // 'content' in new schema
        fileName,
        fileType,
        fileUrl,
        photoName,
        photoUrl,
        photos, // Return the full array
        instructorComment: commentsMap[String(row.id)] || null,
        isViewedByInstructor: viewedMap[String(row.id)] || !!row.reviewed_by_id,
        submittedAt: row.submitted_at ? new Date(row.submitted_at).getTime() : (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
        status: row.status,
        idnumber: (Array.isArray(row.users_students) ? row.users_students[0]?.idnumber : (row.users_students as any)?.idnumber) || row.students?.idnumber,
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

    if (!instructorId) {
        return NextResponse.json({ error: "Instructor ID is required" }, { status: 400 });
    }

    // Resolve instructorId (string idnumber) to numeric ID
    let numericInstructorId = null;
    if (instructorId) {
        const { data: instructorData } = await admin
            .from("users_instructors")
            .select("id")
            .eq("idnumber", instructorId)
            .single();
        
        if (instructorData) {
            numericInstructorId = instructorData.id;
        } else if (!isNaN(Number(instructorId))) {
             // Fallback if it was already a number
             numericInstructorId = Number(instructorId);
        }
    }

    if (!numericInstructorId) {
        console.error("Failed to resolve instructor ID:", instructorId);
        return NextResponse.json({ error: "Invalid Instructor ID" }, { status: 400 });
    }

    // Fetch report to get student idnumber
    const { data: reportData, error: reportError } = await admin
        .from("reports")
        .select("student_id, users_students (idnumber)")
        .eq("id", id)
        .single();

    if (reportError || !reportData) {
        console.error("Error fetching report for comment:", reportError);
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const studentIdNumber = (reportData.users_students as any)?.idnumber;

    // Update reviewed_by_id and reviewed_at in reports table
    const { error: updateError } = await admin
        .from("reports")
        .update({
            reviewed_by_id: numericInstructorId, 
            reviewed_at: new Date().toISOString()
        })
        .eq("id", id);

    if (updateError) {
        console.error("Error updating report reviewed status:", updateError);
        // Continue anyway as comment insertion is more important if present
    }

    if (instructorComment && instructorComment.trim().length > 0) {
        const { error } = await admin
          .from("report_comments")
          .insert({
            report_id: id,
            content: instructorComment,
            author_id: numericInstructorId, 
            author_role: "instructor",
            created_at: new Date().toISOString(),
            unread_for_student: true
          });

        if (error) {
          console.error("Error adding report comment:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
    }

    // Create Notification only if there is a comment text
    if (instructorComment && instructorComment.trim().length > 0 && studentIdNumber) {
      try {
        await admin.from("notifications").insert({
          idnumber: studentIdNumber,
          title: "New Report Comment",
          message: "An instructor has commented on your report.",
          type: "report_comment",
          is_read: false,
          created_at: new Date().toISOString()
        });
      } catch (err) {
        console.error("Failed to create notification:", err);
      }
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

    const body = await req.json();
    const { 
        idnumber, 
        studentId,
        title, 
        body: content, 
        fileName, 
        fileType, 
        fileData, 
        existingFileUrl,
        photos, // Array of {name, type, data}
        existingPhotos, // Array of {name, type, url}
        isDraft,
        week,
        id // draft id if updating
    } = body;

    const normalizedId = String(idnumber || "").trim();
    if (!normalizedId && !(studentId && Number(studentId) > 0)) {
        return NextResponse.json({ error: "Student ID required" }, { status: 400 });
    }

    // Get Student ID
    let student: any = null;
    const normalize = (s: string) => String(s || "").toLowerCase().replace(/[\s\-]/g, "");
    try {
      if (studentId && Number(studentId) > 0) {
        const { data } = await admin
          .from("users_students")
          .select("id, company, supervisor_id, firstname, lastname, course_id, section_id")
          .eq("id", Number(studentId))
          .maybeSingle();
        student = data;
      }
      if (!student && normalizedId) {
        const { data } = await admin
          .from("users_students")
          .select("id, company, supervisor_id, firstname, lastname, course_id, section_id")
          .eq("idnumber", normalizedId)
          .maybeSingle();
        student = data;
      }
      if (!student && normalizedId) {
        const { data } = await admin
          .from("users_students")
          .select("id, company, supervisor_id, firstname, lastname, course_id, section_id")
          .ilike("idnumber", normalizedId)
          .maybeSingle();
        student = data;
      }
      if (!student && normalizedId) {
        const upper = normalizedId.toUpperCase();
        const { data } = await admin
          .from("users_students")
          .select("id, company, supervisor_id, firstname, lastname, course_id, section_id")
          .eq("idnumber", upper)
          .maybeSingle();
        student = data;
      }
      if (!student && normalizedId) {
        const lower = normalizedId.toLowerCase();
        const { data } = await admin
          .from("users_students")
          .select("id, company, supervisor_id, firstname, lastname, course_id, section_id")
          .eq("idnumber", lower)
          .maybeSingle();
        student = data;
      }
      // Fallback: match ignoring spaces/hyphens
      if (!student && normalizedId) {
        const { data: candidates } = await admin
          .from("users_students")
          .select("id, idnumber, company, supervisor_id, firstname, lastname, course_id, section_id")
          .ilike("idnumber", `%${normalizedId.slice(0, Math.max(3, Math.min(6, normalizedId.length))) }%`)
          .limit(200);
        if (Array.isArray(candidates)) {
          const target = candidates.find((c: any) => normalize(c.idnumber) === normalize(normalizedId));
          if (target) student = target;
        }
      }
    } catch {}
    
    if (!student) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const syId = await getActiveSchoolYearId(admin);
    if (!syId) {
        return NextResponse.json({ error: "No active school year found" }, { status: 400 });
    }

    // Handle File Uploads
    const uploadedFiles: any[] = [];

    // 1. Main Document
    if (fileData && fileName) {
        configureCloudinary();
        try {
            let courseName = "UNKNOWN";
            let sectionName = "UNKNOWN";
            try {
                const { data: c } = await admin.from("courses").select("name").eq("id", (student as any).course_id).maybeSingle();
                if (c?.name) courseName = String(c.name);
                const { data: s } = await admin.from("sections").select("name").eq("id", (student as any).section_id).maybeSingle();
                if (s?.name) sectionName = String(s.name);
            } catch {}
            const sanCourse = sanitizeSegment(courseName);
            const sanSection = sanitizeSegment(sectionName);
            const sanId = sanitizeSegment(normalizedId || (student as any).idnumber);
            const safeName = sanitizeSegment(String(fileName).toLowerCase());
            const baseId = `${sanCourse}/${sanSection}/${sanId}/REPORTS/${(student as any).id}_${safeName}_${Date.now()}`;
            const uploadRes = await cloudinary.uploader.upload(fileData, {
                public_id: baseId,
                resource_type: fileType && String(fileType).startsWith("image/") ? "image" : "raw",
                overwrite: false
            });
            uploadedFiles.push({
                name: fileName,
                type: fileType,
                url: uploadRes.secure_url,
                category: 'document',
                week: week
            });
        } catch (err) {
            console.error("Cloudinary upload error (doc):", err);
            return NextResponse.json({ error: "File upload failed" }, { status: 500 });
        }
    } else if (existingFileUrl) {
        uploadedFiles.push({
            name: fileName,
            type: fileType,
            url: existingFileUrl,
            category: 'document',
            week: week
        });
    }

    // 2. Photos
    if (photos && Array.isArray(photos)) {
        configureCloudinary();
        for (const p of photos) {
            if (p.data) {
                try {
                    let courseName = "UNKNOWN";
                    let sectionName = "UNKNOWN";
                    try {
                        const { data: c } = await admin.from("courses").select("name").eq("id", (student as any).course_id).maybeSingle();
                        if (c?.name) courseName = String(c.name);
                        const { data: s } = await admin.from("sections").select("name").eq("id", (student as any).section_id).maybeSingle();
                        if (s?.name) sectionName = String(s.name);
                    } catch {}
                    const sanCourse = sanitizeSegment(courseName);
                    const sanSection = sanitizeSegment(sectionName);
                    const sanId = sanitizeSegment(normalizedId || (student as any).idnumber);
                    const safeName = sanitizeSegment(String(p.name).toLowerCase());
                    const baseId = `${sanCourse}/${sanSection}/${sanId}/PHOTO_EVIDENCE/${(student as any).id}_${safeName}_${Date.now()}`;
                    const uploadRes = await cloudinary.uploader.upload(p.data, {
                        public_id: baseId,
                        resource_type: "image",
                        overwrite: false
                    });
                    uploadedFiles.push({
                        name: p.name,
                        type: p.type,
                        url: uploadRes.secure_url,
                        category: 'photo',
                        week: week
                    });
                } catch (err) {
                    console.error("Cloudinary upload error (photo):", err);
                    // Continue with other photos? or fail?
                    // Fail safer
                    return NextResponse.json({ error: "Photo upload failed" }, { status: 500 });
                }
            }
        }
    }

    // 3. Existing Photos
    if (existingPhotos && Array.isArray(existingPhotos)) {
        existingPhotos.forEach((p: any) => {
            uploadedFiles.push({
                name: p.name,
                type: p.type,
                url: p.url,
                category: 'photo',
                week: week
            });
        });
    }

    // Prepare DB Payload
    const dbPayload: any = {
        student_id: student.id,
        title: title || "(Untitled)",
        content: content, // JSON string
        files: uploadedFiles,
        status: isDraft ? 'draft' : 'submitted',
        school_year_id: syId,
        course_id: student.course_id,
        section_id: student.section_id,
        submitted_at: isDraft ? null : new Date().toISOString()
    };

    if (isDraft) {
        dbPayload.updated_at = new Date().toISOString();
    } else {
        // If submitting, we might want to set created_at if it's new, 
        // but 'created_at' is usually default now().
        // If updating a draft to submitted, we update status and submitted_at.
    }

    let result;
    if (id) {
        // Update existing report (draft)
        const { data, error } = await admin
            .from("reports")
            .update(dbPayload)
            .eq("id", id)
            .select()
            .single();
        
        if (error) throw error;
        result = data;
    } else {
        // Insert new
        const { data, error } = await admin
            .from("reports")
            .insert(dbPayload)
            .select()
            .single();
            
        if (error) throw error;
        result = data;
    }
    
    // Create Notification for Supervisor if Submitted
    if (!isDraft && result) {
        // Notify Supervisor
        if (student.supervisorid) {
             try {
                 // Fetch supervisor idnumber
                 const { data: supervisorData } = await admin
                    .from("users_supervisors")
                    .select("idnumber")
                    .eq("id", student.supervisorid)
                    .single();

                 if (supervisorData && supervisorData.idnumber) {
                    // Simplify student name retrieval to avoid TS errors with dynamic joins
                    const studentName = student.firstname || "Student"; 
                    
                    const msg = `New report submitted: ${title || "(Untitled)"}`;
                    const url = `/portal/supervisor?tab=reports&studentId=${student.id}`;

                    await sendPushNotification(supervisorData.idnumber, {
                        title: "New Report Submitted",
                        body: msg,
                        url: url,
                        tag: `report-submission-${result.id}`
                    });
                 }
             } catch (notifyError) {
                 console.error("Failed to notify supervisor:", notifyError);
             }
        }
        
        // Notify Coordinator? (Optional, based on requirement "notify supervisor")
    }

    return NextResponse.json({ success: true, report: result });

  } catch (e) {
    console.error("Unexpected error in POST /api/reports:", e);
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
