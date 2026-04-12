-- ============================================================
-- Migration 038: Fix rpc_n8n_book_appointment — wrong enum value
--
-- The INSERT used status = 'scheduled' but the scheduling.appointment_status
-- enum has no such label. Valid values: pending, confirmed, cancelled,
-- completed, no_show, rescheduled.
--
-- AI-created bookings go straight to 'confirmed' (the patient already
-- spoke with the AI and chose a slot consciously).
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_n8n_book_appointment(
  p_tenant_id          uuid,
  p_conversation_id    uuid,
  p_customer_id        uuid,
  p_service_name       text,
  p_professional_name  text,
  p_start_at           timestamptz,
  p_notes              text    DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling
AS $$
DECLARE
  v_service_id      uuid;
  v_service_name    text;
  v_duration        int;
  v_professional_id uuid;
  v_pro_name        text;
  v_end_at          timestamptz;
  v_appointment_id  uuid;
  v_conflicts       int;
BEGIN
  -- Resolve service
  SELECT id, name, duration_minutes
    INTO v_service_id, v_service_name, v_duration
  FROM scheduling.services
  WHERE tenant_id = p_tenant_id
    AND is_active = true
    AND (lower(name) = lower(p_service_name)
         OR lower(name) LIKE '%' || lower(p_service_name) || '%')
  LIMIT 1;

  IF v_service_id IS NULL THEN
    RETURN json_build_object('error', 'Serviço não encontrado: ' || p_service_name);
  END IF;

  -- Resolve professional
  SELECT p.id, p.name
    INTO v_professional_id, v_pro_name
  FROM scheduling.professionals p
  JOIN scheduling.service_professional_links l
    ON l.professional_id = p.id AND l.tenant_id = p_tenant_id
  WHERE l.service_id  = v_service_id
    AND l.is_active   = true
    AND p.tenant_id   = p_tenant_id
    AND p.status      = 'active'
    AND (lower(p.name) = lower(p_professional_name)
         OR lower(p.name) LIKE '%' || lower(p_professional_name) || '%')
  LIMIT 1;

  IF v_professional_id IS NULL THEN
    RETURN json_build_object('error', 'Profissional não encontrado: ' || p_professional_name);
  END IF;

  v_end_at := p_start_at + (v_duration || ' minutes')::interval;

  -- Check for conflicts
  SELECT COUNT(*) INTO v_conflicts
  FROM scheduling.appointments
  WHERE professional_id    = v_professional_id
    AND tenant_id          = p_tenant_id
    AND status NOT IN ('cancelled', 'no_show')
    AND scheduled_start_at < v_end_at
    AND scheduled_end_at   > p_start_at;

  IF v_conflicts > 0 THEN
    RETURN json_build_object('error', 'Horário não disponível — existe conflito de agenda');
  END IF;

  -- Create appointment (confirmed = patient explicitly chose via AI)
  INSERT INTO scheduling.appointments (
    tenant_id,
    customer_id,
    professional_id,
    service_id,
    scheduled_start_at,
    scheduled_end_at,
    status,
    notes
  ) VALUES (
    p_tenant_id,
    p_customer_id,
    v_professional_id,
    v_service_id,
    p_start_at,
    v_end_at,
    'confirmed',
    p_notes
  )
  RETURNING id INTO v_appointment_id;

  RETURN json_build_object(
    'appointment_id',     v_appointment_id,
    'service_name',       v_service_name,
    'professional_name',  v_pro_name,
    'start_at',           p_start_at,
    'end_at',             v_end_at,
    'duration_minutes',   v_duration,
    'status',             'confirmed'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_n8n_book_appointment(uuid, uuid, uuid, text, text, timestamptz, text)
  TO anon, authenticated, service_role;
