-- ============================================================
-- Migration 012: Corrige erros em Regra de handoff e Regra de SLA
--
-- Problema 1 (handoff_rules):
--   target_role é do tipo enum core.user_role, mas o RPC atribui
--   um valor text sem cast → "operator does not exist: text = user_role"
--   Fix: cast explícito p_target_role::core.user_role
--
-- Problema 2 (sla_rules):
--   priority é smallint no banco, mas o frontend envia texto
--   ('alta', 'media', 'baixa') → erro de conversão de tipos
--   Fix: ALTER COLUMN priority TYPE text
-- ============================================================

-- ── 1. Corrige tipo da coluna priority em sla_rules ───────────────────────────
ALTER TABLE config.sla_rules
  ALTER COLUMN priority TYPE text USING priority::text;

-- ── 2. Recria rpc_upsert_handoff_rule com cast correto ───────────────────────
CREATE OR REPLACE FUNCTION public.rpc_upsert_handoff_rule(
  p_tenant_id          uuid,
  p_id                 uuid    DEFAULT NULL,
  p_rule_name          text    DEFAULT NULL,
  p_trigger_type       text    DEFAULT NULL,
  p_trigger_config_jsonb jsonb DEFAULT '{}'::jsonb,
  p_target_role        text    DEFAULT 'agent',
  p_is_active          boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config, core
AS $$
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE config.handoff_rules
    SET
      rule_name            = COALESCE(p_rule_name,           rule_name),
      trigger_type         = COALESCE(p_trigger_type,        trigger_type),
      trigger_config_jsonb = COALESCE(p_trigger_config_jsonb, trigger_config_jsonb),
      target_role          = COALESCE(p_target_role::core.user_role, target_role),
      is_active            = COALESCE(p_is_active,           is_active),
      updated_at           = now()
    WHERE id = p_id AND tenant_id = p_tenant_id;
  ELSE
    INSERT INTO config.handoff_rules
      (tenant_id, rule_name, trigger_type, trigger_config_jsonb, target_role, is_active)
    VALUES
      (p_tenant_id, p_rule_name, p_trigger_type,
       p_trigger_config_jsonb, p_target_role::core.user_role, p_is_active);
  END IF;
END;
$$;

-- ── 3. Recria rpc_list_handoff_rules para retornar target_role como text ──────
CREATE OR REPLACE FUNCTION public.rpc_list_handoff_rules(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(t) ORDER BY t.rule_name)
    FROM (
      SELECT
        id, tenant_id, channel_id,
        rule_name, trigger_type,
        trigger_config_jsonb,
        target_role::text AS target_role,
        is_active, created_at, updated_at
      FROM config.handoff_rules
      WHERE tenant_id = p_tenant_id
    ) t
  );
END;
$$;

-- ── 4. Recria rpc_upsert_sla_rule (priority agora é text) ────────────────────
CREATE OR REPLACE FUNCTION public.rpc_upsert_sla_rule(
  p_tenant_id              uuid,
  p_id                     uuid    DEFAULT NULL,
  p_priority               text    DEFAULT NULL,
  p_first_response_seconds int     DEFAULT NULL,
  p_resolution_seconds     int     DEFAULT NULL,
  p_business_hours_only    boolean DEFAULT true,
  p_is_active              boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE config.sla_rules
    SET
      priority               = COALESCE(p_priority,               priority),
      first_response_seconds = COALESCE(p_first_response_seconds, first_response_seconds),
      resolution_seconds     = COALESCE(p_resolution_seconds,     resolution_seconds),
      business_hours_only    = COALESCE(p_business_hours_only,    business_hours_only),
      is_active              = COALESCE(p_is_active,              is_active),
      updated_at             = now()
    WHERE id = p_id AND tenant_id = p_tenant_id;
  ELSE
    INSERT INTO config.sla_rules
      (tenant_id, priority, first_response_seconds, resolution_seconds, business_hours_only, is_active)
    VALUES
      (p_tenant_id, p_priority, p_first_response_seconds, p_resolution_seconds,
       p_business_hours_only, p_is_active);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_upsert_handoff_rule(uuid,uuid,text,text,jsonb,text,boolean)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.rpc_list_handoff_rules(uuid)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.rpc_upsert_sla_rule(uuid,uuid,text,int,int,boolean,boolean)
  TO anon, authenticated, service_role;
