-- ============================================================
-- Migration 003: RPCs de tendência para Visão Geral
-- ============================================================

-- ─── rpc_conversations_trend ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_conversations_trend(
  p_tenant_id uuid,
  p_days      int DEFAULT 30
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, ai
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(d) ORDER BY d.date ASC)
    FROM (
      SELECT
        g.date::text                                                          AS date,
        COUNT(DISTINCT c.id)                                                  AS conversations,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'resolved')             AS resolved,
        COUNT(DISTINCT h.id)                                                  AS handoffs,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status NOT IN ('resolved','waiting_human')) AS bot_resolved,
        0                                                                     AS new_customers
      FROM generate_series(
        (CURRENT_DATE - (p_days - 1) * INTERVAL '1 day')::date,
        CURRENT_DATE,
        '1 day'::interval
      ) AS g(date)
      LEFT JOIN messaging.conversations c
        ON  c.tenant_id   = p_tenant_id
        AND c.started_at::date = g.date
      LEFT JOIN ai.agent_handoffs h
        ON  h.created_at::date = g.date
        AND EXISTS (
          SELECT 1 FROM messaging.conversations cc
          WHERE cc.id = h.conversation_id AND cc.tenant_id = p_tenant_id
        )
      GROUP BY g.date
    ) d
  );
END;
$$;

-- ─── rpc_appointments_trend ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_appointments_trend(
  p_tenant_id uuid,
  p_days      int DEFAULT 30
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(d) ORDER BY d.date ASC)
    FROM (
      SELECT
        g.date::text                                                                    AS date,
        COUNT(a.id)                                                                     AS total,
        COUNT(a.id) FILTER (WHERE a.status = 'confirmed')                               AS confirmed,
        COUNT(a.id) FILTER (WHERE a.status = 'completed')                               AS completed,
        COUNT(a.id) FILTER (WHERE a.status = 'cancelled')                               AS cancelled
      FROM generate_series(
        (CURRENT_DATE - (p_days - 1) * INTERVAL '1 day')::date,
        CURRENT_DATE,
        '1 day'::interval
      ) AS g(date)
      LEFT JOIN scheduling.appointments a
        ON  a.tenant_id              = p_tenant_id
        AND a.scheduled_start_at::date = g.date
      GROUP BY g.date
    ) d
  );
END;
$$;

-- ─── GRANTs ──────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.rpc_conversations_trend(uuid, int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_appointments_trend(uuid, int)  TO anon, authenticated, service_role;
