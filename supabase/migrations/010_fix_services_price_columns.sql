-- ============================================================
-- Migration 010: Corrige nomes de colunas price_min/max → price_from/to
-- A tabela scheduling.services usa price_from e price_to
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_upsert_service(
  p_tenant_id           uuid,
  p_id                  uuid    DEFAULT NULL,
  p_name                text    DEFAULT NULL,
  p_description         text    DEFAULT NULL,
  p_duration_minutes    int     DEFAULT 30,
  p_price_min           numeric DEFAULT NULL,
  p_price_max           numeric DEFAULT NULL,
  p_requires_evaluation boolean DEFAULT false,
  p_is_active           boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling
AS $$
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE scheduling.services
    SET
      name                = COALESCE(p_name, name),
      description         = p_description,
      duration_minutes    = COALESCE(p_duration_minutes, duration_minutes),
      price_from          = p_price_min,
      price_to            = p_price_max,
      requires_evaluation = COALESCE(p_requires_evaluation, requires_evaluation),
      is_active           = COALESCE(p_is_active, is_active),
      updated_at          = now()
    WHERE id = p_id AND tenant_id = p_tenant_id;
  ELSE
    INSERT INTO scheduling.services
      (tenant_id, name, description, duration_minutes, price_from, price_to, requires_evaluation, is_active)
    VALUES
      (p_tenant_id, p_name, p_description, p_duration_minutes, p_price_min, p_price_max, p_requires_evaluation, p_is_active);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_list_services(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(t) ORDER BY t.name)
    FROM (
      SELECT
        id, tenant_id, name, description,
        duration_minutes,
        price_from  AS price_min,
        price_to    AS price_max,
        requires_evaluation, is_active,
        created_at, updated_at
      FROM scheduling.services
      WHERE tenant_id = p_tenant_id
    ) t
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_upsert_service(uuid,uuid,text,text,int,numeric,numeric,boolean,boolean)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.rpc_list_services(uuid)
  TO anon, authenticated, service_role;
