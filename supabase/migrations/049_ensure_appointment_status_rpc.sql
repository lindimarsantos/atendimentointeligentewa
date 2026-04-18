-- ============================================================
-- Migration 049: Garante existência de rpc_update_appointment_status
--
-- A migration 005 pode não ter sido aplicada em alguns ambientes.
-- Esta migration é idempotente (CREATE OR REPLACE) e segura de rodar
-- mesmo que a função já exista.
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
