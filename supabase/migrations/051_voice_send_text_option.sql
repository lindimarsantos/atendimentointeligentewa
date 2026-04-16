-- ============================================================
-- Migration 051: Opção de suprimir texto ao responder por áudio
--
-- Adiciona send_text_with_audio ao rpc_n8n_get_voice_config.
-- O campo é lido de settings_jsonb da voice_profile padrão.
-- Padrão: true (mantém comportamento atual de sempre enviar texto).
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_n8n_get_voice_config(
  p_conversation_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config, messaging, ai, crm
AS $$
DECLARE
  v_tenant_id   uuid;
  v_customer_id uuid;
  v_result      json;
BEGIN
  SELECT tenant_id, customer_id
    INTO v_tenant_id, v_customer_id
  FROM messaging.conversations
  WHERE id = p_conversation_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN json_build_object('voice_enabled', false);
  END IF;

  SELECT json_build_object(
    'voice_enabled',         (ts.allow_voice_output AND cs.enable_audio_reply),
    'voice_external_id',     vp.voice_external_id,
    'elevenlabs_api_key',    vp.settings_jsonb->>'api_key',
    'model_id',              COALESCE(vp.settings_jsonb->>'model_id', 'eleven_multilingual_v2'),
    'stability',             COALESCE((vp.settings_jsonb->>'stability')::numeric, 0.5),
    'similarity_boost',      COALESCE((vp.settings_jsonb->>'similarity_boost')::numeric, 0.75),
    'send_text_with_audio',  COALESCE((vp.settings_jsonb->>'send_text_with_audio')::boolean, true),
    'zapi_instance_id',      tc.external_account_id,
    'zapi_token',            tc.config_jsonb->>'zapi_token',
    'zapi_client_token',     tc.config_jsonb->>'zapi_client_token',
    'customer_phone',        cu.phone_e164
  ) INTO v_result
  FROM config.tenant_settings ts
  LEFT JOIN config.channel_settings cs
         ON cs.tenant_id = ts.tenant_id
  LEFT JOIN messaging.tenant_channels tc
         ON tc.tenant_id = ts.tenant_id AND tc.is_active = true
  LEFT JOIN ai.voice_profiles vp
         ON vp.tenant_id = ts.tenant_id AND vp.is_default = true
  LEFT JOIN crm.customers cu
         ON cu.id = v_customer_id
  WHERE ts.tenant_id = v_tenant_id
  LIMIT 1;

  RETURN COALESCE(v_result, json_build_object('voice_enabled', false));
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_n8n_get_voice_config(uuid)
  TO anon, authenticated, service_role;
