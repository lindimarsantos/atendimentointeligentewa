-- ============================================================
-- Migration 004: RPCs para CRUD de Serviços e Profissionais
-- Totalmente aditiva — não altera dados nem funções existentes
-- ============================================================

-- ─── scheduling.services ─────────────────────────────────────────────────────

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
      price_min           = p_price_min,
      price_max           = p_price_max,
      requires_evaluation = COALESCE(p_requires_evaluation, requires_evaluation),
      is_active           = COALESCE(p_is_active, is_active),
      updated_at          = now()
    WHERE id = p_id AND tenant_id = p_tenant_id;
  ELSE
    INSERT INTO scheduling.services
      (tenant_id, name, description, duration_minutes, price_min, price_max, requires_evaluation, is_active)
    VALUES
      (p_tenant_id, p_name, p_description, p_duration_minutes, p_price_min, p_price_max, p_requires_evaluation, p_is_active);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_delete_service(
  p_tenant_id uuid,
  p_id        uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling
AS $$
BEGIN
  DELETE FROM scheduling.services
  WHERE id = p_id AND tenant_id = p_tenant_id;
END;
$$;

-- ─── scheduling.professionals ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_upsert_professional(
  p_tenant_id uuid,
  p_id        uuid    DEFAULT NULL,
  p_name      text    DEFAULT NULL,
  p_specialty text    DEFAULT NULL,
  p_bio       text    DEFAULT NULL,
  p_is_active boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling
AS $$
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE scheduling.professionals
    SET
      name       = COALESCE(p_name, name),
      specialty  = p_specialty,
      bio        = p_bio,
      is_active  = COALESCE(p_is_active, is_active),
      updated_at = now()
    WHERE id = p_id AND tenant_id = p_tenant_id;
  ELSE
    INSERT INTO scheduling.professionals
      (tenant_id, name, specialty, bio, is_active)
    VALUES
      (p_tenant_id, p_name, p_specialty, p_bio, p_is_active);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_delete_professional(
  p_tenant_id uuid,
  p_id        uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling
AS $$
BEGIN
  DELETE FROM scheduling.professionals
  WHERE id = p_id AND tenant_id = p_tenant_id;
END;
$$;

-- ─── GRANTs ───────────────────────────────────────────────────────────────────

DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'rpc_upsert_service(uuid,uuid,text,text,int,numeric,numeric,boolean,boolean)',
    'rpc_delete_service(uuid,uuid)',
    'rpc_upsert_professional(uuid,uuid,text,text,text,boolean)',
    'rpc_delete_professional(uuid,uuid)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon, authenticated, service_role', fn);
  END LOOP;
END;
$$;
