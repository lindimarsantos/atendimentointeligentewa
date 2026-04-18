-- Migration 086: Google Calendar Sync — remove per-professional oauth_refresh_token requirement
-- Auth is now handled via n8n Google Calendar OAuth2 credential (single shared credential).
-- Per-professional calendar_id is still stored in scheduling.professional_calendars.

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
      pc.calendar_id          AS google_calendar_id
    FROM scheduling.appointments a
    JOIN scheduling.professionals pr ON pr.id = a.professional_id
    JOIN scheduling.professional_calendars pc
         ON  pc.professional_id  = a.professional_id
         AND pc.tenant_id        = a.tenant_id
         AND pc.provider         = 'google'
         AND pc.status           = 'active'
         AND pc.sync_direction  IN ('write', 'bidirectional')
    LEFT JOIN scheduling.services sv ON sv.id = a.service_id
    LEFT JOIN crm.customers       cu ON cu.id = a.customer_id
    WHERE a.status           IN ('confirmed', 'pending')
      AND a.external_event_id IS NULL
    LIMIT p_limit
  ) r;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_all_appointments_pending_google_sync(int)
  TO service_role;
