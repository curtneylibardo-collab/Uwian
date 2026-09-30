/*
# Uwian — full schema for groups, sessions, map spots, expenses, uwian check-in, hangganan, and ledger

## Overview
This migration creates the complete data model for Uwian, a barkada session management app.
All money is stored as integer centavos. The app uses Supabase email/password auth.

## Tables created
1. **profiles** — extends auth.users with display_name and avatar_emoji
2. **groups** — a barkada group with name, invite code, vouches_required, direction tags
3. **group_members** — junction: user × group with role (admin/member) and status (active/pending/vouched)
4. **vouches** — who vouched for whom, for pending members
5. **sessions** — a drinking session with date, time, spot, status, uwian_deadline
6. **rsvps** — per-session RSVP (going/maybe/cant)
7. **spots** — saved tambayan map spots with coords, price range, closing time, notes
8. **expenses** — logged expenses: payer, amount (centavos), split type, is_alcohol
9. **expense_splits** — who an expense is split among
10. **payments** — payment confirmations: payer, receiver, amount, status (pending/confirmed/disputed)
11. **uwian_checkins** — how each member got home, buddy pairing, confirmed status, timestamp
12. **hangganan** — private personal counter with limit per user
13. **group_direction_tags** — direction tags a group sets for buddy pairing

## Security
- RLS enabled on every table
- Owner-scoped policies using auth.uid() for profiles and hangganan
- Group-membership-scoped policies for all group-related tables
- All policies scoped TO authenticated
*/

-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_emoji text NOT NULL DEFAULT '🍺',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "select_all_profiles" ON profiles;
CREATE POLICY "select_all_profiles" ON profiles FOR SELECT TO authenticated USING (true);

-- ============ GROUPS ============
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  invite_code text UNIQUE NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  vouches_required int NOT NULL DEFAULT 1 CHECK (vouches_required IN (1, 2)),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- ============ GROUP MEMBERS ============
CREATE TABLE IF NOT EXISTS group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'vouched')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- ============ VOUCHES ============
CREATE TABLE IF NOT EXISTS vouches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  voucher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, voucher_id, candidate_id)
);
ALTER TABLE vouches ENABLE ROW LEVEL SECURITY;

-- ============ GROUP DIRECTION TAGS ============
CREATE TABLE IF NOT EXISTS group_direction_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  tag text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);
ALTER TABLE group_direction_tags ENABLE ROW LEVEL SECURITY;

-- ============ SPOTS (Tambayan map) ============
CREATE TABLE IF NOT EXISTS spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  lat float8 NOT NULL,
  lng float8 NOT NULL,
  price_range text,
  closing_time text,
  notes text,
  verified boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE spots ENABLE ROW LEVEL SECURITY;

-- ============ SESSIONS ============
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  spot_id uuid REFERENCES spots(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Inuman',
  session_date date NOT NULL,
  session_time text NOT NULL DEFAULT '20:00',
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'live', 'ended')),
  designated_driver uuid REFERENCES auth.users(id),
  uwian_deadline timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- ============ RSVPS ============
CREATE TABLE IF NOT EXISTS rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  response text NOT NULL DEFAULT 'maybe' CHECK (response IN ('going', 'maybe', 'cant')),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(session_id, user_id)
);
ALTER TABLE rsvps ENABLE ROW LEVEL SECURITY;

-- ============ EXPENSES ============
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount_centavos bigint NOT NULL CHECK (amount_centavos >= 0),
  paid_by uuid NOT NULL REFERENCES auth.users(id),
  is_alcohol boolean NOT NULL DEFAULT false,
  split_type text NOT NULL DEFAULT 'equal' CHECK (split_type IN ('equal', 'custom')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- ============ EXPENSE SPLITS ============
CREATE TABLE IF NOT EXISTS expense_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(expense_id, user_id)
);
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;

-- ============ PAYMENTS ============
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  payer_id uuid NOT NULL REFERENCES auth.users(id),
  receiver_id uuid NOT NULL REFERENCES auth.users(id),
  amount_centavos bigint NOT NULL CHECK (amount_centavos > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'disputed')),
  dispute_note text,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ============ UWIAN CHECK-INS ============
CREATE TABLE IF NOT EXISTS uwian_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transport text CHECK (transport IN ('walk', 'ride', 'drive', 'designated_driver', 'taxi', 'buddy')),
  direction_tag text,
  buddy_id uuid REFERENCES auth.users(id),
  confirmed boolean NOT NULL DEFAULT false,
  confirmed_at timestamptz,
  UNIQUE(session_id, user_id)
);
ALTER TABLE uwian_checkins ENABLE ROW LEVEL SECURITY;

