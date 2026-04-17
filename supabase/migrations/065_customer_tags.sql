-- ============================================================
-- Migration 065: Sistema de tags de clientes
--
-- 1. Coluna tags[] em crm.customers
-- 2. Atualiza rpc_list_customers e rpc_get_customer (retorna tags)
-- 3. rpc_update_customer_tags  — gestão manual de tags
-- 4. rpc_auto_tag_customers    — aplica tags automáticas por comportamento
-- 5. rpc_list_customer_tags    — lista todas as tags únicas do tenant
-- ============================================================

-- ── 1. Coluna ─────────────────────────────────────────────────────────────────
ALTER TABLE crm.customers
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- ── 2. rpc_list_customers (inclui tags) ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_list_customers(
  p_tenant_id uuid,
  p_search    text    DEFAULT NULL,
  p_tag       text    DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, crm
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r) ORDER BY r.name), '[]'::json)
    FROM (
      SELECT
        c.id,
        c.tenant_id,
        c.full_name   AS name,
        c.phone_e164  AS phone,
        c.email,
        c.status,
        c.notes,
        c.tags,
        c.created_at,
        c.updated_at
      FROM crm.customers c
      WHERE c.tenant_id = p_tenant_id
        AND (p_search IS NULL
             OR c.full_name  ILIKE '%' || p_search || '%'
             OR c.phone_e164 ILIKE '%' || p_search || '%')
        AND (p_tag IS NULL OR p_tag = ANY(c.tags))
    ) r
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_list_customers(uuid, text, text)
  TO anon, authenticated, service_role;

-- ── 3. rpc_get_customer (inclui tags) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_get_customer(
  p_tenant_id   uuid,
  p_customer_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, crm
AS $$
BEGIN
  RETURN (
    SELECT row_to_json(r)
    FROM (
      SELECT
        c.id,
        c.tenant_id,
        c.full_name   AS name,
        c.phone_e164  AS phone,
        c.email,
        c.status,
        c.notes,
        c.tags,
        c.created_at,
        c.updated_at
      FROM crm.customers c
      WHERE c.tenant_id   = p_tenant_id
        AND c.id          = p_customer_id
    ) r
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_get_customer(uuid, uuid)
  TO anon, authenticated, service_role;

-- ── 4. rpc_update_customer_tags ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_update_customer_tags(
  p_tenant_id   uuid,
  p_customer_id uuid,
  p_tags        text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, crm
AS $$
BEGIN
  UPDATE crm.customers
  SET tags = p_tags, updated_at = now()
  WHERE id = p_customer_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_update_customer_tags(uuid, uuid, text[])
  TO anon, authenticated, service_role;

-- ── 5. rpc_auto_tag_customers ─────────────────────────────────────────────────
-- Tags automáticas geradas por comportamento:
--   cliente      → tem ao menos 1 agendamento confirmado/concluído
--   lead         → nunca agendou
--   recorrente   → 3 ou mais agendamentos
--   vip          → 5 ou mais agendamentos
--   inativo      → último agendamento há mais de 90 dias
--   servico:xxx  → nome do serviço em lowercase com hifens
--
-- Preserva tags manuais (não prefixadas por 'servico:' e não
-- pertencentes ao conjunto automático fixo).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_auto_tag_customers(
  p_tenant_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, crm, scheduling
AS $$
DECLARE
  v_updated int := 0;
BEGIN
  -- Tags fixas automáticas (usadas para decidir o que substituir)
  -- Tags manuais = qualquer tag que NÃO seja dessas fixas nem 'servico:*'

  WITH appt_summary AS (
    SELECT
      a.customer_id,
      COUNT(*)                               AS total,
      MAX(a.scheduled_start_at)              AS last_appt,
      array_agg(DISTINCT
        'servico:' ||
        lower(regexp_replace(sv.name, '\s+', '-', 'g'))
      )                                      AS service_tags
    FROM scheduling.appointments a
    JOIN scheduling.services sv ON sv.id = a.service_id
    WHERE a.tenant_id = p_tenant_id
      AND a.status::text IN ('confirmed', 'completed')
    GROUP BY a.customer_id
  ),
  computed AS (
    SELECT
      cu.id AS customer_id,
      -- Tags manuais existentes (não automáticas)
      COALESCE(
        ARRAY(
          SELECT t FROM unnest(cu.tags) t
          WHERE t NOT IN ('cliente','lead','recorrente','vip','inativo')
            AND t NOT LIKE 'servico:%'
        ),
        '{}'::text[]
      ) AS manual_tags,
      -- Tags automáticas baseadas em comportamento
      ARRAY_REMOVE(ARRAY[
        CASE WHEN s.total IS NOT NULL THEN 'cliente' ELSE 'lead' END,
        CASE WHEN s.total >= 5  THEN 'vip'        ELSE NULL END,
        CASE WHEN s.total >= 3  THEN 'recorrente'  ELSE NULL END,
        CASE WHEN s.total > 0
              AND s.last_appt < NOW() - INTERVAL '90 days'
             THEN 'inativo' ELSE NULL END
      ], NULL) AS behavior_tags,
      COALESCE(s.service_tags, '{}'::text[]) AS service_tags
    FROM crm.customers cu
    LEFT JOIN appt_summary s ON s.customer_id = cu.id
    WHERE cu.tenant_id = p_tenant_id
  ),
  merged AS (
    SELECT
      customer_id,
      ARRAY(
        SELECT DISTINCT unnest(manual_tags || behavior_tags || service_tags)
        ORDER BY 1
      ) AS new_tags
    FROM computed
  )
  UPDATE crm.customers cu
  SET tags = m.new_tags, updated_at = now()
  FROM merged m
  WHERE cu.id = m.customer_id
    AND cu.tags IS DISTINCT FROM m.new_tags;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN json_build_object('updated', v_updated);
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_auto_tag_customers(uuid)
  TO anon, authenticated, service_role;

-- ── 6. rpc_list_customer_tags ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_list_customer_tags(
  p_tenant_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, crm
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(tag ORDER BY tag), '[]'::json)
    FROM (
      SELECT DISTINCT unnest(tags) AS tag
      FROM crm.customers
      WHERE tenant_id = p_tenant_id
        AND array_length(tags, 1) > 0
    ) t
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_list_customer_tags(uuid)
  TO anon, authenticated, service_role;
