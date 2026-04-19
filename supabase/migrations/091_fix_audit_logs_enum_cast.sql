-- Migration 091: Restaura cast ::text nos filtros de rpc_list_audit_logs
--
-- Migration 008 havia adicionado ::text casts porque action e actor_type
-- em audit.audit_logs são enum types — PostgreSQL não permite comparar
-- enum = text sem cast explícito.
-- Migration 087 reescreveu a função para corrigir timezone mas removeu
-- os casts acidentalmente, causando: "operator does not exist: <enum> = text"

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
        AND (p_entity_type IS NULL OR al.entity_type        = p_entity_type)
        AND (p_action      IS NULL OR al.action::text       = p_action)
        AND (p_actor_type  IS NULL OR al.actor_type::text   = p_actor_type)
        AND (p_date_from   IS NULL OR al.created_at >= (p_date_from::date AT TIME ZONE 'America/Sao_Paulo'))
        AND (p_date_to     IS NULL OR al.created_at <  ((p_date_to::date + 1) AT TIME ZONE 'America/Sao_Paulo'))
      ORDER BY al.created_at DESC
      LIMIT p_limit
      OFFSET p_offset
    ) a
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_list_audit_logs(uuid, text, text, text, text, text, int, int)
  TO anon, authenticated, service_role;
