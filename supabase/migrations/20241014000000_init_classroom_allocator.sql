-- ==============================================================================
-- College Classroom Allocator & Reservation System - Initial Schema Migration
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- 2. Create Custom Types & Enums
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'faculty', 'reader');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status') THEN
        CREATE TYPE account_status AS ENUM ('active', 'disabled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservation_status') THEN
        CREATE TYPE reservation_status AS ENUM ('confirmed', 'cancelled');
    END IF;
END $$;

-- 3. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'faculty',
    status account_status NOT NULL DEFAULT 'active',
    must_change_password BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Case-insensitive unique index on username
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_lower_username ON public.profiles(LOWER(username));

-- 4. Auth Username Lookup (Private, not exposed to public)
CREATE TABLE IF NOT EXISTS public.auth_username_lookup (
    username TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_username_lower ON public.auth_username_lookup(LOWER(username));

-- 5. Floors Table
CREATE TABLE IF NOT EXISTS public.floors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 6. Classrooms Table
CREATE TABLE IF NOT EXISTS public.classrooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_number TEXT NOT NULL UNIQUE,
    floor_id UUID NOT NULL REFERENCES public.floors(id) ON DELETE RESTRICT,
    capacity INT NOT NULL DEFAULT 40,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_classrooms_floor_id ON public.classrooms(floor_id);

-- 7. Timetable Events Table (Official College Timetable)
CREATE TABLE IF NOT EXISTS public.timetable_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE RESTRICT,
    subject TEXT NOT NULL,
    faculty_name TEXT NOT NULL,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1 = Monday, 7 = Sunday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    specific_date DATE, -- NULL for recurring weekly schedule, or specific date
    semester TEXT NOT NULL DEFAULT 'Current Semester',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT chk_timetable_times CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_timetable_classroom_day ON public.timetable_events(classroom_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_timetable_specific_date ON public.timetable_events(specific_date);

-- 8. Reservations Table (Faculty Classroom Bookings)
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE RESTRICT,
    faculty_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'Academic / Faculty Activity',
    status reservation_status NOT NULL DEFAULT 'confirmed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT chk_reservation_times CHECK (end_time > start_time)
);

-- Database-level exclusion constraint preventing overlapping active reservations for the same classroom
ALTER TABLE public.reservations 
DROP CONSTRAINT IF EXISTS exclude_overlapping_confirmed_reservations;

ALTER TABLE public.reservations
ADD CONSTRAINT exclude_overlapping_confirmed_reservations
EXCLUDE USING gist (
    classroom_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
) WHERE (status = 'confirmed');

CREATE INDEX IF NOT EXISTS idx_reservations_classroom_interval 
ON public.reservations(classroom_id, start_time, end_time) 
WHERE status = 'confirmed';

CREATE INDEX IF NOT EXISTS idx_reservations_faculty_id 
ON public.reservations(faculty_id);

-- 9. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 10. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_username_lookup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Helper function: is current user admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    );
$$;

-- RLS POLICIES:

-- PROFILES:
-- Public / Reader can see faculty display names and IDs (for reservation attributing)
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
USING (true);

-- Users can update only their own profile (and cannot change role or status)
CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id AND 
    role = (SELECT role FROM public.profiles WHERE id = auth.uid()) AND
    status = (SELECT status FROM public.profiles WHERE id = auth.uid())
);

-- Admin has full access to profiles
CREATE POLICY "Admins have full access to profiles" 
ON public.profiles FOR ALL 
USING (public.is_admin());

-- AUTH_USERNAME_LOOKUP:
-- Only service_role can access username lookup directly
CREATE POLICY "Private auth lookup service access only"
ON public.auth_username_lookup FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- FLOORS:
-- Public can view floors
CREATE POLICY "Floors viewable by everyone" 
ON public.floors FOR SELECT 
USING (true);

-- Admins can manage floors
CREATE POLICY "Admins can manage floors" 
ON public.floors FOR ALL 
USING (public.is_admin());

-- CLASSROOMS:
-- Public can view active classrooms (Admins can view all)
CREATE POLICY "Classrooms viewable by everyone" 
ON public.classrooms FOR SELECT 
USING (is_active = true OR public.is_admin());

-- Admins can manage classrooms
CREATE POLICY "Admins can manage classrooms" 
ON public.classrooms FOR ALL 
USING (public.is_admin());

