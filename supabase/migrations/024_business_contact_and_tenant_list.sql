-- ============================================================
-- Migration 024: Business Contact Info + User Tenant List RPC
-- ============================================================

-- ── 1. Add business_contact_jsonb to tenant settings ─────────────────────────

ALTER TABLE config.tenant_settings
  ADD COLUMN IF NOT EXISTS business_contact_jsonb jsonb NOT NULL DEFAULT '{}';

-- ── 2. rpc_get_business_contact ───────────────────────────────────────────────
-- Returns the contact/location info for the tenant.
-- Returns NULL when no row exists (new tenant without settings yet).

CREATE OR REPLACE FUNCTION public.rpc_get_business_contact(p_tenant_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, config, core
AS $$
  SELECT COALESCE(business_contact_jsonb, '{}')::json
  FROM config.tenant_settings
  WHERE tenant_id = p_tenant_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_business_contact(uuid)
  TO anon, authenticated, service_role;

-- ── 3. rpc_update_business_contact ───────────────────────────────────────────
-- Upserts the contact_jsonb for the tenant (merges with existing data).

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
  -- Ensure a settings row exists before updating
  INSERT INTO config.tenant_settings (tenant_id, business_name, timezone, language, intake_mode,
    allow_audio, allow_image, allow_video, allow_voice,
    human_approval_high_risk, auto_create_customer, business_contact_jsonb)
  VALUES (p_tenant_id, 'Negócio', 'America/Sao_Paulo', 'pt_BR', 'bot_first',
    true, true, false, false, false, true, p_contact)
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    business_contact_jsonb = p_contact,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_update_business_contact(uuid, jsonb)
  TO anon, authenticated, service_role;

-- ── 4. rpc_list_user_tenants ──────────────────────────────────────────────────
-- Lists all tenants a user belongs to, with display names.
-- Used by the tenant switcher in the dashboard sidebar.

CREATE OR REPLACE FUNCTION public.rpc_list_user_tenants(p_user_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, config, core
AS $$
  SELECT COALESCE(json_agg(row_to_json(r) ORDER BY r.display_name), '[]'::json)
  FROM (
    SELECT
      tm.tenant_id,
      tm.role,
      t.name                                             AS tenant_name,
      COALESCE(ts.business_name, t.name)                AS display_name
    FROM public.tenant_members tm
    JOIN core.tenants t ON t.id = tm.tenant_id
    LEFT JOIN config.tenant_settings ts ON ts.tenant_id = tm.tenant_id
    WHERE tm.user_id = p_user_id
  ) r;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_list_user_tenants(uuid)
  TO anon, authenticated, service_role;
