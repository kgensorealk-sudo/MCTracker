# Developer Guide: Database Setup

This application uses Supabase for the backend database and authentication. To set up the database, you need to run the following SQL script in your Supabase project's SQL Editor.

## SQL Schema

Copy and paste the code below into the **Supabase Dashboard > SQL Editor**, then click **Run**.

```sql
-- 1. Manuscripts Table (Core Data)
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
  issue_types TEXT[] DEFAULT '{}',
  notes JSONB DEFAULT '[]'
);

ALTER TABLE manuscripts ENABLE ROW LEVEL SECURITY;

-- Cleanup old individual policies if they exist
DROP POLICY IF EXISTS "Users can view own manuscripts" ON manuscripts;
DROP POLICY IF EXISTS "Users can insert own manuscripts" ON manuscripts;
DROP POLICY IF EXISTS "Users can update own manuscripts" ON manuscripts;
DROP POLICY IF EXISTS "Users can delete own manuscripts" ON manuscripts;

-- Create/Update consolidated policy
DROP POLICY IF EXISTS "Users can manage own manuscripts" ON manuscripts;
CREATE POLICY "Users can manage own manuscripts" ON manuscripts FOR ALL USING ( auth.uid() = user_id );

-- 2. User Settings (Targets)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  target_per_cycle INTEGER DEFAULT 50,
  days_off TEXT[] DEFAULT '{}'
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Cleanup old individual policies if they exist
DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;

-- Create/Update consolidated policy
DROP POLICY IF EXISTS "Users can manage own settings" ON user_settings;
CREATE POLICY "Users can manage own settings" ON user_settings FOR ALL USING ( auth.uid() = user_id );

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_manuscripts_user_updated ON manuscripts (user_id, date_updated DESC);
```

## Environment Variables

Ensure your project has a `.env` file (or environment variables configured in your deployment platform) with the following keys:

```
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Troubleshooting: "Email not confirmed" Error

By default, Supabase requires users to verify their email address before they can sign in. If you want to bypass this for development:

1.  Go to your **Supabase Dashboard**.
2.  Navigate to **Authentication** (in the left sidebar) > **Providers**.
3.  Click on **Email**.
4.  **Toggle OFF** "Confirm email".
5.  Click **Save**.