-- ============================================================
-- Migration 034: n8n-friendly scheduling RPCs
--
-- These wrappers let n8n / the AI call scheduling by name
-- (service name, professional name) instead of UUIDs.
-- The functions resolve names → IDs internally.
--
-- rpc_n8n_get_slots        — find available slots by service name
-- rpc_n8n_book_appointment — book an appointment by service name
-- ============================================================

-- ── rpc_n8n_get_slots ─────────────────────────────────────────────────────────
-- Returns up to p_limit available slots for a service (identified by name).
-- If p_professional_name is provided, restricts to that professional.
-- Slots are returned with human-readable labels for the AI to present.
--
-- Example call from n8n:
--   POST /rest/v1/rpc/rpc_n8n_get_slots
--   { "p_tenant_id": "...", "p_service_name": "Avaliação de Implante",
--     "p_date_from": "2026-04-13", "p_date_to": "2026-04-18" }

CREATE OR REPLACE FUNCTION public.rpc_n8n_get_slots(
  p_tenant_id          uuid,
  p_service_name       text,
  p_professional_name  text    DEFAULT NULL,
  p_date_from          date    DEFAULT NULL,   -- defaults to tomorrow
  p_date_to            date    DEFAULT NULL,   -- defaults to +14 days
  p_limit              int     DEFAULT 8
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling
AS $$
DECLARE
  v_service_id      uuid;
  v_service_name    text;
  v_duration        int;
  v_interval        interval;
  v_professional    RECORD;
  v_avail           scheduling.professional_availability%ROWTYPE;
  v_day             date;
  v_dow             smallint;
  v_slot_start      timestamptz;
  v_slot_end        timestamptz;
  v_conflicts       int;
  v_slots           jsonb := '[]'::jsonb;
  v_count           int   := 0;
  v_date_from       date;
  v_date_to         date;
BEGIN
  -- Default date range
  v_date_from := COALESCE(p_date_from, CURRENT_DATE + 1);
  v_date_to   := COALESCE(p_date_to,   CURRENT_DATE + 14);

  -- Resolve service by name (case-insensitive, active only)
  SELECT id, name, duration_minutes
    INTO v_service_id, v_service_name, v_duration
  FROM scheduling.services
  WHERE tenant_id  = p_tenant_id
    AND is_active  = true
    AND lower(name) = lower(p_service_name)
  LIMIT 1;

  IF v_service_id IS NULL THEN
    -- Fuzzy fallback: partial match
    SELECT id, name, duration_minutes
      INTO v_service_id, v_service_name, v_duration
    FROM scheduling.services
    WHERE tenant_id = p_tenant_id
      AND is_active = true
      AND lower(name) LIKE '%' || lower(p_service_name) || '%'
    LIMIT 1;
  END IF;

  IF v_service_id IS NULL THEN
    RETURN json_build_object(
      'error', 'Serviço não encontrado: ' || p_service_name,
      'slots', '[]'::json
    );
  END IF;

  v_interval := (v_duration || ' minutes')::interval;

  -- Iterate over linked professionals
  FOR v_professional IN
    SELECT p.id, p.name
    FROM scheduling.professionals p
    JOIN scheduling.service_professional_links l
      ON l.professional_id = p.id AND l.tenant_id = p_tenant_id
    WHERE l.service_id  = v_service_id
      AND l.is_active   = true
      AND p.tenant_id   = p_tenant_id
      AND p.status      = 'active'
      AND (
        p_professional_name IS NULL
        OR lower(p.name) = lower(p_professional_name)
        OR lower(p.name) LIKE '%' || lower(p_professional_name) || '%'
      )
    ORDER BY p.name
  LOOP
    EXIT WHEN v_count >= p_limit;

    v_day := v_date_from;
    WHILE v_day <= v_date_to AND v_count < p_limit LOOP
      v_dow := EXTRACT(DOW FROM v_day)::smallint;

      SELECT * INTO v_avail
      FROM scheduling.professional_availability
      WHERE tenant_id       = p_tenant_id
        AND professional_id = v_professional.id
        AND day_of_week     = v_dow
        AND is_available    = true;

      IF FOUND THEN
        v_slot_start := (v_day::text || ' ' || v_avail.start_time::text)::timestamptz;

        WHILE v_slot_start + v_interval <=
              (v_day::text || ' ' || v_avail.end_time::text)::timestamptz
          AND v_count < p_limit
        LOOP
          v_slot_end := v_slot_start + v_interval;

          -- Skip break period if configured
          IF v_avail.break_start IS NOT NULL AND v_avail.break_end IS NOT NULL THEN
            IF v_slot_start < (v_day::text || ' ' || v_avail.break_end::text)::timestamptz
            AND v_slot_end  > (v_day::text || ' ' || v_avail.break_start::text)::timestamptz
            THEN
              v_slot_start := v_slot_start + v_interval;
              CONTINUE;
            END IF;
          END IF;

          SELECT COUNT(*) INTO v_conflicts
          FROM scheduling.appointments
          WHERE professional_id    = v_professional.id
            AND tenant_id          = p_tenant_id
            AND status NOT IN ('cancelled', 'no_show')
            AND scheduled_start_at < v_slot_end
            AND scheduled_end_at   > v_slot_start;

          IF v_conflicts = 0 THEN
            v_slots := v_slots || jsonb_build_object(
              'start',             v_slot_start,
              'end',               v_slot_end,
              'professional_id',   v_professional.id,
              'professional_name', v_professional.name,
              'service_id',        v_service_id,
              'service_name',      v_service_name,
              'duration_minutes',  v_duration
            );
            v_count := v_count + 1;
          END IF;

          v_slot_start := v_slot_start + v_interval;
        END LOOP;
      END IF;

      v_day := v_day + 1;
    END LOOP;
  END LOOP;

  RETURN json_build_object(
    'service_name', v_service_name,
    'slots',        v_slots
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_n8n_get_slots(uuid, text, text, date, date, int)
  TO anon, authenticated, service_role;


-- ── rpc_n8n_book_appointment ──────────────────────────────────────────────────
-- Books an appointment by service + professional name.
-- Resolves names → IDs internally. Creates the appointment and returns
-- confirmation details for the AI to relay to the customer.
--
-- Example call from n8n:
--   POST /rest/v1/rpc/rpc_n8n_book_appointment
--   { "p_tenant_id": "...", "p_conversation_id": "...", "p_customer_id": "...",
--     "p_service_name": "Avaliação de Implante",
--     "p_professional_name": "Dra. Ana",
--     "p_start_at": "2026-04-14T09:00:00-03:00" }

CREATE OR REPLACE FUNCTION public.rpc_n8n_book_appointment(
  p_tenant_id          uuid,
  p_conversation_id    uuid,
  p_customer_id        uuid,
  p_service_name       text,
  p_professional_name  text,
  p_start_at           timestamptz,
  p_notes              text    DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling
AS $$
DECLARE
  v_service_id      uuid;
  v_service_name    text;
  v_duration        int;
  v_professional_id uuid;
  v_pro_name        text;
  v_end_at          timestamptz;
  v_appointment_id  uuid;
  v_conflicts       int;
BEGIN
  -- Resolve service
  SELECT id, name, duration_minutes
    INTO v_service_id, v_service_name, v_duration
  FROM scheduling.services
  WHERE tenant_id = p_tenant_id
    AND is_active = true
    AND (lower(name) = lower(p_service_name)
         OR lower(name) LIKE '%' || lower(p_service_name) || '%')
  LIMIT 1;

  IF v_service_id IS NULL THEN
    RETURN json_build_object('error', 'Serviço não encontrado: ' || p_service_name);
  END IF;

  -- Resolve professional
  SELECT p.id, p.name
    INTO v_professional_id, v_pro_name
  FROM scheduling.professionals p
  JOIN scheduling.service_professional_links l
    ON l.professional_id = p.id AND l.tenant_id = p_tenant_id
  WHERE l.service_id  = v_service_id
    AND l.is_active   = true
    AND p.tenant_id   = p_tenant_id
    AND p.status      = 'active'
    AND (lower(p.name) = lower(p_professional_name)
         OR lower(p.name) LIKE '%' || lower(p_professional_name) || '%')
  LIMIT 1;

  IF v_professional_id IS NULL THEN
    RETURN json_build_object('error', 'Profissional não encontrado: ' || p_professional_name);
  END IF;

  v_end_at := p_start_at + (v_duration || ' minutes')::interval;

  -- Check for conflicts
  SELECT COUNT(*) INTO v_conflicts
  FROM scheduling.appointments
  WHERE professional_id    = v_professional_id
    AND tenant_id          = p_tenant_id
    AND status NOT IN ('cancelled', 'no_show')
    AND scheduled_start_at < v_end_at
    AND scheduled_end_at   > p_start_at;

  IF v_conflicts > 0 THEN
    RETURN json_build_object('error', 'Horário não disponível — existe conflito de agenda');
  END IF;

  -- Create appointment
  INSERT INTO scheduling.appointments (
    tenant_id,
    customer_id,
    professional_id,
    service_id,
    scheduled_start_at,
    scheduled_end_at,
    status,
    notes
  ) VALUES (
    p_tenant_id,
    p_customer_id,
    v_professional_id,
    v_service_id,
    p_start_at,
    v_end_at,
    'scheduled',
    p_notes
  )
  RETURNING id INTO v_appointment_id;

  RETURN json_build_object(
    'appointment_id',     v_appointment_id,
    'service_name',       v_service_name,
    'professional_name',  v_pro_name,
    'start_at',           p_start_at,
    'end_at',             v_end_at,
    'duration_minutes',   v_duration,
    'status',             'scheduled'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_n8n_book_appointment(uuid, uuid, uuid, text, text, timestamptz, text)
  TO anon, authenticated, service_role;
