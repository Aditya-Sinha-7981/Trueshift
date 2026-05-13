-- ============================================================
-- AttendTrack Pro — Complete Supabase Schema
-- Run this entire file in Supabase SQL Editor (in order)
-- ============================================================

-- ── 1. PROFILES ─────────────────────────────────────────────
-- One row per user. Auto-created by trigger on auth.users insert.
-- New accounts start with is_verified=false and cannot use the app
-- until a Basic Admin or Super Admin verifies them.
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'employee'
                  CHECK (role IN ('employee', 'admin', 'super_admin')),
  full_name       TEXT NOT NULL,
  employee_id     TEXT UNIQUE,              -- e.g. EMP-001, assigned by admin after verification
  department      TEXT,
  designation     TEXT,
  phone           TEXT,
  shift_start     TEXT DEFAULT '09:00',     -- HH:MM format, 24hr
  shift_end       TEXT DEFAULT '18:00',
  late_threshold_minutes INTEGER DEFAULT 15, -- minutes after shift_start before marked late
  is_active       BOOLEAN DEFAULT TRUE,
  is_verified     BOOLEAN DEFAULT FALSE,    -- must be true before employee can log in
  joined_date     DATE DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. GEOFENCE ZONES ───────────────────────────────────────
-- One row per physical office location. Managed by Super Admin only.
CREATE TABLE IF NOT EXISTS geofence_zones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,            -- "Head Office", "Warehouse - Indore", etc.
  latitude        NUMERIC(10, 7) NOT NULL,
  longitude       NUMERIC(10, 7) NOT NULL,
  radius_meters   INTEGER DEFAULT 200,
  is_active       BOOLEAN DEFAULT TRUE,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. ATTENDANCE LOGS ──────────────────────────────────────
-- One row per employee per day. Updated in place on check-out.
CREATE TABLE IF NOT EXISTS attendance_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID REFERENCES profiles(id) NOT NULL,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  checkin_time    TIMESTAMPTZ,
  checkout_time   TIMESTAMPTZ,
  checkin_lat     NUMERIC(10, 7),
  checkin_lng     NUMERIC(10, 7),
  checkout_lat    NUMERIC(10, 7),
  checkout_lng    NUMERIC(10, 7),
  zone_id         UUID REFERENCES geofence_zones(id),
  zone_name       TEXT,                     -- Denormalised for reports (zone may be renamed/deleted)
  selfie_url      TEXT,                     -- Cloudinary URL
  selfie_public_id TEXT,                    -- Cloudinary public_id for deletion after 30 days
  status          TEXT DEFAULT 'present'
                  CHECK (status IN ('present', 'absent', 'late', 'half_day', 'on_leave')),
  hours_worked    NUMERIC(4, 2),            -- Computed on checkout
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employee_id, date)                -- One log per employee per day
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_date
  ON attendance_logs (employee_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_date
  ON attendance_logs (date DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_zone
  ON attendance_logs (zone_id, date DESC);

-- ── 4. LEAVE TYPES ──────────────────────────────────────────
-- Managed by Super Admin only.
CREATE TABLE IF NOT EXISTS leave_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  code          TEXT UNIQUE NOT NULL,       -- "CL", "SL", "EL", "ML", "COMP"
  days_allowed  INTEGER NOT NULL,
  color         TEXT DEFAULT '#4f8ef7',
  is_active     BOOLEAN DEFAULT TRUE
);

-- ── 5. LEAVE BALANCES ───────────────────────────────────────
-- One row per employee per leave type per year.
-- Seeded for each new employee via seed_leave_balances() function.
CREATE TABLE IF NOT EXISTS leave_balances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID REFERENCES profiles(id) NOT NULL,
  leave_type_id   UUID REFERENCES leave_types(id) NOT NULL,
  year            INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
  total_days      INTEGER NOT NULL,
  used_days       INTEGER DEFAULT 0,
  UNIQUE (employee_id, leave_type_id, year)
);

