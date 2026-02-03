
// Hardcoded env for debug
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://urcpbzuohzitymnurpux.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_XOhlH7GpQlT3BY84UNcEmA_qc9zbw1s";

import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { setCoordinatorCourses, getCoordinatorCourses } from "@/lib/coordinator-courses";

async function main() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    console.error("Supabase admin not configured");
    return;
  }

  console.log("Searching for Charles Xander Panis...");
  const { data: users, error } = await admin
    .from("users_coordinators")
    .select("id, firstname, lastname")
    .ilike("firstname", "%Charles%")
    .ilike("lastname", "%Panis%");

  if (error) {
    console.error("Error searching user:", error);
    return;
  }

  if (!users || users.length === 0) {
    console.error("User Charles Xander Panis not found.");
    return;
  }

  const user = users[0];
  console.log(`Found User: ${user.firstname} ${user.lastname} (ID: ${user.id})`);

  console.log("Fetching courses...");
  const { data: courses, error: courseError } = await admin
    .from("courses")
    .select("id, name")
    .limit(3);

  if (courseError || !courses) {
    console.error("Error fetching courses:", courseError);
    return;
  }

  const courseIds = courses.map(c => c.id);
  const courseNames = courses.map(c => c.name);
  console.log(`Assigning courses: ${courseNames.join(", ")} (IDs: ${courseIds.join(", ")})`);

  setCoordinatorCourses(user.id, courseIds);

  const storedIds = getCoordinatorCourses(user.id);
  console.log(`Stored Course IDs for ${user.firstname}:`, storedIds);

  if (storedIds.length === courseIds.length) {
      console.log("SUCCESS: Courses assigned to Charles.");
  } else {
      console.log("FAILURE: Courses mismatch.");
  }
}

main().catch(console.error);