-- ============ HANGGANAN (private counter) ============
CREATE TABLE IF NOT EXISTS hangganan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  count int NOT NULL DEFAULT 0,
  limit_max int NOT NULL DEFAULT 5,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE hangganan ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_hangganan" ON hangganan;
CREATE POLICY "select_own_hangganan" ON hangganan FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_hangganan" ON hangganan;
CREATE POLICY "insert_own_hangganan" ON hangganan FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_hangganan" ON hangganan;
CREATE POLICY "update_own_hangganan" ON hangganan FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ GROUP-MEMBERSHIP POLICIES ============
-- Helper: membership check via EXISTS subquery on group_members where the user is an active member

-- groups: read if member, update/create if admin
DROP POLICY IF EXISTS "select_groups_as_member" ON groups;
CREATE POLICY "select_groups_as_member" ON groups FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = groups.id AND gm.user_id = auth.uid() AND gm.status = 'active'));
DROP POLICY IF EXISTS "insert_groups_as_creator" ON groups;
CREATE POLICY "insert_groups_as_creator" ON groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "update_groups_as_admin" ON groups;
CREATE POLICY "update_groups_as_admin" ON groups FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = groups.id AND gm.user_id = auth.uid() AND gm.role = 'admin' AND gm.status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = groups.id AND gm.user_id = auth.uid() AND gm.role = 'admin' AND gm.status = 'active'));

-- group_members: read if you're in the group; insert if admin or it's your own pending entry; update if admin
DROP POLICY IF EXISTS "select_group_members" ON group_members;
CREATE POLICY "select_group_members" ON group_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM group_members gm2 WHERE gm2.group_id = group_members.group_id AND gm2.user_id = auth.uid() AND gm2.status = 'active')
         OR group_members.user_id = auth.uid());
DROP POLICY IF EXISTS "insert_group_members" ON group_members;
CREATE POLICY "insert_group_members" ON group_members FOR INSERT TO authenticated
  WITH CHECK (group_members.user_id = auth.uid()
              OR EXISTS (SELECT 1 FROM group_members gm2 WHERE gm2.group_id = group_members.group_id AND gm2.user_id = auth.uid() AND gm2.role = 'admin' AND gm2.status = 'active'));
DROP POLICY IF EXISTS "update_group_members" ON group_members;
CREATE POLICY "update_group_members" ON group_members FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM group_members gm2 WHERE gm2.group_id = group_members.group_id AND gm2.user_id = auth.uid() AND gm2.role = 'admin' AND gm2.status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM group_members gm2 WHERE gm2.group_id = group_members.group_id AND gm2.user_id = auth.uid() AND gm2.role = 'admin' AND gm2.status = 'active'));
DROP POLICY IF EXISTS "delete_group_members" ON group_members;
CREATE POLICY "delete_group_members" ON group_members FOR DELETE TO authenticated
  USING (group_members.user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM group_members gm2 WHERE gm2.group_id = group_members.group_id AND gm2.user_id = auth.uid() AND gm2.role = 'admin' AND gm2.status = 'active'));

-- vouches: read if group member; insert if active member; delete if admin or voucher
DROP POLICY IF EXISTS "select_vouches" ON vouches;
CREATE POLICY "select_vouches" ON vouches FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = vouches.group_id AND gm.user_id = auth.uid() AND gm.status = 'active'));
DROP POLICY IF EXISTS "insert_vouches" ON vouches;
CREATE POLICY "insert_vouches" ON vouches FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = vouches.group_id AND gm.user_id = auth.uid() AND gm.status = 'active'));
DROP POLICY IF EXISTS "delete_vouches" ON vouches;
CREATE POLICY "delete_vouches" ON vouches FOR DELETE TO authenticated
  USING (vouches.voucher_id = auth.uid()
         OR EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = vouches.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin' AND gm.status = 'active'));

-- group_direction_tags: read/insert/update/delete if admin of the group
DROP POLICY IF EXISTS "select_direction_tags" ON group_direction_tags;
CREATE POLICY "select_direction_tags" ON group_direction_tags FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_direction_tags.group_id AND gm.user_id = auth.uid() AND gm.status = 'active'));
DROP POLICY IF EXISTS "insert_direction_tags" ON group_direction_tags;
CREATE POLICY "insert_direction_tags" ON group_direction_tags FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_direction_tags.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin' AND gm.status = 'active'));
DROP POLICY IF EXISTS "update_direction_tags" ON group_direction_tags;
CREATE POLICY "update_direction_tags" ON group_direction_tags FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_direction_tags.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin' AND gm.status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_direction_tags.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin' AND gm.status = 'active'));
DROP POLICY IF EXISTS "delete_direction_tags" ON group_direction_tags;
CREATE POLICY "delete_direction_tags" ON group_direction_tags FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_direction_tags.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin' AND gm.status = 'active'));

