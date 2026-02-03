import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
    }
    const body = await req.json().catch(() => ({}));
    const idnumber = String(body?.idnumber || "").trim();
    const password = String(body?.password || "");
    const expectedRole = String(body?.expectedRole || "").trim().toLowerCase();
    const keepSignedIn = !!body?.keepSignedIn;

    if (!idnumber || !password) {
      return NextResponse.json({ error: "ID number and password are required" }, { status: 400 });
    }

    let tableName = "";
    let role = expectedRole;

    // Map role to table
    switch (expectedRole) {
      case "student":
        tableName = "users_students";
        break;
      case "coordinator":
        tableName = "users_coordinators";
        break;
      case "supervisor":
        tableName = "users_supervisors";
        break;
      case "instructor":
        tableName = "users_instructors";
        break;
      case "admin":
      case "superadmin":
        tableName = "users_super_admins";
        role = "superadmin"; // Normalize
        break;
      default:
        // If no role specified, we can't easily guess the table without trying all.
        // For now, require role or default to students if appropriate, but better to return error.
        return NextResponse.json({ error: "Role is required for login" }, { status: 400 });
    }

    // Build select query
    // Common fields
    let selectQuery = "id, idnumber, password, role, firstname, lastname, email, avatar_url";
    
    // Add specific fields based on table
    if (tableName === "users_students") {
      selectQuery += ", signup_status, email_verified, school_year_id";
    } else if (tableName === "users_coordinators" || tableName === "users_supervisors" || tableName === "users_instructors") {
      selectQuery += ", signup_status, email_verified"; // check schema if these have it
    }
    // super_admins might not have signup_status or email_verified in schema, let's check.
    // Schema says: super_admins has id, idnumber, email, password, firstname, lastname, role. No signup_status.

    const { data, error } = await admin
      .from(tableName)
      .select(selectQuery)
      .eq("idnumber", idnumber)
      .limit(1)
      .maybeSingle();

    if (error) {
      // If column doesn't exist (e.g. signup_status on super_admins), it might error.
      // But we are constructing query carefully.
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      // Check if user exists in other tables to give a helpful error
      const tables = [
        { name: "users_students", role: "student" },
        { name: "users_coordinators", role: "coordinator" },
        { name: "users_supervisors", role: "supervisor" },
        { name: "users_instructors", role: "instructor" },
        { name: "users_super_admins", role: "superadmin" }
      ];

      for (const t of tables) {
        if (t.name === tableName) continue; // Skip current table
        
        const { count } = await admin
          .from(t.name)
          .select("id", { count: "exact", head: true })
          .eq("idnumber", idnumber);
          
        if (count && count > 0) {
            let msg = `Account exists as ${t.role}. Please switch to the ${t.role} login.`;
            if (t.role === 'superadmin') {
               msg = `Account detected as Superadmin. Please login at /CiteSuperAdmin/Login`;
            }
            return NextResponse.json({ 
              error: msg
            }, { status: 400 });
         }
      }

      return NextResponse.json({ error: "Invalid ID number" }, { status: 404 });
    }

    // Password Verification Logic
    let passwordMatch = false;
    const storedPassword = String((data as any).password);
    
    // Check if stored password looks like a bcrypt hash
    if (storedPassword.startsWith("$2")) {
        passwordMatch = await bcrypt.compare(password, storedPassword);
    } else {
        // Fallback to plain text comparison
        if (storedPassword === password) {
            passwordMatch = true;
            // Auto-migrate to hashed password
            try {
                const hashedPassword = await bcrypt.hash(password, 10);
                await admin.from(tableName).update({ password: hashedPassword }).eq("id", (data as any).id);
                console.log(`Auto-migrated password for user ${(data as any).id} in ${tableName}`);
            } catch (err) {
                console.error("Failed to auto-migrate password:", err);
            }
        }
    }

    if (!passwordMatch) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }
    
    const normalizedRole = String((data as any).role || role).toLowerCase().replace(/[_\s]+/g, "");
    
    // Strict Role Enforcement (Double check)
    // The table query itself enforces role separation, but good to check data.role
    
    // Student Approval Check Only
    if (normalizedRole === 'student') {
      // Check if signup_status exists on the record
      const status = (data as any).signup_status || 'PENDING';
      if (status !== 'APPROVED' && status !== 'approved') { // Handle potential casing
         return NextResponse.json({ 
          error: "Account pending approval. Please contact your administrator." 
        }, { status: 403 });
      }
    }

    const res = NextResponse.json({
      user: {
        id: (data as any).id,
        idnumber: (data as any).idnumber,
        firstname: (data as any).firstname,
        lastname: (data as any).lastname,
        email: (data as any).email,
        role: normalizedRole, // Use normalized role
        school_year_id: (data as any).school_year_id // Only for students
      }
    });

    // Set cookies or session if needed
    // For now, client stores the user object. 
    // Usually we set a HttpOnly cookie here.

    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
