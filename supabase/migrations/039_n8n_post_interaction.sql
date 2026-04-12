-- ============================================================
-- Migration 039: rpc_n8n_post_interaction
--
-- Called by n8n after each AI Agent response to populate the
-- three AI panels visible in the Dashboard conversation view:
--
--   • ai.ai_decisions       → "Decisões da IA" timeline
--   • ai.conversation_summaries → "Resumo da IA"
--   • ai.customer_memories  → "Memórias do cliente"
--
-- n8n call (HTTP Request node after Bufferizar Resposta):
--   POST /rest/v1/rpc/rpc_n8n_post_interaction
--   Body: {
--     "p_conversation_id": "{{$('Normalizar Payload').first().json.conversation_id}}",
--     "p_reply_text":      "{{$('AI Agent').first().json.output}}",
--     "p_decision_type":   "reply"
--   }
--   Use "schedule" for p_decision_type when the AI booked an appointment.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_n8n_post_interaction(
  p_conversation_id  uuid,
  p_reply_text       text,
  p_decision_type    text DEFAULT 'reply'   -- reply | schedule | handoff | recommend_service
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, ai, messaging, scheduling, crm
AS $$
DECLARE
  v_tenant_id    uuid;
  v_customer_id  uuid;
  v_customer_name text;
  v_session_id   uuid;
  v_msg_count    int;
  v_summary_text text;
  v_facts        jsonb;
  v_open_items   jsonb := '[]'::jsonb;
  v_apt          RECORD;
BEGIN
  -- ── 1. Resolve context ──────────────────────────────────────────────────────
  SELECT c.tenant_id, c.customer_id, cu.full_name
    INTO v_tenant_id, v_customer_id, v_customer_name
  FROM messaging.conversations c
  LEFT JOIN crm.customers cu ON cu.id = c.customer_id
  WHERE c.id = p_conversation_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN RETURN; END IF;

  -- ── 2. Create an AI session row (required FK for ai_decisions) ──────────────
  INSERT INTO ai.ai_sessions (tenant_id, conversation_id, customer_id)
  VALUES (v_tenant_id, p_conversation_id, v_customer_id)
  RETURNING id INTO v_session_id;

  -- ── 3. Record AI decision ───────────────────────────────────────────────────
  INSERT INTO ai.ai_decisions (
    tenant_id,
    conversation_id,
    ai_session_id,
    decision_type,
    decision_reason,
    confidence_score,
    output_payload_jsonb,
    approved_by_rule
  ) VALUES (
    v_tenant_id,
    p_conversation_id,
    v_session_id,
    p_decision_type::ai.decision_type,
    CASE p_decision_type
      WHEN 'reply'              THEN 'Resposta automática gerada pela IA'
      WHEN 'schedule'           THEN 'Agendamento confirmado pela IA'
      WHEN 'handoff'            THEN 'Transferência para atendente humano'
      WHEN 'recommend_service'  THEN 'Sugestão de serviço pela IA'
      ELSE 'Decisão da IA'
    END,
    0.9,
    jsonb_build_object('reply_text', p_reply_text),
    true
  );

  -- ── 4. Build conversation summary ──────────────────────────────────────────
  SELECT COUNT(*) INTO v_msg_count
  FROM messaging.messages
  WHERE conversation_id = p_conversation_id;

  -- Last 8 messages as formatted exchange
  SELECT string_agg(
    CASE direction WHEN 'inbound' THEN 'Cliente' ELSE 'Sofia' END
    || ': ' || content_text,
    E'\n' ORDER BY created_at ASC
  ) INTO v_summary_text
  FROM (
    SELECT direction, content_text, created_at
    FROM messaging.messages
    WHERE conversation_id = p_conversation_id
      AND content_text    IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 8
  ) recent;

  -- Facts: static data we know without an LLM
  v_facts := jsonb_build_object(
    'cliente',     COALESCE(v_customer_name, 'Desconhecido'),
    'mensagens',   v_msg_count
  );

  -- If an appointment was scheduled in this conversation, add to facts
  SELECT a.scheduled_start_at, sv.name AS service_name, pr.name AS professional_name
    INTO v_apt
  FROM scheduling.appointments a
  JOIN scheduling.services     sv ON sv.id = a.service_id
  JOIN scheduling.professionals pr ON pr.id = a.professional_id
  WHERE a.tenant_id = v_tenant_id
    AND a.customer_id = v_customer_id
    AND a.status NOT IN ('cancelled', 'no_show')
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    v_facts := v_facts || jsonb_build_object(
      'agendamento',    v_apt.service_name,
      'profissional',   v_apt.professional_name,
      'horário',        to_char(v_apt.scheduled_start_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
    );

    -- Create / refresh schedule_preference memory
    INSERT INTO ai.customer_memories (
      tenant_id, customer_id, memory_type, content_text, importance_score, is_active, last_used_at
    ) VALUES (
      v_tenant_id,
      v_customer_id,
      'schedule_preference',
      'Agendou ' || v_apt.service_name || ' com ' || v_apt.professional_name
        || ' em ' || to_char(v_apt.scheduled_start_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
      0.8,
      true,
      now()
    )
    ON CONFLICT DO NOTHING;

    -- Create / refresh clinical_interest memory for the service
    INSERT INTO ai.customer_memories (
      tenant_id, customer_id, memory_type, content_text, importance_score, is_active, last_used_at
    ) VALUES (
      v_tenant_id,
      v_customer_id,
      'clinical_interest',
      'Interesse em ' || v_apt.service_name,
      0.7,
      true,
      now()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- ── 5. Upsert running conversation summary ──────────────────────────────────
  -- Replace the previous running summary for this conversation
  DELETE FROM ai.conversation_summaries
  WHERE conversation_id = p_conversation_id
    AND summary_type    = 'running';

  INSERT INTO ai.conversation_summaries (
    tenant_id, conversation_id, summary_type,
    summary_text, facts_jsonb, open_items_jsonb
  ) VALUES (
    v_tenant_id,
    p_conversation_id,
    'running',
    COALESCE(v_summary_text, p_reply_text),
    v_facts,
    v_open_items
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_n8n_post_interaction(uuid, text, text)
  TO anon, authenticated, service_role;
