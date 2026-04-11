-- ============================================================
-- Migration 036: Message batch debouncing
--
-- Prevents multiple AI responses when user sends messages
-- in quick succession (line breaks, multiple short messages).
--
-- rpc_take_conversation_batch:
--   Called after a wait period. Returns the combined text of
--   all recent inbound messages if this message is the latest
--   (i.e., it should be the one to trigger AI processing).
--   Returns should_process=false if a newer message exists,
--   meaning this execution should stop.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_take_conversation_batch(
  p_conversation_id      uuid,
  p_message_id           uuid,
  p_batch_window_seconds int DEFAULT 4
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging
AS $$
DECLARE
  v_latest_message_id uuid;
  v_combined_text     text;
  v_message_count     int;
BEGIN
  -- Find the latest inbound message within the batch window
  SELECT id INTO v_latest_message_id
  FROM messaging.messages
  WHERE conversation_id = p_conversation_id
    AND direction       = 'inbound'
    AND created_at      >= NOW() - (p_batch_window_seconds || ' seconds')::interval
  ORDER BY created_at DESC
  LIMIT 1;

  -- If this is not the latest message, a newer one will handle the batch
  IF v_latest_message_id IS DISTINCT FROM p_message_id THEN
    RETURN json_build_object(
      'should_process', false,
      'combined_text',  NULL,
      'message_count',  0
    );
  END IF;

  -- This is the latest — collect all recent inbound messages
  SELECT
    string_agg(content_text, E'\n' ORDER BY created_at),
    COUNT(*)
  INTO v_combined_text, v_message_count
  FROM messaging.messages
  WHERE conversation_id = p_conversation_id
    AND direction       = 'inbound'
    AND created_at      >= NOW() - (p_batch_window_seconds || ' seconds')::interval
    AND content_text    IS NOT NULL;

  RETURN json_build_object(
    'should_process', true,
    'combined_text',  v_combined_text,
    'message_count',  v_message_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_take_conversation_batch(uuid, uuid, int)
  TO anon, authenticated, service_role;
