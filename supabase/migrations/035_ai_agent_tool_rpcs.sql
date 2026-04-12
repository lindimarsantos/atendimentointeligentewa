-- ============================================================
-- Migration 035: AI Agent tool RPCs
--
-- Wrappers designed for n8n AI Agent tool calls.
-- Accept only conversation_id + semantic params — no UUID
-- lookups required by the caller (AI resolves internally).
-- ============================================================

-- ── rpc_ai_get_slots ──────────────────────────────────────────────────────────
-- Tool: "Verificar Horários Disponíveis"
-- The AI calls this when a patient wants to schedule.
-- Resolves tenant_id from conversation_id internally.

CREATE OR REPLACE FUNCTION public.rpc_ai_get_slots(
  p_conversation_id uuid,
  p_service_name    text,
  p_date_from       date  DEFAULT NULL,
  p_date_to         date  DEFAULT NULL,
  p_limit           int   DEFAULT 6
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, scheduling
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM messaging.conversations
  WHERE id = p_conversation_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN json_build_object('error', 'Conversa não encontrada', 'slots', '[]'::json);
  END IF;

  RETURN public.rpc_n8n_get_slots(
    p_tenant_id         => v_tenant_id,
    p_service_name      => p_service_name,
    p_professional_name => NULL,
    p_date_from         => p_date_from,
    p_date_to           => p_date_to,
    p_limit             => p_limit
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_ai_get_slots(uuid, text, date, date, int)
  TO anon, authenticated, service_role;


-- ── rpc_ai_book_appointment ───────────────────────────────────────────────────
-- Tool: "Confirmar Agendamento"
-- The AI calls this ONLY after explicit patient confirmation.
-- Resolves tenant_id and customer_id from conversation_id.

CREATE OR REPLACE FUNCTION public.rpc_ai_book_appointment(
  p_conversation_id   uuid,
  p_service_name      text,
  p_professional_name text,
  p_start_at          timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, scheduling
AS $$
DECLARE
  v_tenant_id   uuid;
  v_customer_id uuid;
BEGIN
  SELECT tenant_id, customer_id
    INTO v_tenant_id, v_customer_id
  FROM messaging.conversations
  WHERE id = p_conversation_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN json_build_object('error', 'Conversa não encontrada');
  END IF;

  RETURN public.rpc_n8n_book_appointment(
    p_tenant_id          => v_tenant_id,
    p_conversation_id    => p_conversation_id,
    p_customer_id        => v_customer_id,
    p_service_name       => p_service_name,
    p_professional_name  => p_professional_name,
    p_start_at           => p_start_at,
    p_notes              => NULL
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_ai_book_appointment(uuid, text, text, timestamptz)
  TO anon, authenticated, service_role;
