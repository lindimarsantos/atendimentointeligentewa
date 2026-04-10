-- ============================================================
-- Migration 018: RPCs para painel super-admin de tenants
-- Apenas usuários com role='owner' podem chamar estas funções
-- ============================================================

-- ── Helper: verifica se o caller é owner ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public._require_owner()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = auth.uid() AND role = 'owner' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas owners podem executar esta operação';
  END IF;
END;
$$;

-- ── rpc_list_all_tenants ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_list_all_tenants()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $$
BEGIN
  PERFORM public._require_owner();
  RETURN (
    SELECT json_agg(row_to_json(t) ORDER BY t.created_at)
    FROM (
      SELECT
        t.id,
        t.name,
        t.slug,
        t.status::text,
        t.plan,
        t.timezone,
        t.locale,
        t.created_at,
        t.updated_at,
        COUNT(tm.id) FILTER (WHERE tm.is_active) AS member_count
      FROM core.tenants t
      LEFT JOIN public.tenant_members tm ON tm.tenant_id = t.id
      GROUP BY t.id
    ) t
  );
END;
$$;

-- ── rpc_upsert_tenant ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_upsert_tenant(
  p_id       uuid    DEFAULT NULL,
  p_name     text    DEFAULT NULL,
  p_slug     text    DEFAULT NULL,
  p_status   text    DEFAULT 'active',
  p_plan     text    DEFAULT NULL,
  p_timezone text    DEFAULT 'America/Sao_Paulo',
  p_locale   text    DEFAULT 'pt_BR'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM public._require_owner();

  IF p_id IS NOT NULL THEN
    UPDATE core.tenants SET
      name       = COALESCE(p_name,     name),
      slug       = COALESCE(p_slug,     slug),
      status     = COALESCE(p_status::core.tenant_status, status),
      plan       = p_plan,
      timezone   = COALESCE(p_timezone, timezone),
      locale     = COALESCE(p_locale,   locale),
      updated_at = now()
    WHERE id = p_id
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO core.tenants (name, slug, status, plan, timezone, locale, settings_jsonb)
    VALUES (
      p_name,
      COALESCE(p_slug, lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'))),
      COALESCE(p_status, 'active')::core.tenant_status,
      p_plan,
      COALESCE(p_timezone, 'America/Sao_Paulo'),
      COALESCE(p_locale,   'pt_BR'),
      '{}'::jsonb
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

-- ── rpc_delete_tenant ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_delete_tenant(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $$
BEGIN
  PERFORM public._require_owner();
  DELETE FROM core.tenants WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public._require_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_list_all_tenants() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_upsert_tenant(uuid,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_delete_tenant(uuid) TO authenticated;
