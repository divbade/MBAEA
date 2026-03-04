-- MBAEA Seed Data
-- Run after migrations to populate demo data
-- NOTE: Replace 'DEMO_USER_ID' with an actual user UUID after first sign-in

-- This seed script is designed to be run after a real user signs in.
-- You can get your user ID from Supabase Auth dashboard, then run:
-- UPDATE the DEMO_USER_ID below with your real auth.users ID

-- For demo, we'll use a placeholder that you replace:
DO $$
DECLARE
  demo_user_id UUID;
BEGIN
  -- Get the first user in the system (if any)
  SELECT id INTO demo_user_id FROM auth.users LIMIT 1;

  IF demo_user_id IS NULL THEN
    RAISE NOTICE 'No users found. Sign in first, then run this seed script.';
    RETURN;
  END IF;

  -- Ensure profile exists
  INSERT INTO profiles (id, display_name, onboarded)
  VALUES (demo_user_id, 'Demo User', true)
  ON CONFLICT (id) DO UPDATE SET onboarded = true;

  -- Create preferences
  INSERT INTO preferences (user_id, timezone, work_start, work_end, max_commitments_per_day, focus_block_mins, goal_weights)
  VALUES (
    demo_user_id,
    'America/Los_Angeles',
    '08:00',
    '18:00',
    6,
    90,
    '{"recruiting": 4, "academics": 3, "health": 3, "relationships": 2, "clubs": 2, "admin": 1}'::jsonb
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Insert demo candidate items
  INSERT INTO candidate_items (user_id, source, raw_text, extracted_json, status) VALUES
  (
    demo_user_id, 'MANUAL',
    'Coffee chat with McKinsey recruiter Friday 3pm at Blue Bottle',
    '{
      "title": "Coffee chat with McKinsey recruiter",
      "type": "meeting",
      "required_action": "attend",
      "start_at": "2026-03-06T15:00:00-08:00",
      "end_at": "2026-03-06T16:00:00-08:00",
      "duration_mins": 60,
      "prep_mins": 30,
      "goal_tags": ["recruiting"],
      "commitment_strength": "confirmed",
      "confidence": 0.95,
      "rationale": "Networking meeting with consulting firm recruiter. High priority for recruiting goals."
    }'::jsonb,
    'NEW'
  ),
  (
    demo_user_id, 'MANUAL',
    'Strategy case study due next Wednesday',
    '{
      "title": "Strategy case study submission",
      "type": "deadline",
      "required_action": "submit",
      "due_at": "2026-03-11T23:59:00-08:00",
      "duration_mins": 180,
      "goal_tags": ["academics"],
      "commitment_strength": "confirmed",
      "confidence": 0.9,
      "rationale": "Academic deadline. Requires significant preparation time."
    }'::jsonb,
    'NEW'
  ),
  (
    demo_user_id, 'MANUAL',
    'Gym workout Tuesday and Thursday mornings 7am',
    '{
      "title": "Gym workout",
      "type": "task",
      "required_action": "attend",
      "start_at": "2026-03-10T07:00:00-08:00",
      "end_at": "2026-03-10T08:00:00-08:00",
      "duration_mins": 60,
      "goal_tags": ["health"],
      "commitment_strength": "soft",
      "confidence": 0.7,
      "rationale": "Recurring health commitment. Flexible scheduling."
    }'::jsonb,
    'NEW'
  ),
  (
    demo_user_id, 'MANUAL',
    'MBA Tech Club board meeting Monday 6pm',
    '{
      "title": "MBA Tech Club board meeting",
      "type": "meeting",
      "required_action": "attend",
      "start_at": "2026-03-09T18:00:00-08:00",
      "end_at": "2026-03-09T19:30:00-08:00",
      "duration_mins": 90,
      "goal_tags": ["clubs"],
      "commitment_strength": "confirmed",
      "confidence": 0.85,
      "rationale": "Board meeting for extracurricular leadership position."
    }'::jsonb,
    'NEW'
  ),
  (
    demo_user_id, 'MANUAL',
    'Reply to professor about research assistant position by Thursday',
    '{
      "title": "Reply to professor re: RA position",
      "type": "task",
      "required_action": "reply",
      "due_at": "2026-03-12T17:00:00-08:00",
      "duration_mins": 30,
      "goal_tags": ["academics", "recruiting"],
      "commitment_strength": "likely",
      "confidence": 0.8,
      "rationale": "Follow-up on academic/career opportunity. Medium urgency."
    }'::jsonb,
    'NEW'
  );

  RAISE NOTICE 'Seed data inserted for user %', demo_user_id;
END;
$$;
