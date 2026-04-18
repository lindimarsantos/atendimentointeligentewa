-- ============================================================
-- Migration 076: Fix rpc_n8n_solicitar_humano false negative
--
-- When the conversation was already in waiting_human or open state,
-- the function returned handoff_created: false. The n8n workflow
-- treated this as a failure and sent an apology message to the customer
-- ("Parece que não consegui encaminhar..."), even though the conversation
-- was already with a human agent.
--
-- Fix: return handoff_created: true for already-transferred states
-- so the n8n workflow correctly recognises the transfer as successful.
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
  SELECT status INTO v_already
  FROM messaging.conversations
  WHERE id = p_conversation_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversa não encontrada';
  END IF;

  -- Already with a human: return success so n8n does NOT send an apology
  IF v_already = 'waiting_human' THEN
    RETURN jsonb_build_object(
      'status',          'waiting_human',
      'handoff_created', true,
      'already_queued',  true
    );
  END IF;

  IF v_already = 'open' THEN
    RETURN jsonb_build_object(
      'status',           'open',
      'handoff_created',  true,
      'already_open',     true
    );
  END IF;

  -- Transition conversation to waiting_human
  UPDATE messaging.conversations
  SET
    status     = 'waiting_human'::messaging.conversation_status,
    updated_at = now()
  WHERE id = p_conversation_id AND tenant_id = p_tenant_id;

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

  IF p_notify_customer THEN
    INSERT INTO messaging.messages (
      conversation_id, direction, message_type, content_text,
      sender_type, created_at
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