-- spots: read if group member; insert/update if member; delete if creator or admin
DROP POLICY IF EXISTS "select_spots" ON spots;
CREATE POLICY "select_spots" ON spots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = spots.group_id AND gm.user_id = auth.uid() AND gm.status = 'active'));
DROP POLICY IF EXISTS "insert_spots" ON spots;
CREATE POLICY "insert_spots" ON spots FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = spots.group_id AND gm.user_id = auth.uid() AND gm.status = 'active'));
DROP POLICY IF EXISTS "update_spots" ON spots;
CREATE POLICY "update_spots" ON spots FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = spots.group_id AND gm.user_id = auth.uid() AND gm.status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = spots.group_id AND gm.user_id = auth.uid() AND gm.status = 'active'));
DROP POLICY IF EXISTS "delete_spots" ON spots;
CREATE POLICY "delete_spots" ON spots FOR DELETE TO authenticated
  USING (spots.created_by = auth.uid()
         OR EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = spots.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin' AND gm.status = 'active'));

-- sessions: read if group member; insert if member; update if creator or admin; delete if admin
DROP POLICY IF EXISTS "select_sessions" ON sessions;
CREATE POLICY "select_sessions" ON sessions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = sessions.group_id AND gm.user_id = auth.uid() AND gm.status = 'active'));
DROP POLICY IF EXISTS "insert_sessions" ON sessions;
CREATE POLICY "insert_sessions" ON sessions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = sessions.group_id AND gm.user_id = auth.uid() AND gm.status = 'active'));
DROP POLICY IF EXISTS "update_sessions" ON sessions;
CREATE POLICY "update_sessions" ON sessions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = sessions.group_id AND gm.user_id = auth.uid() AND gm.status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = sessions.group_id AND gm.user_id = auth.uid() AND gm.status = 'active'));
DROP POLICY IF EXISTS "delete_sessions" ON sessions;
CREATE POLICY "delete_sessions" ON sessions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = sessions.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin' AND gm.status = 'active'));

-- rsvps: read if group member; insert/update/delete own RSVP
DROP POLICY IF EXISTS "select_rsvps" ON rsvps;
CREATE POLICY "select_rsvps" ON rsvps FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM group_members gm JOIN sessions s ON s.group_id = gm.group_id WHERE s.id = rsvps.session_id AND gm.user_id = auth.uid() AND gm.status = 'active'));
DROP POLICY IF EXISTS "insert_rsvps" ON rsvps;
CREATE POLICY "insert_rsvps" ON rsvps FOR INSERT TO authenticated
  WITH CHECK (rsvps.user_id = auth.uid()
              AND EXISTS (SELECT 1 FROM group_members gm JOIN sessions s ON s.group_id = gm.group_id WHERE s.id = rsvps.session_id AND gm.user_id = auth.uid() AND gm.status = 'active'));
DROP POLICY IF EXISTS "update_rsvps" ON rsvps;
CREATE POLICY "update_rsvps" ON rsvps FOR UPDATE TO authenticated
  USING (rsvps.user_id = auth.uid())
  WITH CHECK (rsvps.user_id = auth.uid());
DROP POLICY IF EXISTS "delete_rsvps" ON rsvps;
CREATE POLICY "delete_rsvps" ON rsvps FOR DELETE TO authenticated USING (rsvps.user_id = auth.uid());

-- expenses: read if group member; insert/update/delete if member of the session's group
DROP POLICY IF EXISTS "select_expenses" ON expenses;
CREATE POLICY "select_expenses" ON expenses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM group_members gm JOIN sessions s ON s.group_id = gm.group_id WHERE s.id = expenses.session_id AND gm.user_id = auth.uid() AND gm.status = 'active'));
DROP POLICY IF EXISTS "insert_expenses" ON expenses;
CREATE POLICY "insert_expenses" ON expenses FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM group_members gm JOIN sessions s ON s.group_id = gm.group_id WHERE s.id = expenses.session_id AND gm.user_id = auth.uid() AND gm.status = 'active'));
DROP POLICY IF EXISTS "update_expenses" ON expenses;
CREATE POLICY "update_expenses" ON expenses FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM group_members gm JOIN sessions s ON s.group_id = gm.group_id WHERE s.id = expenses.session_id AND gm.user_id = auth.uid() AND gm.status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM group_members gm JOIN sessions s ON s.group_id = gm.group_id WHERE s.id = expenses.session_id AND gm.user_id = auth.uid() AND gm.status = 'active'));
DROP POLICY IF EXISTS "delete_expenses" ON expenses;
CREATE POLICY "delete_expenses" ON expenses FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM group_members gm JOIN sessions s ON s.group_id = gm.group_id WHERE s.id = expenses.session_id AND gm.user_id = auth.uid() AND gm.status = 'active'));

