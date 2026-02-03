-- Migration to fix report_requirements schema
-- We want to ensure we have course_id/section_id (nullable) and NO course/section text columns.

-- 1. If course_id exists (as confirmed), make it nullable
ALTER TABLE public.report_requirements ALTER COLUMN course_id DROP NOT NULL;

-- 2. If section_id exists (as confirmed), make it nullable
ALTER TABLE public.report_requirements ALTER COLUMN section_id DROP NOT NULL;

-- 3. Drop unique index if it exists (old one)
DROP INDEX IF EXISTS public.report_requirements_unique_idx;

-- 4. Create proper unique index for IDs
CREATE UNIQUE INDEX IF NOT EXISTS report_requirements_unique_ids_idx 
ON public.report_requirements (
    COALESCE(course_id, -1), 
    COALESCE(section_id, -1), 
    week_number
);
