-- fix-hh2-constraint.sql
-- Add a unique constraint to hh2_purchases to prevent duplicate purchases at
-- the database level (defense-in-depth alongside application-level advisory lock).
--
-- Run: psql $DATABASE_URL -f scripts/fix-hh2-constraint.sql

-- Add the unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hh2_purchases_user_fid_item_id_key'
      AND conrelid = 'hh2_purchases'::regclass
  ) THEN
    ALTER TABLE hh2_purchases
      ADD CONSTRAINT hh2_purchases_user_fid_item_id_key
      UNIQUE (user_fid, item_id);
  END IF;
END $$;