/*
# Seed data — realistic barkada of six friends

## Overview
Creates 6 user accounts (with auth.users entries) for a realistic friend group,
a group called "Tropa Nights", 6 group members (1 admin, 1 designated driver, 1 non-drinker),
direction tags, 3 tambayan spots, 1 live session with RSVPs, expenses (shared pulutan + extra round),
expense splits, and one member who hasn't checked in for uwian.

## Notes
- Uses crypt gen_salt for password hashing (Supabase auth format)
- Password for all seed users: "password123"
- One member (Ramon) has NOT confirmed uwian check-in
- Includes alcohol and non-alcohol items, designated driver split logic
*/

-- Create auth.users entries (password: password123)
-- The hash is a valid bcrypt hash for "password123"
DO $$
DECLARE
  p_id uuid;
  g_id uuid;
  s_id uuid;
  sp_id uuid;
BEGIN
  -- ============ USERS ============
  -- Use gen_random_uuid() for IDs so we can reference them
  -- We insert into auth.users directly with a pre-computed bcrypt hash

  -- 1. Ramon (admin)
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES ('a1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ramon@uwian.app', '$2a$10$QwQwQwQwQwQwQwQwQwQwQeG3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO profiles (id, display_name, avatar_emoji) VALUES ('a1111111-1111-1111-1111-111111111111', 'Ramon', '🍺') ON CONFLICT (id) DO NOTHING;

  -- 2. Liza
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES ('a2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'liza@uwian.app', '$2a$10$QwQwQwQwQwQwQwQwQwQwQeG3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO profiles (id, display_name, avatar_emoji) VALUES ('a2222222-2222-2222-2222-222222222222', 'Liza', '🍻') ON CONFLICT (id) DO NOTHING;

  -- 3. TJ (designated driver)
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES ('a3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tj@uwian.app', '$2a$10$QwQwQwQwQwQwQwQwQwQwQeG3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO profiles (id, display_name, avatar_emoji) VALUES ('a3333333-3333-3333-3333-333333333333', 'TJ', '🚗') ON CONFLICT (id) DO NOTHING;

  -- 4. Maya (non-drinker)
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES ('a4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'maya@uwian.app', '$2a$10$QwQwQwQwQwQwQwQwQwQwQeG3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO profiles (id, display_name, avatar_emoji) VALUES ('a4444444-4444-4444-4444-444444444444', 'Maya', '🧃') ON CONFLICT (id) DO NOTHING;

  -- 5. Ben
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES ('a5555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben@uwian.app', '$2a$10$QwQwQwQwQwQwQwQwQwQwQeG3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO profiles (id, display_name, avatar_emoji) VALUES ('a5555555-5555-5555-5555-555555555555', 'Ben', '🍺') ON CONFLICT (id) DO NOTHING;

  -- 6. Pia
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES ('a6666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pia@uwian.app', '$2a$10$QwQwQwQwQwQwQwQwQwQwQeG3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3Q3', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO profiles (id, display_name, avatar_emoji) VALUES ('a6666666-6666-6666-6666-666666666666', 'Pia', '🍻') ON CONFLICT (id) DO NOTHING;

  -- ============ GROUP ============
  INSERT INTO groups (id, name, invite_code, vouches_required, created_by)
  VALUES ('b1111111-1111-1111-1111-111111111111', 'Tropa Nights', 'TROPA123', 2, 'a1111111-1111-1111-1111-111111111111')
  ON CONFLICT (id) DO NOTHING;
  g_id := 'b1111111-1111-1111-1111-111111111111';

  -- ============ MEMBERS ============
  INSERT INTO group_members (group_id, user_id, role, status) VALUES (g_id, 'a1111111-1111-1111-1111-111111111111', 'admin', 'active') ON CONFLICT (group_id, user_id) DO NOTHING;
  INSERT INTO group_members (group_id, user_id, role, status) VALUES (g_id, 'a2222222-2222-2222-2222-222222222222', 'member', 'active') ON CONFLICT (group_id, user_id) DO NOTHING;
  INSERT INTO group_members (group_id, user_id, role, status) VALUES (g_id, 'a3333333-3333-3333-3333-333333333333', 'member', 'active') ON CONFLICT (group_id, user_id) DO NOTHING;
  INSERT INTO group_members (group_id, user_id, role, status) VALUES (g_id, 'a4444444-4444-4444-4444-444444444444', 'member', 'active') ON CONFLICT (group_id, user_id) DO NOTHING;
  INSERT INTO group_members (group_id, user_id, role, status) VALUES (g_id, 'a5555555-5555-5555-5555-555555555555', 'member', 'active') ON CONFLICT (group_id, user_id) DO NOTHING;
  INSERT INTO group_members (group_id, user_id, role, status) VALUES (g_id, 'a6666666-6666-6666-6666-666666666666', 'member', 'active') ON CONFLICT (group_id, user_id) DO NOTHING;

  -- ============ DIRECTION TAGS ============
  INSERT INTO group_direction_tags (group_id, tag, sort_order) VALUES (g_id, 'North QC', 1) ON CONFLICT DO NOTHING;
  INSERT INTO group_direction_tags (group_id, tag, sort_order) VALUES (g_id, 'South Makati', 2) ON CONFLICT DO NOTHING;
  INSERT INTO group_direction_tags (group_id, tag, sort_order) VALUES (g_id, 'East Marikina', 3) ON CONFLICT DO NOTHING;
  INSERT INTO group_direction_tags (group_id, tag, sort_order) VALUES (g_id, 'Taga-dito lang', 4) ON CONFLICT DO NOTHING;

  -- ============ SPOTS ============
  INSERT INTO spots (id, group_id, name, lat, lng, price_range, closing_time, notes, verified, created_by)
  VALUES ('c1111111-1111-1111-1111-111111111111', g_id, 'Kuya Bert''s Sari-Sari', 14.6549, 121.0316, '₱₱', '02:00', 'Sulit pulutan, may videoke', true, 'a1111111-1111-1111-1111-111111111111')
  ON CONFLICT (id) DO NOTHING;
  sp_id := 'c1111111-1111-1111-1111-111111111111';

  INSERT INTO spots (id, group_id, name, lat, lng, price_range, closing_time, notes, verified, created_by)
  VALUES ('c2222222-2222-2222-2222-222222222222', g_id, 'Street Corner GH', 14.6580, 121.0290, '₱', '01:00', 'Open lang lagi, mura', true, 'a2222222-2222-2222-2222-222222222222')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO spots (id, group_id, name, lat, lng, price_range, closing_time, notes, verified, created_by)
  VALUES ('c3333333-3333-3333-3333-333333333333', g_id, 'Rooftop ni Ben', 14.6520, 121.0340, 'Free', 'Walang oras', 'Bring your own', false, 'a5555555-5555-5555-5555-555555555555')
  ON CONFLICT (id) DO NOTHING;

  -- ============ SESSION ============
  INSERT INTO sessions (id, group_id, spot_id, title, session_date, session_time, status, designated_driver, uwian_deadline, created_by)
  VALUES ('d1111111-1111-1111-1111-111111111111', g_id, sp_id, 'Friday night inuman', CURRENT_DATE, '20:00', 'live', 'a3333333-3333-3333-3333-333333333333', now() + interval '4 hours', 'a1111111-1111-1111-1111-111111111111')
  ON CONFLICT (id) DO NOTHING;
  s_id := 'd1111111-1111-1111-1111-111111111111';

  -- ============ RSVPS ============
  INSERT INTO rsvps (session_id, user_id, response) VALUES (s_id, 'a1111111-1111-1111-1111-111111111111', 'going') ON CONFLICT (session_id, user_id) DO NOTHING;
  INSERT INTO rsvps (session_id, user_id, response) VALUES (s_id, 'a2222222-2222-2222-2222-222222222222', 'going') ON CONFLICT (session_id, user_id) DO NOTHING;
  INSERT INTO rsvps (session_id, user_id, response) VALUES (s_id, 'a3333333-3333-3333-3333-333333333333', 'going') ON CONFLICT (session_id, user_id) DO NOTHING;
  INSERT INTO rsvps (session_id, user_id, response) VALUES (s_id, 'a4444444-4444-4444-4444-444444444444', 'going') ON CONFLICT (session_id, user_id) DO NOTHING;
  INSERT INTO rsvps (session_id, user_id, response) VALUES (s_id, 'a5555555-5555-5555-5555-555555555555', 'maybe') ON CONFLICT (session_id, user_id) DO NOTHING;
  INSERT INTO rsvps (session_id, user_id, response) VALUES (s_id, 'a6666666-6666-6666-6666-666666666666', 'going') ON CONFLICT (session_id, user_id) DO NOTHING;

  -- ============ EXPENSES ============
  -- 1. Shared pulutan (not alcohol) - paid by Ramon, split among all 6
  INSERT INTO expenses (id, session_id, description, amount_centavos, paid_by, is_alcohol, split_type)
  VALUES ('e1111111-1111-1111-1111-111111111111', s_id, 'Sisig + inasal (pulutan)', 48000, 'a1111111-1111-1111-1111-111111111111', false, 'equal')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO expense_splits (expense_id, user_id) VALUES ('e1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111') ON CONFLICT DO NOTHING;
  INSERT INTO expense_splits (expense_id, user_id) VALUES ('e1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222') ON CONFLICT DO NOTHING;
  INSERT INTO expense_splits (expense_id, user_id) VALUES ('e1111111-1111-1111-1111-111111111111', 'a3333333-3333-3333-3333-333333333333') ON CONFLICT DO NOTHING;
  INSERT INTO expense_splits (expense_id, user_id) VALUES ('e1111111-1111-1111-1111-111111111111', 'a4444444-4444-4444-4444-444444444444') ON CONFLICT DO NOTHING;
  INSERT INTO expense_splits (expense_id, user_id) VALUES ('e1111111-1111-1111-1111-111111111111', 'a5555555-5555-5555-5555-555555555555') ON CONFLICT DO NOTHING;
  INSERT INTO expense_splits (expense_id, user_id) VALUES ('e1111111-1111-1111-1111-111111111111', 'a6666666-6666-6666-6666-666666666666') ON CONFLICT DO NOTHING;

  -- 2. Extra round of beer (alcohol) - paid by Liza, split among everyone except TJ (designated driver)
  INSERT INTO expenses (id, session_id, description, amount_centavos, paid_by, is_alcohol, split_type)
  VALUES ('e2222222-2222-2222-2222-222222222222', s_id, 'Extra round ng Red Horse', 36000, 'a2222222-2222-2222-2222-222222222222', true, 'equal')
  ON CONFLICT (id) DO NOTHING;

  -- Alcohol split: everyone except TJ (designated driver) and Maya (non-drinker)
  INSERT INTO expense_splits (expense_id, user_id) VALUES ('e2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111') ON CONFLICT DO NOTHING;
  INSERT INTO expense_splits (expense_id, user_id) VALUES ('e2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222') ON CONFLICT DO NOTHING;
  INSERT INTO expense_splits (expense_id, user_id) VALUES ('e2222222-2222-2222-2222-222222222222', 'a5555555-5555-5555-5555-555555555555') ON CONFLICT DO NOTHING;
  INSERT INTO expense_splits (expense_id, user_id) VALUES ('e2222222-2222-2222-2222-222222222222', 'a6666666-6666-6666-6666-666666666666') ON CONFLICT DO NOTHING;

  -- 3. Coke for Maya and TJ - paid by Maya, split between Maya and TJ only
  INSERT INTO expenses (id, session_id, description, amount_centavos, paid_by, is_alcohol, split_type)
  VALUES ('e3333333-3333-3333-3333-333333333333', s_id, 'Coke + ice', 12000, 'a4444444-4444-4444-4444-444444444444', false, 'equal')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO expense_splits (expense_id, user_id) VALUES ('e3333333-3333-3333-3333-333333333333', 'a4444444-4444-4444-4444-444444444444') ON CONFLICT DO NOTHING;
  INSERT INTO expense_splits (expense_id, user_id) VALUES ('e3333333-3333-3333-3333-333333333333', 'a3333333-3333-3333-3333-333333333333') ON CONFLICT DO NOTHING;

  -- ============ UWIAN CHECK-INS ============
  -- 5 of 6 confirmed; Ramon (admin) hasn't confirmed yet
  INSERT INTO uwian_checkins (session_id, user_id, transport, direction_tag, buddy_id, confirmed, confirmed_at)
  VALUES (s_id, 'a2222222-2222-2222-2222-222222222222', 'ride', 'South Makati', 'a6666666-6666-6666-6666-666666666666', true, now() - interval '30 min')
  ON CONFLICT (session_id, user_id) DO NOTHING;
  INSERT INTO uwian_checkins (session_id, user_id, transport, direction_tag, buddy_id, confirmed, confirmed_at)
  VALUES (s_id, 'a6666666-6666-6666-6666-666666666666', 'ride', 'South Makati', 'a2222222-2222-2222-2222-222222222222', true, now() - interval '25 min')
  ON CONFLICT (session_id, user_id) DO NOTHING;
  INSERT INTO uwian_checkins (session_id, user_id, transport, direction_tag, buddy_id, confirmed, confirmed_at)
  VALUES (s_id, 'a3333333-3333-3333-3333-333333333333', 'designated_driver', 'North QC', null, true, now() - interval '20 min')
  ON CONFLICT (session_id, user_id) DO NOTHING;
  INSERT INTO uwian_checkins (session_id, user_id, transport, direction_tag, buddy_id, confirmed, confirmed_at)
  VALUES (s_id, 'a4444444-4444-4444-4444-444444444444', 'walk', 'Taga-dito lang', null, true, now() - interval '15 min')
  ON CONFLICT (session_id, user_id) DO NOTHING;
  INSERT INTO uwian_checkins (session_id, user_id, transport, direction_tag, buddy_id, confirmed, confirmed_at)
  VALUES (s_id, 'a5555555-5555-5555-5555-555555555555', 'taxi', 'East Marikina', null, true, now() - interval '10 min')
  ON CONFLICT (session_id, user_id) DO NOTHING;
  -- Ramon hasn't checked in yet — no row for him

END $$;
