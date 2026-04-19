-- Migration 094: Orientações e Requisitos para o Agendamento
--
-- 1. Adiciona coluna preparation_instructions em scheduling.services
-- 2. Atualiza rpc_upsert_service e rpc_list_services
-- 3. Atualiza rpc_n8n_book_appointment e rpc_ai_book_appointment
--    para retornar as instruções na confirmação
-- 4. Cria rpc_n8n_get_appointment_reminders para o workflow de lembretes
-- 5. Adiciona coluna reminder_sent_at em scheduling.appointments
--    para evitar envios duplicados

-- ─── 1. Coluna na tabela de serviços ─────────────────────────────────────────

ALTER TABLE scheduling.services
  ADD COLUMN IF NOT EXISTS preparation_instructions text DEFAULT NULL;

-- ─── 2. Coluna reminder_sent_at em appointments ───────────────────────────────

ALTER TABLE scheduling.appointments
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz DEFAULT NULL;

-- ─── 3. rpc_upsert_service — inclui preparation_instructions ─────────────────

CREATE OR REPLACE FUNCTION public.rpc_upsert_service(
  p_tenant_id                uuid,
  p_id                       uuid    DEFAULT NULL,
  p_name                     text    DEFAULT NULL,
  p_description              text    DEFAULT NULL,
  p_duration_minutes         int     DEFAULT 30,
  p_price_min                numeric DEFAULT NULL,
  p_price_max                numeric DEFAULT NULL,
  p_requires_evaluation      boolean DEFAULT false,
  p_is_active                boolean DEFAULT true,
  p_preparation_instructions text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling
AS $$
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE scheduling.services
    SET
      name                     = COALESCE(p_name, name),
      description              = p_description,
      duration_minutes         = COALESCE(p_duration_minutes, duration_minutes),
      price_from               = p_price_min,
      price_to                 = p_price_max,
      requires_evaluation      = COALESCE(p_requires_evaluation, requires_evaluation),
      is_active                = COALESCE(p_is_active, is_active),
      preparation_instructions = p_preparation_instructions,
      updated_at               = now()
    WHERE id = p_id AND tenant_id = p_tenant_id;
  ELSE
    INSERT INTO scheduling.services
      (tenant_id, name, description, duration_minutes, price_from, price_to,
       requires_evaluation, is_active, preparation_instructions)
    VALUES
      (p_tenant_id, p_name, p_description, p_duration_minutes, p_price_min, p_price_max,
       p_requires_evaluation, p_is_active, p_preparation_instructions);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_upsert_service(uuid,uuid,text,text,int,numeric,numeric,boolean,boolean,text)
  TO anon, authenticated, service_role;

-- ─── 4. rpc_list_services — inclui preparation_instructions ──────────────────

CREATE OR REPLACE FUNCTION public.rpc_list_services(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(t) ORDER BY t.name)
    FROM (
      SELECT
        id, tenant_id, name, description,
        duration_minutes,
        price_from               AS price_min,
        price_to                 AS price_max,
        requires_evaluation, is_active,
        preparation_instructions,
        created_at, updated_at
      FROM scheduling.services
      WHERE tenant_id = p_tenant_id
    ) t
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_list_services(uuid)
  TO anon, authenticated, service_role;

-- ─── 5. rpc_n8n_book_appointment — retorna preparation_instructions ───────────

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
  v_service_id             uuid;
  v_service_name           text;
  v_duration               int;
  v_preparation_instructions text;
  v_professional_id        uuid;
  v_pro_name               text;
  v_end_at                 timestamptz;
  v_appointment_id         uuid;
  v_conflicts              int;
BEGIN
  SELECT id, name, duration_minutes, preparation_instructions
    INTO v_service_id, v_service_name, v_duration, v_preparation_instructions
  FROM scheduling.services
  WHERE tenant_id = p_tenant_id
    AND is_active = true
    AND (lower(name) = lower(p_service_name)
         OR lower(name) LIKE '%' || lower(p_service_name) || '%')
  LIMIT 1;

  IF v_service_id IS NULL THEN
    RETURN json_build_object('error', 'Serviço não encontrado: ' || p_service_name);
  END IF;

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

  INSERT INTO scheduling.appointments (
    tenant_id, customer_id, professional_id, service_id,
    scheduled_start_at, scheduled_end_at, status, notes
  ) VALUES (
    p_tenant_id, p_customer_id, v_professional_id, v_service_id,
    p_start_at, v_end_at, 'scheduled', p_notes
  )
  RETURNING id INTO v_appointment_id;

  RETURN json_build_object(
    'appointment_id',          v_appointment_id,
    'service_name',            v_service_name,
    'professional_name',       v_pro_name,
    'start_at',                p_start_at,
    'end_at',                  v_end_at,
    'duration_minutes',        v_duration,
    'status',                  'scheduled',
    'preparation_instructions', v_preparation_instructions
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_n8n_book_appointment(uuid,uuid,uuid,text,text,timestamptz,text)
  TO anon, authenticated, service_role;

-- ─── 6. rpc_n8n_get_appointment_reminders ────────────────────────────────────
-- Chamada pelo workflow de lembretes a cada 30 min.
-- Retorna agendamentos que caem na janela de aviso de cada regra ativa,
-- ainda não lembrados (reminder_sent_at IS NULL), e marca-os atomicamente.

CREATE OR REPLACE FUNCTION public.rpc_n8n_get_appointment_reminders(
  p_tenant_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling, crm, messaging, ops
AS $$
DECLARE
  v_results jsonb := '[]'::jsonb;
BEGIN
  -- Para cada regra ativa, busca agendamentos na janela de lembrete
  WITH rules AS (
    SELECT hours_before
    FROM ops.reminder_rules
    WHERE tenant_id = p_tenant_id
      AND is_active = true
      AND trigger_type = 'appointment_before'
      AND hours_before IS NOT NULL
  ),
  due_appointments AS (
    SELECT DISTINCT ON (a.id)
      a.id                                          AS appointment_id,
      a.tenant_id,
      a.scheduled_start_at,
      cu.full_name                                  AS customer_name,
      cu.phone                                      AS customer_phone,
      p.name                                        AS professional_name,
      s.name                                        AS service_name,
      s.preparation_instructions,
      tc.external_account_id                        AS zapi_instance_id,
      tc.config_jsonb->>'zapi_token'                AS zapi_token,
      tc.config_jsonb->>'zapi_client_token'         AS zapi_client_token
    FROM scheduling.appointments a
    JOIN rules r
      ON a.scheduled_start_at BETWEEN
           NOW() + ((r.hours_before - 1) || ' hours')::interval
         AND NOW() + ((r.hours_before + 1) || ' hours')::interval
    JOIN crm.customers cu
      ON cu.id = a.customer_id
    JOIN scheduling.professionals p
      ON p.id = a.professional_id
    JOIN scheduling.services s
      ON s.id = a.service_id
    JOIN messaging.conversations conv
      ON conv.customer_id = a.customer_id
         AND conv.tenant_id = a.tenant_id
    JOIN messaging.tenant_channels tc
      ON tc.tenant_id = a.tenant_id AND tc.is_active = true
    WHERE a.tenant_id      = p_tenant_id
      AND a.status         = 'scheduled'
      AND a.reminder_sent_at IS NULL
      AND cu.phone IS NOT NULL
      AND tc.external_account_id IS NOT NULL
    ORDER BY a.id, a.scheduled_start_at
  )
  SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json)
  INTO v_results
  FROM due_appointments d;

  -- Marca os agendamentos retornados como lembrados
  UPDATE scheduling.appointments
  SET reminder_sent_at = NOW()
  WHERE id IN (
    SELECT (elem->>'appointment_id')::uuid
    FROM jsonb_array_elements(v_results) AS elem
  );

  RETURN v_results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_n8n_get_appointment_reminders(uuid)
  TO anon, authenticated, service_role;
