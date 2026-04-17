-- ============================================================
-- Migration 062: Filtro de destinatários por campanha
--
-- Adiciona recipient_filter em messaging.campaigns:
--   'all'            → todos os clientes com telefone
--   'active'         → apenas status = 'active'
--   'lead'           → apenas status = 'lead'
--   'active_and_lead'→ status IN ('active','lead')
--
-- Atualiza rpc_upsert_campaign e rpc_list_running_campaigns
-- para usar o filtro.
-- ============================================================

-- ── 1. Nova coluna ────────────────────────────────────────────────────────────

ALTER TABLE messaging.campaigns
  ADD COLUMN IF NOT EXISTS recipient_filter text NOT NULL DEFAULT 'all';

-- ── 2. rpc_upsert_campaign (aceita p_recipient_filter) ───────────────────────

CREATE OR REPLACE FUNCTION public.rpc_upsert_campaign(
  p_tenant_id        uuid,
  p_id               uuid        DEFAULT NULL,
  p_name             text        DEFAULT NULL,
  p_template_id      uuid        DEFAULT NULL,
  p_target_count     int         DEFAULT NULL,
  p_scheduled_at     timestamptz DEFAULT NULL,
  p_status           text        DEFAULT 'draft',
  p_recipient_filter text        DEFAULT 'all'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging
AS $$
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE messaging.campaigns
    SET
      name             = COALESCE(p_name,             name),
      template_id      = p_template_id,
      target_count     = COALESCE(p_target_count,     target_count),
      scheduled_at     = p_scheduled_at,
      status           = COALESCE(p_status,           status),
      recipient_filter = COALESCE(p_recipient_filter, recipient_filter),
      updated_at       = now()
    WHERE id = p_id AND tenant_id = p_tenant_id;
  ELSE
    INSERT INTO messaging.campaigns
      (tenant_id, name, template_id, target_count, scheduled_at, status, recipient_filter)
    VALUES
      (p_tenant_id, p_name, p_template_id, p_target_count, p_scheduled_at,
       COALESCE(p_status, 'draft'), COALESCE(p_recipient_filter, 'all'));
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_upsert_campaign(uuid,uuid,text,uuid,int,timestamptz,text,text)
  TO anon, authenticated, service_role;

-- ── 3. rpc_list_running_campaigns (aplica recipient_filter) ──────────────────

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
  WHERE tenant_id   = p_tenant_id
    AND status      = 'scheduled'
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
        wt.body_text        AS template_body,
        wt.header_text      AS template_header,
        wt.name             AS template_name,
        COALESCE(wt.metadata_jsonb->>'template_type', 'zapi') AS template_type,
        (
          SELECT COALESCE(json_agg(
            json_build_object(
              'customer_id', cu.id,
              'name',        cu.full_name,
              'phone',       cu.phone_e164
            )
          ), '[]'::json)
          FROM crm.customers cu
          WHERE cu.tenant_id   = p_tenant_id
            AND cu.phone_e164  IS NOT NULL
            AND cu.phone_e164  <> ''
            AND CASE c.recipient_filter
                  WHEN 'active'          THEN cu.status::text = 'active'
                  WHEN 'lead'            THEN cu.status::text = 'lead'
                  WHEN 'active_and_lead' THEN cu.status::text IN ('active','lead')
                  ELSE true   -- 'all'
                END
        ) AS recipients
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
