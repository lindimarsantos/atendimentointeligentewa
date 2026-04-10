-- ============================================================
-- Migration 028: Add break period to professional availability
--
-- Adds break_start / break_end nullable columns so each
-- working day can have a lunch / rest window.
-- rpc_get_available_slots skips any slot that overlaps
-- with the break window.
-- ============================================================

-- ── 1. Add break columns ──────────────────────────────────────────────────────
ALTER TABLE scheduling.professional_availability
  ADD COLUMN IF NOT EXISTS break_start time NULL,
  ADD COLUMN IF NOT EXISTS break_end   time NULL;

-- ── 2. rpc_upsert_professional_availability (with break support) ──────────────
CREATE OR REPLACE FUNCTION public.rpc_upsert_professional_availability(
  p_tenant_id       uuid,
  p_professional_id uuid,
  p_slots           jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling
AS $$
BEGIN
  DELETE FROM scheduling.professional_availability
  WHERE tenant_id       = p_tenant_id
    AND professional_id = p_professional_id;

  INSERT INTO scheduling.professional_availability
    (tenant_id, professional_id, day_of_week, start_time, end_time,
     is_available, break_start, break_end)
  SELECT
    p_tenant_id,
    p_professional_id,
    (s->>'day_of_week')::smallint,
    (s->>'start_time')::time,
    (s->>'end_time')::time,
    COALESCE((s->>'is_available')::boolean, true),
    NULLIF(s->>'break_start', '')::time,
    NULLIF(s->>'break_end',   '')::time
  FROM jsonb_array_elements(p_slots) s;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_upsert_professional_availability(uuid, uuid, jsonb)
  TO anon, authenticated, service_role;

-- ── 3. rpc_get_available_slots (respects break period) ────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_get_available_slots(
  p_tenant_id       uuid,
  p_professional_id uuid,
  p_service_id      uuid,
  p_date_from       date,
  p_date_to         date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling
AS $$
DECLARE
  v_duration    int;
  v_interval    interval;
  v_day         date;
  v_dow         smallint;
  v_avail       scheduling.professional_availability%ROWTYPE;
  v_slot_start  timestamptz;
  v_slot_end    timestamptz;
  v_break_start timestamptz;
  v_break_end   timestamptz;
  v_conflicts   int;
  v_slots       jsonb := '[]'::jsonb;
BEGIN
  SELECT duration_minutes INTO v_duration
  FROM scheduling.services
  WHERE id = p_service_id AND tenant_id = p_tenant_id;

  IF v_duration IS NULL THEN
    RETURN '[]'::json;
  END IF;

  v_interval := (v_duration || ' minutes')::interval;
  v_day      := p_date_from;

  WHILE v_day <= p_date_to LOOP
    v_dow := EXTRACT(DOW FROM v_day)::smallint;

    SELECT * INTO v_avail
    FROM scheduling.professional_availability
    WHERE tenant_id       = p_tenant_id
      AND professional_id = p_professional_id
      AND day_of_week     = v_dow
      AND is_available    = true;

    IF FOUND THEN
      v_break_start := CASE WHEN v_avail.break_start IS NOT NULL
        THEN (v_day::text || ' ' || v_avail.break_start::text)::timestamptz END;
      v_break_end   := CASE WHEN v_avail.break_end IS NOT NULL
        THEN (v_day::text || ' ' || v_avail.break_end::text)::timestamptz END;

      v_slot_start := (v_day::text || ' ' || v_avail.start_time::text)::timestamptz;

      WHILE v_slot_start + v_interval <=
            (v_day::text || ' ' || v_avail.end_time::text)::timestamptz
      LOOP
        v_slot_end := v_slot_start + v_interval;

        -- Skip slots that overlap with the break window
        IF v_break_start IS NOT NULL
           AND v_slot_start < v_break_end
           AND v_slot_end   > v_break_start
        THEN
          v_slot_start := v_slot_start + v_interval;
          CONTINUE;
        END IF;

        SELECT COUNT(*) INTO v_conflicts
        FROM scheduling.appointments
        WHERE professional_id    = p_professional_id
          AND tenant_id          = p_tenant_id
          AND status NOT IN ('cancelled', 'no_show')
          AND scheduled_start_at < v_slot_end
          AND scheduled_end_at   > v_slot_start;

        IF v_conflicts = 0 THEN
          v_slots := v_slots || jsonb_build_object(
            'start',           v_slot_start,
            'end',             v_slot_end,
            'professional_id', p_professional_id,
            'service_id',      p_service_id
          );
        END IF;

        v_slot_start := v_slot_start + v_interval;
      END LOOP;
    END IF;

    v_day := v_day + 1;
  END LOOP;

  RETURN v_slots::json;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_get_available_slots(uuid, uuid, uuid, date, date)
  TO anon, authenticated, service_role;
