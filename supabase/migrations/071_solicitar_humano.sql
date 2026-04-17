-- ============================================================
-- Migration 071: rpc_n8n_solicitar_humano
--
-- Called by the AI agent (n8n) when the conversation needs to be
-- transferred to a human operator.
--
-- Actions:
--   1. Sets conversation status → waiting_human
--   2. Inserts a row in ai.agent_handoffs (creates the queue entry)
--   3. Optionally sends a message to the customer acknowledging
--      the transfer (via messaging.messages insert)
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_n8n_solicitar_humano(
  p_tenant_id       uuid,
  p_conversation_id uuid,
  p_reason_text     text    DEFAULT NULL,
  p_target_role     text    DEFAULT 'agent',
  p_notify_customer boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, ai
AS $$
DECLARE
  v_handoff_id uuid;
  v_already    text;
BEGIN
  -- Check current status to avoid double-queuing
  SELECT status INTO v_already
  FROM messaging.conversations
  WHERE id = p_conversation_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversa não encontrada';
  END IF;

  IF v_already IN ('waiting_human', 'open') THEN
    -- Already transferred or assumed — return existing state
    RETURN jsonb_build_object('status', v_already, 'handoff_created', false);
  END IF;

  -- 1. Transition conversation
  UPDATE messaging.conversations
  SET
    status     = 'waiting_human'::messaging.conversation_status,
    updated_at = now()
  WHERE id = p_conversation_id AND tenant_id = p_tenant_id;

  -- 2. Create handoff queue entry
  INSERT INTO ai.agent_handoffs (
    tenant_id, conversation_id, reason_text, target_role, status, created_at
  )
  VALUES (
    p_tenant_id, p_conversation_id,
    COALESCE(p_reason_text, 'Solicitado pelo agente de IA'),
    COALESCE(p_target_role, 'agent'),
    'pending',
    now()
  )
  RETURNING id INTO v_handoff_id;

  -- 3. Notify customer (optional bot message)
  IF p_notify_customer THEN
    INSERT INTO messaging.messages (
      conversation_id, direction, content_type, content_text,
      sender_type, sent_at
    )
    VALUES (
      p_conversation_id,
      'outbound',
      'text',
      'Estou transferindo você para um de nossos atendentes. Aguarde um momento, por favor.',
      'bot',
      now()
    );
  END IF;

  RETURN jsonb_build_object(
    'status',          'waiting_human',
    'handoff_id',      v_handoff_id,
    'handoff_created', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_n8n_solicitar_humano(uuid, uuid, text, text, boolean)
  TO anon, authenticated, service_role;


-- ============================================================
-- RPC: rpc_list_handoff_queue
-- Returns pending handoff entries with conversation + customer info.
-- Used by the "Aguarda Humano" tab in the frontend.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_list_handoff_queue(
  p_tenant_id uuid,
  p_status    text DEFAULT 'pending'
)
RETURNS TABLE (
  id                      uuid,
  tenant_id               uuid,
  conversation_id         uuid,
  reason_text             text,
  target_role             text,
  status                  text,
  accepted_at             timestamptz,
  resolved_at             timestamptz,
  created_at              timestamptz,
  conversation_status     text,
  customer_id             uuid,
  customer_name           text,
  customer_phone          text,
  last_message            text,
  conversation_updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, messaging, ai, crm
AS $$
  SELECT
    h.id,
    h.tenant_id,
    h.conversation_id,
    h.reason_text,
    h.target_role,
    h.status::text,
    h.accepted_at,
    h.resolved_at,
    h.created_at,
    c.status::text           AS conversation_status,
    c.customer_id,
    cu.full_name             AS customer_name,
    cu.phone_e164            AS customer_phone,
    (
      SELECT m.content_text
      FROM   messaging.messages m
      WHERE  m.conversation_id = c.id
      ORDER  BY m.sent_at DESC
      LIMIT  1
    )                        AS last_message,
    c.updated_at             AS conversation_updated_at
  FROM   ai.agent_handoffs h
  JOIN   messaging.conversations c  ON c.id = h.conversation_id
  JOIN   crm.customers cu           ON cu.id = c.customer_id
  WHERE  h.tenant_id = p_tenant_id
    AND  (p_status = 'all' OR h.status::text = p_status)
  ORDER  BY h.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_list_handoff_queue(uuid, text)
  TO anon, authenticated, service_role;
