-- ============================================================
-- Migration 072: Fix column names and parameter defaults
--
-- Fixes two issues introduced in migrations 068 and 071:
--
--   1. rpc_assumir_conversa: parameter defaults conflict
--      Migration 068 had p_user_id without DEFAULT; migration 070
--      added DEFAULT NULL. Re-running 068 after 070 failed with
--      "cannot remove parameter defaults". Fix: DROP + recreate.
--
--   2. rpc_n8n_solicitar_humano + rpc_list_handoff_queue:
--      messaging.messages real columns are created_at (not sent_at)
--      and message_type (not content_type) — see migration 026.
-- ============================================================

-- ── 1. rpc_assumir_conversa ──────────────────────────────────────────────────
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
SET search_path = public, messaging, auth
AS $$
DECLARE
  v_user_uuid uuid;
BEGIN
  v_user_uuid := auth.uid();

  IF v_user_uuid IS NULL AND p_user_id IS NOT NULL THEN
    BEGIN
      v_user_uuid := p_user_id::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_user_uuid := NULL;
    END;

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


-- ── 2. rpc_n8n_solicitar_humano ──────────────────────────────────────────────
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

  IF v_already IN ('waiting_human', 'open') THEN
    RETURN jsonb_build_object('status', v_already, 'handoff_created', false);
  END IF;

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


-- ── 3. rpc_list_handoff_queue ────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.rpc_list_handoff_queue(uuid, text);

CREATE FUNCTION public.rpc_list_handoff_queue(
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
      ORDER  BY m.created_at DESC
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
