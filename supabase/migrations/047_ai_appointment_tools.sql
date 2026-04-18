-- ============================================================
-- Migration 047: AI tools — consultar e reagendar agendamentos
--
-- rpc_ai_get_appointments  — lista agendamentos futuros do cliente
-- rpc_ai_reschedule_appointment — cancela o atual e cria um novo
--
-- Seguem o mesmo padrão das tools existentes: recebem apenas
-- conversation_id + parâmetros semânticos; resolvem tenant/customer
-- internamente.
-- ============================================================

-- ── 1. rpc_ai_get_appointments ───────────────────────────────────────────────
-- Retorna agendamentos confirmados/pendentes do cliente.
-- Por padrão traz apenas os futuros; com p_include_past=true
-- inclui também os dos últimos 30 dias (útil para "meu último agendamento").

CREATE OR REPLACE FUNCTION public.rpc_ai_get_appointments(
  p_conversation_id uuid,
  p_include_past    boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, scheduling, crm
AS $$
DECLARE
  v_tenant_id   uuid;
  v_customer_id uuid;
BEGIN
  SELECT tenant_id, customer_id
    INTO v_tenant_id, v_customer_id
  FROM messaging.conversations
  WHERE id = p_conversation_id
  LIMIT 1;

  IF v_tenant_id IS NULL OR v_customer_id IS NULL THEN
    RETURN json_build_object('error', 'Conversa ou cliente não encontrado', 'appointments', '[]'::json);
  END IF;

  RETURN (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'id',                  a.id,
          'service_name',        sv.name,
          'professional_name',   pr.name,
          'scheduled_start_at',  to_char(a.scheduled_start_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
          'scheduled_start_iso', a.scheduled_start_at,
          'status',              a.status::text,
          'notes',               a.notes
        )
        ORDER BY a.scheduled_start_at ASC
      ),
      '[]'::json
    )
    FROM scheduling.appointments a
    LEFT JOIN scheduling.services      sv ON sv.id = a.service_id
    LEFT JOIN scheduling.professionals pr ON pr.id = a.professional_id
    WHERE a.tenant_id   = v_tenant_id
      AND a.customer_id = v_customer_id
      AND a.status      NOT IN ('cancelled', 'no_show', 'completed')
      AND (
        p_include_past = true
        OR a.scheduled_start_at >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::timestamptz
      )
      AND (
        p_include_past = false
        OR a.scheduled_start_at >= NOW() - interval '30 days'
      )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_ai_get_appointments(uuid, boolean)
  TO anon, authenticated, service_role;


-- ── 2. rpc_ai_reschedule_appointment ─────────────────────────────────────────
-- Cancela o agendamento existente (marca como 'rescheduled') e cria
-- um novo no horário solicitado, mantendo serviço e profissional.
-- Valida que o agendamento pertence ao cliente da conversa.

CREATE OR REPLACE FUNCTION public.rpc_ai_reschedule_appointment(
  p_conversation_id uuid,
  p_appointment_id  uuid,
  p_new_start_at    timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, scheduling
AS $$
DECLARE
  v_tenant_id       uuid;
  v_customer_id     uuid;
  v_service_id      uuid;
  v_professional_id uuid;
  v_service_name    text;
  v_professional_name text;
  v_result          json;
BEGIN
  -- Resolve tenant e customer
  SELECT tenant_id, customer_id
    INTO v_tenant_id, v_customer_id
  FROM messaging.conversations
  WHERE id = p_conversation_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN json_build_object('error', 'Conversa não encontrada');
  END IF;

  -- Valida que o agendamento pertence a este cliente
  SELECT a.service_id, a.professional_id, sv.name, pr.name
    INTO v_service_id, v_professional_id, v_service_name, v_professional_name
  FROM scheduling.appointments a
  LEFT JOIN scheduling.services      sv ON sv.id = a.service_id
  LEFT JOIN scheduling.professionals pr ON pr.id = a.professional_id
  WHERE a.id          = p_appointment_id
    AND a.tenant_id   = v_tenant_id
    AND a.customer_id = v_customer_id
    AND a.status      NOT IN ('cancelled', 'no_show', 'completed')
  LIMIT 1;

  IF v_service_id IS NULL THEN
    RETURN json_build_object('error', 'Agendamento não encontrado ou não pertence a este cliente');
  END IF;

  -- Marca o agendamento atual como reagendado
  UPDATE scheduling.appointments
  SET status     = 'rescheduled',
      updated_at = now()
  WHERE id = p_appointment_id;

  -- Cria o novo agendamento reutilizando serviço e profissional
  SELECT public.rpc_n8n_book_appointment(
    p_tenant_id         => v_tenant_id,
    p_conversation_id   => p_conversation_id,
    p_customer_id       => v_customer_id,
    p_service_name      => v_service_name,
    p_professional_name => v_professional_name,
    p_start_at          => p_new_start_at,
    p_notes             => 'Reagendado pelo assistente virtual'
  ) INTO v_result;

  -- Retorna resultado enriquecido
  IF v_result->>'error' IS NOT NULL THEN
    -- Novo horário indisponível — desfaz o cancelamento
    UPDATE scheduling.appointments
    SET status     = 'confirmed',
        updated_at = now()
    WHERE id = p_appointment_id;

    RETURN v_result;
  END IF;

  RETURN json_build_object(
    'success',            true,
    'message',            'Agendamento reagendado com sucesso',
    'old_appointment_id', p_appointment_id,
    'new_appointment',    v_result,
    'service_name',       v_service_name,
    'professional_name',  v_professional_name,
    'new_start_at',       to_char(p_new_start_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_ai_reschedule_appointment(uuid, uuid, timestamptz)
  TO anon, authenticated, service_role;
