-- ============================================================
-- Migration 001: RPCs para Módulo 10 — Configurações de IA
-- Todos os RPCs criados no schema public para acesso via anon
-- ============================================================

-- ─── config.ai_agent_profiles ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_get_ai_agent_profile(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
DECLARE v_result json;
BEGIN
  SELECT row_to_json(p) INTO v_result
  FROM config.ai_agent_profiles p
  WHERE p.tenant_id = p_tenant_id
  LIMIT 1;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_update_ai_agent_profile(
  p_tenant_id            uuid,
  p_profile_name         text,
  p_objective            text DEFAULT NULL,
  p_tone                 text DEFAULT NULL,
  p_verbosity            text DEFAULT NULL,
  p_escalation_policy    text DEFAULT NULL,
  p_use_memory           boolean DEFAULT NULL,
  p_use_recommendations  boolean DEFAULT NULL,
  p_use_scheduling       boolean DEFAULT NULL,
  p_allow_voice_response boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  UPDATE config.ai_agent_profiles
  SET
    profile_name         = COALESCE(p_profile_name, profile_name),
    objective            = COALESCE(p_objective, objective),
    tone                 = COALESCE(p_tone, tone),
    verbosity            = COALESCE(p_verbosity, verbosity),
    escalation_policy    = COALESCE(p_escalation_policy, escalation_policy),
    use_memory           = COALESCE(p_use_memory, use_memory),
    use_recommendations  = COALESCE(p_use_recommendations, use_recommendations),
    use_scheduling       = COALESCE(p_use_scheduling, use_scheduling),
    allow_voice_response = COALESCE(p_allow_voice_response, allow_voice_response),
    updated_at           = now()
  WHERE tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    INSERT INTO config.ai_agent_profiles (
      tenant_id, profile_name, objective, tone, verbosity,
      escalation_policy, use_memory, use_recommendations,
      use_scheduling, allow_voice_response
    ) VALUES (
      p_tenant_id,
      COALESCE(p_profile_name, 'Agente'),
      p_objective,
      COALESCE(p_tone, 'profissional'),
      COALESCE(p_verbosity, 'moderado'),
      p_escalation_policy,
      COALESCE(p_use_memory, true),
      COALESCE(p_use_recommendations, true),
      COALESCE(p_use_scheduling, true),
      COALESCE(p_allow_voice_response, false)
    );
  END IF;
END;
$$;

-- ─── ai.ai_agents ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_get_ai_agent(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, ai
AS $$
DECLARE v_result json;
BEGIN
  SELECT row_to_json(a) INTO v_result
  FROM ai.ai_agents a
  WHERE a.tenant_id = p_tenant_id
    AND a.status = 'active'
  LIMIT 1;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_update_ai_agent(
  p_tenant_id     uuid,
  p_name          text       DEFAULT NULL,
  p_model_name    text       DEFAULT NULL,
  p_system_prompt text       DEFAULT NULL,
  p_temperature   numeric    DEFAULT NULL,
  p_max_tokens    int        DEFAULT NULL,
  p_tools_jsonb   jsonb      DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, ai
AS $$
BEGIN
  UPDATE ai.ai_agents
  SET
    name          = COALESCE(p_name, name),
    model_name    = COALESCE(p_model_name, model_name),
    system_prompt = COALESCE(p_system_prompt, system_prompt),
    temperature   = COALESCE(p_temperature, temperature),
    max_tokens    = COALESCE(p_max_tokens, max_tokens),
    tools_jsonb   = COALESCE(p_tools_jsonb, tools_jsonb),
    updated_at    = now()
  WHERE tenant_id = p_tenant_id
    AND status = 'active';
END;
$$;

-- ─── config.prompt_templates ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_list_prompt_templates(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(t) ORDER BY t.code)
    FROM config.prompt_templates t
    WHERE t.tenant_id = p_tenant_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_upsert_prompt_template(
  p_tenant_id      uuid,
  p_code           text,
  p_title          text,
  p_prompt_text    text,
  p_is_active      boolean DEFAULT true,
  p_metadata_jsonb jsonb   DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  UPDATE config.prompt_templates
  SET
    title          = p_title,
    prompt_text    = p_prompt_text,
    is_active      = p_is_active,
    metadata_jsonb = COALESCE(p_metadata_jsonb, metadata_jsonb),
    version        = version + 1,
    updated_at     = now()
  WHERE tenant_id = p_tenant_id AND code = p_code;

  IF NOT FOUND THEN
    INSERT INTO config.prompt_templates
      (tenant_id, code, title, prompt_text, version, is_active, metadata_jsonb)
    VALUES
      (p_tenant_id, p_code, p_title, p_prompt_text, 1, p_is_active, p_metadata_jsonb);
  END IF;
END;
$$;

-- ─── config.business_hours ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_get_business_hours(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(h) ORDER BY h.day_of_week)
    FROM config.business_hours h
    WHERE h.tenant_id = p_tenant_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_update_business_hours(
  p_tenant_id uuid,
  p_hours     jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
DECLARE
  v_hour jsonb;
BEGIN
  FOR v_hour IN SELECT * FROM jsonb_array_elements(p_hours)
  LOOP
    UPDATE config.business_hours
    SET
      open_time  = (v_hour->>'open_time'),
      close_time = (v_hour->>'close_time'),
      is_open    = (v_hour->>'is_open')::boolean
    WHERE tenant_id = p_tenant_id
      AND day_of_week = (v_hour->>'day_of_week')::int;

    IF NOT FOUND THEN
      INSERT INTO config.business_hours (tenant_id, day_of_week, open_time, close_time, is_open)
      VALUES (
        p_tenant_id,
        (v_hour->>'day_of_week')::int,
        (v_hour->>'open_time'),
        (v_hour->>'close_time'),
        (v_hour->>'is_open')::boolean
      );
    END IF;
  END LOOP;
END;
$$;

-- ─── config.channel_settings ──────────────────────────────────────────────────

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
  SELECT row_to_json(s) INTO v_result
  FROM config.channel_settings s
  WHERE s.tenant_id  = p_tenant_id
    AND s.channel_id = p_channel_id
  LIMIT 1;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_update_channel_settings(
  p_tenant_id           uuid,
  p_channel_id          uuid,
  p_welcome_message     text    DEFAULT NULL,
  p_out_of_hours_message text   DEFAULT NULL,
  p_handoff_message     text    DEFAULT NULL,
  p_buffer_active       boolean DEFAULT NULL,
  p_typing_simulation   boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  UPDATE config.channel_settings
  SET
    welcome_message      = COALESCE(p_welcome_message,      welcome_message),
    out_of_hours_message = COALESCE(p_out_of_hours_message, out_of_hours_message),
    handoff_message      = COALESCE(p_handoff_message,      handoff_message),
    buffer_active        = COALESCE(p_buffer_active,        buffer_active),
    typing_simulation    = COALESCE(p_typing_simulation,    typing_simulation),
    updated_at           = now()
  WHERE tenant_id  = p_tenant_id
    AND channel_id = p_channel_id;

  IF NOT FOUND THEN
    INSERT INTO config.channel_settings
      (tenant_id, channel_id, welcome_message, out_of_hours_message, handoff_message,
       buffer_active, typing_simulation)
    VALUES
      (p_tenant_id, p_channel_id,
       p_welcome_message, p_out_of_hours_message, p_handoff_message,
       COALESCE(p_buffer_active, true), COALESCE(p_typing_simulation, true));
  END IF;
END;
$$;

-- ─── config.tenant_settings ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_get_tenant_settings(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
DECLARE v_result json;
BEGIN
  SELECT row_to_json(s) INTO v_result
  FROM config.tenant_settings s
  WHERE s.tenant_id = p_tenant_id
  LIMIT 1;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_update_tenant_settings(
  p_tenant_id                 uuid,
  p_business_name             text    DEFAULT NULL,
  p_timezone                  text    DEFAULT NULL,
  p_language                  text    DEFAULT NULL,
  p_intake_mode               text    DEFAULT NULL,
  p_allow_audio               boolean DEFAULT NULL,
  p_allow_image               boolean DEFAULT NULL,
  p_allow_voice               boolean DEFAULT NULL,
  p_human_approval_high_risk  boolean DEFAULT NULL,
  p_auto_create_customer      boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  UPDATE config.tenant_settings
  SET
    business_name            = COALESCE(p_business_name, business_name),
    timezone                 = COALESCE(p_timezone, timezone),
    language                 = COALESCE(p_language, language),
    intake_mode              = COALESCE(p_intake_mode, intake_mode),
    allow_audio              = COALESCE(p_allow_audio, allow_audio),
    allow_image              = COALESCE(p_allow_image, allow_image),
    allow_voice              = COALESCE(p_allow_voice, allow_voice),
    human_approval_high_risk = COALESCE(p_human_approval_high_risk, human_approval_high_risk),
    auto_create_customer     = COALESCE(p_auto_create_customer, auto_create_customer),
    updated_at               = now()
  WHERE tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    INSERT INTO config.tenant_settings
      (tenant_id, business_name, timezone, language, intake_mode,
       allow_audio, allow_image, allow_voice, human_approval_high_risk, auto_create_customer)
    VALUES
      (p_tenant_id,
       COALESCE(p_business_name, 'Meu Negócio'),
       COALESCE(p_timezone, 'America/Sao_Paulo'),
       COALESCE(p_language, 'pt-BR'),
       COALESCE(p_intake_mode, 'bot_first'),
       COALESCE(p_allow_audio, true),
       COALESCE(p_allow_image, true),
       COALESCE(p_allow_voice, false),
       COALESCE(p_human_approval_high_risk, true),
       COALESCE(p_auto_create_customer, true));
  END IF;
END;
$$;

-- ─── config.handoff_rules ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_list_handoff_rules(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(r) ORDER BY r.rule_name)
    FROM config.handoff_rules r
    WHERE r.tenant_id = p_tenant_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_upsert_handoff_rule(
  p_tenant_id            uuid,
  p_id                   uuid    DEFAULT NULL,
  p_rule_name            text    DEFAULT NULL,
  p_trigger_type         text    DEFAULT NULL,
  p_trigger_config_jsonb jsonb   DEFAULT '{}',
  p_target_role          text    DEFAULT 'agent',
  p_is_active            boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE config.handoff_rules
    SET
      rule_name            = COALESCE(p_rule_name, rule_name),
      trigger_type         = COALESCE(p_trigger_type, trigger_type),
      trigger_config_jsonb = COALESCE(p_trigger_config_jsonb, trigger_config_jsonb),
      target_role          = COALESCE(p_target_role, target_role),
      is_active            = COALESCE(p_is_active, is_active),
      updated_at           = now()
    WHERE id = p_id AND tenant_id = p_tenant_id;
  ELSE
    INSERT INTO config.handoff_rules
      (tenant_id, rule_name, trigger_type, trigger_config_jsonb, target_role, is_active)
    VALUES
      (p_tenant_id, p_rule_name, p_trigger_type, p_trigger_config_jsonb, p_target_role, p_is_active);
  END IF;
END;
$$;

-- ─── config.sla_rules ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_list_sla_rules(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(r) ORDER BY r.priority)
    FROM config.sla_rules r
    WHERE r.tenant_id = p_tenant_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_upsert_sla_rule(
  p_tenant_id              uuid,
  p_id                     uuid    DEFAULT NULL,
  p_priority               text    DEFAULT NULL,
  p_first_response_seconds int     DEFAULT NULL,
  p_resolution_seconds     int     DEFAULT NULL,
  p_business_hours_only    boolean DEFAULT true,
  p_is_active              boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE config.sla_rules
    SET
      priority               = COALESCE(p_priority, priority),
      first_response_seconds = COALESCE(p_first_response_seconds, first_response_seconds),
      resolution_seconds     = COALESCE(p_resolution_seconds, resolution_seconds),
      business_hours_only    = COALESCE(p_business_hours_only, business_hours_only),
      is_active              = COALESCE(p_is_active, is_active)
    WHERE id = p_id AND tenant_id = p_tenant_id;
  ELSE
    INSERT INTO config.sla_rules
      (tenant_id, priority, first_response_seconds, resolution_seconds, business_hours_only, is_active)
    VALUES
      (p_tenant_id, p_priority, p_first_response_seconds, p_resolution_seconds, p_business_hours_only, p_is_active);
  END IF;
END;
$$;

-- ─── config.feature_flags ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_list_feature_flags(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(f) ORDER BY f.code)
    FROM config.feature_flags f
    WHERE f.tenant_id = p_tenant_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_update_feature_flag(
  p_tenant_id    uuid,
  p_code         text,
  p_is_enabled   boolean,
  p_config_jsonb jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  UPDATE config.feature_flags
  SET
    is_enabled   = p_is_enabled,
    config_jsonb = COALESCE(p_config_jsonb, config_jsonb),
    updated_at   = now()
  WHERE tenant_id = p_tenant_id AND code = p_code;

  IF NOT FOUND THEN
    INSERT INTO config.feature_flags (tenant_id, code, is_enabled, config_jsonb)
    VALUES (p_tenant_id, p_code, p_is_enabled, p_config_jsonb);
  END IF;
END;
$$;

-- ─── ai.voice_profiles ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_list_voice_profiles(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, ai
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(v) ORDER BY v.is_default DESC, v.name)
    FROM ai.voice_profiles v
    WHERE v.tenant_id = p_tenant_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_upsert_voice_profile(
  p_tenant_id        uuid,
  p_id               uuid    DEFAULT NULL,
  p_name             text    DEFAULT NULL,
  p_provider         text    DEFAULT 'elevenlabs',
  p_voice_external_id text   DEFAULT NULL,
  p_language_code    text    DEFAULT 'pt-BR',
  p_gender           text    DEFAULT 'female',
  p_settings_jsonb   jsonb   DEFAULT NULL,
  p_is_default       boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, ai
AS $$
BEGIN
  -- If setting as default, unset others first
  IF p_is_default THEN
    UPDATE ai.voice_profiles SET is_default = false WHERE tenant_id = p_tenant_id;
  END IF;

  IF p_id IS NOT NULL THEN
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
    INSERT INTO ai.voice_profiles
      (tenant_id, name, provider, voice_external_id, language_code, gender, settings_jsonb, is_default)
    VALUES
      (p_tenant_id, p_name, p_provider, p_voice_external_id, p_language_code, p_gender, p_settings_jsonb, p_is_default);
  END IF;
END;
$$;

-- ─── GRANTs ───────────────────────────────────────────────────────────────────

DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'rpc_get_ai_agent_profile(uuid)',
    'rpc_update_ai_agent_profile(uuid,text,text,text,text,text,boolean,boolean,boolean,boolean)',
    'rpc_get_ai_agent(uuid)',
    'rpc_update_ai_agent(uuid,text,text,text,numeric,int,jsonb)',
    'rpc_list_prompt_templates(uuid)',
    'rpc_upsert_prompt_template(uuid,text,text,text,boolean,jsonb)',
    'rpc_get_business_hours(uuid)',
    'rpc_update_business_hours(uuid,jsonb)',
    'rpc_get_channel_settings(uuid,uuid)',
    'rpc_update_channel_settings(uuid,uuid,text,text,text,boolean,boolean)',
    'rpc_get_tenant_settings(uuid)',
    'rpc_update_tenant_settings(uuid,text,text,text,text,boolean,boolean,boolean,boolean,boolean)',
    'rpc_list_handoff_rules(uuid)',
    'rpc_upsert_handoff_rule(uuid,uuid,text,text,jsonb,text,boolean)',
    'rpc_list_sla_rules(uuid)',
    'rpc_upsert_sla_rule(uuid,uuid,text,int,int,boolean,boolean)',
    'rpc_list_feature_flags(uuid)',
    'rpc_update_feature_flag(uuid,text,boolean,jsonb)',
    'rpc_list_voice_profiles(uuid)',
    'rpc_upsert_voice_profile(uuid,uuid,text,text,text,text,text,jsonb,boolean)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon, authenticated, service_role', fn);
  END LOOP;
END;
$$;
