import { getSupabaseAdmin } from "./supabaseClient";

export async function getActiveSchoolYearId(adminClient?: any) {
  const supabase = adminClient || getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("school_years")
    .select("id")
    .eq("is_active", true)
    .single();

  if (error || !data) {
    return null;
  }

  return data.id;
}
