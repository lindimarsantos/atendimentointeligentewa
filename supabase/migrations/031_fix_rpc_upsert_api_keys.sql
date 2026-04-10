-- ============================================================
-- Migration 031: Fix rpc_upsert_api_keys column names
--
-- config.tenant_settings real column names differ from what
-- was assumed in migration 029:
--   timezone          → default_timezone
--   language          → language_code
--   allow_audio       → allow_audio_input
--   allow_image       → allow_image_input
--   allow_video       → allow_video_input
--   allow_voice       → allow_voice_output
--   human_approval_high_risk → require_human_approval_for_high_risk
--   auto_create_customer     → auto_create_customer_on_first_contact
-- Also added missing currency_code and auto_create_lead_source_if_missing.
-- UPDATE-first approach avoids INSERT failures on existing tenants.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_upsert_api_keys(
  p_tenant_id uuid,
  p_keys      jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  UPDATE config.tenant_settings
  SET
    api_keys_jsonb = api_keys_jsonb || p_keys,
    updated_at     = now()
  WHERE tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    INSERT INTO config.tenant_settings
      (tenant_id, business_name, default_timezone, language_code, currency_code,
       intake_mode, allow_audio_input, allow_image_input, allow_video_input,
       allow_voice_output, require_human_approval_for_high_risk,
       auto_create_customer_on_first_contact, auto_create_lead_source_if_missing,
       settings_jsonb, api_keys_jsonb)
    VALUES
      (p_tenant_id, 'Negócio', 'America/Sao_Paulo', 'pt_BR', 'BRL',
       'bot_first', true, true, false,
       false, false,
       true, false,
       '{}', p_keys);
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_upsert_api_keys(uuid, jsonb)
  TO anon, authenticated, service_role;
