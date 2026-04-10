-- ============================================================
-- Migration 025: Fix column names and resolve RPC overload conflicts
--
-- crm.customers  real columns: full_name, phone_e164 (not name/phone)
-- messaging.messages real column: created_at (not sent_at)
-- messaging.conversations: no professional_id column
--   and status is ENUM messaging.conversation_status (needs ::text cast)
-- rpc_list_appointments: was joining crm.professionals/services
--   (wrong schema) instead of scheduling.professionals/services
-- Old TABLE-returning overloads conflict with newer JSON overloads
-- ============================================================

-- ── 1. Drop conflicting old overloads ─────────────────────────────────────────
DROP FUNCTION IF EXISTS public.rpc_list_conversations(uuid, text, integer, integer);
DROP FUNCTION IF EXISTS public.rpc_list_appointments(uuid, text, date, date, integer, integer);

-- ── 2. Fix rpc_list_customers ─────────────────────────────────────────────────
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
        c.created_at,
        c.updated_at
      FROM crm.customers c
      WHERE c.tenant_id = p_tenant_id
        AND (
          p_search IS NULL
          OR c.full_name  ILIKE '%' || p_search || '%'
          OR c.phone_e164 ILIKE '%' || p_search || '%'
        )
    ) r
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_list_customers(uuid, text)
  TO anon, authenticated, service_role;

-- ── 3. Fix rpc_get_customer ───────────────────────────────────────────────────
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

-- ── 4. Fix rpc_list_conversations ─────────────────────────────────────────────
-- status is ENUM messaging.conversation_status — must cast to text
CREATE OR REPLACE FUNCTION public.rpc_list_conversations(
  p_tenant_id   uuid,
  p_status      text DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, crm
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r) ORDER BY r.updated_at DESC), '[]'::json)
    FROM (
      SELECT
        c.id,
        c.tenant_id,
        c.channel_id,
        c.customer_id,
        c.status::text,
        c.priority,
        c.started_at,
        c.updated_at,
        cu.full_name   AS customer_name,
        cu.phone_e164  AS customer_phone,
        (
          SELECT m.content_text
          FROM messaging.messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC LIMIT 1
        ) AS last_message_text,
        (
          SELECT m.created_at
          FROM messaging.messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC LIMIT 1
        ) AS last_message_at,
        (
          SELECT COUNT(*)::int
          FROM messaging.messages m
          WHERE m.conversation_id = c.id
        ) AS msg_count,
        c.assigned_user_id
      FROM messaging.conversations c
      LEFT JOIN crm.customers cu ON cu.id = c.customer_id
      WHERE c.tenant_id = p_tenant_id
        AND (p_status      IS NULL OR c.status::text = p_status)
        AND (p_customer_id IS NULL OR c.customer_id  = p_customer_id)
    ) r
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_list_conversations(uuid, text, uuid)
  TO anon, authenticated, service_role;

-- ── 5. Fix rpc_list_appointments ──────────────────────────────────────────────
-- Was joining crm.professionals/services (wrong schema).
-- Correct tables are scheduling.professionals and scheduling.services.
CREATE OR REPLACE FUNCTION public.rpc_list_appointments(
  p_tenant_id       uuid,
  p_date_from       date DEFAULT NULL,
  p_date_to         date DEFAULT NULL,
  p_customer_id     uuid DEFAULT NULL,
  p_professional_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling, crm
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r) ORDER BY r.scheduled_start_at ASC), '[]'::json)
    FROM (
      SELECT
        a.id,
        a.tenant_id,
        a.customer_id,
        a.professional_id,
        a.service_id,
        a.scheduled_start_at,
        a.scheduled_end_at,
        a.status::text,
        a.notes,
        a.created_at,
        cu.full_name             AS customer_name,
        cu.phone_e164            AS customer_phone,
        pr.name                  AS professional_name,
        pr.specialty             AS professional_specialty,
        sv.name                  AS service_name,
        sv.duration_minutes      AS service_duration
      FROM scheduling.appointments a
      LEFT JOIN crm.customers             cu ON cu.id = a.customer_id
      LEFT JOIN scheduling.professionals  pr ON pr.id = a.professional_id
      LEFT JOIN scheduling.services       sv ON sv.id = a.service_id
      WHERE a.tenant_id = p_tenant_id
        AND (p_date_from       IS NULL OR a.scheduled_start_at::date >= p_date_from)
        AND (p_date_to         IS NULL OR a.scheduled_start_at::date <= p_date_to)
        AND (p_customer_id     IS NULL OR a.customer_id              = p_customer_id)
        AND (p_professional_id IS NULL OR a.professional_id          = p_professional_id)
    ) r
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_list_appointments(uuid, date, date, uuid, uuid)
  TO anon, authenticated, service_role;

-- ── 6. Fix rpc_list_handoff_queue ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_list_handoff_queue(
  p_tenant_id uuid,
  p_status    text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, ai, messaging, crm
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(h) ORDER BY h.created_at ASC), '[]'::json)
    FROM (
      SELECT
        ah.id,
        ah.tenant_id,
        ah.conversation_id,
        ah.reason_text,
        ah.target_role::text,
        ah.status,
        ah.accepted_at,
        ah.resolved_at,
        ah.created_at,
        c.status::text AS conversation_status,
        c.customer_id,
        c.updated_at   AS conversation_updated_at,
        cu.full_name   AS customer_name,
        cu.phone_e164  AS customer_phone,
        (
          SELECT m.content_text
          FROM messaging.messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) AS last_message
      FROM ai.agent_handoffs ah
      JOIN messaging.conversations c  ON c.id  = ah.conversation_id
      LEFT JOIN crm.customers       cu ON cu.id = c.customer_id
      WHERE ah.tenant_id = p_tenant_id
        AND (
          p_status IS NOT NULL AND ah.status = p_status
          OR
          p_status IS NULL AND ah.status IN ('pending', 'accepted')
        )
    ) h
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_list_handoff_queue(uuid, text)
  TO anon, authenticated, service_role;

-- ── 7. Fix rpc_list_running_campaigns ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_list_running_campaigns(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, config, crm
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r) ORDER BY r.created_at ASC), '[]'::json)
    FROM (
      SELECT
        c.id              AS campaign_id,
        c.tenant_id,
        c.name            AS campaign_name,
        c.template_id,
        c.target_count,
        c.sent_count,
        wt.body_text      AS template_body,
        wt.header_text    AS template_header,
        wt.name           AS template_name,
        COALESCE(wt.metadata_jsonb->>'template_type', 'zapi') AS template_type,
        (
          SELECT COALESCE(json_agg(
            json_build_object(
              'customer_id', cu.id,
              'name',        cu.full_name,
              'phone',       cu.phone_e164
            )
          ), '[]'::json)
          FROM crm.customers cu
          WHERE cu.tenant_id  = p_tenant_id
            AND cu.phone_e164 IS NOT NULL
            AND cu.phone_e164 <> ''
        ) AS recipients
      FROM messaging.campaigns c
      LEFT JOIN config.whatsapp_templates wt ON wt.id = c.template_id
      WHERE c.tenant_id = p_tenant_id
        AND c.status = 'running'
    ) r
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_list_running_campaigns(uuid)
  TO anon, authenticated, service_role;
