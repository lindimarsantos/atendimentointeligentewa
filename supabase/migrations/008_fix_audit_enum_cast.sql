-- ============================================================
-- Migration 008: Fix — cast explícito de enum para text nos filtros
-- de rpc_list_audit_logs e rpc_list_integration_logs
--
-- Problema: colunas action, actor_type (audit.audit_logs) e status
-- (audit.integration_logs) são enum types. PostgreSQL não permite
-- comparar enum = text sem cast explícito.
-- Solução: al.action::text, al.actor_type::text, il.status::text
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_list_audit_logs(
  p_tenant_id   uuid,
  p_entity_type text    DEFAULT NULL,
  p_action      text    DEFAULT NULL,
  p_actor_type  text    DEFAULT NULL,
  p_date_from   text    DEFAULT NULL,
  p_date_to     text    DEFAULT NULL,
  p_limit       int     DEFAULT 50,
  p_offset      int     DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(a))
    FROM (
      SELECT *
      FROM audit.audit_logs al
      WHERE
        (al.tenant_id = p_tenant_id OR al.tenant_id IS NULL)
        AND (p_entity_type IS NULL OR al.entity_type             = p_entity_type)
        AND (p_action      IS NULL OR al.action::text            = p_action)
        AND (p_actor_type  IS NULL OR al.actor_type::text        = p_actor_type)
        AND (p_date_from   IS NULL OR al.created_at >= p_date_from::timestamptz)
        AND (p_date_to     IS NULL OR al.created_at <= (p_date_to::date + interval '1 day')::timestamptz)
      ORDER BY al.created_at DESC
      LIMIT p_limit
      OFFSET p_offset
    ) a
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_list_integration_logs(
  p_tenant_id        uuid,
  p_integration_name text DEFAULT NULL,
  p_status           text DEFAULT NULL,
  p_date_from        text DEFAULT NULL,
  p_date_to          text DEFAULT NULL,
  p_limit            int  DEFAULT 50,
  p_offset           int  DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(l))
    FROM (
      SELECT *
      FROM audit.integration_logs il
      WHERE
        (il.tenant_id = p_tenant_id OR il.tenant_id IS NULL)
        AND (p_integration_name IS NULL OR il.integration_name          = p_integration_name)
        AND (p_status           IS NULL OR il.status::text              = p_status)
        AND (p_date_from        IS NULL OR il.created_at >= p_date_from::timestamptz)
        AND (p_date_to          IS NULL OR il.created_at <= (p_date_to::date + interval '1 day')::timestamptz)
      ORDER BY il.created_at DESC
      LIMIT p_limit
      OFFSET p_offset
    ) l
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_list_audit_logs(uuid,text,text,text,text,text,int,int)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.rpc_list_integration_logs(uuid,text,text,text,text,int,int)
  TO anon, authenticated, service_role;
