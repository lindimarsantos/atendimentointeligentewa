-- ============================================================
-- Migration 077: Fix rpc_n8n_post_interaction — remove ai.ai_memory reference
--
-- The DB had an old version of this function referencing ai.ai_memory,
-- a table that does not exist. The correct tables are:
--   • ai.customer_memories     (per-customer persistent memories)
--   • ai.conversation_summaries (per-conversation running summary)
--
-- Also uses ON CONFLICT ON CONSTRAINT customer_memories_unique_per_type
-- (added in migration 075) for proper duplicate prevention.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_n8n_post_interaction(
  p_conversation_id  uuid,
  p_reply_text       text,
  p_decision_type    text DEFAULT 'reply'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, ai, messaging, scheduling, crm
AS $$
DECLARE
  v_tenant_id     uuid;
  v_customer_id   uuid;
  v_customer_name text;
  v_session_id    uuid;
  v_msg_count     int;
  v_summary_text  text;
  v_facts         jsonb;
  v_recent_msgs   jsonb;
  v_apt           RECORD;
BEGIN
  -- 1. Resolve context
  SELECT c.tenant_id, c.customer_id, cu.full_name
    INTO v_tenant_id, v_customer_id, v_customer_name
  FROM messaging.conversations c
  LEFT JOIN crm.customers cu ON cu.id = c.customer_id
  WHERE c.id = p_conversation_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN RETURN; END IF;

  -- 2. Clear follow-up flag (customer interacted)
  UPDATE messaging.conversations
  SET followup_sent_at = NULL
  WHERE id = p_conversation_id
    AND followup_sent_at IS NOT NULL;

  -- 3. Create AI session (required FK for ai_decisions)
  INSERT INTO ai.ai_sessions (tenant_id, conversation_id, customer_id)
  VALUES (v_tenant_id, p_conversation_id, v_customer_id)
  RETURNING id INTO v_session_id;

  -- 4. Record AI decision
  INSERT INTO ai.ai_decisions (
    tenant_id, conversation_id, ai_session_id,
    decision_type, decision_reason, confidence_score,
    output_payload_jsonb, approved_by_rule
  ) VALUES (
    v_tenant_id, p_conversation_id, v_session_id,
    p_decision_type::ai.decision_type,
    CASE p_decision_type
      WHEN 'reply'             THEN 'Resposta automática gerada pela IA'
      WHEN 'schedule'          THEN 'Agendamento confirmado pela IA'
      WHEN 'handoff'           THEN 'Transferência para atendente humano'
      WHEN 'recommend_service' THEN 'Sugestão de serviço pela IA'
      ELSE 'Decisão da IA'
    END,
    0.9,
    jsonb_build_object('reply_text', p_reply_text),
    true
  );

  -- 5. Count messages
  SELECT COUNT(*) INTO v_msg_count
  FROM messaging.messages
  WHERE conversation_id = p_conversation_id;

  -- 6. Last 8 messages as [{role, text}] for Memória Recente
  SELECT COALESCE(json_agg(
    json_build_object(
      'role', CASE direction
                WHEN 'inbound' THEN COALESCE(v_customer_name, 'Cliente')
                ELSE 'Sofia'
              END,
      'text', content_text
    ) ORDER BY created_at ASC
  ), '[]'::json)::jsonb
  INTO v_recent_msgs
  FROM (
    SELECT direction, content_text, created_at
    FROM messaging.messages
    WHERE conversation_id = p_conversation_id
      AND content_text    IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 8
  ) sub;

  -- 7. Check for latest appointment
  SELECT a.scheduled_start_at, sv.name AS service_name, pr.name AS professional_name
    INTO v_apt
  FROM scheduling.appointments a
  JOIN scheduling.services      sv ON sv.id = a.service_id
  JOIN scheduling.professionals pr ON pr.id = a.professional_id
  WHERE a.tenant_id   = v_tenant_id
    AND a.customer_id = v_customer_id
    AND a.status NOT IN ('cancelled', 'no_show')
  ORDER BY a.created_at DESC
  LIMIT 1;

  -- 8. Build narrative summary
  v_summary_text :=
    'Atendimento em andamento' ||
    CASE WHEN v_customer_name IS NOT NULL
      THEN ' com ' || v_customer_name
      ELSE ''
    END || '. ' ||
    'A conversa acumula ' || v_msg_count ||
    CASE WHEN v_msg_count = 1 THEN ' mensagem trocada' ELSE ' mensagens trocadas' END ||
    ' até o momento.';

  IF FOUND THEN
    v_summary_text := v_summary_text ||
      ' O cliente demonstrou interesse em ' || v_apt.service_name || '.' ||
      ' Foi confirmado agendamento de ' || v_apt.service_name ||
      ' com ' || v_apt.professional_name ||
      ' para ' || to_char(
        v_apt.scheduled_start_at AT TIME ZONE 'America/Sao_Paulo',
        'DD/MM/YYYY "às" HH24:MI'
      ) || '.';
  END IF;

  v_summary_text := v_summary_text || ' Última resposta da IA: ' || p_reply_text;

  -- 9. Facts (structured metadata)
  v_facts := jsonb_build_object(
    'cliente',   COALESCE(v_customer_name, 'Cliente'),
    'mensagens', v_msg_count
  );

  IF FOUND THEN
    v_facts := v_facts || jsonb_build_object(
      'agendamento',  v_apt.service_name,
      'profissional', v_apt.professional_name,
      'horário',      to_char(
        v_apt.scheduled_start_at AT TIME ZONE 'America/Sao_Paulo',
        'DD/MM/YYYY HH24:MI'
      )
    );

    INSERT INTO ai.customer_memories (
      tenant_id, customer_id, memory_type, content_text, importance_score, is_active, last_used_at
    ) VALUES (
      v_tenant_id, v_customer_id, 'schedule_preference',
      'Agendou ' || v_apt.service_name || ' com ' || v_apt.professional_name ||
        ' em ' || to_char(v_apt.scheduled_start_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
      0.8, true, now()
    )
    ON CONFLICT ON CONSTRAINT customer_memories_unique_per_type DO NOTHING;

    INSERT INTO ai.customer_memories (
      tenant_id, customer_id, memory_type, content_text, importance_score, is_active, last_used_at
    ) VALUES (
      v_tenant_id, v_customer_id, 'clinical_interest',
      'Interesse em ' || v_apt.service_name,
      0.7, true, now()
    )
    ON CONFLICT ON CONSTRAINT customer_memories_unique_per_type DO NOTHING;
  END IF;

  -- 10. Upsert running conversation summary
  DELETE FROM ai.conversation_summaries
  WHERE conversation_id = p_conversation_id
    AND summary_type    = 'running';

  INSERT INTO ai.conversation_summaries (
    tenant_id, conversation_id, summary_type,
    summary_text, facts_jsonb, open_items_jsonb
  ) VALUES (
    v_tenant_id, p_conversation_id, 'running',
    v_summary_text,
    v_facts,
    v_recent_msgs
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_n8n_post_interaction(uuid, text, text)
  TO anon, authenticated, service_role;
