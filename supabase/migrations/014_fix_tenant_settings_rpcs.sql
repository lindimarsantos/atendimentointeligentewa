-- ============================================================
-- Migration 014: Corrige RPCs de tenant_settings
-- Colunas reais diferem dos aliases usados nos RPCs originais
-- ============================================================

-- ── 1. GET com aliases corretos ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_get_tenant_settings(p_tenant_id uuid)
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
      id, tenant_id,
      business_name,
      whatsapp_display_name,
      default_timezone              AS timezone,
      language_code                 AS language,
      currency_code,
      intake_mode,
      allow_audio_input             AS allow_audio,
      allow_image_input             AS allow_image,
      allow_video_input             AS allow_video,
      allow_voice_output            AS allow_voice,
      require_human_approval_for_high_risk  AS human_approval_high_risk,
      auto_create_customer_on_first_contact AS auto_create_customer,
      auto_create_lead_source_if_missing,
      settings_jsonb,
      updated_at
    FROM config.tenant_settings
    WHERE tenant_id = p_tenant_id
    LIMIT 1
  ) t;
  RETURN v_result;
END;
$$;

-- ── 2. UPDATE com nomes de coluna corretos ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_update_tenant_settings(
  p_tenant_id                uuid,
  p_business_name            text    DEFAULT NULL,
  p_whatsapp_display_name    text    DEFAULT NULL,
  p_timezone                 text    DEFAULT NULL,
  p_language                 text    DEFAULT NULL,
  p_intake_mode              text    DEFAULT NULL,
  p_allow_audio              boolean DEFAULT NULL,
  p_allow_image              boolean DEFAULT NULL,
  p_allow_video              boolean DEFAULT NULL,
  p_allow_voice              boolean DEFAULT NULL,
  p_human_approval_high_risk boolean DEFAULT NULL,
  p_auto_create_customer     boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, config
AS $$
BEGIN
  UPDATE config.tenant_settings
  SET
    business_name                         = COALESCE(p_business_name,            business_name),
    whatsapp_display_name                 = COALESCE(p_whatsapp_display_name,    whatsapp_display_name),
    default_timezone                      = COALESCE(p_timezone,                 default_timezone),
    language_code                         = COALESCE(p_language,                 language_code),
    intake_mode                           = COALESCE(p_intake_mode,              intake_mode),
    allow_audio_input                     = COALESCE(p_allow_audio,              allow_audio_input),
    allow_image_input                     = COALESCE(p_allow_image,              allow_image_input),
    allow_video_input                     = COALESCE(p_allow_video,              allow_video_input),
    allow_voice_output                    = COALESCE(p_allow_voice,              allow_voice_output),
    require_human_approval_for_high_risk  = COALESCE(p_human_approval_high_risk, require_human_approval_for_high_risk),
    auto_create_customer_on_first_contact = COALESCE(p_auto_create_customer,     auto_create_customer_on_first_contact),
    updated_at                            = now()
  WHERE tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    INSERT INTO config.tenant_settings
      (tenant_id, business_name, whatsapp_display_name, default_timezone,
       language_code, intake_mode, allow_audio_input, allow_image_input,
       allow_video_input, allow_voice_output,
       require_human_approval_for_high_risk,
       auto_create_customer_on_first_contact)
    VALUES
      (p_tenant_id,
       COALESCE(p_business_name,            'Meu Negócio'),
       p_whatsapp_display_name,
       COALESCE(p_timezone,                 'America/Sao_Paulo'),
       COALESCE(p_language,                 'pt-BR'),
       COALESCE(p_intake_mode,              'bot_first'),
       COALESCE(p_allow_audio,              true),
       COALESCE(p_allow_image,              true),
       COALESCE(p_allow_video,              true),
       COALESCE(p_allow_voice,              false),
       COALESCE(p_human_approval_high_risk, false),
       COALESCE(p_auto_create_customer,     true));
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_tenant_settings(uuid)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.rpc_update_tenant_settings(uuid,text,text,text,text,text,boolean,boolean,boolean,boolean,boolean,boolean)
  TO anon, authenticated, service_role;

-- ── 3. Semente do tenant inicial ─────────────────────────────────────────────
INSERT INTO config.tenant_settings (tenant_id)
VALUES ('5518085b-42e9-4608-8c56-890cef45ba9b')
ON CONFLICT DO NOTHING;
