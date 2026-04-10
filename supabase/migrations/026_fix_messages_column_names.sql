-- ============================================================
-- Migration 026: Fix messaging.messages column references
--
-- messaging.messages real columns:
--   - created_at  (NOT sent_at)
--   - message_type (NOT content_type)
-- Both rpc_get_conversation_messages and rpc_get_message_intents
-- were ordering by m.sent_at which does not exist.
-- rpc_get_conversation_messages also returned row_to_json(m) which
-- exposes message_type instead of content_type expected by the UI.
-- ============================================================

-- ── 1. Fix rpc_get_conversation_messages ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_get_conversation_messages(
  p_tenant_id       uuid,
  p_conversation_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r) ORDER BY r.sent_at ASC), '[]'::json)
    FROM (
      SELECT
        m.id,
        m.conversation_id,
        m.direction::text,
        m.sender_type::text,
        m.message_type::text   AS content_type,
        m.content_text,
        m.media_url,
        m.media_mime_type,
        m.transcription_text,
        m.caption,
        m.created_at           AS sent_at,
        m.delivered_at,
        m.read_at
      FROM messaging.messages m
      WHERE m.conversation_id = p_conversation_id
    ) r
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_get_conversation_messages(uuid, uuid)
  TO anon, authenticated, service_role;

-- ── 2. Fix rpc_get_message_intents ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_get_message_intents(
  p_tenant_id       uuid,
  p_conversation_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, ai, messaging
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(i) ORDER BY m.created_at ASC), '[]'::json)
    FROM ai.message_intents i
    JOIN messaging.messages m ON m.id = i.message_id
    WHERE m.conversation_id = p_conversation_id
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_get_message_intents(uuid, uuid)
  TO anon, authenticated, service_role;
