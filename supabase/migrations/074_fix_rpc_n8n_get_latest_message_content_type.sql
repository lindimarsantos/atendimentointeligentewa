-- ============================================================
-- Migration 074: Fix rpc_n8n_get_latest_message — content_type → message_type
--
-- messaging.messages uses message_type (not content_type).
-- The column is aliased as content_type in the output to keep
-- backward compatibility with n8n workflow expectations.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_n8n_get_latest_message(
  p_conversation_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, crm
AS $$
BEGIN
  RETURN (
    SELECT row_to_json(r)
    FROM (
      SELECT
        m.id,
        m.conversation_id,
        m.content_text,
        m.message_type::text            AS content_type,
        m.media_url,
        m.transcription_text,
        m.media_duration_sec,
        m.direction,
        m.sender_type,
        m.created_at,
        cu.full_name                    AS customer_name,
        cu.phone_e164                   AS customer_phone,
        c.tenant_id,
        c.channel_id,
        c.customer_id,
        c.status::text                  AS conversation_status
      FROM messaging.conversations c
      LEFT JOIN crm.customers cu ON cu.id = c.customer_id
      LEFT JOIN LATERAL (
        SELECT *
        FROM messaging.messages
        WHERE conversation_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) m ON true
      WHERE c.id = p_conversation_id
      LIMIT 1
    ) r
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_n8n_get_latest_message(uuid)
  TO anon, authenticated, service_role;
