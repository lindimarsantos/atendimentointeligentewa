-- ============================================================
-- Migration 002: RPCs para Módulo de Auditoria
-- ============================================================

-- ─── ai.conversation_summaries ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_get_conversation_summary(
  p_tenant_id       uuid,
  p_conversation_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, ai
AS $$
DECLARE v_result json;
BEGIN
  SELECT row_to_json(s) INTO v_result
  FROM ai.conversation_summaries s
  WHERE s.conversation_id = p_conversation_id
  ORDER BY s.created_at DESC
  LIMIT 1;
  RETURN v_result;
END;
$$;

-- ─── ai.ai_decisions ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_get_ai_decisions(
  p_tenant_id       uuid,
  p_conversation_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, ai
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(d) ORDER BY d.created_at ASC)
    FROM ai.ai_decisions d
    WHERE d.conversation_id = p_conversation_id
  );
END;
$$;

-- ─── ai.customer_memories ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_get_customer_memories(
  p_tenant_id  uuid,
  p_customer_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, ai
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(m) ORDER BY m.importance_score DESC)
    FROM ai.customer_memories m
    WHERE m.customer_id = p_customer_id
      AND m.is_active = true
  );
END;
$$;

-- ─── ai.message_intents ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_get_message_intents(
  p_tenant_id       uuid,
  p_conversation_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, ai, messaging
AS $$
BEGIN
  -- Join through messages to filter by conversation
  RETURN (
    SELECT json_agg(row_to_json(i) ORDER BY m.sent_at ASC)
    FROM ai.message_intents i
    JOIN messaging.messages m ON m.id = i.message_id
    WHERE m.conversation_id = p_conversation_id
  );
END;
$$;

-- ─── audit.audit_logs ─────────────────────────────────────────────────────────

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
        AND (p_entity_type IS NULL OR al.entity_type = p_entity_type)
        AND (p_action      IS NULL OR al.action      = p_action)
        AND (p_actor_type  IS NULL OR al.actor_type  = p_actor_type)
        AND (p_date_from   IS NULL OR al.created_at >= p_date_from::timestamptz)
        AND (p_date_to     IS NULL OR al.created_at <= (p_date_to::date + interval '1 day')::timestamptz)
      ORDER BY al.created_at DESC
      LIMIT p_limit
      OFFSET p_offset
    ) a
  );
END;
$$;

-- ─── audit.integration_logs ───────────────────────────────────────────────────

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
        AND (p_integration_name IS NULL OR il.integration_name = p_integration_name)
        AND (p_status           IS NULL OR il.status           = p_status)
        AND (p_date_from        IS NULL OR il.created_at >= p_date_from::timestamptz)
        AND (p_date_to          IS NULL OR il.created_at <= (p_date_to::date + interval '1 day')::timestamptz)
      ORDER BY il.created_at DESC
      LIMIT p_limit
      OFFSET p_offset
    ) l
  );
END;
$$;

-- ─── Conversas (complement) ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_get_conversation_messages(
  p_tenant_id       uuid,
  p_conversation_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(m) ORDER BY m.sent_at ASC)
    FROM messaging.messages m
    WHERE m.conversation_id = p_conversation_id
  );
END;
$$;

-- ─── Customers ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_list_customers(
  p_tenant_id uuid,
  p_search    text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, crm
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(c) ORDER BY c.name)
    FROM crm.customers c
    WHERE c.tenant_id = p_tenant_id
      AND (
        p_search IS NULL
        OR c.name  ILIKE '%' || p_search || '%'
        OR c.phone ILIKE '%' || p_search || '%'
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_get_customer(
  p_tenant_id  uuid,
  p_customer_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, crm
AS $$
DECLARE v_result json;
BEGIN
  SELECT row_to_json(c) INTO v_result
  FROM crm.customers c
  WHERE c.tenant_id  = p_tenant_id
    AND c.id         = p_customer_id;
  RETURN v_result;
END;
$$;

-- ─── Services & Professionals ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_list_services(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(s) ORDER BY s.name)
    FROM scheduling.services s
    WHERE s.tenant_id = p_tenant_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_list_professionals(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(p) ORDER BY p.name)
    FROM scheduling.professionals p
    WHERE p.tenant_id = p_tenant_id
  );
END;
$$;

-- ─── Campaigns / Templates ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_list_campaigns(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(c) ORDER BY c.created_at DESC)
    FROM messaging.campaigns c
    WHERE c.tenant_id = p_tenant_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_list_message_templates(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(t) ORDER BY t.name)
    FROM messaging.message_templates t
    WHERE t.tenant_id = p_tenant_id
  );
END;
$$;

-- ─── Jobs ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_list_jobs(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(j) ORDER BY j.created_at DESC)
    FROM public.job_queue j
    WHERE j.tenant_id = p_tenant_id
    LIMIT 100
  );
END;
$$;

-- ─── GRANTs ───────────────────────────────────────────────────────────────────

DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'rpc_get_conversation_summary(uuid,uuid)',
    'rpc_get_ai_decisions(uuid,uuid)',
    'rpc_get_customer_memories(uuid,uuid)',
    'rpc_get_message_intents(uuid,uuid)',
    'rpc_list_audit_logs(uuid,text,text,text,text,text,int,int)',
    'rpc_list_integration_logs(uuid,text,text,text,text,int,int)',
    'rpc_get_conversation_messages(uuid,uuid)',
    'rpc_list_customers(uuid,text)',
    'rpc_get_customer(uuid,uuid)',
    'rpc_list_services(uuid)',
    'rpc_list_professionals(uuid)',
    'rpc_list_campaigns(uuid)',
    'rpc_list_message_templates(uuid)',
    'rpc_list_jobs(uuid)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon, authenticated, service_role', fn);
  END LOOP;
END;
$$;
