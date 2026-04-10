-- ============================================================
-- Migration 006: RPCs para CRUD de Campanhas e Templates
-- Totalmente aditiva — não altera dados nem funções existentes
-- ============================================================

-- ─── messaging.campaigns ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_upsert_campaign(
  p_tenant_id   uuid,
  p_id          uuid    DEFAULT NULL,
  p_name        text    DEFAULT NULL,
  p_template_id uuid    DEFAULT NULL,
  p_target_count int    DEFAULT NULL,
  p_scheduled_at timestamptz DEFAULT NULL,
  p_status      text    DEFAULT 'draft'
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
      name          = COALESCE(p_name, name),
      template_id   = p_template_id,
      target_count  = COALESCE(p_target_count, target_count),
      scheduled_at  = p_scheduled_at,
      status        = COALESCE(p_status, status),
      updated_at    = now()
    WHERE id = p_id AND tenant_id = p_tenant_id;
  ELSE
    INSERT INTO messaging.campaigns
      (tenant_id, name, template_id, target_count, scheduled_at, status)
    VALUES
      (p_tenant_id, p_name, p_template_id, p_target_count, p_scheduled_at, p_status);
  END IF;
END;
$$;

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
END;
$$;

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
  WHERE id = p_id AND tenant_id = p_tenant_id AND status = 'draft';
END;
$$;

-- ─── messaging.message_templates ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_upsert_message_template(
  p_tenant_id  uuid,
  p_id         uuid    DEFAULT NULL,
  p_name       text    DEFAULT NULL,
  p_category   text    DEFAULT 'utility',
  p_language   text    DEFAULT 'pt_BR',
  p_components jsonb   DEFAULT '[]',
  p_status     text    DEFAULT 'pending'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging
AS $$
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE messaging.message_templates
    SET
      name       = COALESCE(p_name, name),
      category   = COALESCE(p_category, category),
      language   = COALESCE(p_language, language),
      components = COALESCE(p_components, components),
      updated_at = now()
    WHERE id = p_id AND tenant_id = p_tenant_id;
  ELSE
    INSERT INTO messaging.message_templates
      (tenant_id, name, category, language, components, status)
    VALUES
      (p_tenant_id, p_name, p_category, p_language, p_components, p_status);
  END IF;
END;
$$;

-- ─── GRANTs ───────────────────────────────────────────────────────────────────

DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'rpc_upsert_campaign(uuid,uuid,text,uuid,int,timestamptz,text)',
    'rpc_update_campaign_status(uuid,uuid,text)',
    'rpc_delete_campaign(uuid,uuid)',
    'rpc_upsert_message_template(uuid,uuid,text,text,text,jsonb,text)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon, authenticated, service_role', fn);
  END LOOP;
END;
$$;
