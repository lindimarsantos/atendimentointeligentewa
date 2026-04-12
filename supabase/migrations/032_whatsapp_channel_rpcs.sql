-- ============================================================
-- Migration 032: WhatsApp channel read/update RPCs
--
-- Exposes messaging.tenant_channels to the dashboard so the
-- user can configure Z-API credentials (instance_id, token,
-- phone number) without touching the DB directly.
-- ============================================================

-- ── rpc_get_whatsapp_channel ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_get_whatsapp_channel(
  p_tenant_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging
AS $$
DECLARE
  v_row messaging.tenant_channels%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM messaging.tenant_channels
  WHERE tenant_id = p_tenant_id
  ORDER BY created_at
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object(
    'id',                   v_row.id,
    'tenant_id',            v_row.tenant_id,
    'type',                 v_row.type::text,
    'name',                 v_row.name,
    'is_active',            v_row.is_active,
    'external_account_id',  v_row.external_account_id,
    'webhook_url',          v_row.webhook_url,
    'config_jsonb',         v_row.config_jsonb
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_get_whatsapp_channel(uuid)
  TO anon, authenticated, service_role;

-- ── rpc_update_whatsapp_channel ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_update_whatsapp_channel(
  p_tenant_id           uuid,
  p_instance_id         text,
  p_zapi_token          text,
  p_phone_number        text  DEFAULT NULL,
  p_webhook_url         text  DEFAULT NULL,
  p_is_active           boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging
AS $$
DECLARE
  v_config jsonb;
  v_instance_id text;
  v_token       text;
  v_phone       text;
BEGIN
  -- Trim and nullify blanks
  v_instance_id := NULLIF(TRIM(p_instance_id), '');
  v_token       := NULLIF(TRIM(p_zapi_token), '');
  v_phone       := NULLIF(TRIM(COALESCE(p_phone_number, '')), '');

  -- Merge into existing config_jsonb so we don't overwrite other keys
  SELECT COALESCE(config_jsonb, '{}') INTO v_config
  FROM messaging.tenant_channels
  WHERE tenant_id = p_tenant_id
  LIMIT 1;

  v_config := v_config
    || jsonb_strip_nulls(jsonb_build_object(
         'zapi_token',    v_token,
         'phone_number',  v_phone
       ));

  UPDATE messaging.tenant_channels
  SET
    external_account_id = COALESCE(v_instance_id, external_account_id),
    webhook_url         = COALESCE(NULLIF(TRIM(COALESCE(p_webhook_url,'')), ''), webhook_url),
    is_active           = p_is_active,
    config_jsonb        = v_config,
    updated_at          = now()
  WHERE tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Canal WhatsApp não encontrado para o tenant %', p_tenant_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_update_whatsapp_channel(uuid, text, text, text, text, boolean)
  TO anon, authenticated, service_role;
