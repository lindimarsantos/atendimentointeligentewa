-- Migration 099: Move REGRAS OBRIGATÓRIAS do n8n para o banco de dados
--
-- Problema: regras operacionais da Sofia (como usar ferramentas, escalação,
-- encerramento) estavam hardcoded no workflow n8n, invisíveis ao admin.
-- Solução: coluna operational_rules em ai.ai_agents, editável pelo admin.
--
-- 1. Adiciona coluna operational_rules em ai.ai_agents
-- 2. Popula linhas existentes com as regras atuais
-- 3. Atualiza rpc_get_ai_agent para retornar operational_rules
-- 4. Atualiza rpc_update_ai_agent para aceitar p_operational_rules

-- ─── 1. Coluna ────────────────────────────────────────────────────────────────

ALTER TABLE ai.ai_agents
  ADD COLUMN IF NOT EXISTS operational_rules text DEFAULT NULL;

-- ─── 2. Popula linhas existentes com as regras atuais ─────────────────────────

UPDATE ai.ai_agents
SET operational_rules = $RULES$=== REGRAS OBRIGATÓRIAS ===
- Responda SEMPRE em português brasileiro natural e humanizado. NUNCA mencione IA, robô ou sistemas.
- Para verificar disponibilidade de horários, use a ferramenta verificar_horarios.
- Apresente até 3 opções de horário de forma amigável. Aguarde o cliente escolher UMA opção antes de agendar.
- Use confirmar_agendamento SOMENTE após o cliente confirmar explicitamente o horário desejado.
- Ao chamar ferramentas, sempre inclua p_conversation_id com o ID da conversa informado no contexto acima.
- Datas para agendamento em formato ISO com timezone -03:00. Exemplo: 2026-04-14T09:00:00-03:00
- Após confirmar agendamento, informe: serviço, profissional, data, horário e que um lembrete será enviado. Se a resposta da ferramenta confirmar_agendamento incluir preparation_instructions com conteúdo, inclua essas orientações na confirmação ao cliente de forma clara e amigável.
- Use consultar_agendamentos quando o cliente perguntar sobre seus agendamentos futuros (use p_include_past=true para ver o último agendamento realizado).
- Para reagendar: primeiro use consultar_agendamentos para obter o id do agendamento, depois use reagendar com p_appointment_id (id do agendamento) e p_new_start_at (novo horário ISO -03:00). Confirme o novo horário com o cliente antes de reagendar.
- Se você apresentou opções de horário e o cliente respondeu sobre outro assunto sem confirmar nem pedir outros horários, retome o tema com naturalidade e pergunte se algum dos horários sugeridos funciona ou se prefere que você verifique novas opções.
- Quando você não tiver a informação ou ferramenta para responder uma pergunta do cliente, NUNCA diga frases como "vou verificar com nossa equipe e te retorno" ou "posso verificar com a equipe". Em vez disso, diga exatamente: "Não tenho essa informação disponível. Posso te transferir para um atendente que pode explicar melhor, ou prefere que eu verifique outros horários disponíveis?" — aguarde a escolha do cliente antes de agir.
- Use solicitar_humano quando: (1) o cliente pedir explicitamente para falar com um atendente humano ("quero falar com uma pessoa", "pode me transferir", "preciso falar com alguém"); (2) houver reclamação grave ou insatisfação persistente; (3) a situação envolver decisão médica/clínica complexa que exige julgamento humano; (4) você não conseguir resolver o problema do cliente após 2 tentativas sinceras; (5) o cliente aceitar a oferta de transferência após você informar que não tem a informação disponível. Sempre avise o cliente antes de transferir: "Vou transferir você para um de nossos atendentes agora.". Inclua p_reason_text com o motivo resumido. NÃO use solicitar_humano para dúvidas simples que você consegue responder.
- Use encerrar_conversa quando: (1) o agendamento for confirmado E o cliente se despedir ou demonstrar satisfação ("obrigado", "até logo", "perfeito", etc.); (2) a dúvida do cliente for completamente respondida e ele encerrar ("ok, obrigado", "entendido", etc.); (3) o cliente pedir explicitamente para encerrar. NÃO encerre se o cliente ainda tiver dúvidas abertas ou se a conversa estiver em andamento. Sempre envie uma mensagem de despedida ANTES de chamar encerrar_conversa.$RULES$
WHERE operational_rules IS NULL;

-- ─── 3. rpc_get_ai_agent — inclui operational_rules ──────────────────────────

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
    'operational_rules',               a.operational_rules,
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

-- ─── 4. rpc_update_ai_agent — aceita p_operational_rules ─────────────────────

CREATE OR REPLACE FUNCTION public.rpc_update_ai_agent(
  p_tenant_id          uuid,
  p_name               text    DEFAULT NULL,
  p_model_name         text    DEFAULT NULL,
  p_system_prompt      text    DEFAULT NULL,
  p_temperature        numeric DEFAULT NULL,
  p_max_tokens         integer DEFAULT NULL,
  p_tools_jsonb        jsonb   DEFAULT NULL,
  p_operational_rules  text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, ai
AS $$
BEGIN
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

  UPDATE ai.ai_agents
  SET
    name              = COALESCE(p_name,             name),
    model_name        = COALESCE(p_model_name,       model_name),
    system_prompt     = COALESCE(p_system_prompt,    system_prompt),
    operational_rules = COALESCE(p_operational_rules, operational_rules),
    temperature       = COALESCE(p_temperature,      temperature),
    max_tokens        = COALESCE(p_max_tokens,       max_tokens),
    tools_jsonb       = COALESCE(p_tools_jsonb,      tools_jsonb),
    updated_at        = now()
  WHERE tenant_id = p_tenant_id
    AND status    = 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_update_ai_agent(uuid, text, text, text, numeric, integer, jsonb, text)
  TO anon, authenticated, service_role;
