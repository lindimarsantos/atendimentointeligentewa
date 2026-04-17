-- ============================================================
-- Migration 059: Estatísticas operacionais
-- rpc_get_operational_stats retorna 6 métricas em tempo real:
--   messages_today, new_customers_today, followups_sent,
--   reminder_rules, open_conversations, jobs_completed
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_get_operational_stats(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, crm, ops
AS $$
BEGIN
  RETURN json_build_object(
    'messages_today',
      (SELECT COUNT(*)
       FROM messaging.messages
       WHERE tenant_id  = p_tenant_id
         AND created_at >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date),

    'new_customers_today',
      (SELECT COUNT(*)
       FROM crm.customers
       WHERE tenant_id  = p_tenant_id
         AND created_at >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date),

    'followups_sent',
      (SELECT COALESCE(SUM(followup_count), 0)
       FROM messaging.conversations
       WHERE tenant_id = p_tenant_id),

    'reminder_rules',
      (SELECT COUNT(*)
       FROM ops.reminder_rules
       WHERE tenant_id = p_tenant_id),

    'open_conversations',
      (SELECT COUNT(*)
       FROM messaging.conversations
       WHERE tenant_id = p_tenant_id
         AND status IN ('open', 'bot_active', 'waiting_human', 'pending')),

    'jobs_completed',
      (SELECT COUNT(*)
       FROM public.job_queue
       WHERE tenant_id = p_tenant_id
         AND status    = 'done')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_operational_stats(uuid)
  TO anon, authenticated, service_role;
