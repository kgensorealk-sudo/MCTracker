-- MASTERCOPY TRACKER SCHEMA
-- Run this script in your Supabase SQL Editor to set up the database.

-- 1. MANUSCRIPTS TABLE
CREATE TABLE IF NOT EXISTS manuscripts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  manuscript_id TEXT NOT NULL,
  journal_code TEXT NOT NULL,
  status TEXT DEFAULT 'UNTOUCHED',
  priority TEXT DEFAULT 'Normal',
  date_received TIMESTAMPTZ DEFAULT now(),
  due_date TIMESTAMPTZ,
  completed_date TIMESTAMPTZ,
  date_updated TIMESTAMPTZ DEFAULT now(),
  date_status_changed TIMESTAMPTZ DEFAULT now(),
  notes JSONB DEFAULT '[]'
);

-- MIGRATION: Safely add new columns if they are missing
ALTER TABLE manuscripts ADD COLUMN IF NOT EXISTS query_reason TEXT;
ALTER TABLE manuscripts ADD COLUMN IF NOT EXISTS date_queried TIMESTAMPTZ;
ALTER TABLE manuscripts ADD COLUMN IF NOT EXISTS date_emailed TIMESTAMPTZ;
ALTER TABLE manuscripts ADD COLUMN IF NOT EXISTS billed_date TIMESTAMPTZ;
ALTER TABLE manuscripts ADD COLUMN IF NOT EXISTS pending_flags JSONB DEFAULT '{"jm":false,"tl":false,"ced":false}';

-- Security Policies
ALTER TABLE manuscripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own manuscripts" ON manuscripts;
CREATE POLICY "Users can manage own manuscripts" ON manuscripts FOR ALL USING ( auth.uid() = user_id );

-- 2. USER SETTINGS TABLE
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  target_per_cycle INTEGER DEFAULT 50,
  days_off TEXT[] DEFAULT '{}'
);

-- MIGRATION: Safely add new columns for Smart Pacing
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS weekly_weights JSONB DEFAULT '[1, 1, 1, 1, 1, 1, 1]';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS exclude_weekends BOOLEAN DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS legacy_xp INTEGER DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS legacy_achievement_xp INTEGER DEFAULT 0;

-- Security Policies
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own settings" ON user_settings;
CREATE POLICY "Users can manage own settings" ON user_settings FOR ALL USING ( auth.uid() = user_id );

-- 3. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_manuscripts_user_updated ON manuscripts (user_id, date_updated DESC);
