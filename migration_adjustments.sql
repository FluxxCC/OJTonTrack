-- 1. Create adjustment_history table
CREATE TABLE IF NOT EXISTS public.adjustment_history (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL PRIMARY KEY,
  validated_hours_id bigint NOT NULL REFERENCES public.validated_hours(id),
  previous_hours numeric NOT NULL,
  new_hours numeric NOT NULL,
  reason text,
  adjusted_by uuid NOT NULL REFERENCES auth.users(id),
  adjusted_at timestamp with time zone DEFAULT now()
);

-- 2. Grant permissions (if needed, usually handled by RLS, but basic grants here)
GRANT ALL ON public.adjustment_history TO authenticated;
GRANT ALL ON public.adjustment_history TO service_role;

-- 3. Policy: Supervisors can insert adjustments
ALTER TABLE public.adjustment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supervisors can insert adjustments" ON public.adjustment_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users_supervisors
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Everyone can read adjustments" ON public.adjustment_history
  FOR SELECT USING (true);
