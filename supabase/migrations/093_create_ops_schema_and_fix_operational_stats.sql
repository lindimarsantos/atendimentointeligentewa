-- Migration 093: Cria schema ops + tabela reminder_rules (nunca criadas)
--               e protege rpc_get_operational_stats com exception handlers
--
-- Problema: ops.reminder_rules é referenciada desde migration 020 mas
-- nenhuma migration criou o schema ops nem a tabela. Quando a tabela não
-- existe, rpc_get_operational_stats falha inteiramente e a seção
-- "Estatísticas Operacionais" fica em branco (retorna null).

-- ─── ops schema + reminder_rules ─────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS ops;

CREATE TABLE IF NOT EXISTS ops.reminder_rules (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL,
  name         text        NOT NULL,
  trigger_type text        NOT NULL DEFAULT 'appointment_before',
  hours_before int,
  template_id  uuid,
  is_active    boolean     NOT NULL DEFAULT true,
  config_jsonb jsonb       NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reminder_rules_tenant_idx
  ON ops.reminder_rules (tenant_id);

ALTER TABLE ops.reminder_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY reminder_rules_service_role ON ops.reminder_rules
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON ops.reminder_rules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ops.reminder_rules TO authenticated;

-- ─── rpc_get_operational_stats — com exception handlers em todas as queries ──

CREATE OR REPLACE FUNCTION public.rpc_get_operational_stats(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, crm, ops
AS $$
DECLARE
  v_messages_today      bigint := 0;
  v_new_customers_today bigint := 0;
  v_followups_sent      bigint := 0;
  v_reminder_rules      bigint := 0;
  v_open_conversations  bigint := 0;
  v_jobs_completed      bigint := 0;
BEGIN
  BEGIN
    SELECT COUNT(*) INTO v_messages_today
    FROM messaging.messages
    WHERE tenant_id  = p_tenant_id
      AND created_at >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
  EXCEPTION WHEN OTHERS THEN
    v_messages_today := 0;
  END;

  BEGIN
    SELECT COUNT(*) INTO v_new_customers_today
    FROM crm.customers
    WHERE tenant_id  = p_tenant_id
      AND created_at >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
  EXCEPTION WHEN OTHERS THEN
    v_new_customers_today := 0;
  END;

  BEGIN
    SELECT COALESCE(SUM(followup_count), 0) INTO v_followups_sent
    FROM messaging.conversations
    WHERE tenant_id = p_tenant_id;
  EXCEPTION WHEN OTHERS THEN
    v_followups_sent := 0;
  END;

  BEGIN
    SELECT COUNT(*) INTO v_reminder_rules
    FROM ops.reminder_rules
    WHERE tenant_id = p_tenant_id;
  EXCEPTION WHEN OTHERS THEN
    v_reminder_rules := 0;
  END;

  BEGIN
    SELECT COUNT(*) INTO v_open_conversations
    FROM messaging.conversations
    WHERE tenant_id = p_tenant_id
      AND status IN ('open', 'bot_active', 'waiting_human', 'pending');
  EXCEPTION WHEN OTHERS THEN
    v_open_conversations := 0;
  END;

  BEGIN
    SELECT COUNT(*) INTO v_jobs_completed
    FROM public.job_queue
    WHERE tenant_id = p_tenant_id
      AND status    = 'done';
  EXCEPTION WHEN OTHERS THEN
    v_jobs_completed := 0;
  END;

  RETURN json_build_object(
    'messages_today',      v_messages_today,
    'new_customers_today', v_new_customers_today,
    'followups_sent',      v_followups_sent,
    'reminder_rules',      v_reminder_rules,
    'open_conversations',  v_open_conversations,
    'jobs_completed',      v_jobs_completed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_operational_stats(uuid)
  TO anon, authenticated, service_role;
