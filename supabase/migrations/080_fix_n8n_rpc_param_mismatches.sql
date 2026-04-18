-- ============================================================
-- Migration 080: Fix n8n RPC parameter mismatches
--
-- 1. rpc_list_running_campaigns() – n8n calls with no params;
--    function required p_tenant_id. Added no-param overload
--    that processes all tenants.
--
-- 2. rpc_n8n_get_scheduling_followup_targets – n8n sends
--    p_hours_first / p_hours_second; function had p_hours_min /
--    p_hours_max. Dropped and recreated with correct param names.
-- ============================================================

-- ── Fix 1: rpc_list_running_campaigns with no params ─────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_list_running_campaigns()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, config, crm
AS $$
BEGIN
  UPDATE messaging.campaigns
  SET status = 'running', updated_at = now()
  WHERE status       = 'scheduled'
    AND scheduled_at <= now();

  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r) ORDER BY r.created_at ASC), '[]'::json)
    FROM (
      SELECT
        c.id                AS campaign_id,
        c.created_at,
        c.tenant_id,
        c.name              AS campaign_name,
        c.template_id,
        c.target_count,
        c.sent_count,
        c.recipient_filter,
        c.manual_recipients_json,
        wt.body_text        AS template_body,
        wt.header_text      AS template_header,
        wt.name             AS template_name,
        COALESCE(wt.metadata_jsonb->>'template_type', 'zapi') AS template_type,
        CASE
          WHEN c.recipient_filter = 'manual' THEN
            c.manual_recipients_json
          ELSE (
            SELECT COALESCE(json_agg(
              json_build_object(
                'customer_id', cu.id,
                'name',        cu.full_name,
                'phone',       cu.phone_e164
              )
            ), '[]'::json)
            FROM crm.customers cu
            WHERE cu.tenant_id  = c.tenant_id
              AND cu.phone_e164 IS NOT NULL
              AND cu.phone_e164 <> ''
              AND CASE
                    WHEN c.recipient_filter = 'active'
                      THEN cu.status::text = 'active'
                    WHEN c.recipient_filter = 'lead'
                      THEN cu.status::text = 'lead'
                    WHEN c.recipient_filter = 'active_and_lead'
                      THEN cu.status::text IN ('active','lead')
                    WHEN c.recipient_filter LIKE 'tag:%'
                      THEN substring(c.recipient_filter FROM 5) = ANY(cu.tags)
                    ELSE true
                  END
          )
        END AS recipients
      FROM messaging.campaigns c
      LEFT JOIN config.whatsapp_templates wt ON wt.id = c.template_id
      WHERE c.status = 'running'
    ) r
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_list_running_campaigns()
  TO anon, authenticated, service_role;

-- ── Fix 2: rename p_hours_min/max → p_hours_first/second ─────────────────────

DROP FUNCTION IF EXISTS public.rpc_n8n_get_scheduling_followup_targets(integer, integer);

CREATE OR REPLACE FUNCTION public.rpc_n8n_get_scheduling_followup_targets(
  p_hours_first  integer DEFAULT 2,
  p_hours_second integer DEFAULT 24
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
