-- ============================================================
-- Migration 029: API Keys storage for LLM providers
--
-- Stores API keys for Anthropic, OpenAI and Google
-- inside config.tenant_settings as JSONB.
-- Keys are tenant-scoped and protected by RLS.
-- ============================================================

ALTER TABLE config.tenant_settings
  ADD COLUMN IF NOT EXISTS api_keys_jsonb jsonb NOT NULL DEFAULT '{}';

-- ── rpc_get_api_keys ─────────────────────────────────────────────────────────
-- Returns the keys for the tenant. Callers see the full key value;
-- the UI is responsible for masking on display.

CREATE OR REPLACE FUNCTION public.rpc_get_api_keys(p_tenant_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, config
AS $$
  SELECT COALESCE(api_keys_jsonb, '{}')::json
  FROM config.tenant_settings
  WHERE tenant_id = p_tenant_id
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_get_api_keys(uuid)
  TO anon, authenticated, service_role;

-- ── rpc_upsert_api_keys ──────────────────────────────────────────────────────
-- Merges new key values into the existing JSONB (only updates provided keys).
-- Pass null/empty string to clear a specific provider key.

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
  INSERT INTO config.tenant_settings
    (tenant_id, business_name, timezone, language, intake_mode,
     allow_audio, allow_image, allow_video, allow_voice,
     human_approval_high_risk, auto_create_customer, api_keys_jsonb)
  VALUES
    (p_tenant_id, 'Negócio', 'America/Sao_Paulo', 'pt_BR', 'bot_first',
     true, true, false, false, false, true, p_keys)
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    api_keys_jsonb = config.tenant_settings.api_keys_jsonb || p_keys,
    updated_at     = now();
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_upsert_api_keys(uuid, jsonb)
  TO anon, authenticated, service_role;
