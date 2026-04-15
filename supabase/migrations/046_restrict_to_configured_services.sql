-- ============================================================
-- Migration 046: restrict_to_configured_services
--
-- Adds a per-tenant toggle that controls whether the AI is
-- restricted to only discuss services registered in the database.
--
-- When ON  → AI may rephrase/explain configured services freely,
--            but cannot introduce services not in the list.
-- When OFF → AI may use external knowledge to complement answers,
--            while still preferring configured services.
--
-- Changes:
--   1. New column on config.ai_agent_profiles
--   2. rpc_update_ai_agent_profile accepts the new param
--   3. rpc_get_ai_agent joins ai_agent_profiles to expose the flag to n8n
-- ============================================================

-- ── 1. Add column ────────────────────────────────────────────────────────────
ALTER TABLE config.ai_agent_profiles
  ADD COLUMN IF NOT EXISTS restrict_to_configured_services boolean NOT NULL DEFAULT false;

-- ── 2. Update rpc_update_ai_agent_profile ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_update_ai_agent_profile(
  p_tenant_id                        uuid,
  p_profile_name                     text,
  p_objective                        text    DEFAULT NULL,
  p_tone                             text    DEFAULT NULL,
  p_verbosity                        text    DEFAULT NULL,
  p_escalation_policy                text    DEFAULT NULL,
  p_use_memory                       boolean DEFAULT NULL,
  p_use_recommendations              boolean DEFAULT NULL,
  p_use_scheduling                   boolean DEFAULT NULL,
  p_allow_voice_response             boolean DEFAULT NULL,
  p_restrict_to_configured_services  boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config, ai
AS $$
BEGIN
  UPDATE config.ai_agent_profiles
  SET
    profile_name                    = COALESCE(p_profile_name,                    profile_name),
    objective                       = COALESCE(p_objective,                       objective),
    tone                            = COALESCE(p_tone,                            tone),
    verbosity                       = COALESCE(p_verbosity,                       verbosity),
    escalation_policy               = COALESCE(p_escalation_policy,               escalation_policy),
    use_memory                      = COALESCE(p_use_memory,                      use_memory),
    use_recommendations             = COALESCE(p_use_recommendations,             use_recommendations),
    use_scheduling                  = COALESCE(p_use_scheduling,                  use_scheduling),
    allow_voice_response            = COALESCE(p_allow_voice_response,            allow_voice_response),
    restrict_to_configured_services = COALESCE(p_restrict_to_configured_services, restrict_to_configured_services),
    updated_at                      = now()
  WHERE tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    INSERT INTO config.ai_agent_profiles (
      tenant_id, profile_name, objective, tone, verbosity,
      escalation_policy, use_memory, use_recommendations,
      use_scheduling, allow_voice_response, restrict_to_configured_services
    ) VALUES (
      p_tenant_id,
      COALESCE(p_profile_name,         'Agente'),
      p_objective,
      COALESCE(p_tone,                 'profissional'),
      COALESCE(p_verbosity,            'moderado'),
      p_escalation_policy,
      COALESCE(p_use_memory,           true),
      COALESCE(p_use_recommendations,  true),
      COALESCE(p_use_scheduling,       true),
      COALESCE(p_allow_voice_response, false),
      COALESCE(p_restrict_to_configured_services, false)
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_update_ai_agent_profile(uuid,text,text,text,text,text,boolean,boolean,boolean,boolean,boolean)
  TO anon, authenticated, service_role;

-- ── 3. Update rpc_get_ai_agent to expose the flag to n8n ─────────────────────
-- Joins ai.ai_agents with config.ai_agent_profiles so the workflow
-- gets restrict_to_configured_services alongside system_prompt.
CREATE OR REPLACE FUNCTION public.rpc_get_ai_agent(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, ai, config
AS $$
DECLARE v_result json;
BEGIN
  SELECT json_build_object(
    'id',                              a.id,
    'tenant_id',                       a.tenant_id,
    'name',                            a.name,
    'status',                          a.status,
    'model_name',                      a.model_name,
    'system_prompt',                   a.system_prompt,
    'temperature',                     a.temperature,
    'max_tokens',                      a.max_tokens,
    'tools_jsonb',                     a.tools_jsonb,
    'updated_at',                      a.updated_at,
    'restrict_to_configured_services', COALESCE(p.restrict_to_configured_services, false)
  ) INTO v_result
  FROM ai.ai_agents a
  LEFT JOIN config.ai_agent_profiles p ON p.tenant_id = a.tenant_id
  WHERE a.tenant_id = p_tenant_id
    AND a.status    = 'active'
  LIMIT 1;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_ai_agent(uuid)
  TO anon, authenticated, service_role;
