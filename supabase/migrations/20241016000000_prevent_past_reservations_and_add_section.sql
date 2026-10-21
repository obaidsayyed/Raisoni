-- Migration: 20241016000000_prevent_past_reservations_and_add_section.sql
-- Description:
-- 1. Adds section column to timetable_events for section tracking (e.g. 'BCA A', 'BCA B')
-- 2. Updates reserve_classroom function to prevent past booking

-- 1. Add section column to timetable_events if it does not already exist
ALTER TABLE public.timetable_events 
ADD COLUMN IF NOT EXISTS section TEXT;

-- 2. Update reserve_classroom function to strictly reject past reservations
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

    -- Block reservations in the past (allow 1 minute grace for network transmission)
    IF p_start < (NOW() - INTERVAL '1 minute') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Cannot book a classroom for a past date or time. Please select a future time slot.'
        );
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

    -- 5. Audit Logging
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
        'reservation_id', v_new_res_id
    );
END;
$$;
