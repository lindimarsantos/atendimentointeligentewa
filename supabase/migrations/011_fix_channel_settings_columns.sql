-- ============================================================
-- Migration 011: Corrige nomes de colunas em channel_settings
-- handoff_message   → human_handoff_message
-- buffer_active     → enable_buffer
-- typing_simulation → enable_typing_simulation
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_get_channel_settings(
  p_tenant_id  uuid,
  p_channel_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
DECLARE v_result json;
BEGIN
  SELECT row_to_json(t) INTO v_result
  FROM (
    SELECT
      id, tenant_id, channel_id,
      welcome_message,
      out_of_hours_message,
      human_handoff_message    AS handoff_message,
      enable_buffer            AS buffer_active,
      enable_typing_simulation AS typing_simulation,
      updated_at
    FROM config.channel_settings s
    WHERE s.tenant_id  = p_tenant_id
      AND s.channel_id = p_channel_id
    LIMIT 1
  ) t;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_update_channel_settings(
  p_tenant_id            uuid,
  p_channel_id           uuid,
  p_welcome_message      text    DEFAULT NULL,
  p_out_of_hours_message text    DEFAULT NULL,
  p_handoff_message      text    DEFAULT NULL,
  p_buffer_active        boolean DEFAULT NULL,
  p_typing_simulation    boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  UPDATE config.channel_settings
  SET
    welcome_message          = COALESCE(p_welcome_message,      welcome_message),
    out_of_hours_message     = COALESCE(p_out_of_hours_message, out_of_hours_message),
    human_handoff_message    = COALESCE(p_handoff_message,      human_handoff_message),
    enable_buffer            = COALESCE(p_buffer_active,        enable_buffer),
    enable_typing_simulation = COALESCE(p_typing_simulation,    enable_typing_simulation),
    updated_at               = now()
  WHERE tenant_id  = p_tenant_id
    AND channel_id = p_channel_id;

  IF NOT FOUND THEN
    INSERT INTO config.channel_settings
      (tenant_id, channel_id, welcome_message, out_of_hours_message,
       human_handoff_message, enable_buffer, enable_typing_simulation)
    VALUES
      (p_tenant_id, p_channel_id,
       p_welcome_message, p_out_of_hours_message, p_handoff_message,
       COALESCE(p_buffer_active, true), COALESCE(p_typing_simulation, true));
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_channel_settings(uuid, uuid)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.rpc_update_channel_settings(uuid,uuid,text,text,text,boolean,boolean)
  TO anon, authenticated, service_role;
