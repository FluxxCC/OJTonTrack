-- Enable RLS on the notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure a clean slate
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Student update own notifications" ON public.notifications;

-- Create a policy to allow users to VIEW their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (
  -- Check if the user is a student
  (recipient_role = 'student' AND recipient_id IN (
    SELECT id FROM public.users_students WHERE email = (auth.jwt() ->> 'email')
  ))
  OR
  -- Check if the user is a supervisor
  (recipient_role = 'supervisor' AND recipient_id IN (
    SELECT id FROM public.users_supervisors WHERE email = (auth.jwt() ->> 'email')
  ))
  OR
  -- Check if the user is a coordinator
  (recipient_role = 'coordinator' AND recipient_id IN (
    SELECT id FROM public.users_coordinators WHERE email = (auth.jwt() ->> 'email')
  ))
);

-- Create a policy to allow users to UPDATE (mark as read) their own notifications
CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (
  (recipient_role = 'student' AND recipient_id IN (
    SELECT id FROM public.users_students WHERE email = (auth.jwt() ->> 'email')
  ))
  OR
  (recipient_role = 'supervisor' AND recipient_id IN (
    SELECT id FROM public.users_supervisors WHERE email = (auth.jwt() ->> 'email')
  ))
  OR
  (recipient_role = 'coordinator' AND recipient_id IN (
    SELECT id FROM public.users_coordinators WHERE email = (auth.jwt() ->> 'email')
  ))
)
WITH CHECK (
  (recipient_role = 'student' AND recipient_id IN (
    SELECT id FROM public.users_students WHERE email = (auth.jwt() ->> 'email')
  ))
  OR
  (recipient_role = 'supervisor' AND recipient_id IN (
    SELECT id FROM public.users_supervisors WHERE email = (auth.jwt() ->> 'email')
  ))
  OR
  (recipient_role = 'coordinator' AND recipient_id IN (
    SELECT id FROM public.users_coordinators WHERE email = (auth.jwt() ->> 'email')
  ))
);
