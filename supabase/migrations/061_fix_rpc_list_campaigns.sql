-- ============================================================
-- Migration 061: Recria rpc_list_campaigns
--
-- A função foi definida em 002 antes de messaging.campaigns
-- existir. Recriar garante recompilação correta no Supabase.
-- ============================================================

DROP FUNCTION IF EXISTS public.rpc_list_campaigns(uuid);

CREATE OR REPLACE FUNCTION public.rpc_list_campaigns(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging
AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(c) ORDER BY c.created_at DESC)
      FROM messaging.campaigns c
      WHERE c.tenant_id = p_tenant_id
    ),
    '[]'::json
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_list_campaigns(uuid)
  TO anon, authenticated, service_role;
