-- MBAEA Schema Migration
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'User',
  avatar_url TEXT,
  onboarded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================
-- PREFERENCES
-- ============================================
CREATE TABLE IF NOT EXISTS preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  work_start TIME NOT NULL DEFAULT '08:00',
  work_end TIME NOT NULL DEFAULT '18:00',
  max_commitments_per_day INTEGER NOT NULL DEFAULT 6,
  focus_block_mins INTEGER NOT NULL DEFAULT 90,
  goal_weights JSONB NOT NULL DEFAULT '{"recruiting": 3, "academics": 3, "health": 2, "relationships": 2, "clubs": 1, "admin": 1}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- CANDIDATE ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS candidate_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('MANUAL', 'CALENDAR', 'GMAIL')),
  raw_text TEXT NOT NULL,
  extracted_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'ACCEPTED', 'DISMISSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE candidate_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own candidates"
  ON candidate_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own candidates"
  ON candidate_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own candidates"
  ON candidate_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own candidates"
  ON candidate_items FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- COMMITMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS commitments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  candidate_item_id UUID REFERENCES candidate_items(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('meeting', 'deadline', 'task', 'invite', 'fyi')),
  required_action TEXT NOT NULL CHECK (required_action IN ('attend', 'reply', 'submit', 'prepare', 'follow_up', 'schedule')),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  duration_mins INTEGER,
  prep_mins INTEGER,
  goal_tags TEXT[] NOT NULL DEFAULT '{}',
  commitment_strength TEXT NOT NULL DEFAULT 'likely' CHECK (commitment_strength IN ('FYI', 'soft', 'likely', 'confirmed')),
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own commitments"
  ON commitments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own commitments"
  ON commitments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own commitments"
  ON commitments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own commitments"
  ON commitments FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- PLANS
-- ============================================
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  plan_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPLIED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plans"
  ON plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plans"
  ON plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plans"
  ON plans FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- FEEDBACK
-- ============================================
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('CANDIDATE', 'PLAN_BLOCK')),
  ref_id UUID NOT NULL,
  thumbs INTEGER NOT NULL CHECK (thumbs IN (1, -1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feedback"
  ON feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback"
  ON feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- GOOGLE TOKENS (server-access only)
-- ============================================
CREATE TABLE IF NOT EXISTS google_tokens (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}'
);

-- NO client-side RLS policies!
-- Only service_role key can access this table.
ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;

-- No policies = no access from client (anon/authenticated roles).
-- Service role key bypasses RLS, so server-side code works fine.

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_candidate_items_user_status ON candidate_items(user_id, status);
CREATE INDEX IF NOT EXISTS idx_commitments_user ON commitments(user_id);
CREATE INDEX IF NOT EXISTS idx_plans_user_week ON plans(user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);

-- ============================================
-- FUNCTION: auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_preferences_updated_at
  BEFORE UPDATE ON preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
