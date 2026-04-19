-- Migration 089: Restore followup_message_template field in rpc_n8n_get_scheduling_followup_targets
--
-- Migration 082 fixed the parameter names (p_hours_first / p_hours_second) but accidentally
-- dropped the followup_message_template column that migration 053 had added.
-- This migration recreates the function with both correct param names AND the template field.

DROP FUNCTION IF EXISTS public.rpc_n8n_get_scheduling_followup_targets(integer, integer);

CREATE OR REPLACE FUNCTION public.rpc_n8n_get_scheduling_followup_targets(
  p_hours_first  integer DEFAULT 2,
  p_hours_second integer DEFAULT 24
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, crm, config
AS $$
DECLARE
  v_default_msg text :=
    'Olá! 😊 Ainda estou por aqui — gostaria de saber se algum dos horários que sugeri funciona para você, ou se preferir posso verificar outras opções disponíveis. É só me dizer!';
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
        tc.config_jsonb->>'zapi_client_token'         AS zapi_client_token,
        COALESCE(
          cs.scheduling_followup_message,
          v_default_msg
        )                                             AS followup_message_template
      FROM messaging.conversations c
      JOIN last_msg lm ON lm.conversation_id = c.id
      JOIN crm.customers cu ON cu.id = c.customer_id
      JOIN messaging.tenant_channels tc
             ON tc.tenant_id = c.tenant_id AND tc.is_active = true
      LEFT JOIN config.channel_settings cs
             ON cs.tenant_id = c.tenant_id
      WHERE c.status = 'bot_active'
        AND lm.direction = 'outbound'
        AND lm.created_at >= NOW() - (p_hours_second || ' hours')::interval
        AND lm.created_at <  NOW() - (p_hours_first  || ' hours')::interval
        AND cu.phone IS NOT NULL
        AND tc.external_account_id IS NOT NULL
    ) r
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_n8n_get_scheduling_followup_targets(integer, integer)
  TO anon, authenticated, service_role;
