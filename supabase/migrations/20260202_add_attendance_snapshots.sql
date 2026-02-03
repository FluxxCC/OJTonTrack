
-- Migration to add snapshot columns to attendance table
-- Run this in your Supabase SQL Editor

ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS official_time_in TEXT,
ADD COLUMN IF NOT EXISTS official_time_out TEXT;

-- Note: shift_id already exists in the table.
