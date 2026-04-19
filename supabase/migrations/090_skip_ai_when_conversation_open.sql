-- Migration 090: Skip AI processing when conversation is already open (human handling)
--
-- Bug: rpc_take_conversation_batch always returned should_process=true for normal
-- messages, even when conversation.status = 'open' (a human agent is actively
-- handling the conversation). This caused the AI bot to respond alongside the
-- human agent.
--
-- Fix: return should_process=false immediately when the conversation status is
-- 'open' or 'waiting_human', so n8n skips the AI agent entirely.

CREATE OR REPLACE FUNCTION public.rpc_take_conversation_batch(
  p_conversation_id      uuid,
  p_message_id           uuid,
  p_batch_window_seconds integer DEFAULT 4
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, ai, ops
AS $$
DECLARE
  v_message_created_at timestamptz;
  v_latest_message_id  uuid;
  v_combined_text      text;
  v_message_count      int;
  -- transfer / status check
  v_tenant_id          uuid;
  v_customer_id        uuid;
  v_channel_id         uuid;
  v_conv_status        text;
  v_hours_check        jsonb;
  v_is_open            boolean;
  v_notify_msg         text;
BEGIN
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

  -- ── Guard: skip AI if a human is already handling this conversation ───────────
  SELECT c.status::text, c.tenant_id, c.customer_id, c.channel_id
    INTO v_conv_status, v_tenant_id, v_customer_id, v_channel_id
  FROM messaging.conversations c
  WHERE c.id = p_conversation_id;

  IF v_conv_status IN ('open', 'waiting_human') THEN
    RETURN json_build_object(
      'should_process', false,
      'combined_text',  NULL,
      'message_count',  0
    );
  END IF;

  -- Debounce: only the most-recent message in the window gets processed
  SELECT id INTO v_latest_message_id
  FROM messaging.messages
  WHERE conversation_id = p_conversation_id
    AND direction       = 'inbound'
    AND created_at      BETWEEN v_message_created_at
                            AND v_message_created_at + (p_batch_window_seconds || ' seconds')::interval
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_latest_message_id IS DISTINCT FROM p_message_id THEN
    RETURN json_build_object(
      'should_process', false,
      'combined_text',  NULL,
      'message_count',  0
    );
  END IF;

  -- Aggregate messages in window
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

  -- ── Transfer-intent interception ──────────────────────────────────────────────
  IF public.rpc_n8n_detect_transfer_intent(COALESCE(v_combined_text, '')) THEN

    -- Create handoff entry (v_tenant_id etc already fetched above)
    IF v_tenant_id IS NOT NULL THEN

      v_hours_check := public.rpc_n8n_check_business_hours(p_conversation_id);
      v_is_open     := COALESCE((v_hours_check->>'is_open')::boolean, true);

      IF v_is_open THEN
        v_notify_msg := 'Estou transferindo você para um de nossos atendentes. Aguarde um momento, por favor.';
      ELSE
        v_notify_msg := 'No momento não há atendentes disponíveis. Assim que um atendente estiver disponível, você será atendido. 😊';
      END IF;

      UPDATE messaging.conversations
      SET status = 'waiting_human'::messaging.conversation_status, updated_at = now()
      WHERE id = p_conversation_id;

      INSERT INTO ai.agent_handoffs (
        tenant_id, conversation_id, reason_text, target_role, status, created_at
      ) VALUES (
        v_tenant_id, p_conversation_id,
        'Solicitado pelo cliente via mensagem',
        'agent', 'pending', now()
      );

      INSERT INTO messaging.messages (
        conversation_id, direction, message_type, content_text, sender_type, created_at
      ) VALUES (
        p_conversation_id, 'outbound', 'text', v_notify_msg, 'bot', now()
      );

      INSERT INTO ops.outbound_message_queue (
        tenant_id, conversation_id, customer_id, channel_id,
        content_text, content_blocks_jsonb,
        buffer_strategy, scheduled_send_at, status
      ) VALUES (
        v_tenant_id, p_conversation_id, v_customer_id, v_channel_id,
        v_notify_msg, '[]'::jsonb,
        'time_window', now(), 'queued'
      );

      RETURN json_build_object(
        'should_process', false,
        'combined_text',  v_combined_text,
        'message_count',  v_message_count
      );
    END IF;
  END IF;

  -- Normal path: bot processes the message
  RETURN json_build_object(
    'should_process', true,
    'combined_text',  v_combined_text,
    'message_count',  v_message_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_take_conversation_batch(uuid, uuid, integer)
  TO anon, authenticated, service_role;
