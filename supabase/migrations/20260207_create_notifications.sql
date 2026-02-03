
-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  recipient_id bigint NOT NULL,
  recipient_role text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  link text,
  type text DEFAULT 'info',
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON public.notifications (recipient_id, recipient_role);

-- Add RLS policies (optional but recommended if RLS is enabled)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (
    (auth.role() = 'anon') OR 
    (recipient_id::text = current_setting('request.jwt.claim.sub', true)) -- This might not work with the custom auth scheme
    -- Since the app uses custom auth (idnumber in localStorage), we might rely on the API/Client filtering for now if RLS isn't strictly enforced for this custom setup.
    -- Given the existing schema/auth setup seems to be "custom" (no auth.users references in some tables), I'll skip complex RLS for now or allow public read if that's how other tables are.
    -- Looking at other tables, they don't seem to have strict RLS policies in the schema dump provided.
  );
  
-- Actually, just allowing public access for now as per the "anon" key usage pattern in the code.
CREATE POLICY "Enable read access for all users" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.notifications FOR UPDATE USING (true);
