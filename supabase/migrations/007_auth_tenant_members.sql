-- ============================================================
-- Migration 007: Auth — tenant_members + rpc_get_user_tenant
-- Totalmente aditiva — não altera dados nem funções existentes
-- ============================================================

-- ─── public.tenant_members ───────────────────────────────────────────────────
-- Vincula auth.users a tenants com um papel (role)

CREATE TABLE IF NOT EXISTS public.tenant_members (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id  uuid        NOT NULL,
  role       text        NOT NULL DEFAULT 'agent',  -- owner | admin | agent
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

-- RLS: cada usuário vê apenas seus próprios vínculos
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tenant_members' AND policyname = 'tenant_members_own_rows'
  ) THEN
    CREATE POLICY "tenant_members_own_rows"
      ON public.tenant_members FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END;
$$;

-- ─── rpc_get_user_tenant ─────────────────────────────────────────────────────
-- Retorna o tenant primário (mais antigo) de um usuário autenticado

CREATE OR REPLACE FUNCTION public.rpc_get_user_tenant(p_user_id uuid)
RETURNS TABLE(tenant_id uuid, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT tm.tenant_id, tm.role
  FROM public.tenant_members tm
  WHERE tm.user_id = p_user_id
    AND tm.is_active = true
  ORDER BY tm.created_at
  LIMIT 1;
END;
$$;

-- ─── GRANTs ───────────────────────────────────────────────────────────────────

GRANT SELECT ON public.tenant_members TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_user_tenant(uuid)
  TO anon, authenticated, service_role;
