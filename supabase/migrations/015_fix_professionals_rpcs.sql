-- ============================================================
-- Migration 015: Corrige RPCs de profissionais
-- Problema: rpc_upsert_professional não aceitava p_bio / p_is_active
--           rpc_list_professionals não retornava is_active / bio
-- ============================================================

-- ── 1. rpc_upsert_professional ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_upsert_professional(
  p_tenant_id uuid,
  p_id        uuid    DEFAULT NULL,
  p_name      text    DEFAULT NULL,
  p_specialty text    DEFAULT NULL,
  p_bio       text    DEFAULT NULL,
  p_email     text    DEFAULT NULL,
  p_phone     text    DEFAULT NULL,
  p_color     text    DEFAULT NULL,
  p_is_active boolean DEFAULT true
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling, core
AS $$
DECLARE
  v_id     uuid;
  v_status core.record_status;
  v_row    json;
BEGIN
  v_status := CASE WHEN p_is_active THEN 'active'::core.record_status
                   ELSE 'inactive'::core.record_status END;

  IF p_id IS NOT NULL THEN
    UPDATE scheduling.professionals SET
      name           = COALESCE(p_name, name),
      specialty      = p_specialty,
      email          = p_email,
      phone          = p_phone,
      color          = p_color,
      status         = v_status,
      metadata_jsonb = jsonb_set(
                         COALESCE(metadata_jsonb, '{}'::jsonb),
                         '{bio}',
                         to_jsonb(COALESCE(p_bio, ''))
                       ),
      updated_at     = now()
    WHERE id = p_id AND tenant_id = p_tenant_id;
    v_id := p_id;
  ELSE
    INSERT INTO scheduling.professionals
      (tenant_id, name, specialty, email, phone, color, status, metadata_jsonb)
    VALUES
      (p_tenant_id, p_name, p_specialty, p_email, p_phone, p_color,
       v_status,
       jsonb_build_object('bio', COALESCE(p_bio, '')))
    RETURNING id INTO v_id;
  END IF;

  SELECT row_to_json(t) INTO v_row
  FROM (
    SELECT
      id, tenant_id, name, specialty, email, phone, color,
      (status = 'active'::core.record_status) AS is_active,
      metadata_jsonb->>'bio'                   AS bio,
      created_at, updated_at
    FROM scheduling.professionals
    WHERE id = v_id
  ) t;

  RETURN v_row;
END;
$$;

-- ── 2. rpc_list_professionals ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_list_professionals(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling, core
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(t) ORDER BY t.name)
    FROM (
      SELECT
        id, tenant_id, name, specialty, email, phone, color,
        (status = 'active'::core.record_status) AS is_active,
        metadata_jsonb->>'bio'                   AS bio,
        created_at, updated_at
      FROM scheduling.professionals
      WHERE tenant_id = p_tenant_id
    ) t
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_upsert_professional(uuid,uuid,text,text,text,text,text,text,boolean)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.rpc_list_professionals(uuid)
  TO anon, authenticated, service_role;
