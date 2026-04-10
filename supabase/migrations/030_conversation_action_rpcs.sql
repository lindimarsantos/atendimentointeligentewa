-- ============================================================
-- Migration 030: Conversation action RPCs
--
-- Creates three RPCs missing from the database that are called
-- by the Atendimento detail page:
--   rpc_assumir_conversa  → status = 'open', assigns agent
--   rpc_registrar_nota    → inserts note as outbound agent message
--   rpc_encerrar_conversa → status = 'resolved'
-- ============================================================

-- ── rpc_assumir_conversa ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_assumir_conversa(
  p_tenant_id       uuid,
  p_conversation_id uuid,
  p_user_id         text,
  p_user_name       text DEFAULT 'Agente'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging
AS $$
DECLARE
  v_user_uuid uuid;
BEGIN
  BEGIN
    v_user_uuid := p_user_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_user_uuid := NULL;
  END;

  UPDATE messaging.conversations
  SET
    status           = 'open'::messaging.conversation_status,
    assigned_user_id = v_user_uuid,
    updated_at       = now()
  WHERE id        = p_conversation_id
    AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversa % não encontrada', p_conversation_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_assumir_conversa(uuid, uuid, text, text)
  TO anon, authenticated, service_role;

-- ── rpc_registrar_nota ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_registrar_nota(
  p_tenant_id       uuid,
  p_conversation_id uuid,
  p_user_id         text,
  p_user_name       text DEFAULT 'Agente',
  p_nota_text       text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  SELECT customer_id INTO v_customer_id
  FROM messaging.conversations
  WHERE id = p_conversation_id AND tenant_id = p_tenant_id;

  INSERT INTO messaging.messages
    (tenant_id, conversation_id, customer_id,
     direction, sender_type, message_type, content_text, created_at)
  VALUES
    (p_tenant_id, p_conversation_id, v_customer_id,
     'outbound', 'agent', 'text',
     '[Nota] ' || p_nota_text, now());

  UPDATE messaging.conversations
  SET updated_at = now()
  WHERE id = p_conversation_id AND tenant_id = p_tenant_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_nota(uuid, uuid, text, text, text)
  TO anon, authenticated, service_role;

-- ── rpc_encerrar_conversa ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_encerrar_conversa(
  p_tenant_id       uuid,
  p_conversation_id uuid,
  p_user_id         text,
  p_user_name       text DEFAULT 'Agente'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging
AS $$
BEGIN
  UPDATE messaging.conversations
  SET
    status     = 'resolved'::messaging.conversation_status,
    updated_at = now()
  WHERE id        = p_conversation_id
    AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversa % não encontrada', p_conversation_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_encerrar_conversa(uuid, uuid, text, text)
  TO anon, authenticated, service_role;
