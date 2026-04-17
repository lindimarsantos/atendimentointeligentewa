-- ============================================================
-- Migration 058: Encerramento automático de conversas
--
-- 1. rpc_sofia_close_conversation
--    Sofia chama esta ferramenta quando a conversa foi resolvida
--    (agendamento confirmado, dúvida respondida, cliente se despediu).
--
-- 2. rpc_n8n_auto_close_inactive
--    n8n chama após o cron de follow-up.
--    Encerra conversas onde o 2º lembrete já foi enviado e o cliente
--    ainda não respondeu depois de p_hours_after horas.
-- ============================================================

-- ── 1. rpc_sofia_close_conversation ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_sofia_close_conversation(
  p_conversation_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging
AS $$
BEGIN
  UPDATE messaging.conversations
  SET
    status                = 'resolved',
    followup_count        = 0,
    followup_last_sent_at = NULL,
    updated_at            = now()
  WHERE id     = p_conversation_id
    AND status != 'resolved';

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_sofia_close_conversation(uuid)
  TO anon, authenticated, service_role;

-- ── 2. rpc_n8n_auto_close_inactive ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_n8n_auto_close_inactive(
  p_hours_after int DEFAULT 48
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging
AS $$
DECLARE
  v_count int;
BEGIN
  WITH closed AS (
    UPDATE messaging.conversations
    SET
      status                = 'resolved',
      followup_count        = 0,
      followup_last_sent_at = NULL,
      updated_at            = now()
    WHERE status                = 'bot_active'
      AND followup_count        >= 2
      AND followup_last_sent_at < NOW() - (p_hours_after || ' hours')::interval
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM closed;

  RETURN json_build_object('closed', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_n8n_auto_close_inactive(int)
  TO anon, authenticated, service_role;
