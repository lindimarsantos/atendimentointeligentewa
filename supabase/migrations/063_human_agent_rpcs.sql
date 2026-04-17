-- ============================================================
-- Migration 063: RPCs para atendimento humano
--
-- 1. rpc_n8n_get_latest_message — busca dados da conversa + status
--    (estava ausente; referenciada no workflow n8n)
-- 2. rpc_agent_send_message     — agente humano envia mensagem
-- 3. rpc_devolver_ao_bot        — devolve conversa ao bot
-- ============================================================

-- ── 1. rpc_n8n_get_latest_message ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_n8n_get_latest_message(
  p_conversation_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, crm
AS $$
BEGIN
  RETURN (
    SELECT row_to_json(r)
    FROM (
      SELECT
        m.id,
        m.conversation_id,
        m.content_text,
        m.content_type,
        m.media_url,
        m.transcription_text,
        m.media_duration_sec,
        m.direction,
        m.sender_type,
        m.created_at,
        cu.full_name                    AS customer_name,
        cu.phone_e164                   AS customer_phone,
        c.tenant_id,
        c.channel_id,
        c.customer_id,
        c.status::text                  AS conversation_status
      FROM messaging.conversations c
      LEFT JOIN crm.customers cu ON cu.id = c.customer_id
      LEFT JOIN LATERAL (
        SELECT *
        FROM messaging.messages
        WHERE conversation_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) m ON true
      WHERE c.id = p_conversation_id
      LIMIT 1
    ) r
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_n8n_get_latest_message(uuid)
  TO anon, authenticated, service_role;

-- ── 2. rpc_agent_send_message ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_agent_send_message(
  p_tenant_id       uuid,
  p_conversation_id uuid,
  p_message_text    text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, crm
AS $$
DECLARE
  v_customer_id        uuid;
  v_customer_phone     text;
  v_zapi_instance_id   text;
  v_zapi_token         text;
  v_zapi_client_token  text;
BEGIN
  -- Busca dados da conversa e cliente
  SELECT c.customer_id, cu.phone_e164
    INTO v_customer_id, v_customer_phone
  FROM messaging.conversations c
  JOIN crm.customers cu ON cu.id = c.customer_id
  WHERE c.id = p_conversation_id AND c.tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversa não encontrada';
  END IF;

  -- Busca credenciais Z-API do canal ativo do tenant
  SELECT
    tc.external_account_id,
    tc.config_jsonb->>'zapi_token',
    tc.config_jsonb->>'zapi_client_token'
  INTO v_zapi_instance_id, v_zapi_token, v_zapi_client_token
  FROM messaging.tenant_channels tc
  WHERE tc.tenant_id = p_tenant_id AND tc.is_active = true
  LIMIT 1;

  -- Salva a mensagem no banco
  INSERT INTO messaging.messages
    (tenant_id, conversation_id, customer_id,
     direction, sender_type, message_type, content_text, created_at)
  VALUES
    (p_tenant_id, p_conversation_id, v_customer_id,
     'outbound', 'agent', 'text', p_message_text, now());

  UPDATE messaging.conversations
  SET updated_at = now()
  WHERE id = p_conversation_id AND tenant_id = p_tenant_id;

  RETURN json_build_object(
    'ok',                   true,
    'customer_phone',       v_customer_phone,
    'zapi_instance_id',     v_zapi_instance_id,
    'zapi_token',           v_zapi_token,
    'zapi_client_token',    v_zapi_client_token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_agent_send_message(uuid, uuid, text)
  TO anon, authenticated, service_role;

-- ── 3. rpc_devolver_ao_bot ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_devolver_ao_bot(
  p_tenant_id       uuid,
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
    status           = 'bot_active'::messaging.conversation_status,
    assigned_user_id = NULL,
    updated_at       = now()
  WHERE id = p_conversation_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversa não encontrada';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_devolver_ao_bot(uuid, uuid)
  TO anon, authenticated, service_role;
