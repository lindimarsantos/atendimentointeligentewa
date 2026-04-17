-- ============================================================
-- Migration 067: rpc_reabrir_conversa
-- Reabre uma conversa resolvida, devolvendo ao bot (bot_active).
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_reabrir_conversa(
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

GRANT EXECUTE ON FUNCTION public.rpc_reabrir_conversa(uuid, uuid)
  TO anon, authenticated, service_role;
