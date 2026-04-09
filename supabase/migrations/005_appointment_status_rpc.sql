-- ============================================================
-- Migration 005: RPC para atualização de status de agendamento
-- Totalmente aditiva — não altera dados nem funções existentes
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_update_appointment_status(
  p_tenant_id uuid,
  p_id        uuid,
  p_status    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, scheduling
AS $$
BEGIN
  UPDATE scheduling.appointments
  SET
    status     = p_status,
    updated_at = now()
  WHERE id = p_id AND tenant_id = p_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_update_appointment_status(uuid, uuid, text)
  TO anon, authenticated, service_role;
