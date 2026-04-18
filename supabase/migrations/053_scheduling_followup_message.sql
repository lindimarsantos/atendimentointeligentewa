-- ============================================================
-- Migration 053: Mensagem de follow-up de agendamento
--
-- 1. Adiciona coluna scheduling_followup_message em channel_settings
-- 2. Atualiza RPCs de channel_settings para incluir o novo campo
-- 3. Atualiza rpc_n8n_get_scheduling_followup_targets para retornar
--    a mensagem configurada pelo tenant (com fallback padrão)
-- ============================================================

-- ── 1. Coluna na tabela ──────────────────────────────────────────────────────

ALTER TABLE config.channel_settings
  ADD COLUMN IF NOT EXISTS scheduling_followup_message text DEFAULT NULL;

-- ── 2. rpc_get_channel_settings ─────────────────────────────────────────────

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
      human_handoff_message         AS handoff_message,
      enable_buffer                 AS buffer_active,
      enable_typing_simulation      AS typing_simulation,
      scheduling_followup_message,
      updated_at
    FROM config.channel_settings s
    WHERE s.tenant_id  = p_tenant_id
      AND s.channel_id = p_channel_id
    LIMIT 1
  ) t;
  RETURN v_result;
END;
$$;

-- ── 3. rpc_update_channel_settings ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_update_channel_settings(
  p_tenant_id                    uuid,
  p_channel_id                   uuid,
  p_welcome_message              text    DEFAULT NULL,
  p_out_of_hours_message         text    DEFAULT NULL,
  p_handoff_message              text    DEFAULT NULL,
  p_buffer_active                boolean DEFAULT NULL,
  p_typing_simulation            boolean DEFAULT NULL,
  p_scheduling_followup_message  text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  UPDATE config.channel_settings
  SET
    welcome_message               = COALESCE(p_welcome_message,             welcome_message),
    out_of_hours_message          = COALESCE(p_out_of_hours_message,        out_of_hours_message),
    human_handoff_message         = COALESCE(p_handoff_message,             human_handoff_message),
    enable_buffer                 = COALESCE(p_buffer_active,               enable_buffer),
    enable_typing_simulation      = COALESCE(p_typing_simulation,           enable_typing_simulation),
    scheduling_followup_message   = COALESCE(p_scheduling_followup_message, scheduling_followup_message),
    updated_at                    = now()
  WHERE tenant_id  = p_tenant_id
    AND channel_id = p_channel_id;

  IF NOT FOUND THEN
    INSERT INTO config.channel_settings
      (tenant_id, channel_id, welcome_message, out_of_hours_message,
       human_handoff_message, enable_buffer, enable_typing_simulation,
       scheduling_followup_message)
    VALUES
      (p_tenant_id, p_channel_id,
       p_welcome_message, p_out_of_hours_message, p_handoff_message,
       COALESCE(p_buffer_active, true), COALESCE(p_typing_simulation, true),
       p_scheduling_followup_message);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_channel_settings(uuid, uuid)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.rpc_update_channel_settings(uuid,uuid,text,text,text,boolean,boolean,text)
  TO anon, authenticated, service_role;

-- ── 4. rpc_n8n_get_scheduling_followup_targets — inclui mensagem ────────────

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