-- TIMETABLE_EVENTS:
-- Public can view active timetable events
CREATE POLICY "Timetable events viewable by everyone" 
ON public.timetable_events FOR SELECT 
USING (is_active = true OR public.is_admin());

-- Admins can manage timetable events
CREATE POLICY "Admins can manage timetable events" 
ON public.timetable_events FOR ALL 
USING (public.is_admin());

-- RESERVATIONS:
-- Confirmed reservations viewable by everyone (for Reader & Faculty schedule view)
CREATE POLICY "Reservations viewable by everyone" 
ON public.reservations FOR SELECT 
USING (true);

-- Faculty can insert reservations (only their own UID, status confirmed)
CREATE POLICY "Faculty can insert own reservations" 
ON public.reservations FOR INSERT 
WITH CHECK (
    auth.uid() = faculty_id AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('faculty', 'admin') AND status = 'active')
);

-- Faculty can cancel their own reservations
CREATE POLICY "Faculty can update own reservations" 
ON public.reservations FOR UPDATE 
USING (auth.uid() = faculty_id OR public.is_admin())
WITH CHECK (auth.uid() = faculty_id OR public.is_admin());

-- Admins can delete or manage any reservation
CREATE POLICY "Admins can manage all reservations" 
ON public.reservations FOR ALL 
USING (public.is_admin());

-- AUDIT LOGS:
-- Admin-only viewable
CREATE POLICY "Admins can view audit logs" 
ON public.audit_logs FOR SELECT 
USING (public.is_admin());

CREATE POLICY "Authenticated users can insert audit logs" 
ON public.audit_logs FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);


-- ==============================================================================
-- 11. Transactional Availability & Reservation Functions (RPC)
-- ==============================================================================

-- Check classroom availability for a time range
CREATE OR REPLACE FUNCTION public.check_classroom_availability(
    p_classroom_id UUID,
    p_start TIMESTAMPTZ,
    p_end TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
    v_is_active BOOLEAN;
    v_day_of_week INT;
    v_date DATE;
    v_start_time TIME;
    v_end_time TIME;
    v_tt_record RECORD;
    v_res_record RECORD;
BEGIN
    -- 1. Validate inputs
    IF p_end <= p_start THEN
        RETURN jsonb_build_object('available', false, 'reason', 'End time must be after start time');
    END IF;

    -- 2. Check classroom existence and active status
    SELECT is_active INTO v_is_active FROM public.classrooms WHERE id = p_classroom_id;
    IF v_is_active IS NULL THEN
        RETURN jsonb_build_object('available', false, 'reason', 'Classroom does not exist');
    END IF;
    IF NOT v_is_active THEN
        RETURN jsonb_build_object('available', false, 'reason', 'Classroom is marked inactive');
    END IF;

    -- Extract local time/day (convert to classroom college timezone if needed, default to UTC/local)
    v_day_of_week := EXTRACT(ISODOW FROM p_start); -- 1 = Mon, 7 = Sun
    v_date := (p_start AT TIME ZONE 'UTC')::DATE;
    v_start_time := (p_start AT TIME ZONE 'UTC')::TIME;
    v_end_time := (p_end AT TIME ZONE 'UTC')::TIME;

    -- 3. Check official timetable conflicts
    -- Overlap condition: requested_start < existing_end AND requested_end > existing_start
    SELECT id, subject, faculty_name, start_time, end_time
    INTO v_tt_record
    FROM public.timetable_events
    WHERE classroom_id = p_classroom_id
      AND is_active = true
      AND (
          -- Date specific override
          (specific_date IS NOT NULL AND specific_date = v_date)
          OR
          -- Recurring weekly schedule
          (specific_date IS NULL AND day_of_week = v_day_of_week)
      )
      AND v_start_time < end_time 
      AND v_end_time > start_time
    LIMIT 1;

    IF v_tt_record.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'available', false,
            'conflict_type', 'timetable',
            'reason', 'Classroom is occupied by official timetable lecture',
            'details', jsonb_build_object(
                'subject', v_tt_record.subject,
                'faculty_name', v_tt_record.faculty_name,
                'start_time', v_tt_record.start_time,
                'end_time', v_tt_record.end_time
            )
        );
    END IF;

    -- 4. Check faculty reservation conflicts
    -- Overlap condition: requested_start < existing_end AND requested_end > existing_start
    SELECT r.id, r.purpose, r.start_time, r.end_time, p.full_name AS faculty_name
    INTO v_res_record
    FROM public.reservations r
    JOIN public.profiles p ON p.id = r.faculty_id
    WHERE r.classroom_id = p_classroom_id
      AND r.status = 'confirmed'
      AND p_start < r.end_time
      AND p_end > r.start_time
    LIMIT 1;

    IF v_res_record.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'available', false,
            'conflict_type', 'reservation',
            'reason', 'Classroom is already reserved by another faculty member',
            'details', jsonb_build_object(
                'faculty_name', v_res_record.faculty_name,
                'purpose', v_res_record.purpose,
                'start_time', v_res_record.start_time,
                'end_time', v_res_record.end_time
            )
        );
    END IF;

    RETURN jsonb_build_object('available', true, 'reason', 'Classroom is available');
