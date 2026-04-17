-- ============================================================
-- Migration 068: Fix rpc_assumir_conversa — FK violation
--
-- O assigned_user_id tem FK para auth.users. Quando o agente
-- usa o dashboard com o UUID padrão (não existe em auth.users),
-- a atualização quebrava. Agora verificamos se o UUID existe
-- antes de atribuir; se não existir, assigned_user_id fica NULL.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_assumir_conversa(
  p_tenant_id       uuid,
  p_conversation_id uuid,
  p_user_id         text,
  p_user_name       text DEFAULT 'Agente'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, auth
AS $$
DECLARE
  v_user_uuid uuid;
BEGIN
  -- Tenta converter para UUID
  BEGIN
    v_user_uuid := p_user_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_user_uuid := NULL;
  END;

  -- Verifica se o UUID existe em auth.users; se não, usa NULL
  IF v_user_uuid IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_uuid) THEN
      v_user_uuid := NULL;
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