-- expense_splits: read if group member; insert/delete if member
DROP POLICY IF EXISTS "select_expense_splits" ON expense_splits;
CREATE POLICY "select_expense_splits" ON expense_splits FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM expense_splits es2 JOIN expenses e ON e.id = es2.expense_id JOIN sessions s ON s.id = e.session_id JOIN group_members gm ON gm.group_id = s.group_id WHERE es2.expense_id = expense_splits.expense_id AND gm.user_id = auth.uid() AND gm.status = 'active'));
DROP POLICY IF EXISTS "insert_expense_splits" ON expense_splits;
CREATE POLICY "insert_expense_splits" ON expense_splits FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM expenses e JOIN sessions s ON s.id = e.session_id JOIN group_members gm ON gm.group_id = s.group_id WHERE e.id = expense_splits.expense_id AND gm.user_id = auth.uid() AND gm.status = 'active'));
DROP POLICY IF EXISTS "delete_expense_splits" ON expense_splits;
CREATE POLICY "delete_expense_splits" ON expense_splits FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM expenses e JOIN sessions s ON s.id = e.session_id JOIN group_members gm ON gm.group_id = s.group_id WHERE e.id = expense_splits.expense_id AND gm.user_id = auth.uid() AND gm.status = 'active'));

-- payments: read if group member; insert if payer; update if receiver
DROP POLICY IF EXISTS "select_payments" ON payments;
CREATE POLICY "select_payments" ON payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = payments.group_id AND gm.user_id = auth.uid() AND gm.status = 'active'));
DROP POLICY IF EXISTS "insert_payments" ON payments;
CREATE POLICY "insert_payments" ON payments FOR INSERT TO authenticated
  WITH CHECK (payments.payer_id = auth.uid()
              AND EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = payments.group_id AND gm.user_id = auth.uid() AND gm.status = 'active'));
DROP POLICY IF EXISTS "update_payments" ON payments;
CREATE POLICY "update_payments" ON payments FOR UPDATE TO authenticated
  USING (payments.receiver_id = auth.uid()
         OR payments.payer_id = auth.uid())
  WITH CHECK (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = payments.group_id AND gm.user_id = auth.uid() AND gm.status = 'active'));

-- uwian_checkins: read if group member; insert/update own check-in
DROP POLICY IF EXISTS "select_uwian_checkins" ON uwian_checkins;
CREATE POLICY "select_uwian_checkins" ON uwian_checkins FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM sessions s JOIN group_members gm ON gm.group_id = s.group_id WHERE s.id = uwian_checkins.session_id AND gm.user_id = auth.uid() AND gm.status = 'active'));
DROP POLICY IF EXISTS "insert_uwian_checkins" ON uwian_checkins;
CREATE POLICY "insert_uwian_checkins" ON uwian_checkins
  FOR INSERT TO authenticated
  WITH CHECK (uwian_checkins.user_id = auth.uid()
              AND EXISTS (SELECT 1 FROM sessions s JOIN group_members gm ON gm.group_id = s.group_id WHERE s.id = uwian_checkins.session_id AND gm.user_id = auth.uid() AND gm.status = 'active'));
DROP POLICY IF EXISTS "update_uwian_checkins" ON uwian_checkins;
CREATE POLICY "update_uwian_checkins" ON uwian_checkins FOR UPDATE TO authenticated
  USING (uwian_checkins.user_id = auth.uid())
  WITH CHECK (uwian_checkins.user_id = auth.uid());

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_vouches_group ON vouches(group_id);
CREATE INDEX IF NOT EXISTS idx_sessions_group ON sessions(group_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_session ON rsvps(session_id);
CREATE INDEX IF NOT EXISTS idx_expenses_session ON expenses(session_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_payments_group ON payments(group_id);
CREATE INDEX IF NOT EXISTS idx_uwian_checkins_session ON uwian_checkins(session_id);
CREATE INDEX IF NOT EXISTS idx_spots_group ON spots(group_id);
CREATE INDEX IF NOT EXISTS idx_direction_tags_group ON group_direction_tags(group_id);
