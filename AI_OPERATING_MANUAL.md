# AI Operating Manual — Atendimento Inteligente WA

> Versão: 1.1 | Atualizado: 2026-04-09

---

## 1. Visão Geral da Plataforma

Sistema de atendimento via WhatsApp com IA, configurável sem código.
Permite que empresas criem agentes inteligentes com personalidade, prompts,
regras e voz customizados.

**URL de produção:** `atendimentointeligentewa.vercel.app`

---

## 2. Stack Técnica

| Camada     | Tecnologia                                          |
|------------|-----------------------------------------------------|
| Frontend   | Next.js 14 (App Router) + TypeScript                |
| Estilo     | Tailwind CSS + componentes UI em `src/components/ui/` |
| Backend/DB | Supabase — schemas `config.*` e `ai.*`              |
| API layer  | RPCs públicos (SECURITY DEFINER) em `public.*`      |
| IA         | Anthropic Claude (padrão: claude-sonnet-4-20250514) |
| Voz        | ElevenLabs API                                      |
| Deploy     | Vercel                                              |

---

## 3. Arquitetura de Dados

### Schemas Supabase

| Schema   | Contúhdo                                               |
|----------|--------------------------------------------------------|
| `config` | Configurações do tenant (perfil IA, horários, canal...) |
| `ai`     | Agentes IA, voice profiles, modelos                    |
| `public` | RPCs expostos — toda escrita/leitura passa por aqui    |

### Acesso a dados

**NUNCA** acessar tabelas diretamente. Sempre usar as funções em `src/lib/api.ts`
que chamam RPCs via `supabase.rpc('nome_rpc', { p_tenant_id: TENANT_ID, ... })`.

### IDs de ambiente (homologação)

```ts
TENANT_ID  = '5518085b-42e9-4608-8c56-890cef45ba9b'
CHANNEL_ID = '58c4062a-9fe9-4ae2-abff-5a8b5236a79e'
```

Definidos em `src/lib/supabase.ts` (override via env vars `NEXT_PUBLIC_TENANT_ID` / `NEXT_PUBLIC_CHANNEL_ID`).

---

## 4. Estrutura de Arquivos

```
src/
├── app/
│   ├── configuracoes/page.tsx     ← página de configurações (tabs)
│   ├── atendimento/page.tsx
│   ├── clientes/page.tsx
│   ├── agenda/page.tsx
│   └── ...demais rotas
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── DashboardLayout.tsx
│   ├── modules/
│   │   ├── Configuracoes/         ← 7 tabs de configuração
│   │   ├── Atendimento/
│   │   └── Observabilidade/
│   └── ui/                        ← biblioteca UI compartilhada
├── lib/
│   ├── api.ts                     ← TODAS as chamadas ao Supabase
│   ├── supabase.ts                ← client + TENANT_ID + CHANNEL_ID
│   └── utils.ts
└── types/
    └── index.ts                   ← todos os tipos TypeScript
```

---

## 5. Módulo 10: Configurações de IA (já implementado)

### Componentes (`src/components/modules/Configuracoes/`)

| Arquivo                 | Tab na UI                   | Estado             |
|-------------------------|-----------------------------|--------------------|
| `PerfilAgente.tsx`      | Perfil do Agente            | ✅ Funcional        |
| `PromptModelo.tsx`      | Prompt e Modelo             | ✅ Funcional        |
| `DadosNegocio.tsx`      | Dados do Negócio            | ✅ Read-only (links)|
| `MensagensCanal.tsx`    | Mensagens do Canal          | ✅ Funcional        |
| `RegrasComportamento.tsx` | Regras de Comportamento   | ✅ Funcional        |
| `Voz.tsx`               | Voz (ElevenLabs)            | ✅ Funcional        |
| `GeralTenant.tsx`       | Configurações Gerais        | ✅ Funcional        |

### Padrão de null-state

Todos os tabs com formulário inicializam com `DEFAULT_*` quando o RPC retorna `null`
(tenant sem dados ainda). O save chama um UPSERT que cria o registro.

---

## 6. RPCs Supabase — Configurações (Migration 001)

