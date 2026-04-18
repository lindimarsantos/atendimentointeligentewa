-- ============================================================
-- Migration 078: Fix business_hours column names + n8n enforcement
--
-- Problems:
--   1. config.business_hours table has columns weekday/start_time/end_time
--      but RPCs and TypeScript types use day_of_week/open_time/close_time.
--   2. No RPC for n8n to check whether we're currently in business hours.
--   3. rpc_n8n_solicitar_humano always sends "transferring you now…" even
--      when no agents are available (outside hours).
--
-- Fixes:
--   1. Rename DB columns to match TypeScript types (safe — skips if already renamed).
--   2. Recreate rpc_get_business_hours / rpc_update_business_hours with correct names.
--   3. Add rpc_n8n_check_business_hours(conversation_id) → {is_open}
--   4. Update rpc_n8n_solicitar_humano to send different message outside hours.
-- ============================================================

-- ── Step 1: Normalise column names ────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'config' AND table_name = 'business_hours' AND column_name = 'weekday'
  ) THEN
    ALTER TABLE config.business_hours RENAME COLUMN weekday TO day_of_week;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'config' AND table_name = 'business_hours' AND column_name = 'start_time'
  ) THEN
    ALTER TABLE config.business_hours RENAME COLUMN start_time TO open_time;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'config' AND table_name = 'business_hours' AND column_name = 'end_time'
  ) THEN
    ALTER TABLE config.business_hours RENAME COLUMN end_time TO close_time;
  END IF;
END $$;

-- ── Step 2: Fix rpc_get_business_hours ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_get_business_hours(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(h) ORDER BY h.day_of_week)
    FROM config.business_hours h
    WHERE h.tenant_id = p_tenant_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_business_hours(uuid)
  TO anon, authenticated, service_role;

-- ── Step 3: Fix rpc_update_business_hours ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_update_business_hours(
  p_tenant_id uuid,
  p_hours     jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
DECLARE
  v_hour jsonb;
BEGIN
  FOR v_hour IN SELECT * FROM jsonb_array_elements(p_hours)
  LOOP
    UPDATE config.business_hours
    SET
      open_time  = (v_hour->>'open_time')::time,
      close_time = (v_hour->>'close_time')::time,
      is_open    = (v_hour->>'is_open')::boolean,
      updated_at = now()
    WHERE tenant_id    = p_tenant_id
      AND day_of_week  = (v_hour->>'day_of_week')::int;

    IF NOT FOUND THEN
      INSERT INTO config.business_hours (tenant_id, day_of_week, open_time, close_time, is_open)
      VALUES (
        p_tenant_id,
        (v_hour->>'day_of_week')::int,
        (v_hour->>'open_time')::time,
        (v_hour->>'close_time')::time,
        (v_hour->>'is_open')::boolean
      );
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_update_business_hours(uuid, jsonb)
  TO anon, authenticated, service_role;

-- ── Step 4: rpc_n8n_check_business_hours ──────────────────────────────────────
-- Returns {is_open: boolean}.
-- If no hours are configured for the tenant → assumes always open.

CREATE OR REPLACE FUNCTION public.rpc_n8n_check_business_hours(
  p_conversation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config, messaging
AS $$
DECLARE
  v_tenant_id uuid;
  v_timezone  text;
  v_now_local timestamptz;
  v_dow       int;
  v_time_now  time;
  v_row_count int;
  v_is_open   boolean;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM messaging.conversations
  WHERE id = p_conversation_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('is_open', true);
  END IF;

  SELECT COALESCE(default_timezone, 'America/Sao_Paulo') INTO v_timezone
  FROM config.tenant_settings
  WHERE tenant_id = v_tenant_id
  LIMIT 1;

  v_now_local := now() AT TIME ZONE COALESCE(v_timezone, 'America/Sao_Paulo');
  v_dow       := EXTRACT(DOW FROM v_now_local)::int;
  v_time_now  := v_now_local::time;

  SELECT COUNT(*) INTO v_row_count
  FROM config.business_hours
  WHERE tenant_id = v_tenant_id;

  -- No hours configured → assume always open
  IF v_row_count = 0 THEN
    RETURN jsonb_build_object('is_open', true);
  END IF;

  SELECT is_open INTO v_is_open
  FROM config.business_hours
  WHERE tenant_id   = v_tenant_id
    AND day_of_week = v_dow
    AND is_open     = true
    AND v_time_now BETWEEN open_time AND close_time
  LIMIT 1;

  RETURN jsonb_build_object('is_open', COALESCE(v_is_open, false));
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_n8n_check_business_hours(uuid)
  TO anon, authenticated, service_role;

-- ── Step 5: Update rpc_n8n_solicitar_humano ───────────────────────────────────

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
SET search_path = public, messaging, ai, config
AS $$
DECLARE
  v_handoff_id  uuid;
  v_already     text;
  v_hours_check jsonb;
  v_is_open     boolean;
  v_notify_msg  text;
BEGIN
  SELECT status INTO v_already
  FROM messaging.conversations
  WHERE id = p_conversation_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversa não encontrada';
  END IF;

  IF v_already = 'waiting_human' THEN
    RETURN jsonb_build_object(
      'status',          'waiting_human',
      'handoff_created', true,
      'already_queued',  true
    );
  END IF;

  IF v_already = 'open' THEN
    RETURN jsonb_build_object(
      'status',          'open',
      'handoff_created', true,
      'already_open',    true
    );
  END IF;

  -- Check business hours to select the right customer-facing message
  v_hours_check := public.rpc_n8n_check_business_hours(p_conversation_id);
  v_is_open     := COALESCE((v_hours_check->>'is_open')::boolean, true);

  IF v_is_open THEN
    v_notify_msg := 'Estou transferindo você para um de nossos atendentes. Aguarde um momento, por favor.';
  ELSE
    v_notify_msg := 'No momento não há atendentes disponíveis. Assim que um atendente estiver disponível, você será atendido. 😊';
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
      v_notify_msg,
      'bot',
      now()
    );
  END IF;

  RETURN jsonb_build_object(
    'status',          'waiting_human',
    'handoff_id',      v_handoff_id,
    'handoff_created', true,
    'outside_hours',   NOT v_is_open
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_n8n_solicitar_humano(uuid, uuid, text, text, boolean)
  TO anon, authenticated, service_role;
