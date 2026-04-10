-- ============================================================
-- Migration 020: RPCs CRUD para regras de lembrete
-- ============================================================

-- ── rpc_list_reminder_rules ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_list_reminder_rules(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, ops
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(r) ORDER BY r.hours_before NULLS LAST)
    FROM (
      SELECT
        rr.id,
        rr.tenant_id,
        rr.name,
        rr.trigger_type,
        rr.hours_before,
        rr.template_id,
        rr.is_active,
        rr.config_jsonb,
        rr.created_at,
        rr.updated_at
      FROM ops.reminder_rules rr
      WHERE rr.tenant_id = p_tenant_id
    ) r
  );
END;
$$;

-- ── rpc_upsert_reminder_rule ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_upsert_reminder_rule(
  p_tenant_id    uuid,
  p_id           uuid    DEFAULT NULL,
  p_name         text    DEFAULT NULL,
  p_trigger_type text    DEFAULT 'appointment_before',
  p_hours_before int     DEFAULT 24,
  p_template_id  uuid    DEFAULT NULL,
  p_is_active    boolean DEFAULT true,
  p_prep_notes   text    DEFAULT NULL,
  p_include_recommendations boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, ops
AS $$
DECLARE
  v_config jsonb;
BEGIN
  v_config := jsonb_build_object(
    'prep_notes',              COALESCE(p_prep_notes, ''),
    'include_recommendations', p_include_recommendations
  );

  IF p_id IS NOT NULL THEN
    UPDATE ops.reminder_rules SET
      name         = COALESCE(p_name,         name),
      trigger_type = COALESCE(p_trigger_type, trigger_type),
      hours_before = COALESCE(p_hours_before, hours_before),
      template_id  = p_template_id,
      is_active    = COALESCE(p_is_active,    is_active),
      config_jsonb = v_config,
      updated_at   = now()
    WHERE id = p_id AND tenant_id = p_tenant_id;
  ELSE
    INSERT INTO ops.reminder_rules
      (tenant_id, name, trigger_type, hours_before, template_id, is_active, config_jsonb)
    VALUES
      (p_tenant_id, p_name, p_trigger_type, p_hours_before, p_template_id, p_is_active, v_config);
  END IF;
END;
$$;

-- ── rpc_delete_reminder_rule ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_delete_reminder_rule(p_tenant_id uuid, p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, ops
AS $$
BEGIN
  DELETE FROM ops.reminder_rules WHERE id = p_id AND tenant_id = p_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_list_reminder_rules(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_upsert_reminder_rule(uuid,uuid,text,text,int,uuid,boolean,text,boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_delete_reminder_rule(uuid,uuid) TO anon, authenticated, service_role;
