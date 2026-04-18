-- ============================================================
-- Migration 055: Follow-up em dois rounds
--
-- Substitui followup_sent_at por:
--   followup_count        int  (0=nenhum, 1=1º enviado, 2=2º enviado/parado)
--   followup_last_sent_at timestamptz
--
-- Round 1: followup_count=0  AND last outbound >= p_hours_first horas atrás
-- Round 2: followup_count=1  AND followup_last_sent_at >= p_hours_second h atrás
-- Reset  : cliente responde → followup_count=0, followup_last_sent_at=NULL
-- ============================================================

-- ── 1. Colunas em messaging.conversations ────────────────────────────────────

ALTER TABLE messaging.conversations
  DROP COLUMN IF EXISTS followup_sent_at;

ALTER TABLE messaging.conversations
  ADD COLUMN IF NOT EXISTS followup_count        int         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS followup_last_sent_at timestamptz          DEFAULT NULL;

-- ── 2. Segunda mensagem em channel_settings ──────────────────────────────────

ALTER TABLE config.channel_settings
  ADD COLUMN IF NOT EXISTS scheduling_followup_message_2 text DEFAULT NULL;

-- ── 3. rpc_get_channel_settings ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_get_channel_settings(
  p_tenant_id  uuid,
  p_channel_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
DECLARE v_result json;
BEGIN
  SELECT row_to_json(t) INTO v_result
  FROM (
    SELECT
      id, tenant_id, channel_id,
      welcome_message,
      out_of_hours_message,
      human_handoff_message           AS handoff_message,
      enable_buffer                   AS buffer_active,
      enable_typing_simulation        AS typing_simulation,
      scheduling_followup_message,
      scheduling_followup_message_2,
      updated_at
    FROM config.channel_settings s
    WHERE s.tenant_id  = p_tenant_id
      AND s.channel_id = p_channel_id
    LIMIT 1
  ) t;
  RETURN v_result;
END;
$$;

-- ── 4. rpc_update_channel_settings ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_update_channel_settings(
  p_tenant_id                      uuid,
  p_channel_id                     uuid,
  p_welcome_message                text    DEFAULT NULL,
  p_out_of_hours_message           text    DEFAULT NULL,
  p_handoff_message                text    DEFAULT NULL,
  p_buffer_active                  boolean DEFAULT NULL,
  p_typing_simulation              boolean DEFAULT NULL,
  p_scheduling_followup_message    text    DEFAULT NULL,
  p_scheduling_followup_message_2  text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  UPDATE config.channel_settings
  SET
    welcome_message                 = COALESCE(p_welcome_message,              welcome_message),
    out_of_hours_message            = COALESCE(p_out_of_hours_message,         out_of_hours_message),
    human_handoff_message           = COALESCE(p_handoff_message,              human_handoff_message),
    enable_buffer                   = COALESCE(p_buffer_active,                enable_buffer),
    enable_typing_simulation        = COALESCE(p_typing_simulation,            enable_typing_simulation),
    scheduling_followup_message     = COALESCE(p_scheduling_followup_message,  scheduling_followup_message),
    scheduling_followup_message_2   = COALESCE(p_scheduling_followup_message_2,scheduling_followup_message_2),
    updated_at                      = now()
  WHERE tenant_id  = p_tenant_id
    AND channel_id = p_channel_id;

  IF NOT FOUND THEN
    INSERT INTO config.channel_settings
      (tenant_id, channel_id, welcome_message, out_of_hours_message,
       human_handoff_message, enable_buffer, enable_typing_simulation,
       scheduling_followup_message, scheduling_followup_message_2)
    VALUES
      (p_tenant_id, p_channel_id,
       p_welcome_message, p_out_of_hours_message, p_handoff_message,
       COALESCE(p_buffer_active, true), COALESCE(p_typing_simulation, true),
       p_scheduling_followup_message, p_scheduling_followup_message_2);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_channel_settings(uuid, uuid)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.rpc_update_channel_settings(uuid,uuid,text,text,text,boolean,boolean,text,text)
  TO anon, authenticated, service_role;

-- ── 5. rpc_n8n_get_scheduling_followup_targets (dois rounds) ─────────────────

CREATE OR REPLACE FUNCTION public.rpc_n8n_get_scheduling_followup_targets(
  p_hours_first  int DEFAULT 2,   -- horas de silêncio para o 1º lembrete
  p_hours_second int DEFAULT 24   -- horas desde o 1º lembrete para o 2º
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, crm, config
AS $$
DECLARE
  v_default_msg1 text := 'Olá! 😊 Ainda estou por aqui — gostaria de saber se algum dos horários que sugeri funciona para você, ou se preferir posso verificar outras opções disponíveis. É só me dizer!';
  v_default_msg2 text := 'Oi! 😊 Só passando para saber se você conseguiu decidir sobre o agendamento. Caso prefira, posso buscar outros horários disponíveis. Qualquer coisa, é só falar!';
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
    FROM (

      -- Round 1: nunca enviou follow-up, último outbound >= p_hours_first h atrás
      WITH last_msg AS (
        SELECT DISTINCT ON (conversation_id)
          conversation_id, direction, created_at
        FROM messaging.messages
        ORDER BY conversation_id, created_at DESC
      )
      SELECT
        c.id                                                    AS conversation_id,
        c.tenant_id,
        cu.full_name                                            AS customer_name,
        cu.phone                                                AS customer_phone,
        tc.external_account_id                                  AS zapi_instance_id,
        tc.config_jsonb->>'zapi_token'                          AS zapi_token,
        tc.config_jsonb->>'zapi_client_token'                   AS zapi_client_token,
        1                                                       AS followup_round,
        COALESCE(cs.scheduling_followup_message,   v_default_msg1) AS followup_message_template
      FROM messaging.conversations c
      JOIN last_msg lm ON lm.conversation_id = c.id
      JOIN crm.customers cu ON cu.id = c.customer_id
      JOIN messaging.tenant_channels tc
             ON tc.tenant_id = c.tenant_id AND tc.is_active = true
      LEFT JOIN config.channel_settings cs ON cs.tenant_id = c.tenant_id
      WHERE c.status           = 'bot_active'
        AND c.followup_count   = 0
        AND lm.direction       = 'outbound'
        AND lm.created_at      < NOW() - (p_hours_first || ' hours')::interval
        AND cu.phone IS NOT NULL
        AND tc.external_account_id IS NOT NULL

      UNION ALL

      -- Round 2: já enviou o 1º, aguarda p_hours_second h desde o último envio
      SELECT
        c.id                                                    AS conversation_id,
        c.tenant_id,
        cu.full_name                                            AS customer_name,
        cu.phone                                                AS customer_phone,
        tc.external_account_id                                  AS zapi_instance_id,
        tc.config_jsonb->>'zapi_token'                          AS zapi_token,
        tc.config_jsonb->>'zapi_client_token'                   AS zapi_client_token,
        2                                                       AS followup_round,
        COALESCE(cs.scheduling_followup_message_2, v_default_msg2) AS followup_message_template
      FROM messaging.conversations c
      JOIN crm.customers cu ON cu.id = c.customer_id
      JOIN messaging.tenant_channels tc
             ON tc.tenant_id = c.tenant_id AND tc.is_active = true
      LEFT JOIN config.channel_settings cs ON cs.tenant_id = c.tenant_id
      WHERE c.status                = 'bot_active'
        AND c.followup_count        = 1
        AND c.followup_last_sent_at < NOW() - (p_hours_second || ' hours')::interval
        AND cu.phone IS NOT NULL
        AND tc.external_account_id IS NOT NULL

    ) r
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_n8n_get_scheduling_followup_targets(int, int)
  TO anon, authenticated, service_role;

-- ── 6. rpc_n8n_mark_followup_sent — incrementa o contador ───────────────────

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
  SET
    followup_count        = followup_count + 1,
    followup_last_sent_at = NOW()
  WHERE id = p_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_n8n_mark_followup_sent(uuid)
  TO anon, authenticated, service_role;

-- ── 7. rpc_n8n_post_interaction — reseta ao cliente responder ────────────────

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
  v_recent_msgs   jsonb;
  v_summary_text  text;
  v_facts         jsonb;
BEGIN
  SELECT c.tenant_id, c.customer_id, cu.full_name
    INTO v_tenant_id, v_customer_id, v_customer_name
  FROM messaging.conversations c
  LEFT JOIN crm.customers cu ON cu.id = c.customer_id
  WHERE c.id = p_conversation_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN RETURN; END IF;

  -- Reset follow-up counter quando o cliente interage
  UPDATE messaging.conversations
  SET followup_count = 0, followup_last_sent_at = NULL
  WHERE id = p_conversation_id AND followup_count > 0;

  INSERT INTO ai.ai_sessions (tenant_id, conversation_id, customer_id)
  VALUES (v_tenant_id, p_conversation_id, v_customer_id)
  RETURNING id INTO v_session_id;

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

  SELECT summary_text, facts_jsonb
  INTO v_summary_text, v_facts
  FROM ai.ai_memory
  WHERE tenant_id = v_tenant_id AND customer_id = v_customer_id
  LIMIT 1;

  INSERT INTO ai.ai_memory (
    tenant_id, customer_id, interaction_count,
    open_items_jsonb, facts_jsonb, summary_text, last_interaction_at
  )
  VALUES (
    v_tenant_id, v_customer_id, 1,
    v_recent_msgs, COALESCE(v_facts, '{}'::jsonb),
    COALESCE(v_summary_text, ''), NOW()
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
