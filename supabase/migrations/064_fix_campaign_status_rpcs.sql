-- ============================================================
-- Migration 064: Recriar RPCs de campanha que falharam porque
-- a tabela messaging.campaigns só foi criada na migration 060.
-- ============================================================

-- rpc_update_campaign_status
CREATE OR REPLACE FUNCTION public.rpc_update_campaign_status(
  p_tenant_id uuid,
  p_id        uuid,
  p_status    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging
AS $$
BEGIN
  UPDATE messaging.campaigns
  SET status = p_status, updated_at = now()
  WHERE id = p_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campanha não encontrada';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_update_campaign_status(uuid, uuid, text)
  TO anon, authenticated, service_role;

-- rpc_delete_campaign
CREATE OR REPLACE FUNCTION public.rpc_delete_campaign(
  p_tenant_id uuid,
  p_id        uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging
AS $$
BEGIN
  DELETE FROM messaging.campaigns
  WHERE id = p_id AND tenant_id = p_tenant_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_delete_campaign(uuid, uuid)
  TO anon, authenticated, service_role;

-- rpc_upsert_campaign (recriar para garantir que referencia a tabela correta)
CREATE OR REPLACE FUNCTION public.rpc_upsert_campaign(
  p_tenant_id        uuid,
  p_id               uuid    DEFAULT NULL,
  p_name             text    DEFAULT NULL,
  p_template_id      uuid    DEFAULT NULL,
  p_target_count     int     DEFAULT NULL,
  p_scheduled_at     timestamptz DEFAULT NULL,
  p_status           text    DEFAULT 'draft',
  p_recipient_filter text    DEFAULT 'all'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging
AS $$
BEGIN
  INSERT INTO messaging.campaigns
    (id, tenant_id, name, template_id, target_count, scheduled_at, status, recipient_filter)
  VALUES
    (COALESCE(p_id, gen_random_uuid()), p_tenant_id, p_name, p_template_id,
     p_target_count, p_scheduled_at, p_status::text, p_recipient_filter)
  ON CONFLICT (id) DO UPDATE SET
    name             = EXCLUDED.name,
    template_id      = EXCLUDED.template_id,
    target_count     = EXCLUDED.target_count,
    scheduled_at     = EXCLUDED.scheduled_at,
    status           = EXCLUDED.status,
    recipient_filter = EXCLUDED.recipient_filter,
    updated_at       = now();
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_upsert_campaign(uuid, uuid, text, uuid, int, timestamptz, text, text)
  TO anon, authenticated, service_role;