| Função RPC                          | Ação               | Tabela alvo                    |
|-------------------------------------|--------------------|--------------------------------|
| `rpc_get_ai_agent_profile`          | GET                | `config.ai_agent_profiles`     |
| `rpc_update_ai_agent_profile`       | UPSERT             | `config.ai_agent_profiles`     |
| `rpc_get_ai_agent`                  | GET                | `ai.ai_agents`                 |
| `rpc_update_ai_agent`               | UPDATE             | `ai.ai_agents`                 |
| `rpc_list_prompt_templates`         | LIST               | `config.prompt_templates`      |
| `rpc_upsert_prompt_template`        | UPSERT             | `config.prompt_templates`      |
| `rpc_get_business_hours`            | GET                | `config.business_hours`        |
| `rpc_update_business_hours`         | UPSERT array       | `config.business_hours`        |
| `rpc_get_channel_settings`          | GET                | `config.channel_settings`      |
| `rpc_update_channel_settings`       | UPSERT             | `config.channel_settings`      |
| `rpc_get_tenant_settings`           | GET                | `config.tenant_settings`       |
| `rpc_update_tenant_settings`        | UPSERT             | `config.tenant_settings`       |
| `rpc_list_handoff_rules`            | LIST               | `config.handoff_rules`         |
| `rpc_upsert_handoff_rule`           | UPSERT             | `config.handoff_rules`         |
| `rpc_list_sla_rules`                | LIST               | `config.sla_rules`             |
| `rpc_upsert_sla_rule`               | UPSERT             | `config.sla_rules`             |
| `rpc_list_feature_flags`            | LIST               | `config.feature_flags`         |
| `rpc_update_feature_flag`           | UPSERT             | `config.feature_flags`         |
| `rpc_list_voice_profiles`           | LIST               | `ai.voice_profiles`            |
| `rpc_upsert_voice_profile`          | UPSERT             | `ai.voice_profiles`            |

### RPCs extras (Migrations 002–003)

| Função                    | Módulo         |
|---------------------------|----------------|
| `rpc_list_audit_logs`     | Observabilidade |
| `rpc_list_integration_logs`| Observabilidade|
| `rpc_list_jobs`           | Observabilidade |
| `rpc_conversations_trend` | Dashboard       |
| `rpc_appointments_trend`  | Dashboard       |

### RPCs extras (Migrations 017–022)

| Função                        | Módulo / Ação                                      |
|-------------------------------|-----------------------------------------------------|
| `rpc_list_handoff_queue`      | Atendimento — fila de handoff humano                |
| `rpc_update_handoff_status`   | Atendimento — aceitar/resolver/rejeitar handoff     |
| `rpc_list_reminder_rules`     | Configurações — regras de lembrete (CRUD)           |
| `rpc_upsert_reminder_rule`    | Configurações — criar/editar regra                  |
| `rpc_delete_reminder_rule`    | Configurações — excluir regra                       |
| `rpc_list_prediction_scores`  | Observabilidade — scores de predição da IA          |
| `rpc_get_roi_summary`         | Observabilidade — resumo de ROI por mês             |
| `rpc_list_all_tenants`        | Administração — listagem super-admin                |
| `rpc_upsert_tenant`           | Administração — criar/editar tenant                 |
| `rpc_delete_tenant`           | Administração — excluir tenant                      |
| `rpc_list_conversations`      | Atendimento/Clientes — agora aceita `p_customer_id` |
| `rpc_list_appointments`       | Agenda/Clientes — agora aceita `p_customer_id`      |
| `rpc_dispatch_campaign`       | Campanhas — marca running + retorna payload n8n     |

### n8n Webhooks (produção)

| Webhook                        | URL                                                           |
|--------------------------------|---------------------------------------------------------------|
| Campaigns Dispatcher           | `https://n8n.atividadeweb.com.br/webhook/campaigns-dispatcher` |
| _(demais paths a confirmar)_   | Base: `https://n8n.atividadeweb.com.br/webhook/`              |

---

## 7. Padrões de Código

### Componentes de módulo
- State local (`useState`) + funções de `@/lib/api`
- Toast via `import { toast } from '@/components/ui/Toast'`
- Loading spinner padrão: `<div className="animate-spin ... border-brand-600" />`
- Erro via `AlertCircle` do lucide-react
- Botão salvar: `<Button onClick={handleSave} loading={saving}>`

### UI components disponíveis em `src/components/ui/`
```
Card, CardHeader, CardTitle
Button (variant: primary | secondary | ghost | danger; size: sm | md | lg)
Input, Textarea
Select
Toggle
Slider
Modal
Badge (variant: success | default | purple | ...)
Tabs
Toast
```

### Migrations
- Não criar novas migrations sem validação do responsável
- Numerar sequencialmente: `004_*.sql`, `005_*.sql`...
- Jamais alterar migrations já aplicadas (001, 002, 003)

---

## 8. Variáveis de Ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=https://jxqnfzujsgtzzjabvplm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave_anon>
NEXT_PUBLIC_TENANT_ID=         # opcional, tem fallback hardcoded
NEXT_PUBLIC_CHANNEL_ID=        # opcional, tem fallback hardcoded
```
