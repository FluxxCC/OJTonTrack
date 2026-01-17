-- Create system_audit_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.system_audit_logs (
   id bigint GENERATED ALWAYS AS IDENTITY NOT NULL, 
   actor_idnumber text NOT NULL, 
   actor_role text NOT NULL, 
   action text NOT NULL, 
   target_table text NOT NULL, 
   target_id bigint NOT NULL, 
   before_data jsonb, 
   after_data jsonb, 
   reason text, 
   created_at timestamp with time zone DEFAULT now(), 
   CONSTRAINT system_audit_logs_pkey PRIMARY KEY (id) 
);

-- Enable RLS
ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow read access to superadmins (assuming you have policies or service role bypass)
-- For simplicity in this setup script, we'll allow all service role operations.
-- Adjust policies as needed for your auth setup.

-- Example policy:
-- CREATE POLICY "Enable read access for superadmins" ON "public"."system_audit_logs"
-- AS PERMISSIVE FOR SELECT
-- TO authenticated
-- USING (auth.jwt() ->> 'role' = 'superadmin');
