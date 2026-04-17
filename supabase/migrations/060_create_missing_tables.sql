-- ============================================================
-- Migration 060: Cria tabelas que estavam ausentes no DB
--
-- config.whatsapp_templates  — templates de mensagem WhatsApp
-- messaging.campaigns        — campanhas de envio em massa
--
-- Usar CREATE TABLE IF NOT EXISTS: seguro para ambientes onde
-- as tabelas já existem (criadas manualmente via Studio).
-- ============================================================

-- ── Garantir que os schemas existem ──────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS config;
CREATE SCHEMA IF NOT EXISTS messaging;

-- ── config.whatsapp_templates ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS config.whatsapp_templates (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL,
  code           text        NOT NULL,
  name           text        NOT NULL,
  category       text        NOT NULL DEFAULT 'utility',
  language_code  text        NOT NULL DEFAULT 'pt_BR',
  header_text    text,
  body_text      text        NOT NULL DEFAULT '',
  footer_text    text,
  is_active      boolean     NOT NULL DEFAULT false,
  metadata_jsonb jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ── messaging.campaigns ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messaging.campaigns (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL,
  name         text        NOT NULL,
  template_id  uuid,
  target_count int,
  sent_count   int         NOT NULL DEFAULT 0,
  scheduled_at timestamptz,
  status       text        NOT NULL DEFAULT 'draft',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Índices ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS whatsapp_templates_tenant_idx
  ON config.whatsapp_templates (tenant_id);

CREATE INDEX IF NOT EXISTS campaigns_tenant_idx
  ON messaging.campaigns (tenant_id);

CREATE INDEX IF NOT EXISTS campaigns_status_idx
  ON messaging.campaigns (tenant_id, status);

-- ── Row Level Security (desabilitado — acesso via SECURITY DEFINER RPCs) ──────

ALTER TABLE config.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging.campaigns       ENABLE ROW LEVEL SECURITY;

-- Política permissiva para service_role (usado pelos RPCs SECURITY DEFINER)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'config' AND tablename = 'whatsapp_templates' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON config.whatsapp_templates
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'messaging' AND tablename = 'campaigns' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON messaging.campaigns
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END;
$$;
