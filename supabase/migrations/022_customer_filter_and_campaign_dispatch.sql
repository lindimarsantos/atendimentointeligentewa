-- ============================================================
-- Migration 022: Customer filter for conversations/appointments
--                + Campaign dispatch RPC for n8n integration
-- ============================================================

-- ── rpc_list_conversations (extended with p_customer_id) ─────────────────────
CREATE OR REPLACE FUNCTION public.rpc_list_conversations(
  p_tenant_id   uuid,
  p_status      text    DEFAULT NULL,
  p_customer_id uuid    DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, crm
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(r) ORDER BY r.updated_at DESC)
    FROM (
      SELECT
        c.id,
        c.tenant_id,
        c.channel_id,
        c.customer_id,
        c.professional_id,
        c.status,
        c.priority,
        c.started_at,
        c.updated_at,
        cu.name    AS customer_name,
        cu.phone   AS customer_phone,
        (
          SELECT m.content_text
          FROM messaging.messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.sent_at DESC LIMIT 1
        ) AS last_message_text,
        (
          SELECT m.sent_at
          FROM messaging.messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.sent_at DESC LIMIT 1
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
        AND (p_status      IS NULL OR c.status      = p_status)
        AND (p_customer_id IS NULL OR c.customer_id = p_customer_id)
    ) r
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_list_conversations(uuid, text, uuid)
  TO anon, authenticated, service_role;

-- ── rpc_list_appointments (extended with p_customer_id) ──────────────────────
CREATE OR REPLACE FUNCTION public.rpc_list_appointments(
  p_tenant_id   uuid,
  p_date_from   date    DEFAULT NULL,
  p_date_to     date    DEFAULT NULL,
  p_customer_id uuid    DEFAULT NULL,
  p_professional_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling, crm
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(r) ORDER BY r.scheduled_start_at ASC)
    FROM (
      SELECT
        a.id,
        a.tenant_id,
        a.customer_id,
        a.professional_id,
        a.service_id,
        a.scheduled_start_at,
        a.scheduled_end_at,
        a.status,
        a.notes,
        a.created_at,
        cu.name               AS customer_name,
        cu.phone              AS customer_phone,
        pr.name               AS professional_name,
        pr.specialty          AS professional_specialty,
        sv.name               AS service_name,
        sv.duration_minutes   AS service_duration
      FROM scheduling.appointments a
      LEFT JOIN crm.customers       cu ON cu.id = a.customer_id
      LEFT JOIN crm.professionals   pr ON pr.id = a.professional_id
      LEFT JOIN crm.services        sv ON sv.id = a.service_id
      WHERE a.tenant_id = p_tenant_id
        AND (p_date_from      IS NULL OR a.scheduled_start_at::date >= p_date_from)
        AND (p_date_to        IS NULL OR a.scheduled_start_at::date <= p_date_to)
        AND (p_customer_id    IS NULL OR a.customer_id           = p_customer_id)
        AND (p_professional_id IS NULL OR a.professional_id      = p_professional_id)
    ) r
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_list_appointments(uuid, date, date, uuid, uuid)
  TO anon, authenticated, service_role;

-- ── rpc_dispatch_campaign ─────────────────────────────────────────────────────
-- Marks the campaign as running and returns payload for n8n workflow
CREATE OR REPLACE FUNCTION public.rpc_dispatch_campaign(
  p_tenant_id   uuid,
  p_campaign_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging
AS $$
DECLARE
  v_template_id   uuid;
  v_target_count  int;
  v_status        text;
BEGIN
  SELECT status, template_id, target_count
    INTO v_status, v_template_id, v_target_count
  FROM messaging.campaigns
  WHERE id = p_campaign_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  IF v_status NOT IN ('draft', 'paused', 'scheduled') THEN
    RAISE EXCEPTION 'Campaign status "%" cannot be dispatched', v_status;
  END IF;

  UPDATE messaging.campaigns
  SET status = 'running', updated_at = now()
  WHERE id = p_campaign_id AND tenant_id = p_tenant_id;

  RETURN json_build_object(
    'campaign_id',  p_campaign_id,
    'template_id',  v_template_id,
    'tenant_id',    p_tenant_id,
    'target_count', v_target_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_dispatch_campaign(uuid, uuid)
  TO anon, authenticated, service_role;
