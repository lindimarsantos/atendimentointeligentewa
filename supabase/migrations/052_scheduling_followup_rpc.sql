-- ============================================================
-- Migration 052: rpc_n8n_get_scheduling_followup_targets
--
-- Retorna conversas em bot_active onde o bot enviou a última
-- mensagem há p_hours_min–p_hours_max horas e o cliente ainda
-- não respondeu. Usado pelo workflow de follow-up de agendamento.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_n8n_get_scheduling_followup_targets(
  p_hours_min int DEFAULT 2,
  p_hours_max int DEFAULT 4
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, crm
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
    FROM (
      WITH last_msg AS (
        SELECT DISTINCT ON (conversation_id)
          conversation_id,
          direction,
          created_at
        FROM messaging.messages
        ORDER BY conversation_id, created_at DESC
      )
      SELECT
        c.id                                          AS conversation_id,
        c.tenant_id,
        cu.full_name                                  AS customer_name,
        cu.phone                                      AS customer_phone,
        tc.external_account_id                        AS zapi_instance_id,
        tc.config_jsonb->>'zapi_token'                AS zapi_token,
        tc.config_jsonb->>'zapi_client_token'         AS zapi_client_token
      FROM messaging.conversations c
      JOIN last_msg lm ON lm.conversation_id = c.id
      JOIN crm.customers cu ON cu.id = c.customer_id
      JOIN messaging.tenant_channels tc
             ON tc.tenant_id = c.tenant_id AND tc.is_active = true
      WHERE c.status = 'bot_active'
        AND lm.direction = 'outbound'
        AND lm.created_at >= NOW() - (p_hours_max || ' hours')::interval
        AND lm.created_at <  NOW() - (p_hours_min || ' hours')::interval
        AND cu.phone IS NOT NULL
        AND tc.external_account_id IS NOT NULL
    ) r
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_n8n_get_scheduling_followup_targets(int, int)
  TO anon, authenticated, service_role;
