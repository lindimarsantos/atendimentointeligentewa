-- ============================================================
-- Migration 054: Flag de follow-up enviado na conversa
--
-- followup_sent_at: marcado quando o follow-up é disparado.
-- Limpo automaticamente quando o cliente responde (post_interaction).
-- Garante exatamente UM follow-up por episódio de silêncio.
-- ============================================================

-- ── 1. Coluna na tabela de conversas ────────────────────────────────────────

ALTER TABLE messaging.conversations
  ADD COLUMN IF NOT EXISTS followup_sent_at TIMESTAMPTZ DEFAULT NULL;

-- ── 2. rpc_n8n_get_scheduling_followup_targets — exclui já marcadas ─────────

CREATE OR REPLACE FUNCTION public.rpc_n8n_get_scheduling_followup_targets(
  p_hours_min int DEFAULT 2,
  p_hours_max int DEFAULT 4
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, crm, config
AS $$
DECLARE
  v_default_msg text :=
    'Olá! 😊 Ainda estou por aqui — gostaria de saber se algum dos horários que sugeri funciona para você, ou se preferir posso verificar outras opções disponíveis. É só me dizer!';
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
    FROM (
      WITH last_msg AS (
        SELECT DISTINCT ON (conversation_id)
          conversation_id,
          direction,
          created_at
        FROM messaging.messages
        ORDER BY conversation_id, created_at DESC
      )
      SELECT
        c.id                                          AS conversation_id,
        c.tenant_id,
        cu.full_name                                  AS customer_name,
        cu.phone                                      AS customer_phone,
        tc.external_account_id                        AS zapi_instance_id,
        tc.config_jsonb->>'zapi_token'                AS zapi_token,
        tc.config_jsonb->>'zapi_client_token'         AS zapi_client_token,
        COALESCE(
          cs.scheduling_followup_message,
          v_default_msg
        )                                             AS followup_message_template
      FROM messaging.conversations c
      JOIN last_msg lm ON lm.conversation_id = c.id
      JOIN crm.customers cu ON cu.id = c.customer_id
      JOIN messaging.tenant_channels tc
             ON tc.tenant_id = c.tenant_id AND tc.is_active = true
      LEFT JOIN config.channel_settings cs
             ON cs.tenant_id = c.tenant_id
      WHERE c.status = 'bot_active'
        AND c.followup_sent_at IS NULL               -- ← ainda não enviou follow-up
        AND lm.direction = 'outbound'
        AND lm.created_at >= NOW() - (p_hours_max || ' hours')::interval
        AND lm.created_at <  NOW() - (p_hours_min || ' hours')::interval
        AND cu.phone IS NOT NULL
        AND tc.external_account_id IS NOT NULL
    ) r
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_n8n_get_scheduling_followup_targets(int, int)
  TO anon, authenticated, service_role;

-- ── 3. rpc_n8n_mark_followup_sent — chamado pelo n8n após enviar ────────────

CREATE OR REPLACE FUNCTION public.rpc_n8n_mark_followup_sent(
  p_conversation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging
AS $$
BEGIN
  UPDATE messaging.conversations
  SET followup_sent_at = NOW()
  WHERE id = p_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_n8n_mark_followup_sent(uuid)
  TO anon, authenticated, service_role;

-- ── 4. rpc_n8n_post_interaction — limpa a flag quando cliente responde ───────
-- Reimplementa apenas o trecho de limpeza via ALTER; a função completa já
-- existe (migration 040). Substituímos com REPLACE para adicionar o reset.

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
  -- ── 1. Resolve context ──────────────────────────────────────────────────────
  SELECT c.tenant_id, c.customer_id, cu.full_name
    INTO v_tenant_id, v_customer_id, v_customer_name
  FROM messaging.conversations c
  LEFT JOIN crm.customers cu ON cu.id = c.customer_id
  WHERE c.id = p_conversation_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN RETURN; END IF;

  -- ── 2. Limpa flag de follow-up (cliente interagiu) ──────────────────────────
  UPDATE messaging.conversations
  SET followup_sent_at = NULL
  WHERE id = p_conversation_id
    AND followup_sent_at IS NOT NULL;

  -- ── 3. Create AI session ────────────────────────────────────────────────────
  INSERT INTO ai.ai_sessions (tenant_id, conversation_id, customer_id)
  VALUES (v_tenant_id, p_conversation_id, v_customer_id)
  RETURNING id INTO v_session_id;

  -- ── 4. Record AI decision ───────────────────────────────────────────────────
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

  -- ── 5. Count messages ───────────────────────────────────────────────────────
  SELECT COUNT(*) INTO v_msg_count
  FROM messaging.messages
  WHERE conversation_id = p_conversation_id;

  -- ── 6. Last 8 messages as [{role, text}] for Memória Recente ────────────────
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
    ORDER BY created_at DESC
    LIMIT 8
  ) sub;

  -- ── 7. Upsert AI memory ─────────────────────────────────────────────────────
  SELECT
    a.summary_text,
    a.facts_jsonb
  INTO v_summary_text, v_facts
  FROM ai.ai_memory a
  WHERE a.tenant_id = v_tenant_id
    AND a.customer_id = v_customer_id
  LIMIT 1;

  INSERT INTO ai.ai_memory (
    tenant_id, customer_id,
    interaction_count,
    open_items_jsonb,
    facts_jsonb,
    summary_text,
    last_interaction_at
  )
  VALUES (
    v_tenant_id, v_customer_id,
    1,
    v_recent_msgs,
    COALESCE(v_facts, '{}'::jsonb),
    COALESCE(v_summary_text, ''),
    NOW()
  )
  ON CONFLICT (tenant_id, customer_id) DO UPDATE
  SET
    interaction_count   = ai.ai_memory.interaction_count + 1,
    open_items_jsonb    = v_recent_msgs,
    last_interaction_at = NOW();

END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_n8n_post_interaction(uuid, text, text)
  TO anon, authenticated, service_role;