-- ── 6. LEAVES ───────────────────────────────────────────────
-- One row per leave application.
CREATE TABLE IF NOT EXISTS leaves (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID REFERENCES profiles(id) NOT NULL,
  leave_type_id   UUID REFERENCES leave_types(id) NOT NULL,
  from_date       DATE NOT NULL,
  to_date         DATE NOT NULL,
  days_requested  INTEGER NOT NULL,        -- Calculated server-side (excludes weekends + holidays)
  mode            TEXT DEFAULT 'full_day'
                  CHECK (mode IN ('full_day', 'first_half', 'second_half')),
  reason          TEXT NOT NULL,
  contact_during  TEXT,
  status          TEXT DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by     UUID REFERENCES profiles(id),
  approved_at     TIMESTAMPTZ,
  rejection_note  TEXT,
  applied_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leaves_employee
  ON leaves (employee_id, applied_at DESC);

CREATE INDEX IF NOT EXISTS idx_leaves_status
  ON leaves (status, applied_at DESC);

-- ── 7. HOLIDAYS ─────────────────────────────────────────────
-- Managed by Super Admin only.
CREATE TABLE IF NOT EXISTS holidays (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  date          DATE NOT NULL UNIQUE,
  type          TEXT NOT NULL CHECK (type IN ('national', 'festival', 'regional', 'restricted')),
  description   TEXT,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEED DATA — Run after tables are created
-- ============================================================

INSERT INTO leave_types (name, code, days_allowed, color) VALUES
  ('Casual Leave',          'CL',    12, '#4f8ef7'),
  ('Sick Leave',            'SL',     8, '#10b981'),
  ('Earned Leave',          'EL',    15, '#f59e0b'),
  ('Maternity/Paternity',   'ML',    90, '#f9a8d4'),
  ('Compensatory Off',      'COMP',   5, '#c4b5fd')
ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- TRIGGER — Auto-create profile on Supabase Auth signup
-- New accounts are always employee + unverified by default.
-- Role can only be changed by Super Admin after verification.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, is_verified)
  VALUES (
    NEW.id,
    'employee',                                              -- always starts as employee
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    FALSE                                                    -- always starts unverified
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- HELPER FUNCTION — Seed leave balances for a new employee
-- Call this after verifying and activating a new employee account.
-- ============================================================

CREATE OR REPLACE FUNCTION seed_leave_balances(p_employee_id UUID, p_year INTEGER DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_year INTEGER := COALESCE(p_year, EXTRACT(YEAR FROM NOW())::INTEGER);
  lt     RECORD;
BEGIN
  FOR lt IN SELECT id, days_allowed FROM leave_types WHERE is_active = TRUE LOOP
    INSERT INTO leave_balances (employee_id, leave_type_id, year, total_days, used_days)
    VALUES (p_employee_id, lt.id, v_year, lt.days_allowed, 0)
    ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;
  END LOOP;
END;
$$;

-- Call after verifying each employee:
-- SELECT seed_leave_balances('employee-uuid-here');
-- Or via Python: supabase.rpc('seed_leave_balances', {'p_employee_id': employee_id}).execute()


-- ============================================================
-- HELPER FUNCTION — Check if current user is admin or super_admin
-- Used in RLS policies.
-- ============================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  );
END;
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
END;
$$;


-- ============================================================
-- RLS POLICIES
-- DISABLE during development. ENABLE on Day 10 before production.
-- ============================================================

-- TO DISABLE ALL RLS (run during development):
/*
ALTER TABLE profiles              DISABLE ROW LEVEL SECURITY;
ALTER TABLE geofence_zones        DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs       DISABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types           DISABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances        DISABLE ROW LEVEL SECURITY;
ALTER TABLE leaves                DISABLE ROW LEVEL SECURITY;
ALTER TABLE holidays              DISABLE ROW LEVEL SECURITY;
*/

-- TO ENABLE RLS (run before production deploy):
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofence_zones        ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types           ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances        ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaves                ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays              ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "users_see_own_profile"
  ON profiles FOR SELECT
  USING (id = auth.uid() OR is_admin());

CREATE POLICY "admins_update_profiles"
  ON profiles FOR UPDATE
  USING (is_admin());

-- ATTENDANCE LOGS
CREATE POLICY "employees_see_own_logs"
  ON attendance_logs FOR SELECT
  USING (employee_id = auth.uid() OR is_admin());

CREATE POLICY "employees_insert_own_logs"
  ON attendance_logs FOR INSERT
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "employees_update_own_logs"
  ON attendance_logs FOR UPDATE
  USING (employee_id = auth.uid() OR is_admin());

-- LEAVES
CREATE POLICY "employees_see_own_leaves"
  ON leaves FOR SELECT
  USING (employee_id = auth.uid() OR is_admin());

CREATE POLICY "employees_apply_leave"
  ON leaves FOR INSERT
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "admins_manage_leaves"
  ON leaves FOR UPDATE
  USING (is_admin());

-- LEAVE BALANCES
CREATE POLICY "employees_see_own_balance"
  ON leave_balances FOR SELECT
  USING (employee_id = auth.uid() OR is_admin());

-- HOLIDAYS + LEAVE TYPES — everyone reads, only super admin writes
CREATE POLICY "all_read_holidays"       ON holidays    FOR SELECT USING (TRUE);
CREATE POLICY "super_admin_write_holidays" ON holidays FOR ALL    USING (is_super_admin());
CREATE POLICY "all_read_leave_types"    ON leave_types FOR SELECT USING (TRUE);
CREATE POLICY "super_admin_write_leave_types" ON leave_types FOR ALL USING (is_super_admin());

-- GEOFENCE — everyone reads (needed for check-in), only super admin writes
CREATE POLICY "all_read_zones"          ON geofence_zones FOR SELECT USING (TRUE);
CREATE POLICY "super_admin_write_zones" ON geofence_zones FOR ALL   USING (is_super_admin());


-- ============================================================
-- VERIFICATION QUERIES — Run to confirm setup is correct
-- ============================================================

-- Should return 5 rows
SELECT name, code, days_allowed FROM leave_types ORDER BY name;

-- Should return 0 rows (no users yet — that's fine)
SELECT COUNT(*) FROM profiles;

-- Should return the trigger
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Should return the functions
SELECT routine_name FROM information_schema.routines
WHERE routine_name IN ('handle_new_user', 'seed_leave_balances', 'is_admin', 'is_super_admin');
