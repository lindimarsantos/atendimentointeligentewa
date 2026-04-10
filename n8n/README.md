# n8n Workflows — Atendimento Inteligente WA

## Como importar um workflow

1. Abra o n8n em `https://n8n.atividadeweb.com.br`
2. Vá em **Workflows → Import from File**
3. Selecione o arquivo `.json` da pasta `n8n/workflows/`
4. Configure as **Variables** necessárias (veja abaixo)

---

## Variáveis de ambiente (n8n Variables)

Configure em **Settings → Variables** no n8n:

| Variável                   | Valor                                              |
|----------------------------|----------------------------------------------------|
| `SUPABASE_URL`             | `https://jxqnfzujsgtzzjabvplm.supabase.co`        |
| `SUPABASE_SERVICE_ROLE_KEY`| `<service_role_key do Supabase>`                   |
| `DEFAULT_TENANT_ID`        | `5518085b-42e9-4608-8c56-890cef45ba9b`             |
| `ZAPI_BASE_URL`            | `https://api.z-api.io`                             |
| `ZAPI_INSTANCE_ID`         | `<seu instance ID da Z-API>`                       |
| `ZAPI_TOKEN`               | `<seu token da Z-API>`                             |
| `ZAPI_CLIENT_TOKEN`        | `<seu client-token da Z-API (header segurança)>`   |

---

## Workflows disponíveis

### Campaigns - Dispatcher (`campaigns-dispatcher.json`)

**Tipo:** Cron (a cada 10 minutos)

**O que faz:**
1. Busca campanhas com status `running` no banco (`rpc_list_running_campaigns`)
2. Para cada campanha, pega a lista de clientes com telefone
3. Substitui variáveis no template: `{{cliente_nome}}`, `{{cliente_primeiro_nome}}`
4. Envia para cada cliente via Z-API (`/send-text`)
5. Aguarda 1s entre envios (rate limiting)
6. Marca campanha como `completed` (`rpc_complete_campaign`)

**Como disparar uma campanha:**
- No dashboard, acesse **Campanhas**
- Clique em **Disparar** na campanha desejada
- Isso marca o status como `running`
- O workflow do n8n detecta e processa dentro de até 10 minutos

**RPCs necessárias (Migration 023):**
- `rpc_list_running_campaigns(p_tenant_id)`
- `rpc_complete_campaign(p_tenant_id, p_campaign_id, p_sent_count)`

---

## Workflows já existentes no n8n

| Workflow                         | Tipo    | URL                                                        |
|----------------------------------|---------|------------------------------------------------------------|
| WA - Inbound Intake              | Webhook | `/webhook/wa-inbound`                                      |
| WA - Decision and Buffered Reply | Webhook | `/webhook/wa-decision`                                     |
| Scheduling - Appointment Flow    | Webhook | `/webhook/scheduling-appointment-flow`                     |
| Scheduling - Reminder Worker     | Cron    | a cada 2 min                                               |
| WA - Outbound Worker             | Cron    | a cada 15s                                                  |
| **Campaigns - Dispatcher**       | **Cron**| **a cada 10 min** ← importar de `campaigns-dispatcher.json`|
