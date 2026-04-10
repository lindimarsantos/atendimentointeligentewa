-- ============================================================
-- Migration 033: n8n wrapper for registering outbound messages
--
-- PostgREST cannot auto-cast text → messaging.message_type (ENUM).
-- This wrapper accepts only plain text/uuid params and does the
-- internal enum cast, so n8n doesn't need to pass p_message_type.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_n8n_register_outbound(
  p_tenant_id           uuid,
  p_conversation_id     uuid,
  p_customer_id         uuid,
  p_content_text        text    DEFAULT NULL,
  p_external_message_id text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging
AS $$
BEGIN
  INSERT INTO messaging.messages (
    tenant_id,
    conversation_id,
    customer_id,
    direction,
    sender_type,
    message_type,
    content_text,
    external_message_id,
    created_at
  ) VALUES (
    p_tenant_id,
    p_conversation_id,
    p_customer_id,
    'outbound',
    'agent',
    'text'::messaging.message_type,
    p_content_text,
    p_external_message_id,
    now()
  );

  -- Keep conversation updated_at fresh
  UPDATE messaging.conversations
  SET updated_at = now()
  WHERE id = p_conversation_id
    AND tenant_id = p_tenant_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_n8n_register_outbound(uuid, uuid, uuid, text, text)
  TO anon, authenticated, service_role;
