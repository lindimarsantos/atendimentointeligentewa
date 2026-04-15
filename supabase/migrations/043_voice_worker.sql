-- ============================================================
-- Migration 043: Voice Worker — ElevenLabs Integration
--
-- 1. Corrige bug em rpc_upsert_voice_profile (settings_jsonb NULL)
-- 2. Cria rpc_n8n_get_voice_config para o n8n worker de voz
--
-- Estrutura de settings_jsonb em ai.voice_profiles:
--   { "api_key": "sk_...", "model_id": "eleven_multilingual_v2",
--     "stability": 0.5, "similarity_boost": 0.75 }
-- ============================================================

-- ── 1. Fix rpc_upsert_voice_profile ─────────────────────────────────────────
-- Bug: INSERT passava p_settings_jsonb NULL explícito, ignorando o DEFAULT

CREATE OR REPLACE FUNCTION public.rpc_upsert_voice_profile(
  p_tenant_id         uuid,
  p_id                uuid    DEFAULT NULL,
  p_name              text    DEFAULT NULL,
  p_provider          text    DEFAULT 'elevenlabs',
  p_voice_external_id text    DEFAULT NULL,
  p_language_code     text    DEFAULT 'pt-BR',
  p_gender            text    DEFAULT 'female',
  p_settings_jsonb    jsonb   DEFAULT NULL,
  p_is_default        boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, ai
AS $$
BEGIN
  -- Se vai ser default, limpa os outros primeiro
  IF p_is_default THEN
    UPDATE ai.voice_profiles SET is_default = false WHERE tenant_id = p_tenant_id;
  END IF;

  IF p_id IS NOT NULL THEN
    -- UPDATE: usa COALESCE para não sobrescrever com NULL
    UPDATE ai.voice_profiles
    SET
      name              = COALESCE(p_name, name),
      provider          = COALESCE(p_provider, provider),
      voice_external_id = COALESCE(p_voice_external_id, voice_external_id),
      language_code     = COALESCE(p_language_code, language_code),
      gender            = COALESCE(p_gender, gender),
      settings_jsonb    = COALESCE(p_settings_jsonb, settings_jsonb),
      is_default        = COALESCE(p_is_default, is_default),
      updated_at        = now()
    WHERE id = p_id AND tenant_id = p_tenant_id;
  ELSE
    -- INSERT: COALESCE garante '{}' quando frontend não envia settings
    INSERT INTO ai.voice_profiles
      (tenant_id, name, provider, voice_external_id, language_code, gender, settings_jsonb, is_default)
    VALUES
      (p_tenant_id, p_name, p_provider, p_voice_external_id,
       p_language_code, p_gender,
       COALESCE(p_settings_jsonb, '{}'::jsonb),  -- ← fix
       p_is_default);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_upsert_voice_profile(uuid,uuid,text,text,text,text,text,jsonb,boolean)
  TO anon, authenticated, service_role;


-- ── 2. rpc_n8n_get_voice_config ─────────────────────────────────────────────
-- Chamado pelo n8n antes de gerar áudio.
-- Resolve tenant → busca config de voz padrão + credenciais Z-API.
-- Retorna tudo que o worker precisa em um único JSON.

CREATE OR REPLACE FUNCTION public.rpc_n8n_get_voice_config(
  p_conversation_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config, messaging, ai
AS $$
DECLARE
  v_tenant_id uuid;
  v_result    json;
BEGIN
  -- Resolve tenant a partir da conversa
  SELECT tenant_id INTO v_tenant_id
  FROM messaging.conversations
  WHERE id = p_conversation_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN json_build_object('voice_enabled', false);
  END IF;

  SELECT json_build_object(
    -- Feature flags de voz
    'voice_enabled',       (ts.allow_voice_output AND cs.enable_audio_reply),
    -- Config ElevenLabs (perfil padrão do tenant)
    'voice_external_id',   vp.voice_external_id,
    'elevenlabs_api_key',  vp.settings_jsonb->>'api_key',
    'model_id',            COALESCE(vp.settings_jsonb->>'model_id', 'eleven_multilingual_v2'),
    'stability',           COALESCE((vp.settings_jsonb->>'stability')::numeric, 0.5),
    'similarity_boost',    COALESCE((vp.settings_jsonb->>'similarity_boost')::numeric, 0.75),
    -- Credenciais Z-API do canal
    'zapi_instance_id',    tc.external_account_id,
    'zapi_token',          tc.config_jsonb->>'zapi_token'
  ) INTO v_result
  FROM config.tenant_settings ts
  LEFT JOIN config.channel_settings cs
         ON cs.tenant_id = ts.tenant_id
  LEFT JOIN messaging.tenant_channels tc
         ON tc.tenant_id = ts.tenant_id AND tc.is_active = true
  LEFT JOIN ai.voice_profiles vp
         ON vp.tenant_id = ts.tenant_id AND vp.is_default = true
  WHERE ts.tenant_id = v_tenant_id
  LIMIT 1;

  RETURN COALESCE(v_result, json_build_object('voice_enabled', false));
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_n8n_get_voice_config(uuid)
  TO anon, authenticated, service_role;
