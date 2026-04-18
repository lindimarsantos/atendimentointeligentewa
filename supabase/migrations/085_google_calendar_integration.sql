-- ============================================================
-- Migration 085: Google Calendar Integration
--
-- Adds OAuth credential columns to scheduling.professional_calendars
-- and creates RPCs for managing Google Calendar connections,
-- querying appointments pending sync, and logging sync results.
-- ============================================================

-- 1. OAuth credential columns
ALTER TABLE scheduling.professional_calendars
  ADD COLUMN IF NOT EXISTS oauth_refresh_token    text,
  ADD COLUMN IF NOT EXISTS oauth_access_token     text,
  ADD COLUMN IF NOT EXISTS oauth_token_expires_at timestamptz;

-- ============================================================
-- 2. RPC: list calendars connected to professionals
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_list_professional_calendars(
  p_tenant_id       uuid,
  p_professional_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, scheduling
AS $$
  SELECT COALESCE(
    json_agg(row_to_json(c) ORDER BY c.is_primary DESC, c.created_at),
    '[]'::json
  )
  FROM (
    SELECT
      pc.id,
      pc.professional_id,
      pc.provider::text,
      pc.calendar_id,
      pc.calendar_name,
      pc.is_primary,
      pc.sync_direction::text,
      pc.status::text,
      pc.last_synced_at,
      pc.oauth_token_expires_at,
      pc.created_at,
      (pc.oauth_refresh_token IS NOT NULL) AS has_credentials,
      pr.name AS professional_name
    FROM scheduling.professional_calendars pc
    JOIN scheduling.professionals pr ON pr.id = pc.professional_id
    WHERE pc.tenant_id = p_tenant_id
      AND (p_professional_id IS NULL OR pc.professional_id = p_professional_id)
  ) c;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_list_professional_calendars(uuid, uuid)
  TO anon, authenticated, service_role;

-- ============================================================
-- 3. RPC: upsert Google Calendar connection with OAuth tokens
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_upsert_professional_calendar(
  p_tenant_id              uuid,
  p_professional_id        uuid,
  p_calendar_id            text,
  p_calendar_name          text        DEFAULT NULL,
  p_sync_direction         text        DEFAULT 'write',
  p_is_primary             boolean     DEFAULT true,
  p_oauth_refresh_token    text        DEFAULT NULL,
  p_oauth_access_token     text        DEFAULT NULL,
  p_oauth_token_expires_at timestamptz DEFAULT NULL,
  p_id                     uuid        DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE scheduling.professional_calendars SET
      calendar_id              = COALESCE(p_calendar_id,            calendar_id),
      calendar_name            = COALESCE(p_calendar_name,          calendar_name),
      sync_direction           = COALESCE(p_sync_direction::scheduling.sync_direction, sync_direction),
      is_primary               = COALESCE(p_is_primary,             is_primary),
      oauth_refresh_token      = COALESCE(p_oauth_refresh_token,    oauth_refresh_token),
      oauth_access_token       = COALESCE(p_oauth_access_token,     oauth_access_token),
      oauth_token_expires_at   = COALESCE(p_oauth_token_expires_at, oauth_token_expires_at),
      status                   = 'active',
      updated_at               = now()
    WHERE id = p_id AND tenant_id = p_tenant_id;
    v_id := p_id;
  ELSE
    INSERT INTO scheduling.professional_calendars (
      tenant_id, professional_id, provider, calendar_id, calendar_name,
      is_primary, sync_direction, status,
      oauth_refresh_token, oauth_access_token, oauth_token_expires_at
    ) VALUES (
      p_tenant_id, p_professional_id, 'google',
      p_calendar_id, COALESCE(p_calendar_name, 'Google Calendar'),
      COALESCE(p_is_primary, true),
      COALESCE(p_sync_direction::scheduling.sync_direction, 'write'),
      'active',
      p_oauth_refresh_token, p_oauth_access_token, p_oauth_token_expires_at
    )
    ON CONFLICT (professional_id, calendar_id) DO UPDATE SET
      calendar_name            = COALESCE(p_calendar_name,          scheduling.professional_calendars.calendar_name),
      sync_direction           = COALESCE(p_sync_direction::scheduling.sync_direction, scheduling.professional_calendars.sync_direction),
      is_primary               = COALESCE(p_is_primary,             scheduling.professional_calendars.is_primary),
      oauth_refresh_token      = COALESCE(p_oauth_refresh_token,    scheduling.professional_calendars.oauth_refresh_token),
      oauth_access_token       = COALESCE(p_oauth_access_token,     scheduling.professional_calendars.oauth_access_token),
      oauth_token_expires_at   = COALESCE(p_oauth_token_expires_at, scheduling.professional_calendars.oauth_token_expires_at),
      status                   = 'active',
      updated_at               = now()
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      SELECT id INTO v_id FROM scheduling.professional_calendars
      WHERE professional_id = p_professional_id AND calendar_id = p_calendar_id;
    END IF;
  END IF;

  RETURN (
    SELECT row_to_json(pc) FROM scheduling.professional_calendars pc WHERE pc.id = v_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_upsert_professional_calendar(uuid, uuid, text, text, text, boolean, text, text, timestamptz, uuid)
  TO anon, authenticated, service_role;

-- ============================================================
-- 4. RPC: remove Google Calendar connection
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_delete_professional_calendar(
  p_tenant_id uuid,
  p_id        uuid
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, scheduling
AS $$
  DELETE FROM scheduling.professional_calendars
  WHERE id = p_id AND tenant_id = p_tenant_id;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_delete_professional_calendar(uuid, uuid)
  TO anon, authenticated, service_role;

-- ============================================================
-- 5. RPC: appointments needing Google Calendar sync
--    (confirmed/pending, no external_event_id, professional has active Google Calendar)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_get_appointments_pending_google_sync(
  p_tenant_id uuid,
  p_limit     int DEFAULT 20
)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, scheduling, crm
AS $$
  SELECT COALESCE(
    json_agg(row_to_json(r) ORDER BY r.scheduled_start_at),
    '[]'::json
  )
  FROM (
    SELECT
      a.id                    AS appointment_id,
      a.tenant_id,
      a.professional_id,
      a.service_id,
      a.customer_id,
      a.scheduled_start_at,
      a.scheduled_end_at,
      a.status,
      a.notes,
      pr.name                 AS professional_name,
      sv.name                 AS service_name,
      cu.full_name            AS customer_name,
      cu.email                AS customer_email,
      pc.id                   AS calendar_record_id,
      pc.calendar_id          AS google_calendar_id,
      pc.oauth_refresh_token,
      pc.oauth_access_token,
      pc.oauth_token_expires_at
    FROM scheduling.appointments a
    JOIN scheduling.professionals pr ON pr.id = a.professional_id
    JOIN scheduling.professional_calendars pc
         ON  pc.professional_id  = a.professional_id
         AND pc.tenant_id        = a.tenant_id
         AND pc.provider         = 'google'
         AND pc.status           = 'active'
         AND pc.sync_direction  IN ('write', 'bidirectional')
         AND pc.oauth_refresh_token IS NOT NULL
    LEFT JOIN scheduling.services sv ON sv.id = a.service_id
    LEFT JOIN crm.customers       cu ON cu.id = a.customer_id
    WHERE a.tenant_id         = p_tenant_id
      AND a.status           IN ('confirmed', 'pending')
      AND a.external_event_id IS NULL
    LIMIT p_limit
  ) r;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_appointments_pending_google_sync(uuid, int)
  TO anon, authenticated, service_role;

-- ============================================================
-- 6. RPC: store Google Calendar event ID after successful sync
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_update_appointment_external_id(
  p_tenant_id         uuid,
  p_appointment_id    uuid,
  p_external_event_id text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, scheduling
AS $$
  UPDATE scheduling.appointments
  SET external_event_id = p_external_event_id,
      updated_at        = now()
  WHERE id        = p_appointment_id
    AND tenant_id = p_tenant_id;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_update_appointment_external_id(uuid, uuid, text)
  TO anon, authenticated, service_role;

-- ============================================================
-- 7. RPC: log Google Calendar sync attempt
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_log_calendar_sync(
  p_tenant_id                uuid,
  p_professional_calendar_id uuid,
  p_direction                text,
  p_status                   text,
  p_request_jsonb            jsonb DEFAULT NULL,
  p_response_jsonb           jsonb DEFAULT NULL,
  p_error_jsonb              jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling, ai
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO scheduling.calendar_sync_logs (
    tenant_id,
    professional_calendar_id,
    direction,
    status,
    request_jsonb,
    response_jsonb,
    error_jsonb
  ) VALUES (
    p_tenant_id,
    p_professional_calendar_id,
    p_direction::scheduling.sync_direction,
    p_status::ai.job_status,
    COALESCE(p_request_jsonb,  '{}'::jsonb),
    COALESCE(p_response_jsonb, '{}'::jsonb),
    COALESCE(p_error_jsonb,    '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  IF p_status = 'completed' THEN
    UPDATE scheduling.professional_calendars
    SET last_synced_at = now(), updated_at = now()
    WHERE id = p_professional_calendar_id;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_log_calendar_sync(uuid, uuid, text, text, jsonb, jsonb, jsonb)
  TO anon, authenticated, service_role;

-- ============================================================
-- 8. RPC: cross-tenant query for n8n worker (service_role only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_get_all_appointments_pending_google_sync(
  p_limit int DEFAULT 50
)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, scheduling, crm
AS $$
  SELECT COALESCE(
    json_agg(row_to_json(r) ORDER BY r.scheduled_start_at),
    '[]'::json
  )
  FROM (
    SELECT
      a.id                    AS appointment_id,
      a.tenant_id,
      a.professional_id,
      a.service_id,
      a.customer_id,
      a.scheduled_start_at,
      a.scheduled_end_at,
      a.status::text,
      a.notes,
      pr.name                 AS professional_name,
      sv.name                 AS service_name,
      cu.full_name            AS customer_name,
      cu.email                AS customer_email,
      pc.id                   AS calendar_record_id,
      pc.calendar_id          AS google_calendar_id,
      pc.oauth_refresh_token,
      pc.oauth_access_token,
      pc.oauth_token_expires_at
    FROM scheduling.appointments a
    JOIN scheduling.professionals pr ON pr.id = a.professional_id
    JOIN scheduling.professional_calendars pc
         ON  pc.professional_id  = a.professional_id
         AND pc.tenant_id        = a.tenant_id
         AND pc.provider         = 'google'
         AND pc.status           = 'active'
         AND pc.sync_direction  IN ('write', 'bidirectional')
         AND pc.oauth_refresh_token IS NOT NULL
    LEFT JOIN scheduling.services sv ON sv.id = a.service_id
    LEFT JOIN crm.customers       cu ON cu.id = a.customer_id
    WHERE a.status           IN ('confirmed', 'pending')
      AND a.external_event_id IS NULL
    LIMIT p_limit
  ) r;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_all_appointments_pending_google_sync(int)
  TO service_role;
