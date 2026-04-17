-- ============================================================
-- Migration 070: rpc_assumir_conversa — use auth.uid() server-side
--
-- auth.uid() returns the JWT UUID of the logged-in user when
-- called via PostgREST (anon/authenticated roles). For service_role
-- calls (e.g. n8n), auth.uid() is NULL, so we fall back to the
-- p_user_id parameter (checking it exists in auth.users first).
-- This eliminates the FK violation permanently.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_assumir_conversa(
  p_tenant_id       uuid,
  p_conversation_id uuid,
  p_user_id         text    DEFAULT NULL,
  p_user_name       text    DEFAULT 'Agente'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, auth
AS $$
DECLARE
  v_user_uuid uuid;
BEGIN
  -- Prefer the authenticated session user (set by PostgREST JWT)
  v_user_uuid := auth.uid();

  -- Fallback: parameter supplied (e.g. service_role / n8n call)
  IF v_user_uuid IS NULL AND p_user_id IS NOT NULL THEN
    BEGIN
      v_user_uuid := p_user_id::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_user_uuid := NULL;
    END;

    -- Only use it if the UUID actually exists in auth.users
    IF v_user_uuid IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_uuid) THEN
        v_user_uuid := NULL;
      END IF;
    END IF;
  END IF;

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
