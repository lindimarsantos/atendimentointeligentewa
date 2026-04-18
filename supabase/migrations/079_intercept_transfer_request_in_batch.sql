-- ============================================================
-- Migration 079: Intercept human-transfer requests before AI
--
-- Root cause: the n8n "WA - AI Agent" workflow has no handoff
-- node. When a customer asks to speak to a human, the AI LLM
-- generates "Parece que não consigo encaminhar…" because it has
-- no tool to do the transfer.
--
-- Fix: intercept inside rpc_take_conversation_batch (called by
-- n8n BEFORE the AI agent runs). When the customer's combined
-- message contains transfer-intent keywords:
--   1. Create the agent_handoff entry
--   2. Update conversation → waiting_human
--   3. Insert the notification into messaging.messages
--   4. Enqueue the notification to ops.outbound_message_queue
--      so it is actually sent via WhatsApp
--   5. Return should_process = false → n8n skips the AI entirely
-- ============================================================

-- ── Step 1: transfer-intent keyword detector ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_n8n_detect_transfer_intent(p_text text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    lower(p_text) LIKE '%atendente humano%'
    OR lower(p_text) LIKE '%atendimento humano%'
    OR lower(p_text) LIKE '%me passe%'
    OR lower(p_text) LIKE '%me encaminhe%'
    OR lower(p_text) LIKE '%me transfere%'
    OR lower(p_text) LIKE '%me transfer%'
    OR lower(p_text) LIKE '%quero um atendente%'
    OR lower(p_text) LIKE '%preciso de um atendente%'
    OR lower(p_text) LIKE '%quero falar com%humano%'
    OR lower(p_text) LIKE '%quero falar com%pessoa%'
    OR lower(p_text) LIKE '%falar com um humano%'
    OR lower(p_text) LIKE '%falar com uma pessoa%'
    OR lower(p_text) LIKE '%falar com algu%'
    OR lower(p_text) LIKE '%quero um humano%'
    OR lower(p_text) LIKE '%preciso de humano%'
    OR lower(p_text) LIKE '%passe para um atendente%'
    OR lower(p_text) LIKE '%passe para atendimento%'
    OR lower(p_text) LIKE '%quero atendimento humano%'
    OR lower(p_text) LIKE '%atendente por favor%';
$$;

GRANT EXECUTE ON FUNCTION public.rpc_n8n_detect_transfer_intent(text)
  TO anon, authenticated, service_role;

-- ── Step 2: Modify rpc_take_conversation_batch ────────────────────────────────

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
  -- transfer
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

  -- ── Transfer-intent interception ─────────────────────────────────────────────
  IF public.rpc_n8n_detect_transfer_intent(COALESCE(v_combined_text, '')) THEN

    SELECT c.tenant_id, c.customer_id, c.channel_id, c.status::text
      INTO v_tenant_id, v_customer_id, v_channel_id, v_conv_status
    FROM messaging.conversations c
    WHERE c.id = p_conversation_id;

    -- Skip if already handed off or with a human
    IF v_tenant_id IS NOT NULL AND v_conv_status NOT IN ('waiting_human', 'open') THEN

      -- Pick message based on current business hours
      v_hours_check := public.rpc_n8n_check_business_hours(p_conversation_id);
      v_is_open     := COALESCE((v_hours_check->>'is_open')::boolean, true);

      IF v_is_open THEN
        v_notify_msg := 'Estou transferindo você para um de nossos atendentes. Aguarde um momento, por favor.';
      ELSE
        v_notify_msg := 'No momento não há atendentes disponíveis. Assim que um atendente estiver disponível, você será atendido. 😊';
      END IF;

      -- Transition conversation
      UPDATE messaging.conversations
      SET status = 'waiting_human'::messaging.conversation_status, updated_at = now()
      WHERE id = p_conversation_id;

      -- Create handoff queue entry
      INSERT INTO ai.agent_handoffs (
        tenant_id, conversation_id, reason_text, target_role, status, created_at
      ) VALUES (
        v_tenant_id, p_conversation_id,
        'Solicitado pelo cliente via mensagem',
        'agent', 'pending', now()
      );

      -- Save notification in conversation history
      INSERT INTO messaging.messages (
        conversation_id, direction, message_type, content_text, sender_type, created_at
      ) VALUES (
        p_conversation_id, 'outbound', 'text', v_notify_msg, 'bot', now()
      );

      -- Enqueue for actual WhatsApp delivery
      INSERT INTO ops.outbound_message_queue (
        tenant_id, conversation_id, customer_id, channel_id,
        content_text, content_blocks_jsonb,
        buffer_strategy, scheduled_send_at, status
      ) VALUES (
        v_tenant_id, p_conversation_id, v_customer_id, v_channel_id,
        v_notify_msg, '[]'::jsonb,
        'time_window', now(), 'queued'
      );

      -- Return false → n8n skips the AI agent entirely
      RETURN json_build_object(
        'should_process', false,
        'combined_text',  v_combined_text,
        'message_count',  v_message_count
      );
    END IF;
  END IF;

  -- Normal path
  RETURN json_build_object(
    'should_process', true,
    'combined_text',  v_combined_text,
    'message_count',  v_message_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_take_conversation_batch(uuid, uuid, integer)
  TO anon, authenticated, service_role;
