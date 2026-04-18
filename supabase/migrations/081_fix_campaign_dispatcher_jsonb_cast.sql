-- ============================================================
-- Migration 081: Fix CASE/WHEN jsonb→json cast in
--                rpc_list_running_campaigns()
--
-- manual_recipients_json is jsonb; the ELSE branch returns json
-- (from json_agg). PostgreSQL rejects the mixed types.
-- Fix: cast the manual branch to json explicitly.
-- ============================================================

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
            c.manual_recipients_json::json
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
