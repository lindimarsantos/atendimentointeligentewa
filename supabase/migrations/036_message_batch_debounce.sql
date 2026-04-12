-- ============================================================
-- Migration 036: Message batch debouncing (v2)
--
-- Prevents multiple AI responses when user sends messages
-- in quick succession (line breaks, multiple short messages).
--
-- Key fix: the batch window is anchored to the CURRENT message's
-- creation time, not to NOW(). This prevents new messages sent
-- during the wait period from invalidating the original batch.
--
-- Example:
--   t=0.0s  M1 arrives, M2 arrives, M3 arrives
--   t=0.0s  3 n8n executions start, each waits 4s
--   t=2.0s  User sends M4 (new message during wait)
--   t=4.0s  Batch check runs:
--     M1: latest in [t=0.0 → t=4.0] = M3 → should_process=false
--     M2: latest in [t=0.2 → t=4.2] = M3 → should_process=false
--     M3: latest in [t=0.4 → t=4.4] = M3 → should_process=true ✓
--     M4 starts its own new batch cycle
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
  v_message_created_at timestamptz;
  v_latest_message_id  uuid;
  v_combined_text      text;
  v_message_count      int;
BEGIN
  -- Get the creation time of this specific message
  SELECT created_at INTO v_message_created_at
  FROM messaging.messages
  WHERE id = p_message_id;

  IF v_message_created_at IS NULL THEN
    RETURN json_build_object(
      'should_process', false,
      'combined_text',  NULL,
      'message_count',  0
    );
  END IF;

  -- Find the latest inbound message in the window anchored to THIS message's creation time
  -- Window: from this message's creation → +batch_window seconds
  SELECT id INTO v_latest_message_id
  FROM messaging.messages
  WHERE conversation_id = p_conversation_id
    AND direction       = 'inbound'
    AND created_at      BETWEEN v_message_created_at
                            AND v_message_created_at + (p_batch_window_seconds || ' seconds')::interval
  ORDER BY created_at DESC
  LIMIT 1;

  -- If this message is not the latest in its own window, stop
  IF v_latest_message_id IS DISTINCT FROM p_message_id THEN
    RETURN json_build_object(
      'should_process', false,
      'combined_text',  NULL,
      'message_count',  0
    );
  END IF;

  -- This is the latest in the window — collect all messages from this batch
  -- Look back up to batch_window seconds before this message to catch earlier messages in the burst
  SELECT
    string_agg(content_text, E'\n' ORDER BY created_at),
    COUNT(*)
  INTO v_combined_text, v_message_count
  FROM messaging.messages
  WHERE conversation_id = p_conversation_id
    AND direction       = 'inbound'
    AND created_at      BETWEEN v_message_created_at - (p_batch_window_seconds || ' seconds')::interval
                            AND v_message_created_at + (p_batch_window_seconds || ' seconds')::interval
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
