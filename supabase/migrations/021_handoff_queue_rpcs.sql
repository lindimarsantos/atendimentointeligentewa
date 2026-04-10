-- ============================================================
-- Migration 021: RPCs para fila de handoff humano
-- ============================================================

-- ── rpc_list_handoff_queue ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_list_handoff_queue(
  p_tenant_id uuid,
  p_status    text DEFAULT NULL    -- NULL = pending + accepted
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, ai, messaging, crm
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(h) ORDER BY h.created_at ASC)
    FROM (
      SELECT
        ah.id,
        ah.tenant_id,
        ah.conversation_id,
        ah.reason_text,
        ah.target_role::text,
        ah.status,
        ah.accepted_at,
        ah.resolved_at,
        ah.created_at,
        c.status     AS conversation_status,
        c.customer_id,
        c.updated_at AS conversation_updated_at,
        cu.name      AS customer_name,
        cu.phone     AS customer_phone,
        (
          SELECT m.content_text
          FROM messaging.messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.sent_at DESC
          LIMIT 1
        ) AS last_message
      FROM ai.agent_handoffs ah
      JOIN messaging.conversations c  ON c.id  = ah.conversation_id
      LEFT JOIN crm.customers       cu ON cu.id = c.customer_id
      WHERE ah.tenant_id = p_tenant_id
        AND (
          p_status IS NOT NULL
            AND ah.status = p_status
          OR
          p_status IS NULL
            AND ah.status IN ('pending', 'accepted')
        )
    ) h
  );
END;
$$;

-- ── rpc_update_handoff_status ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_update_handoff_status(
  p_tenant_id       uuid,
  p_handoff_id      uuid,
  p_status          text,
  p_resolution_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, ai, messaging
AS $$
DECLARE
  v_conv_id uuid;
BEGIN
  SELECT conversation_id INTO v_conv_id
  FROM ai.agent_handoffs
  WHERE id = p_handoff_id AND tenant_id = p_tenant_id;

  UPDATE ai.agent_handoffs SET
    status      = p_status,
    accepted_at = CASE WHEN p_status = 'accepted' THEN now() ELSE accepted_at END,
    resolved_at = CASE WHEN p_status IN ('resolved', 'rejected') THEN now() ELSE resolved_at END
  WHERE id = p_handoff_id AND tenant_id = p_tenant_id;

  IF p_status = 'accepted' THEN
    UPDATE messaging.conversations SET status = 'open', updated_at = now()
    WHERE id = v_conv_id AND tenant_id = p_tenant_id;
  ELSIF p_status = 'resolved' THEN
    UPDATE messaging.conversations SET status = 'resolved', updated_at = now()
    WHERE id = v_conv_id AND tenant_id = p_tenant_id;
  ELSIF p_status = 'rejected' THEN
    UPDATE messaging.conversations SET status = 'bot_active', updated_at = now()
    WHERE id = v_conv_id AND tenant_id = p_tenant_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_list_handoff_queue(uuid,text)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.rpc_update_handoff_status(uuid,uuid,text,text)
  TO anon, authenticated, service_role;
