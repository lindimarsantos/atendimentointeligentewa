-- ============================================================
-- Migration 037: Fix rpc_update_business_contact column names
--
-- Migration 024 created this function with stale column names
-- that no longer match config.tenant_settings:
--   timezone              → default_timezone
--   language              → language_code
--   allow_audio           → allow_audio_input
--   allow_image           → allow_image_input
--   allow_video           → allow_video_input
--   allow_voice           → allow_voice_output
--   human_approval_high_risk     → require_human_approval_for_high_risk
--   auto_create_customer  → auto_create_customer_on_first_contact
--
-- Since all non-id columns have sensible defaults, the INSERT
-- only needs to specify tenant_id; ON CONFLICT handles existing rows.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_update_business_contact(
  p_tenant_id uuid,
  p_contact   jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config, core
AS $$
BEGIN
  INSERT INTO config.tenant_settings (tenant_id, business_contact_jsonb)
  VALUES (p_tenant_id, p_contact)
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    business_contact_jsonb = p_contact,
    updated_at             = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_update_business_contact(uuid, jsonb)
  TO anon, authenticated, service_role;
