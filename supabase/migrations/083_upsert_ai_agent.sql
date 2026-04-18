-- ============================================================
-- Migration 083: Fix rpc_update_ai_agent — UPDATE → UPSERT
--
-- The function only did UPDATE, so if the tenant had no row in
-- ai.ai_agents the save silenced without error and no data was
-- written. Now it inserts a default row first if none exists.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_update_ai_agent(
  p_tenant_id    uuid,
  p_name         text    DEFAULT NULL,
  p_model_name   text    DEFAULT NULL,
  p_system_prompt text   DEFAULT NULL,
  p_temperature  numeric DEFAULT NULL,
  p_max_tokens   integer DEFAULT NULL,
  p_tools_jsonb  jsonb   DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, ai
AS $$
BEGIN
  -- Ensure a row exists for this tenant before updating
  INSERT INTO ai.ai_agents (
    tenant_id, name, model_name, system_prompt,
    temperature, max_tokens, tools_jsonb, status
  )
  VALUES (
    p_tenant_id,
    COALESCE(p_name,          'Agente IA'),
    COALESCE(p_model_name,    'claude-sonnet-4-6'),
    COALESCE(p_system_prompt, ''),
    COALESCE(p_temperature,   0.7),
    COALESCE(p_max_tokens,    1024),
    COALESCE(p_tools_jsonb,   '[]'::jsonb),
    'active'
  )
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Apply the partial update (COALESCE keeps existing values when param is NULL)
  UPDATE ai.ai_agents
  SET
    name          = COALESCE(p_name,          name),
    model_name    = COALESCE(p_model_name,    model_name),
    system_prompt = COALESCE(p_system_prompt, system_prompt),
    temperature   = COALESCE(p_temperature,   temperature),
    max_tokens    = COALESCE(p_max_tokens,    max_tokens),
    tools_jsonb   = COALESCE(p_tools_jsonb,   tools_jsonb),
    updated_at    = now()
  WHERE tenant_id = p_tenant_id
    AND status    = 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_update_ai_agent(uuid, text, text, text, numeric, integer, jsonb)
  TO anon, authenticated, service_role;
