-- ============================================================
-- Migration 041: Business profile for AI context
--
-- Adds business_profile_jsonb to config.tenant_settings and creates:
--   rpc_get_business_profile        — dashboard reads/displays
--   rpc_update_business_profile     — dashboard saves
--   rpc_n8n_get_business_profile    — n8n reads (resolves tenant from conversation_id)
--
-- Profile fields:
--   sobre          — history, mission, values
--   posicionamento — market positioning and differentials
--   publico_alvo   — target audience
--   info_ia        — free-form additional context for the AI
-- ============================================================

ALTER TABLE config.tenant_settings
  ADD COLUMN IF NOT EXISTS business_profile_jsonb jsonb NOT NULL DEFAULT '{}';

-- ── rpc_get_business_profile ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_get_business_profile(p_tenant_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, config
AS $$
  SELECT COALESCE(business_profile_jsonb, '{}')::json
  FROM config.tenant_settings
  WHERE tenant_id = p_tenant_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_business_profile(uuid)
  TO anon, authenticated, service_role;

-- ── rpc_update_business_profile ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_update_business_profile(
  p_tenant_id uuid,
  p_profile   jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  INSERT INTO config.tenant_settings (tenant_id, business_profile_jsonb)
  VALUES (p_tenant_id, p_profile)
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    business_profile_jsonb = p_profile,
    updated_at             = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_update_business_profile(uuid, jsonb)
  TO anon, authenticated, service_role;

-- ── rpc_n8n_get_business_profile ─────────────────────────────────────────────
-- n8n calls this with p_conversation_id; tenant is resolved internally.
-- Returns a single formatted text string ready for injection in the system prompt.

CREATE OR REPLACE FUNCTION public.rpc_n8n_get_business_profile(
  p_conversation_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config, messaging
AS $$
DECLARE
  v_tenant_id uuid;
  v_profile   jsonb;
  v_text      text := '';
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM messaging.conversations
  WHERE id = p_conversation_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN json_build_object('profile_text', '');
  END IF;

  SELECT COALESCE(business_profile_jsonb, '{}') INTO v_profile
  FROM config.tenant_settings
  WHERE tenant_id = v_tenant_id
  LIMIT 1;

  -- Build formatted text block for the AI
  IF v_profile ->> 'sobre'          IS NOT NULL AND length(trim(v_profile ->> 'sobre')) > 0 THEN
    v_text := v_text || '## Sobre a empresa' || E'\n' || trim(v_profile ->> 'sobre') || E'\n\n';
  END IF;

  IF v_profile ->> 'posicionamento'  IS NOT NULL AND length(trim(v_profile ->> 'posicionamento')) > 0 THEN
    v_text := v_text || '## Posicionamento e diferenciais' || E'\n' || trim(v_profile ->> 'posicionamento') || E'\n\n';
  END IF;

  IF v_profile ->> 'publico_alvo'    IS NOT NULL AND length(trim(v_profile ->> 'publico_alvo')) > 0 THEN
    v_text := v_text || '## Público-alvo' || E'\n' || trim(v_profile ->> 'publico_alvo') || E'\n\n';
  END IF;

  IF v_profile ->> 'info_ia'         IS NOT NULL AND length(trim(v_profile ->> 'info_ia')) > 0 THEN
    v_text := v_text || '## Informações adicionais' || E'\n' || trim(v_profile ->> 'info_ia') || E'\n\n';
  END IF;

  RETURN json_build_object('profile_text', trim(v_text));
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_n8n_get_business_profile(uuid)
  TO anon, authenticated, service_role;
