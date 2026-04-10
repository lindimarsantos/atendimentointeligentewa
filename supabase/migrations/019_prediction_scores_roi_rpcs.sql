-- ============================================================
-- Migration 019: RPCs para prediction scores e ROI
-- ============================================================

-- ── rpc_list_prediction_scores ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_list_prediction_scores(
  p_tenant_id   uuid,
  p_entity_type text    DEFAULT NULL,
  p_score_type  text    DEFAULT NULL,
  p_limit       int     DEFAULT 100
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, observability
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(s) ORDER BY s.created_at DESC)
    FROM (
      SELECT
        ps.id,
        ps.tenant_id,
        ps.entity_type,
        ps.entity_id,
        ps.score_type,
        ps.score_value,
        ps.model_name,
        ps.explanation_jsonb,
        ps.created_at,
        CASE WHEN ps.entity_type = 'customer'
          THEN (SELECT c.name FROM core.customers c WHERE c.id = ps.entity_id LIMIT 1)
          ELSE NULL
        END AS entity_name
      FROM observability.prediction_scores ps
      WHERE ps.tenant_id = p_tenant_id
        AND (p_entity_type IS NULL OR ps.entity_type = p_entity_type)
        AND (p_score_type  IS NULL OR ps.score_type  = p_score_type)
      ORDER BY ps.created_at DESC
      LIMIT p_limit
    ) s
  );
END;
$$;

-- ── rpc_get_roi_summary ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_get_roi_summary(
  p_tenant_id uuid,
  p_months    int DEFAULT 6
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, analytics
AS $$
DECLARE
  v_since date := (current_date - (p_months || ' months')::interval)::date;
BEGIN
  RETURN (
    SELECT row_to_json(r)
    FROM (
      SELECT
        COALESCE(SUM(revenue_total), 0)      AS total_revenue,
        COALESCE(SUM(media_spend), 0)        AS total_media_spend,
        COALESCE(SUM(leads_count), 0)        AS total_leads,
        COALESCE(SUM(appointments_count), 0) AS total_appointments,
        COALESCE(
          CASE WHEN SUM(media_spend) > 0
            THEN ROUND(SUM(revenue_total) / NULLIF(SUM(media_spend), 0), 2)
            ELSE NULL
          END
        , 0)                                 AS roi_ratio,
        COALESCE(AVG(show_rate), 0)          AS avg_show_rate,
        COALESCE(AVG(conversion_rate), 0)    AS avg_conversion_rate,
        json_agg(
          json_build_object(
            'period_start',       rs.period_start,
            'period_end',         rs.period_end,
            'leads_count',        rs.leads_count,
            'appointments_count', rs.appointments_count,
            'show_rate',          rs.show_rate,
            'conversion_rate',    rs.conversion_rate,
            'revenue_total',      rs.revenue_total,
            'media_spend',        rs.media_spend,
            'roi_value',          rs.roi_value
          ) ORDER BY rs.period_start
        ) AS snapshots
      FROM analytics.roi_snapshots rs
      WHERE rs.tenant_id = p_tenant_id
        AND rs.period_start >= v_since
    ) r
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_list_prediction_scores(uuid,text,text,int)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.rpc_get_roi_summary(uuid,int)
  TO anon, authenticated, service_role;
