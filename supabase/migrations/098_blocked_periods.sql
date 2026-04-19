-- Migration 098: Feriados, Férias e Recesso (Blocked Periods)
--
-- 1. Cria scheduling.blocked_periods
-- 2. RPCs CRUD: rpc_list_blocked_periods, rpc_upsert_blocked_period, rpc_delete_blocked_period
-- 3. Atualiza rpc_n8n_get_slots para excluir dias bloqueados

-- ─── 1. Tabela ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scheduling.blocked_periods (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL,
  type            text        NOT NULL CHECK (type IN ('holiday','professional_vacation','company_recess')),
  title           text        NOT NULL,
  professional_id uuid        DEFAULT NULL,  -- NULL = aplica à empresa toda
  start_date      date        NOT NULL,
  end_date        date        NOT NULL,
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocked_periods_dates_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS blocked_periods_tenant_dates_idx
  ON scheduling.blocked_periods (tenant_id, start_date, end_date);

ALTER TABLE scheduling.blocked_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY blocked_periods_service_role ON scheduling.blocked_periods
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON scheduling.blocked_periods
  TO service_role, authenticated;

-- ─── 2. rpc_list_blocked_periods ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_list_blocked_periods(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.start_date, t.title), '[]'::json)
    FROM (
      SELECT
        bp.id, bp.tenant_id, bp.type, bp.title,
        bp.professional_id,
        p.name AS professional_name,
        bp.start_date, bp.end_date,
        bp.is_active, bp.created_at, bp.updated_at
      FROM scheduling.blocked_periods bp
      LEFT JOIN scheduling.professionals p ON p.id = bp.professional_id
      WHERE bp.tenant_id = p_tenant_id
    ) t
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_list_blocked_periods(uuid)
  TO anon, authenticated, service_role;

-- ─── 3. rpc_upsert_blocked_period ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_upsert_blocked_period(
  p_tenant_id       uuid,
  p_id              uuid    DEFAULT NULL,
  p_type            text    DEFAULT 'holiday',
  p_title           text    DEFAULT NULL,
  p_professional_id uuid    DEFAULT NULL,
  p_start_date      date    DEFAULT NULL,
  p_end_date        date    DEFAULT NULL,
  p_is_active       boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling
AS $$
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE scheduling.blocked_periods SET
      type            = COALESCE(p_type,       type),
      title           = COALESCE(p_title,      title),
      professional_id = p_professional_id,
      start_date      = COALESCE(p_start_date, start_date),
      end_date        = COALESCE(p_end_date,   end_date),
      is_active       = COALESCE(p_is_active,  is_active),
      updated_at      = now()
    WHERE id = p_id AND tenant_id = p_tenant_id;
  ELSE
    INSERT INTO scheduling.blocked_periods
      (tenant_id, type, title, professional_id, start_date, end_date, is_active)
    VALUES
      (p_tenant_id, p_type, p_title, p_professional_id, p_start_date, p_end_date, p_is_active);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_upsert_blocked_period(uuid,uuid,text,text,uuid,date,date,boolean)
  TO anon, authenticated, service_role;

-- ─── 4. rpc_delete_blocked_period ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_delete_blocked_period(p_tenant_id uuid, p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling
AS $$
BEGIN
  DELETE FROM scheduling.blocked_periods WHERE id = p_id AND tenant_id = p_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_delete_blocked_period(uuid,uuid)
  TO anon, authenticated, service_role;

-- ─── 5. rpc_n8n_get_slots — exclui dias bloqueados ───────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_n8n_get_slots(
  p_tenant_id          uuid,
  p_service_name       text,
  p_professional_name  text    DEFAULT NULL,
  p_date_from          date    DEFAULT NULL,
  p_date_to            date    DEFAULT NULL,
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
  v_slot_brt        timestamptz;
  v_conflicts       int;
  v_slots           jsonb := '[]'::jsonb;
  v_count           int   := 0;
  v_date_from       date;
  v_date_to         date;
  v_day_name        text;
  v_day_blocked     boolean;
BEGIN
  v_date_from := COALESCE(p_date_from, CURRENT_DATE + 1);
  v_date_to   := COALESCE(p_date_to,   CURRENT_DATE + 14);

  SELECT id, name, duration_minutes
    INTO v_service_id, v_service_name, v_duration
  FROM scheduling.services
  WHERE tenant_id = p_tenant_id
    AND is_active = true
    AND lower(name) = lower(p_service_name)
  LIMIT 1;

  IF v_service_id IS NULL THEN
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

  FOR v_professional IN
    SELECT p.id, p.name
    FROM scheduling.professionals p
    JOIN scheduling.service_professional_links l
      ON l.professional_id = p.id AND l.tenant_id = p_tenant_id
    WHERE l.service_id = v_service_id
      AND l.is_active  = true
      AND p.tenant_id  = p_tenant_id
      AND p.status     = 'active'
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

      -- Verifica se o dia está bloqueado (feriado, recesso ou férias do profissional)
      SELECT EXISTS (
        SELECT 1 FROM scheduling.blocked_periods bp
        WHERE bp.tenant_id = p_tenant_id
          AND bp.is_active = true
          AND v_day BETWEEN bp.start_date AND bp.end_date
          AND (bp.professional_id IS NULL OR bp.professional_id = v_professional.id)
      ) INTO v_day_blocked;

      IF v_day_blocked THEN
        v_day := v_day + 1;
        CONTINUE;
      END IF;

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
            v_slot_brt := v_slot_start AT TIME ZONE 'America/Sao_Paulo';
            v_day_name := CASE EXTRACT(DOW FROM v_slot_brt)
              WHEN 0 THEN 'domingo'
              WHEN 1 THEN 'segunda-feira'
              WHEN 2 THEN 'terça-feira'
              WHEN 3 THEN 'quarta-feira'
              WHEN 4 THEN 'quinta-feira'
              WHEN 5 THEN 'sexta-feira'
              WHEN 6 THEN 'sábado'
            END;

            v_slots := v_slots || jsonb_build_object(
              'start',             v_slot_start,
              'end',               v_slot_end,
              'day_name',          v_day_name,
              'date_label',        TO_CHAR(v_slot_brt, 'DD/MM/YYYY'),
              'time_label',        TO_CHAR(v_slot_brt, 'HH24:MI'),
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
