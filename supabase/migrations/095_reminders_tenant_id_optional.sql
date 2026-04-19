-- Migration 095: torna p_tenant_id opcional em rpc_n8n_get_appointment_reminders
--
-- Quando p_tenant_id IS NULL, processa TODOS os tenants (mesmo padrão de
-- rpc_n8n_get_scheduling_followup_targets e outros RPCs de workflow n8n).
-- Isso elimina a dependência da variável TENANT_ID no n8n, que não está
-- configurada e causava body {} vazio na chamada HTTP.

CREATE OR REPLACE FUNCTION public.rpc_n8n_get_appointment_reminders(
  p_tenant_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling, crm, messaging, ops
AS $$
DECLARE
  v_results jsonb := '[]'::jsonb;
BEGIN
  WITH rules AS (
    SELECT tenant_id, hours_before
    FROM ops.reminder_rules
    WHERE (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
      AND is_active = true
      AND trigger_type = 'appointment_before'
      AND hours_before IS NOT NULL
  ),
  due_appointments AS (
    SELECT DISTINCT ON (a.id)
      a.id                                          AS appointment_id,
      a.tenant_id,
      a.scheduled_start_at,
      cu.full_name                                  AS customer_name,
      cu.phone                                      AS customer_phone,
      p.name                                        AS professional_name,
      s.name                                        AS service_name,
      s.preparation_instructions,
      tc.external_account_id                        AS zapi_instance_id,
      tc.config_jsonb->>'zapi_token'                AS zapi_token,
      tc.config_jsonb->>'zapi_client_token'         AS zapi_client_token
    FROM scheduling.appointments a
    JOIN rules r
      ON r.tenant_id = a.tenant_id
     AND a.scheduled_start_at BETWEEN
           NOW() + ((r.hours_before - 1) || ' hours')::interval
         AND NOW() + ((r.hours_before + 1) || ' hours')::interval
    JOIN crm.customers cu
      ON cu.id = a.customer_id
    JOIN scheduling.professionals p
      ON p.id = a.professional_id
    JOIN scheduling.services s
      ON s.id = a.service_id
    JOIN messaging.tenant_channels tc
      ON tc.tenant_id = a.tenant_id AND tc.is_active = true
    WHERE (p_tenant_id IS NULL OR a.tenant_id = p_tenant_id)
      AND a.status         = 'scheduled'
      AND a.reminder_sent_at IS NULL
      AND cu.phone IS NOT NULL
      AND tc.external_account_id IS NOT NULL
    ORDER BY a.id, a.scheduled_start_at
  )
  SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json)
  INTO v_results
  FROM due_appointments d;

  UPDATE scheduling.appointments
  SET reminder_sent_at = NOW()
  WHERE id IN (
    SELECT (elem->>'appointment_id')::uuid
    FROM jsonb_array_elements(v_results) AS elem
  );

  RETURN v_results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_n8n_get_appointment_reminders(uuid)
  TO anon, authenticated, service_role;
