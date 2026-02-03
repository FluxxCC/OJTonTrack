-- Create table for storing Web Push Subscriptions
create table public.push_subscriptions (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null,
  idnumber text not null,
  role text not null default 'user'::text,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  constraint push_subscriptions_pkey primary key (id),
  constraint push_subscriptions_endpoint_key unique (endpoint)
);

-- Index for faster lookups by idnumber (used when sending notifications)
create index if not exists idx_push_subs_idnumber on public.push_subscriptions (idnumber);

-- RLS Policies (Optional but recommended)
alter table public.push_subscriptions enable row level security;

-- Allow users to insert/update their own subscriptions (if you implement RLS fully)
-- For now, the API uses Service Role (admin) so it bypasses RLS, but enabling it is good practice.
create policy "Enable insert for authenticated users only" on "public"."push_subscriptions"
as permissive for insert
to authenticated
with check (true);

create policy "Enable read for users based on idnumber" on "public"."push_subscriptions"
as permissive for select
to authenticated
using ((auth.uid() IS NOT NULL)); -- Simplified, ideally match auth.uid to idnumber map
