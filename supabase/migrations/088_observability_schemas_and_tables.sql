-- Migration 088: Create missing schemas and tables for Observabilidade module
--   • public.job_queue
--   • audit schema  → audit_logs, integration_logs
--   • observability schema → prediction_scores
--   • analytics schema    → roi_snapshots
-- Also fixes rpc_list_prediction_scores (core.customers → crm.customers).

-- ─── public.job_queue ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.job_queue (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL,
  job_type    text        NOT NULL,
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'running', 'done', 'failed')),
  payload     jsonb,
  result      jsonb,
  error       text,
  attempts    int         NOT NULL DEFAULT 0,
  max_attempts int        NOT NULL DEFAULT 3,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at  timestamptz,
  finished_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_queue_tenant_status_idx
  ON public.job_queue (tenant_id, status, scheduled_at);

ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_queue_service_role ON public.job_queue
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.job_queue TO service_role;


-- ─── audit schema ─────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS audit;

-- audit.audit_logs
CREATE TABLE IF NOT EXISTS audit.audit_logs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid,
  entity_type    text        NOT NULL,
  entity_id      uuid,
  action         text        NOT NULL
                             CHECK (action IN ('insert','update','delete','sync','decision','handoff','login')),
  actor_type     text        NOT NULL
                             CHECK (actor_type IN ('system','ai','agent','customer','integration')),
  actor_id       text,
  before_jsonb   jsonb,
  after_jsonb    jsonb,
  metadata_jsonb jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_tenant_at_idx
  ON audit.audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx
  ON audit.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx
  ON audit.audit_logs (action);

-- audit.integration_logs
CREATE TABLE IF NOT EXISTS audit.integration_logs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid,
  integration_name text        NOT NULL,
  direction        text        NOT NULL DEFAULT 'outbound'
                               CHECK (direction IN ('inbound','outbound')),
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('success','error','pending')),
  external_id      text,
  payload_jsonb    jsonb,
  response_jsonb   jsonb,
  error_jsonb      jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS integration_logs_tenant_at_idx
  ON audit.integration_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS integration_logs_name_idx
  ON audit.integration_logs (integration_name);


-- ─── observability schema ─────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS observability;

CREATE TABLE IF NOT EXISTS observability.prediction_scores (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL,
  entity_type      text        NOT NULL,
  entity_id        uuid        NOT NULL,
  score_type       text        NOT NULL,
  score_value      numeric(5,4) NOT NULL CHECK (score_value BETWEEN 0 AND 1),
  model_name       text,
  explanation_jsonb jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prediction_scores_tenant_at_idx
  ON observability.prediction_scores (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS prediction_scores_entity_idx
  ON observability.prediction_scores (entity_type, entity_id);


-- ─── analytics schema ─────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.roi_snapshots (
  id                 uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid    NOT NULL,
  period_start       date    NOT NULL,
  period_end         date    NOT NULL,
  leads_count        int     NOT NULL DEFAULT 0,
  appointments_count int     NOT NULL DEFAULT 0,
  show_rate          numeric(5,4) NOT NULL DEFAULT 0,
  conversion_rate    numeric(5,4) NOT NULL DEFAULT 0,
  revenue_total      numeric(14,2) NOT NULL DEFAULT 0,
  media_spend        numeric(14,2) NOT NULL DEFAULT 0,
  roi_value          numeric(10,4),
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period_start)
);

CREATE INDEX IF NOT EXISTS roi_snapshots_tenant_period_idx
  ON analytics.roi_snapshots (tenant_id, period_start DESC);


-- ─── Fix rpc_list_prediction_scores (core.customers → crm.customers) ──────────

CREATE OR REPLACE FUNCTION public.rpc_list_prediction_scores(
  p_tenant_id   uuid,
  p_entity_type text    DEFAULT NULL,
  p_score_type  text    DEFAULT NULL,
  p_limit       int     DEFAULT 100
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, observability, crm
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
          THEN (SELECT c.full_name FROM crm.customers c WHERE c.id = ps.entity_id LIMIT 1)
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

GRANT EXECUTE ON FUNCTION public.rpc_list_prediction_scores(uuid,text,text,int)
  TO anon, authenticated, service_role;


-- ─── Fix rpc_list_jobs to handle table gracefully (now the table exists) ───────

CREATE OR REPLACE FUNCTION public.rpc_list_jobs(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(j) ORDER BY j.created_at DESC), '[]'::json)
    FROM public.job_queue j
    WHERE j.tenant_id = p_tenant_id
    LIMIT 100
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_list_jobs(uuid)
  TO anon, authenticated, service_role;