END;
$$;


-- Transactional Reservation Function (concurrency-safe with locking)
CREATE OR REPLACE FUNCTION public.reserve_classroom(
    p_classroom_id UUID,
    p_start TIMESTAMPTZ,
    p_end TIMESTAMPTZ,
    p_purpose TEXT DEFAULT 'Faculty Academic Session'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_profile RECORD;
    v_avail_check JSONB;
    v_new_res_id UUID;
BEGIN
    -- 1. Verify authenticated user
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to make a reservation.';
    END IF;

    SELECT id, role, status, must_change_password 
    INTO v_profile 
    FROM public.profiles 
    WHERE id = v_user_id;

    IF v_profile.id IS NULL THEN
        RAISE EXCEPTION 'User profile not found.';
    END IF;

    IF v_profile.status != 'active' THEN
        RAISE EXCEPTION 'Your account has been deactivated. Contact an administrator.';
    END IF;

    IF v_profile.role NOT IN ('faculty', 'admin') THEN
        RAISE EXCEPTION 'You do not have permission to reserve classrooms.';
    END IF;

    IF v_profile.must_change_password THEN
        RAISE EXCEPTION 'You must change your temporary password before making reservations.';
    END IF;

    -- 2. Concurrency Control: Acquire PostgreSQL Advisory Lock on classroom ID
    -- This guarantees atomic serialization for simultaneous booking attempts on the same room.
    PERFORM pg_advisory_xact_lock(hashtext(p_classroom_id::TEXT));

    -- 3. Re-verify availability within the transaction
    v_avail_check := public.check_classroom_availability(p_classroom_id, p_start, p_end);
    IF NOT (v_avail_check->>'available')::BOOLEAN THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', v_avail_check->>'reason',
            'details', v_avail_check->'details'
        );
    END IF;

    -- 4. Insert Reservation
    INSERT INTO public.reservations (classroom_id, faculty_id, start_time, end_time, purpose, status)
    VALUES (p_classroom_id, v_user_id, p_start, p_end, COALESCE(p_purpose, 'Faculty Academic Session'), 'confirmed')
    RETURNING id INTO v_new_res_id;

    -- 5. Write to Audit Log
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (
        v_user_id,
        'CREATE_RESERVATION',
        'reservation',
        v_new_res_id,
        jsonb_build_object(
            'classroom_id', p_classroom_id,
            'start_time', p_start,
            'end_time', p_end,
            'purpose', p_purpose
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'reservation_id', v_new_res_id,
        'message', 'Reservation successfully confirmed.'
    );
END;
$$;


-- Cancel Reservation Function
CREATE OR REPLACE FUNCTION public.cancel_reservation(p_reservation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_res RECORD;
    v_is_admin BOOLEAN := public.is_admin();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT id, faculty_id, status, classroom_id, start_time 
    INTO v_res 
    FROM public.reservations 
    WHERE id = p_reservation_id;

    IF v_res.id IS NULL THEN
        RAISE EXCEPTION 'Reservation not found.';
    END IF;

    IF v_res.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reservation is already cancelled.');
    END IF;

    IF v_res.faculty_id != v_user_id AND NOT v_is_admin THEN
        RAISE EXCEPTION 'You are not authorized to cancel this reservation.';
    END IF;

    -- Prevent cancelling past reservations unless admin
    IF v_res.start_time < timezone('utc', now()) AND NOT v_is_admin THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot cancel past reservations.');
    END IF;

    UPDATE public.reservations
    SET status = 'cancelled', updated_at = timezone('utc', now())
    WHERE id = p_reservation_id;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (
        v_user_id,
        'CANCEL_RESERVATION',
        'reservation',
        p_reservation_id,
        jsonb_build_object('cancelled_by', v_user_id, 'is_admin', v_is_admin)
    );

    RETURN jsonb_build_object('success', true, 'message', 'Reservation successfully cancelled.');
END;
$$;


-- Change Username Function
CREATE OR REPLACE FUNCTION public.change_username(p_new_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_clean_username TEXT;
    v_existing_id UUID;
    v_old_username TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    v_clean_username := TRIM(p_new_username);

    IF LENGTH(v_clean_username) < 3 OR LENGTH(v_clean_username) > 32 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Username must be between 3 and 32 characters.');
    END IF;

    -- Enforce alphanumeric + underscore/hyphen
    IF v_clean_username !~ '^[a-zA-Z0-9_-]+$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Username can only contain letters, numbers, hyphens, and underscores.');
    END IF;

    -- Check case-insensitive uniqueness
    SELECT id INTO v_existing_id 
    FROM public.profiles 
    WHERE LOWER(username) = LOWER(v_clean_username) AND id != v_user_id;

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Username is already taken. Please choose another.');
    END IF;

    SELECT username INTO v_old_username FROM public.profiles WHERE id = v_user_id;

    -- Update profiles
    UPDATE public.profiles
    SET username = v_clean_username, updated_at = timezone('utc', now())
    WHERE id = v_user_id;

    -- Update auth_username_lookup
    UPDATE public.auth_username_lookup
    SET username = v_clean_username
    WHERE user_id = v_user_id;

    -- Audit log
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (
        v_user_id,
        'CHANGE_USERNAME',
        'profile',
        v_user_id,
        jsonb_build_object('old_username', v_old_username, 'new_username', v_clean_username)
    );

    RETURN jsonb_build_object('success', true, 'username', v_clean_username);
END;
$$;


-- Admin Detect Timetable Conflicts (check if a new lecture conflicts with existing confirmed reservations)
CREATE OR REPLACE FUNCTION public.admin_detect_timetable_conflicts(
    p_classroom_id UUID,
    p_day_of_week INT,
    p_start_time TIME,
    p_end_time TIME,
    p_specific_date DATE DEFAULT NULL
)
RETURNS TABLE (
    reservation_id UUID,
    faculty_name TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    purpose TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id AS reservation_id,
        p.full_name AS faculty_name,
        r.start_time,
        r.end_time,
        r.purpose
    FROM public.reservations r
    JOIN public.profiles p ON p.id = r.faculty_id
    WHERE r.classroom_id = p_classroom_id
      AND r.status = 'confirmed'
      AND (
          -- If specific date provided, match that date
          (p_specific_date IS NOT NULL AND (r.start_time AT TIME ZONE 'UTC')::DATE = p_specific_date)
          OR
          -- If recurring day of week, match any upcoming reservation on that day of week
          (p_specific_date IS NULL AND EXTRACT(ISODOW FROM r.start_time) = p_day_of_week)
      )
      AND p_start_time < (r.end_time AT TIME ZONE 'UTC')::TIME
      AND p_end_time > (r.start_time AT TIME ZONE 'UTC')::TIME;
END;
$$;

-- Seed initial default floors and classrooms if table is empty
DO $$
DECLARE
    v_floor_1 UUID;
    v_floor_2 UUID;
    v_floor_3 UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.floors LIMIT 1) THEN
        INSERT INTO public.floors (name, display_order) VALUES ('Ground Floor', 1) RETURNING id INTO v_floor_1;
        INSERT INTO public.floors (name, display_order) VALUES ('First Floor', 2) RETURNING id INTO v_floor_2;
        INSERT INTO public.floors (name, display_order) VALUES ('Second Floor', 3) RETURNING id INTO v_floor_3;

        INSERT INTO public.classrooms (room_number, floor_id, capacity, is_active) VALUES
            ('G-101', v_floor_1, 60, true),
            ('G-102', v_floor_1, 45, true),
            ('G-103', v_floor_1, 50, true),
            ('F-201', v_floor_2, 60, true),
            ('F-202', v_floor_2, 40, true),
            ('F-203', v_floor_2, 75, true),
            ('S-301', v_floor_3, 50, true),
            ('S-302', v_floor_3, 50, true);
    END IF;
END $$;
