# Critical Database Update Required

The "Attendance Ledger" system requires new columns in your database to freeze attendance rules. The error you are seeing (`Could not find the 'official_time_in' column...`) confirms these columns are missing.

Please execute the following SQL command in your **Supabase Dashboard > SQL Editor** immediately:

```sql
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS official_time_in TEXT,
ADD COLUMN IF NOT EXISTS official_time_out TEXT;

-- Verify shift_id exists (it should, but just in case)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'shift_id') THEN
        ALTER TABLE attendance ADD COLUMN shift_id UUID REFERENCES shifts(id);
    END IF;
END $$;
```

After running this, the error will resolve, and the attendance engine will start freezing rules for all new records.
