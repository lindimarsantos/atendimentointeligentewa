-- Migration 100: rpc_n8n_get_slots retorna blocked_days com motivo do bloqueio
--
-- Quando a função pula um dia bloqueado, agora registra qual bloqueio
-- impediu o agendamento. A resposta inclui o campo blocked_days:
--   [{ date, date_label, day_name, title, type }]
-- Sofia usa essa informação para explicar ao cliente o motivo
-- (ex: "não temos horários na terça por ser feriado de Tiradentes").
--
-- Também atualiza operational_rules em ai.ai_agents com a nova regra
-- para que Sofia saiba usar o campo blocked_days.

-- ─── 1. rpc_n8n_get_slots — com blocked_days ─────────────────────────────────

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
  v_block_title     text;
  v_block_type      text;
  v_blocked_days    jsonb := '[]'::jsonb;
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
      'slots', '[]'::json,
      'blocked_days', '[]'::json
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

      -- Verifica bloqueio e coleta o motivo
      SELECT EXISTS (
        SELECT 1 FROM scheduling.blocked_periods bp
        WHERE bp.tenant_id = p_tenant_id
          AND bp.is_active = true
          AND v_day BETWEEN bp.start_date AND bp.end_date
          AND (bp.professional_id IS NULL OR bp.professional_id = v_professional.id)
      ) INTO v_day_blocked;

      IF v_day_blocked THEN
        -- Registra o motivo uma única vez por data
        IF NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_blocked_days) e
          WHERE (e->>'date') = v_day::text
        ) THEN
          SELECT bp.title, bp.type
            INTO v_block_title, v_block_type
          FROM scheduling.blocked_periods bp
          WHERE bp.tenant_id = p_tenant_id
            AND bp.is_active = true
            AND v_day BETWEEN bp.start_date AND bp.end_date
            AND (bp.professional_id IS NULL OR bp.professional_id = v_professional.id)
          ORDER BY bp.professional_id NULLS LAST
          LIMIT 1;

          v_day_name := CASE EXTRACT(DOW FROM v_day)
            WHEN 0 THEN 'domingo'
            WHEN 1 THEN 'segunda-feira'
            WHEN 2 THEN 'terça-feira'
            WHEN 3 THEN 'quarta-feira'
            WHEN 4 THEN 'quinta-feira'
            WHEN 5 THEN 'sexta-feira'
            WHEN 6 THEN 'sábado'
          END;

          v_blocked_days := v_blocked_days || jsonb_build_object(
            'date',       v_day,
            'date_label', TO_CHAR(v_day, 'DD/MM/YYYY'),
            'day_name',   v_day_name,
            'title',      v_block_title,
            'type',       v_block_type
          );
        END IF;

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
    'slots',        v_slots,
    'blocked_days', v_blocked_days
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_n8n_get_slots(uuid, text, text, date, date, int)
  TO anon, authenticated, service_role;

-- ─── 2. Adiciona regra sobre blocked_days nas operational_rules existentes ────

UPDATE ai.ai_agents
SET operational_rules = operational_rules ||
E'\n- Quando verificar_horarios retornar blocked_days com datas que coincidem com o que o cliente pediu, mencione o motivo na resposta. Exemplo: "Infelizmente não temos horários disponíveis na terça-feira, 21 de abril, pois é feriado de Tiradentes. Posso verificar outros dias?" — use o campo title do blocked_days como motivo.'
WHERE operational_rules IS NOT NULL
  AND operational_rules NOT LIKE '%blocked_days%';
