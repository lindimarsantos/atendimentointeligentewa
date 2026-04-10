-- ============================================================
-- Migration 017: Adiciona template_type (zapi | official)
-- Templates Z-API são auto-aprovados; official requerem aprovação Meta
-- ============================================================

-- ── rpc_upsert_message_template (v2) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_upsert_message_template(
  p_tenant_id     uuid,
  p_id            uuid    DEFAULT NULL,
  p_name          text    DEFAULT NULL,
  p_category      text    DEFAULT 'utility',
  p_language      text    DEFAULT 'pt_BR',
  p_components    jsonb   DEFAULT '[]',
  p_status        text    DEFAULT NULL,
  p_template_type text    DEFAULT 'official'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
DECLARE
  v_header   text;
  v_body     text;
  v_footer   text;
  v_code     text;
  v_status   text;
BEGIN
  -- Extrair partes dos componentes
  SELECT elem->>'text' INTO v_header
  FROM jsonb_array_elements(p_components) elem
  WHERE elem->>'type' = 'HEADER' LIMIT 1;

  SELECT elem->>'text' INTO v_body
  FROM jsonb_array_elements(p_components) elem
  WHERE elem->>'type' = 'BODY' LIMIT 1;

  SELECT elem->>'text' INTO v_footer
  FROM jsonb_array_elements(p_components) elem
  WHERE elem->>'type' = 'FOOTER' LIMIT 1;

  -- Z-API templates são auto-aprovados
  v_status := COALESCE(
    p_status,
    CASE WHEN p_template_type = 'zapi' THEN 'approved' ELSE 'pending' END
  );

  v_code := lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '_', 'g'));

  IF p_id IS NOT NULL THEN
    UPDATE config.whatsapp_templates SET
      name           = COALESCE(p_name,     name),
      category       = COALESCE(p_category, category),
      language_code  = COALESCE(p_language, language_code),
      header_text    = v_header,
      body_text      = COALESCE(v_body,     body_text),
      footer_text    = v_footer,
      is_active      = (v_status = 'approved'),
      metadata_jsonb = jsonb_set(
                         jsonb_set(
                           COALESCE(metadata_jsonb, '{}'::jsonb),
                           '{status}',
                           to_jsonb(v_status)
                         ),
                         '{template_type}',
                         to_jsonb(p_template_type)
                       ),
      updated_at     = now()
    WHERE id = p_id AND tenant_id = p_tenant_id;
  ELSE
    INSERT INTO config.whatsapp_templates
      (tenant_id, code, name, category, language_code,
       header_text, body_text, footer_text,
       is_active, metadata_jsonb)
    VALUES
      (p_tenant_id, v_code, p_name, p_category, p_language,
       v_header, COALESCE(v_body, ''), v_footer,
       (v_status = 'approved'),
       jsonb_build_object('status', v_status, 'template_type', p_template_type));
  END IF;
END;
$$;

-- ── rpc_list_message_templates (v2) — expõe template_type ────────────────────
CREATE OR REPLACE FUNCTION public.rpc_list_message_templates(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(t) ORDER BY t.name)
    FROM (
      SELECT
        id,
        tenant_id,
        name,
        category,
        language_code AS language,
        COALESCE(metadata_jsonb->>'status', 'pending')        AS status,
        COALESCE(metadata_jsonb->>'template_type', 'official') AS template_type,
        (
          COALESCE(
            CASE WHEN header_text IS NOT NULL AND header_text <> ''
              THEN jsonb_build_array(jsonb_build_object('type','HEADER','format','TEXT','text', header_text))
              ELSE '[]'::jsonb END,
            '[]'::jsonb
          )
          ||
          jsonb_build_array(jsonb_build_object('type','BODY','text', body_text))
          ||
          COALESCE(
            CASE WHEN footer_text IS NOT NULL AND footer_text <> ''
              THEN jsonb_build_array(jsonb_build_object('type','FOOTER','text', footer_text))
              ELSE '[]'::jsonb END,
            '[]'::jsonb
          )
        ) AS components,
        created_at,
        updated_at
      FROM config.whatsapp_templates
      WHERE tenant_id = p_tenant_id
    ) t
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_upsert_message_template(uuid,uuid,text,text,text,jsonb,text,text)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.rpc_list_message_templates(uuid)
  TO anon, authenticated, service_role;
