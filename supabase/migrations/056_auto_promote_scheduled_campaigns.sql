-- ============================================================
-- Migration 056: Auto-promoção de campanhas agendadas
--
-- rpc_list_running_campaigns passa a incluir campanhas com
-- status='scheduled' cujo scheduled_at já chegou (<=NOW()).
-- O n8n cron a cada 10min as promove para 'running' e dispara.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_list_running_campaigns(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, messaging, crm
AS $$
BEGIN
  -- Promove campanhas agendadas cujo horário já chegou
  UPDATE public.campaigns
  SET status = 'running', updated_at = now()
  WHERE tenant_id  = p_tenant_id
    AND status     = 'scheduled'
    AND scheduled_at <= NOW();

  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
    FROM (
      SELECT
        c.id             AS campaign_id,
        c.tenant_id,
        c.name,
        c.status,
        c.target_count,
        c.sent_count,
        c.scheduled_at,
        -- Corpo da mensagem do template
        COALESCE(
          (SELECT comp->>'text'
           FROM jsonb_array_elements(t.components::jsonb) comp
           WHERE comp->>'type' = 'BODY'
           LIMIT 1),
          ''
        )                AS template_body,
        -- Destinatários: todos os clientes ativos do tenant com telefone
        (
          SELECT COALESCE(json_agg(json_build_object(
            'customer_id', cu.id,
            'phone',       cu.phone,
            'name',        cu.full_name
          )), '[]'::json)
          FROM crm.customers cu
          WHERE cu.tenant_id = c.tenant_id
            AND cu.phone IS NOT NULL
            AND cu.status::text IN ('active','lead')
        )                AS recipients
      FROM public.campaigns c
      LEFT JOIN public.message_templates t ON t.id = c.template_id
      WHERE c.tenant_id = p_tenant_id
        AND c.status    = 'running'
    ) r
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_list_running_campaigns(uuid)
  TO anon, authenticated, service_role;
