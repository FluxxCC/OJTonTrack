-- DROP deprecated columns from attendance table
-- RUN THIS ONLY AFTER verifying data in validated_hours table
ALTER TABLE public.attendance 
  DROP COLUMN IF EXISTS rendered_hours,
  DROP COLUMN IF EXISTS validated_hours,
  DROP COLUMN IF EXISTS official_time_in,
  DROP COLUMN IF EXISTS official_time_out;
