-- ============================================================
-- Migration 073: Fix rpc_assumir_conversa — FK references core.tenant_users
--
-- Root cause: conversations.assigned_user_id has a FK to
-- core.tenant_users(id), NOT auth.users(id).
-- All previous versions passed auth.uid() or the auth UUID directly,
-- which violated the FK because core.tenant_users.id is a different UUID.
--
-- Fix: look up core.tenant_users.id WHERE auth_user_id = auth.uid()
-- (or p_user_id for service_role calls) AND tenant_id = p_tenant_id.
-- ============================================================

DROP FUNCTION IF EXISTS public.rpc_assumir_conversa(uuid, uuid, text, text);

CREATE FUNCTION public.rpc_assumir_conversa(
  p_tenant_id       uuid,
  p_conversation_id uuid,
  p_user_id         text    DEFAULT NULL,
  p_user_name       text    DEFAULT 'Agente'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, core, auth
AS $$
DECLARE
  v_auth_uid  uuid;
  v_user_uuid uuid;
BEGIN
  -- Resolve auth uid: JWT session (browser) or p_user_id param (service_role/n8n)
  v_auth_uid := auth.uid();

  IF v_auth_uid IS NULL AND p_user_id IS NOT NULL THEN
    BEGIN
      v_auth_uid := p_user_id::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_auth_uid := NULL;
    END;
  END IF;

  -- Look up the core.tenant_users.id (what the FK actually requires)
  IF v_auth_uid IS NOT NULL THEN
    SELECT id INTO v_user_uuid
    FROM core.tenant_users
    WHERE auth_user_id = v_auth_uid
      AND tenant_id    = p_tenant_id
    LIMIT 1;
  END IF;

  -- v_user_uuid may be NULL if no tenant_users row found — that's OK (column is nullable)
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
