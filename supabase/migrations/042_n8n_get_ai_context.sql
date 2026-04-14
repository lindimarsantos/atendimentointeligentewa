-- ============================================================
-- Migration 042: rpc_n8n_get_ai_context
--
-- Called by n8n ("Buscar Contexto Empresa" node) before Preparar Contexto.
-- Resolves tenant from conversation_id and returns all business data
-- formatted as a text block ready for injection into the AI system prompt.
--
-- Returns: { "ai_context_text": "## Contato e Localização\n..." }
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_n8n_get_ai_context(
  p_conversation_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config, scheduling, messaging
AS $$
DECLARE
  v_tenant_id  uuid;
  v_contact    jsonb;
  v_profile    jsonb;
  v_svc_text   text;
  v_pro_text   text;
  v_text       text := '';
BEGIN
  -- Resolve tenant
  SELECT tenant_id INTO v_tenant_id
  FROM messaging.conversations
  WHERE id = p_conversation_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN json_build_object('ai_context_text', '');
  END IF;

  -- Pull contact + profile in one query
  SELECT
    COALESCE(business_contact_jsonb, '{}'),
    COALESCE(business_profile_jsonb, '{}')
  INTO v_contact, v_profile
  FROM config.tenant_settings
  WHERE tenant_id = v_tenant_id
  LIMIT 1;

  -- ── Contato e Localização ────────────────────────────────────────────────────
  v_text := '## Contato e Localização' || E'\n';

  IF v_contact->>'address' IS NOT NULL AND trim(v_contact->>'address') <> '' THEN
    v_text := v_text || 'Endereço: '  || trim(v_contact->>'address')  || E'\n';
  END IF;
  IF v_contact->>'phone' IS NOT NULL AND trim(v_contact->>'phone') <> '' THEN
    v_text := v_text || 'Telefone: '  || trim(v_contact->>'phone')    || E'\n';
  END IF;
  IF v_contact->>'whatsapp' IS NOT NULL AND trim(v_contact->>'whatsapp') <> '' THEN
    v_text := v_text || 'WhatsApp: '  || trim(v_contact->>'whatsapp') || E'\n';
  END IF;
  IF v_contact->>'website' IS NOT NULL AND trim(v_contact->>'website') <> '' THEN
    v_text := v_text || 'Website: '   || trim(v_contact->>'website')  || E'\n';
  END IF;
  IF v_contact->>'email' IS NOT NULL AND trim(v_contact->>'email') <> '' THEN
    v_text := v_text || 'E-mail: '    || trim(v_contact->>'email')    || E'\n';
  END IF;
  IF v_contact->>'instagram' IS NOT NULL AND trim(v_contact->>'instagram') <> '' THEN
    v_text := v_text || 'Instagram: ' || trim(v_contact->>'instagram')|| E'\n';
  END IF;
  IF v_contact->>'google_maps_url' IS NOT NULL AND trim(v_contact->>'google_maps_url') <> '' THEN
    v_text := v_text || 'Google Maps: ' || trim(v_contact->>'google_maps_url') || E'\n';
  END IF;
  IF v_contact->>'business_hours' IS NOT NULL AND trim(v_contact->>'business_hours') <> '' THEN
    v_text := v_text || 'Horário de funcionamento: ' || trim(v_contact->>'business_hours') || E'\n';
  END IF;

  -- ── Serviços Disponíveis ─────────────────────────────────────────────────────
  SELECT string_agg(
    '- ' || name
    || ' (' || duration_minutes || ' min)'
    || CASE
         WHEN price_min IS NOT NULL AND price_max IS NOT NULL AND price_min <> price_max
           THEN ' | R$ ' || price_min::text || '–' || price_max::text
         WHEN price_min IS NOT NULL
           THEN ' | R$ ' || price_min::text
         ELSE ''
       END
    || CASE WHEN requires_evaluation THEN ' — requer avaliação' ELSE '' END,
    E'\n'
    ORDER BY name
  ) INTO v_svc_text
  FROM scheduling.services
  WHERE tenant_id = v_tenant_id
    AND is_active = true;

  IF v_svc_text IS NOT NULL THEN
    v_text := v_text || E'\n## Serviços Disponíveis\n' || v_svc_text || E'\n';
  END IF;

  -- ── Profissionais ────────────────────────────────────────────────────────────
  SELECT string_agg(
    '- ' || name
    || CASE WHEN specialty IS NOT NULL AND trim(specialty) <> ''
            THEN ' (' || trim(specialty) || ')' ELSE '' END,
    E'\n'
    ORDER BY name
  ) INTO v_pro_text
  FROM scheduling.professionals
  WHERE tenant_id = v_tenant_id
    AND status    = 'active';

  IF v_pro_text IS NOT NULL THEN
    v_text := v_text || E'\n## Profissionais\n' || v_pro_text || E'\n';
  END IF;

  -- ── Perfil da Empresa ────────────────────────────────────────────────────────
  IF v_profile IS NOT NULL AND v_profile <> '{}'::jsonb THEN
    v_text := v_text || E'\n## Perfil da Empresa\n';
    IF v_profile->>'sobre' IS NOT NULL AND trim(v_profile->>'sobre') <> '' THEN
      v_text := v_text || trim(v_profile->>'sobre') || E'\n';
    END IF;
    IF v_profile->>'posicionamento' IS NOT NULL AND trim(v_profile->>'posicionamento') <> '' THEN
      v_text := v_text || 'Posicionamento: ' || trim(v_profile->>'posicionamento') || E'\n';
    END IF;
    IF v_profile->>'publico_alvo' IS NOT NULL AND trim(v_profile->>'publico_alvo') <> '' THEN
      v_text := v_text || 'Público-alvo: ' || trim(v_profile->>'publico_alvo') || E'\n';
    END IF;
    IF v_profile->>'info_ia' IS NOT NULL AND trim(v_profile->>'info_ia') <> '' THEN
      v_text := v_text || 'Instruções para a IA: ' || trim(v_profile->>'info_ia') || E'\n';
    END IF;
  END IF;

  RETURN json_build_object('ai_context_text', trim(v_text));
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_n8n_get_ai_context(uuid)
  TO anon, authenticated, service_role;
