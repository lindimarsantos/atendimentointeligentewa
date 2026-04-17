-- ============================================================
-- Migration 069: rpc_update_customer
-- Permite edição manual de dados básicos de um cliente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_update_customer(
  p_tenant_id   uuid,
  p_customer_id uuid,
  p_full_name   text DEFAULT NULL,
  p_phone_e164  text DEFAULT NULL,
  p_email       text DEFAULT NULL,
  p_status      text DEFAULT NULL,
  p_notes       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, crm
AS $$
BEGIN
  -- Atualiza campos de texto
  UPDATE crm.customers
  SET
    full_name  = COALESCE(NULLIF(p_full_name,  ''), full_name),
    phone_e164 = COALESCE(NULLIF(p_phone_e164, ''), phone_e164),
    email      = CASE WHEN p_email  IS NOT NULL THEN NULLIF(p_email, '') ELSE email END,
    notes      = CASE WHEN p_notes  IS NOT NULL THEN p_notes               ELSE notes END,
    updated_at = now()
  WHERE id = p_customer_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;

  -- Atualiza status via SQL dinâmico para lidar com o enum sem nome fixo
  IF p_status IS NOT NULL AND p_status <> '' THEN
    EXECUTE format(
      'UPDATE crm.customers SET status = %L::crm.customer_status WHERE id = %L AND tenant_id = %L',
      p_status, p_customer_id, p_tenant_id
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_update_customer(uuid, uuid, text, text, text, text, text)
  TO anon, authenticated, service_role;
