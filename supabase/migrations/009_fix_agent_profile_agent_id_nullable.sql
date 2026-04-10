-- ============================================================
-- Migration 009: agent_id nullable em config.ai_agent_profiles
-- ============================================================

ALTER TABLE config.ai_agent_profiles ALTER COLUMN agent_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.rpc_update_ai_agent_profile(
  p_tenant_id            uuid,
  p_profile_name         text,
  p_objective            text    DEFAULT NULL,
  p_tone                 text    DEFAULT NULL,
  p_verbosity            text    DEFAULT NULL,
  p_escalation_policy    text    DEFAULT NULL,
  p_use_memory           boolean DEFAULT NULL,
  p_use_recommendations  boolean DEFAULT NULL,
  p_use_scheduling       boolean DEFAULT NULL,
  p_allow_voice_response boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config, ai
AS $$
BEGIN
  UPDATE config.ai_agent_profiles
  SET
    profile_name         = COALESCE(p_profile_name,         profile_name),
    objective            = COALESCE(p_objective,            objective),
    tone                 = COALESCE(p_tone,                 tone),
    verbosity            = COALESCE(p_verbosity,            verbosity),
    escalation_policy    = COALESCE(p_escalation_policy,    escalation_policy),
    use_memory           = COALESCE(p_use_memory,           use_memory),
    use_recommendations  = COALESCE(p_use_recommendations,  use_recommendations),
    use_scheduling       = COALESCE(p_use_scheduling,       use_scheduling),
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
      COALESCE(p_profile_name,         'Agente'),
      p_objective,
      COALESCE(p_tone,                 'profissional'),
      COALESCE(p_verbosity,            'moderado'),
      p_escalation_policy,
      COALESCE(p_use_memory,           true),
      COALESCE(p_use_recommendations,  true),
      COALESCE(p_use_scheduling,       true),
      COALESCE(p_allow_voice_response, false)
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_update_ai_agent_profile(uuid,text,text,text,text,text,boolean,boolean,boolean,boolean)
  TO anon, authenticated, service_role;
