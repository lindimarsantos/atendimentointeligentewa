-- ============================================================
-- Migration 027: Professional availability (weekly schedule)
--
-- scheduling.professional_availability stores per-professional
-- weekly recurring availability windows used by the AI to
-- offer booking slots to customers.
-- ============================================================

-- ── 1. Table ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scheduling.professional_availability (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL,
  professional_id uuid        NOT NULL,
  day_of_week     smallint    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Dom, 6=Sáb
  start_time      time        NOT NULL DEFAULT '09:00',
  end_time        time        NOT NULL DEFAULT '18:00',
  is_available    boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, professional_id, day_of_week)
);

-- ── 2. rpc_get_professional_availability ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_get_professional_availability(
  p_tenant_id       uuid,
  p_professional_id uuid
)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, scheduling
AS $$
  SELECT COALESCE(
    json_agg(row_to_json(a) ORDER BY a.day_of_week),
    '[]'::json
  )
  FROM scheduling.professional_availability a
  WHERE a.tenant_id       = p_tenant_id
    AND a.professional_id = p_professional_id;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_get_professional_availability(uuid, uuid)
  TO anon, authenticated, service_role;

-- ── 3. rpc_upsert_professional_availability ───────────────────────────────────
-- Replaces the full weekly schedule for a professional.
-- p_slots: [{day_of_week, start_time, end_time, is_available}, ...]

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
    (tenant_id, professional_id, day_of_week, start_time, end_time, is_available)
  SELECT
    p_tenant_id,
    p_professional_id,
    (s->>'day_of_week')::smallint,
    (s->>'start_time')::time,
    (s->>'end_time')::time,
    COALESCE((s->>'is_available')::boolean, true)
  FROM jsonb_array_elements(p_slots) s;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_upsert_professional_availability(uuid, uuid, jsonb)
  TO anon, authenticated, service_role;

-- ── 4. rpc_get_available_slots ────────────────────────────────────────────────
-- Generates available time slots for a professional+service over a date range.
-- Excludes slots that conflict with existing non-cancelled appointments.
-- Returns [{start, end, professional_id, service_id}, ...]

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
  v_duration   int;
  v_interval   interval;
  v_day        date;
  v_dow        smallint;
  v_avail      scheduling.professional_availability%ROWTYPE;
  v_slot_start timestamptz;
  v_slot_end   timestamptz;
  v_conflicts  int;
  v_slots      jsonb := '[]'::jsonb;
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
      v_slot_start := (v_day::text || ' ' || v_avail.start_time::text)::timestamptz;

      WHILE v_slot_start + v_interval <=
            (v_day::text || ' ' || v_avail.end_time::text)::timestamptz
      LOOP
        v_slot_end := v_slot_start + v_interval;

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
