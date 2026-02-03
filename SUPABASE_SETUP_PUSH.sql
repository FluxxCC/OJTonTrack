-- Create table for push subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    idnumber text NOT NULL,
    role text NOT NULL,
    endpoint text NOT NULL UNIQUE,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS push_subscriptions_idnumber_idx ON public.push_subscriptions(idnumber);

-- RLS Policies (Optional, but good practice if RLS is enabled)
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow insert/select/delete for anon (since we handle auth manually via API for now, or use service role)
-- Ideally, this should be restricted, but for the API route to work without service role it needs access.
-- However, we use getSupabaseAdmin() in the API routes, so RLS doesn't apply to the API.
-- We can leave RLS enabled but with no policies (deny all by default) to prevent client-side access.
