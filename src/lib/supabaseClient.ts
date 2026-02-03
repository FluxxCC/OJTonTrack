import { createClient } from "@supabase/supabase-js";

const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const publicAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

export const supabase = publicUrl && publicAnon ? createClient(publicUrl, publicAnon) : null;

export function getSupabaseAdmin() {
  if (typeof window !== "undefined") {
    throw new Error("supabaseAdmin is server-only");
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  
  // Debug log (remove in production)
  if (!serviceKey) {
      console.warn("getSupabaseAdmin: SUPABASE_SERVICE_ROLE_KEY is missing, falling back to anon key (will fail for admin tasks).");
  } else {
      console.log("getSupabaseAdmin: URL:", publicUrl);
      console.log("getSupabaseAdmin: Key Prefix:", serviceKey.substring(0, 15), "Length:", serviceKey.length);
  }

  if (publicUrl && serviceKey) {
    return createClient(publicUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  if (publicUrl && publicAnon) {
    return createClient(publicUrl, publicAnon);
  }
  return null;
}
