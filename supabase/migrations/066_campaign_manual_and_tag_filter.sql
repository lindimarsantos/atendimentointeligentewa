-- ============================================================
-- Migration 066: Campanhas — lista manual de destinatários
--                e filtro por tag
--
-- 1. Coluna manual_recipients_json em messaging.campaigns
-- 2. Atualiza rpc_upsert_campaign (aceita manual_recipients_json)
-- 3. Atualiza rpc_list_running_campaigns:
--      recipient_filter = 'tag:TAGNAME'  → filtra por tag
--      recipient_filter = 'manual'       → usa manual_recipients_json
-- ============================================================

-- ── 1. Coluna ─────────────────────────────────────────────────────────────────
ALTER TABLE messaging.campaigns
  ADD COLUMN IF NOT EXISTS manual_recipients_json jsonb NOT NULL DEFAULT '[]';

-- ── 2. rpc_upsert_campaign ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_upsert_campaign(
  p_tenant_id              uuid,
  p_id                     uuid        DEFAULT NULL,
  p_name                   text        DEFAULT NULL,
  p_template_id            uuid        DEFAULT NULL,
  p_target_count           int         DEFAULT NULL,
  p_scheduled_at           timestamptz DEFAULT NULL,
  p_status                 text        DEFAULT 'draft',
  p_recipient_filter       text        DEFAULT 'all',
  p_manual_recipients_json jsonb       DEFAULT '[]'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging
AS $$
BEGIN
  INSERT INTO messaging.campaigns
    (id, tenant_id, name, template_id, target_count, scheduled_at,
     status, recipient_filter, manual_recipients_json)
  VALUES
    (COALESCE(p_id, gen_random_uuid()), p_tenant_id, p_name, p_template_id,
     p_target_count, p_scheduled_at,
     COALESCE(p_status, 'draft'), COALESCE(p_recipient_filter, 'all'),
     COALESCE(p_manual_recipients_json, '[]'))
  ON CONFLICT (id) DO UPDATE SET
    name                   = EXCLUDED.name,
    template_id            = EXCLUDED.template_id,
    target_count           = EXCLUDED.target_count,
    scheduled_at           = EXCLUDED.scheduled_at,
    status                 = EXCLUDED.status,
    recipient_filter       = EXCLUDED.recipient_filter,
    manual_recipients_json = EXCLUDED.manual_recipients_json,
    updated_at             = now();
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_upsert_campaign(uuid, uuid, text, uuid, int, timestamptz, text, text, jsonb)
  TO anon, authenticated, service_role;

-- ── 3. rpc_list_running_campaigns ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_list_running_campaigns(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, config, crm
AS $$
BEGIN
  -- Promove campanhas agendadas cujo scheduled_at já passou
  UPDATE messaging.campaigns
  SET status = 'running', updated_at = now()
  WHERE tenant_id    = p_tenant_id
    AND status       = 'scheduled'
    AND scheduled_at <= NOW();

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
        -- destinatários: lista manual OU clientes filtrados
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
            WHERE cu.tenant_id  = p_tenant_id
              AND cu.phone_e164 IS NOT NULL
              AND cu.phone_e164 <> ''
              AND CASE
                    -- filtros por status
                    WHEN c.recipient_filter = 'active'
                      THEN cu.status::text = 'active'
                    WHEN c.recipient_filter = 'lead'
                      THEN cu.status::text = 'lead'
                    WHEN c.recipient_filter = 'active_and_lead'
                      THEN cu.status::text IN ('active','lead')
                    -- filtro por tag: 'tag:nome-da-tag'
                    WHEN c.recipient_filter LIKE 'tag:%'
                      THEN substring(c.recipient_filter FROM 5) = ANY(cu.tags)
                    -- todos
                    ELSE true
                  END
          )
        END AS recipients
      FROM messaging.campaigns c
      LEFT JOIN config.whatsapp_templates wt ON wt.id = c.template_id
      WHERE c.tenant_id = p_tenant_id
        AND c.status    = 'running'
    ) r
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_list_running_campaigns(uuid)
  TO anon, authenticated, service_role;

-- ── 4. rpc_list_campaigns (inclui manual_recipients_json) ────────────────────
CREATE OR REPLACE FUNCTION public.rpc_list_campaigns(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT json_agg(row_to_json(c) ORDER BY c.created_at DESC)
     FROM (
       SELECT
         id, tenant_id, name, template_id, target_count, sent_count,
         scheduled_at, status, recipient_filter, manual_recipients_json,
         created_at, updated_at
       FROM messaging.campaigns
       WHERE tenant_id = p_tenant_id
     ) c),
    '[]'::json
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_list_campaigns(uuid)
  TO anon, authenticated, service_role;
