-- Migration 087: Fix rpc_get_operational_stats (job_queue missing table) and
--               fix rpc_list_audit_logs date filtering for America/Sao_Paulo timezone.

-- ─── rpc_get_operational_stats ───────────────────────────────────────────────
-- Wraps the job_queue query in an exception handler so a missing table returns 0
-- instead of crashing the entire function.

CREATE OR REPLACE FUNCTION public.rpc_get_operational_stats(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, crm, ops
AS $$
DECLARE
  v_jobs_completed bigint := 0;
BEGIN
  BEGIN
    SELECT COUNT(*) INTO v_jobs_completed
    FROM public.job_queue
    WHERE tenant_id = p_tenant_id
      AND status    = 'done';
  EXCEPTION WHEN undefined_table THEN
    v_jobs_completed := 0;
  END;

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

    'jobs_completed', v_jobs_completed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_operational_stats(uuid)
  TO anon, authenticated, service_role;


-- ─── rpc_list_audit_logs ─────────────────────────────────────────────────────
-- Fix: date boundary parameters are treated as America/Sao_Paulo midnight,
--      matching what the user sees in the UI date picker.

CREATE OR REPLACE FUNCTION public.rpc_list_audit_logs(
  p_tenant_id   uuid,
  p_entity_type text    DEFAULT NULL,
  p_action      text    DEFAULT NULL,
  p_actor_type  text    DEFAULT NULL,
  p_date_from   text    DEFAULT NULL,
  p_date_to     text    DEFAULT NULL,
  p_limit       int     DEFAULT 50,
  p_offset      int     DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(a))
    FROM (
      SELECT *
      FROM audit.audit_logs al
      WHERE
        (al.tenant_id = p_tenant_id OR al.tenant_id IS NULL)
        AND (p_entity_type IS NULL OR al.entity_type = p_entity_type)
        AND (p_action      IS NULL OR al.action      = p_action)
        AND (p_actor_type  IS NULL OR al.actor_type  = p_actor_type)
        AND (p_date_from   IS NULL OR al.created_at >= (p_date_from::date AT TIME ZONE 'America/Sao_Paulo'))
        AND (p_date_to     IS NULL OR al.created_at <  ((p_date_to::date + 1) AT TIME ZONE 'America/Sao_Paulo'))
      ORDER BY al.created_at DESC
      LIMIT p_limit
      OFFSET p_offset
    ) a
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_list_audit_logs(uuid, text, text, text, text, text, int, int)
  TO anon, authenticated, service_role;
