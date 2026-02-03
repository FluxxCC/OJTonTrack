
-- 1. Fix Shifts Table Types (Text -> Time)
-- Ensures official times are treated as proper time objects
ALTER TABLE public.shifts 
  ALTER COLUMN official_start TYPE time without time zone USING official_start::time,
  ALTER COLUMN official_end TYPE time without time zone USING official_end::time;

-- 2. Create Ledger Table (if not exists)
CREATE TABLE IF NOT EXISTS public.validated_hours (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL PRIMARY KEY,
  student_id bigint NOT NULL REFERENCES public.users_students(id),
  date date NOT NULL,
  shift_id bigint NOT NULL REFERENCES public.shifts(id),
  school_year_id bigint REFERENCES public.school_years(id),
  hours numeric NOT NULL,
  validated_at timestamp with time zone DEFAULT now()
);

-- 3. Constraints (Unique Constraint for Upsert)
ALTER TABLE public.validated_hours 
DROP CONSTRAINT IF EXISTS validated_hours_student_date_shift_unique;

ALTER TABLE public.validated_hours 
ADD CONSTRAINT validated_hours_student_date_shift_unique UNIQUE (student_id, date, shift_id);

CREATE INDEX IF NOT EXISTS idx_validated_hours_student_date ON public.validated_hours(student_id, date);

-- 4. Populate Ledger (One-Time Migration)
-- Professional Migration: Prioritize validated_hours column, else recompute using Golden Rule
INSERT INTO public.validated_hours (student_id, date, shift_id, school_year_id, hours, validated_at)
SELECT DISTINCT ON (out_log.id)
  out_log.student_id,
  out_log.attendance_date,
  out_log.shift_id,
  out_log.school_year_id,
  -- Logic:
  -- 1. Use validated_hours column from attendance if exists and > 0
  -- 2. Else recompute: Overlap( (In, Out), (OfficialStart, OfficialEnd) )
  -- Note: We use Postgres arithmetic for intervals and timestamps
  COALESCE(
    NULLIF(out_log.validated_hours, 0),
    GREATEST(0, EXTRACT(EPOCH FROM (
      LEAST(out_log.logged_at, (out_log.attendance_date + s.official_end)::timestamp) - 
      GREATEST(in_log.logged_at, (out_log.attendance_date + s.official_start)::timestamp)
    )) / 3600.0)
  ) as hours,
  out_log.validated_at
FROM public.attendance out_log
JOIN public.shifts s ON out_log.shift_id = s.id
-- Find matching IN log (latest one before OUT)
LEFT JOIN public.attendance in_log ON 
  in_log.student_id = out_log.student_id AND 
  in_log.attendance_date = out_log.attendance_date AND
  in_log.type = 'in' AND
  in_log.logged_at < out_log.logged_at
WHERE 
  out_log.status IN ('VALIDATED', 'OFFICIAL', 'ADJUSTED', 'Approved', 'Official', 'Validated') 
  AND out_log.type = 'out' 
  AND out_log.shift_id IS NOT NULL
ORDER BY out_log.id, in_log.logged_at DESC
ON CONFLICT (student_id, date, shift_id) DO UPDATE
SET hours = EXCLUDED.hours;
