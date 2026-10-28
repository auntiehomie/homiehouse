-- Supabase RLS (Row-Level Security) Setup
-- Run this script in Supabase SQL Editor: https://app.supabase.com → Project → SQL Editor
-- This enables RLS on all tables and creates policies for user-owned data

-- ============================================================================
-- 1. Enable RLS on all tables
-- ============================================================================

ALTER TABLE curated_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE curated_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_casts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. Drop any existing permissive policies (clean slate)
-- ============================================================================

DROP POLICY IF EXISTS "Enable all for anon" ON curated_lists;
DROP POLICY IF EXISTS "Enable all for anon" ON curated_list_items;
DROP POLICY IF EXISTS "Enable all for anon" ON scheduled_casts;

-- Drop any other existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public read access" ON curated_lists;
DROP POLICY IF EXISTS "Public read access" ON curated_list_items;
DROP POLICY IF EXISTS "Public read access" ON scheduled_casts;

-- ============================================================================
-- 3. Policies for curated_lists table
-- ============================================================================

CREATE POLICY "Users can read own lists"
  ON curated_lists FOR SELECT
  USING (auth.uid()::text = fid::text);

CREATE POLICY "Users can create own lists"
  ON curated_lists FOR INSERT
  WITH CHECK (auth.uid()::text = fid::text);

CREATE POLICY "Users can update own lists"
  ON curated_lists FOR UPDATE
  USING (auth.uid()::text = fid::text);

CREATE POLICY "Users can delete own lists"
  ON curated_lists FOR DELETE
  USING (auth.uid()::text = fid::text);

-- ============================================================================
-- 4. Policies for scheduled_casts table
-- ============================================================================

CREATE POLICY "Users can read own casts"
  ON scheduled_casts FOR SELECT
  USING (auth.uid()::text = user_fid::text);

CREATE POLICY "Users can create own casts"
  ON scheduled_casts FOR INSERT
  WITH CHECK (auth.uid()::text = user_fid::text);

CREATE POLICY "Users can update own casts"
  ON scheduled_casts FOR UPDATE
  USING (auth.uid()::text = user_fid::text);

CREATE POLICY "Users can delete own casts"
  ON scheduled_casts FOR DELETE
  USING (auth.uid()::text = user_fid::text);

-- ============================================================================
-- 5. Policies for curated_list_items table
-- ============================================================================

CREATE POLICY "Users can manage items in own lists"
  ON curated_list_items FOR ALL
  USING (
    list_id IN (
      SELECT id FROM curated_lists WHERE auth.uid()::text = fid::text
    )
  );

-- ============================================================================
-- Verification queries (run these after policies are created)
-- ============================================================================

-- Check that RLS is enabled on all tables:
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('curated_lists', 'curated_list_items', 'scheduled_casts');

-- List all policies on a table:
-- SELECT * FROM pg_policies WHERE tablename = 'curated_lists';
