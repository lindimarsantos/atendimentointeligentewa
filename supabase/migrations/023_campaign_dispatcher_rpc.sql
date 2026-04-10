-- ============================================================
-- Migration 023: RPCs para Campaigns Dispatcher (n8n cron)
-- Usados pelo workflow "Campaigns - Dispatcher" no n8n
-- ============================================================

-- ── rpc_list_running_campaigns ────────────────────────────────────────────────
-- Retorna campanhas com status 'running' prontas para dispatch
CREATE OR REPLACE FUNCTION public.rpc_list_running_campaigns(
  p_tenant_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, config, crm
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r) ORDER BY r.created_at ASC), '[]'::json)
    FROM (
      SELECT
        c.id              AS campaign_id,
        c.tenant_id,
        c.name            AS campaign_name,
        c.template_id,
        c.target_count,
        c.sent_count,
        -- Template body from config.whatsapp_templates
        wt.body_text      AS template_body,
        wt.header_text    AS template_header,
        wt.name           AS template_name,
        COALESCE(wt.metadata_jsonb->>'template_type', 'zapi') AS template_type,
        -- Customers to send (all active tenant customers with phone)
        (
          SELECT COALESCE(json_agg(
            json_build_object(
              'customer_id', cu.id,
              'name',        cu.name,
              'phone',       cu.phone
            )
          ), '[]'::json)
          FROM crm.customers cu
          WHERE cu.tenant_id = p_tenant_id
            AND cu.phone IS NOT NULL
            AND cu.phone <> ''
        ) AS recipients
      FROM messaging.campaigns c
      LEFT JOIN config.whatsapp_templates wt ON wt.id = c.template_id
      WHERE c.tenant_id = p_tenant_id
        AND c.status = 'running'
    ) r
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_list_running_campaigns(uuid)
  TO anon, authenticated, service_role;

-- ── rpc_complete_campaign ─────────────────────────────────────────────────────
-- Marca campanha como concluída e atualiza sent_count
CREATE OR REPLACE FUNCTION public.rpc_complete_campaign(
  p_tenant_id   uuid,
  p_campaign_id uuid,
  p_sent_count  int  DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging
AS $$
BEGIN
  UPDATE messaging.campaigns
  SET
    status     = 'completed',
    sent_count = COALESCE(p_sent_count, sent_count, 0),
    updated_at = now()
  WHERE id = p_campaign_id AND tenant_id = p_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_complete_campaign(uuid, uuid, int)
  TO anon, authenticated, service_role;
