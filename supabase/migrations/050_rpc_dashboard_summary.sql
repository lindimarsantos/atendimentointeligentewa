-- ============================================================
-- Migration 050: rpc_dashboard_summary (completa e corrigida)
--
-- Corrige "Eficiência da IA" que mostrava 0% sempre.
-- Cálculos:
--   bot_resolution_rate = conversas resolvidas SEM handoff / total resolvidas
--   handoff_rate        = conversas COM handoff / total de conversas (30d)
--   avg_first_response  = tempo mediano entre 1ª msg inbound e 1ª outbound
--   avg_resolution      = tempo médio do início até resolução
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_dashboard_summary(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, scheduling, crm, ai, ops, config
AS $$
DECLARE
  v_customers    json;
  v_convs        json;
  v_messages     json;
  v_appointments json;
  v_jobs         json;
  v_reminders    json;
  v_performance  json;
BEGIN

  -- ── Clientes ──────────────────────────────────────────────────────────────
  SELECT json_build_object(
    'total',     COUNT(*),
    'leads',     COUNT(*) FILTER (WHERE status::text = 'lead'),
    'active',    COUNT(*) FILTER (WHERE status::text = 'active'),
    'new_today', COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE),
    'new_week',  COUNT(*) FILTER (WHERE created_at >= date_trunc('week', NOW()))
  ) INTO v_customers
  FROM crm.customers
  WHERE tenant_id = p_tenant_id;

  -- ── Conversas ─────────────────────────────────────────────────────────────
  SELECT json_build_object(
    'total',          COUNT(*),
    'open',           COUNT(*) FILTER (WHERE status::text = 'open'),
    'bot_active',     COUNT(*) FILTER (WHERE status::text = 'bot_active'),
    'waiting_human',  COUNT(*) FILTER (WHERE status::text = 'waiting_human'),
    'resolved',       COUNT(*) FILTER (WHERE status::text = 'resolved'),
    'resolved_today', COUNT(*) FILTER (WHERE status::text = 'resolved'
                                         AND updated_at::date = CURRENT_DATE),
    'pending',        COUNT(*) FILTER (WHERE status::text = 'pending')
  ) INTO v_convs
  FROM messaging.conversations
  WHERE tenant_id = p_tenant_id;

  -- ── Mensagens ─────────────────────────────────────────────────────────────
  SELECT json_build_object(
    'total',    COUNT(*),
    'today',    COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE),
    'inbound',  COUNT(*) FILTER (WHERE direction::text = 'inbound'),
    'outbound', COUNT(*) FILTER (WHERE direction::text = 'outbound')
  ) INTO v_messages
  FROM messaging.messages
  WHERE tenant_id = p_tenant_id;

  -- ── Agendamentos ──────────────────────────────────────────────────────────
  SELECT json_build_object(
    'total',     COUNT(*),
    'today',     COUNT(*) FILTER (WHERE scheduled_start_at::date = CURRENT_DATE),
    'tomorrow',  COUNT(*) FILTER (WHERE scheduled_start_at::date = CURRENT_DATE + 1),
    'confirmed', COUNT(*) FILTER (WHERE status::text = 'confirmed'),
    'pending',   COUNT(*) FILTER (WHERE status::text = 'pending'),
    'completed', COUNT(*) FILTER (WHERE status::text = 'completed'),
    'cancelled', COUNT(*) FILTER (WHERE status::text = 'cancelled'),
    'no_show',   COUNT(*) FILTER (WHERE status::text = 'no_show')
  ) INTO v_appointments
  FROM scheduling.appointments
  WHERE tenant_id = p_tenant_id;

  -- ── Jobs (public.job_queue) ────────────────────────────────────────────────
  BEGIN
    SELECT json_build_object(
      'total',     COUNT(*),
      'pending',   COUNT(*) FILTER (WHERE status::text = 'pending'),
      'completed', COUNT(*) FILTER (WHERE status::text = 'completed'),
      'failed',    COUNT(*) FILTER (WHERE status::text = 'failed')
    ) INTO v_jobs
    FROM public.job_queue
    WHERE tenant_id = p_tenant_id;
  EXCEPTION WHEN undefined_table THEN
    v_jobs := json_build_object('total',0,'pending',0,'completed',0,'failed',0);
  END;

  -- ── Lembretes ─────────────────────────────────────────────────────────────
  SELECT json_build_object(
    'rules_active',      COUNT(*) FILTER (WHERE is_active = true),
    'dispatches_sent',   0,
    'dispatches_failed', 0
  ) INTO v_reminders
  FROM ops.reminder_rules
  WHERE tenant_id = p_tenant_id;

  -- ── Performance / Eficiência da IA (últimos 30 dias) ──────────────────────
  -- Usa CTE para calcular por conversa e depois agrega.
  -- first_response_sec : latência 1ª msg inbound → 1ª msg outbound
  -- resolution_sec     : duração total até status='resolved'
  -- has_handoff        : existência de registro em ai.agent_handoffs
  WITH conv_window AS (
    SELECT c.id,
           c.status::text            AS status,
           c.started_at,
           c.updated_at
    FROM messaging.conversations c
    WHERE c.tenant_id = p_tenant_id
      AND c.started_at >= NOW() - INTERVAL '30 days'
  ),
  first_msgs AS (
    SELECT
      m.conversation_id,
      MIN(m.created_at) FILTER (WHERE m.direction::text = 'inbound')  AS first_in,
      MIN(m.created_at) FILTER (WHERE m.direction::text = 'outbound') AS first_out
    FROM messaging.messages m
    WHERE m.tenant_id = p_tenant_id
      AND m.conversation_id IN (SELECT id FROM conv_window)
    GROUP BY m.conversation_id
  ),
  handoff_ids AS (
    SELECT DISTINCT conversation_id
    FROM ai.agent_handoffs
    WHERE tenant_id = p_tenant_id
      AND conversation_id IN (SELECT id FROM conv_window)
  ),
  perf AS (
    SELECT
      cw.status,
      EXTRACT(EPOCH FROM (fm.first_out - fm.first_in))              AS first_response_sec,
      CASE WHEN cw.status = 'resolved'
           THEN EXTRACT(EPOCH FROM (cw.updated_at - cw.started_at))
      END                                                             AS resolution_sec,
      (hi.conversation_id IS NOT NULL)                               AS has_handoff
    FROM conv_window cw
    LEFT JOIN first_msgs   fm ON fm.conversation_id = cw.id
    LEFT JOIN handoff_ids  hi ON hi.conversation_id = cw.id
  )
  SELECT json_build_object(
    'avg_first_response_seconds',
        COALESCE(
          ROUND(AVG(first_response_sec)
                FILTER (WHERE first_response_sec IS NOT NULL
                          AND first_response_sec > 0
                          AND first_response_sec < 86400))::bigint,
          0),
    'avg_resolution_seconds',
        COALESCE(
          ROUND(AVG(resolution_sec)
                FILTER (WHERE resolution_sec IS NOT NULL
                          AND resolution_sec > 0))::bigint,
          0),
    'bot_resolution_rate',
        COALESCE(
          COUNT(*) FILTER (WHERE status = 'resolved' AND NOT has_handoff)
          ::numeric / NULLIF(COUNT(*) FILTER (WHERE status = 'resolved'), 0),
          0),
    'handoff_rate',
        COALESCE(
          COUNT(*) FILTER (WHERE has_handoff)
          ::numeric / NULLIF(COUNT(*), 0),
          0)
  ) INTO v_performance
  FROM perf;

  -- ── Resultado final ────────────────────────────────────────────────────────
  RETURN json_build_object(
    'customers',    v_customers,
    'conversations',v_convs,
    'messages',     v_messages,
    'appointments', v_appointments,
    'jobs',         COALESCE(v_jobs, json_build_object('total',0,'pending',0,'completed',0,'failed',0)),
    'reminders',    COALESCE(v_reminders, json_build_object('rules_active',0,'dispatches_sent',0,'dispatches_failed',0)),
    'performance',  v_performance,
    'generated_at', to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_dashboard_summary(uuid)
  TO anon, authenticated, service_role;
