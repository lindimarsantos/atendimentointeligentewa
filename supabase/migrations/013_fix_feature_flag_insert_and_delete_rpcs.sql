-- ============================================================
-- Migration 013
-- 1. Corrige rpc_update_feature_flag: config_jsonb NOT NULL
--    → usar COALESCE(p_config_jsonb, '{}') no INSERT
-- 2. Adiciona RPCs de exclusão para handoff_rules, sla_rules
--    e feature_flags
-- ============================================================

-- ── 1. Corrige rpc_update_feature_flag ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_update_feature_flag(
  p_tenant_id   uuid,
  p_code        text,
  p_is_enabled  boolean,
  p_config_jsonb jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  UPDATE config.feature_flags
  SET
    is_enabled   = p_is_enabled,
    config_jsonb = COALESCE(p_config_jsonb, config_jsonb),
    updated_at   = now()
  WHERE tenant_id = p_tenant_id AND code = p_code;

  IF NOT FOUND THEN
    INSERT INTO config.feature_flags (tenant_id, code, is_enabled, config_jsonb)
    VALUES (p_tenant_id, p_code, p_is_enabled, COALESCE(p_config_jsonb, '{}'::jsonb));
  END IF;
END;
$$;

-- ── 2. rpc_delete_handoff_rule ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_delete_handoff_rule(
  p_tenant_id uuid,
  p_id        uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  DELETE FROM config.handoff_rules
  WHERE id = p_id AND tenant_id = p_tenant_id;
END;
$$;

-- ── 3. rpc_delete_sla_rule ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_delete_sla_rule(
  p_tenant_id uuid,
  p_id        uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  DELETE FROM config.sla_rules
  WHERE id = p_id AND tenant_id = p_tenant_id;
END;
$$;

-- ── 4. rpc_delete_feature_flag ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_delete_feature_flag(
  p_tenant_id uuid,
  p_code      text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  DELETE FROM config.feature_flags
  WHERE tenant_id = p_tenant_id AND code = p_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_update_feature_flag(uuid,text,boolean,jsonb)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.rpc_delete_handoff_rule(uuid,uuid)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.rpc_delete_sla_rule(uuid,uuid)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.rpc_delete_feature_flag(uuid,text)
  TO anon, authenticated, service_role;
