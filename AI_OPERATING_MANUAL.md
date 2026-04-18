# AI Operating Manual — Atendimento Inteligente WA
> Versão: 2.0 | Atualizado: 2026-04-18 | Sessão ativa: claude/resume-session-2fEn8

---

## 1. Objetivo do Projeto

Plataforma SaaS **multi-tenant** de atendimento inteligente via WhatsApp, focada em clínicas e operações de serviço. A IA atende, agenda, faz handoff para humanos e gera analytics. Operação sem alteração de código pelo operador.

---

## 2. Stack Tecnológica

| Camada | Tecnologia | Observação |
|---|---|---|
| Frontend | Next.js 14 App Router + TypeScript | Vercel, `'use client'` em tudo |
| Estilo | Tailwind CSS | Componentes em `src/components/ui/` |
| Backend/DB | Supabase PostgreSQL | Projeto ID: `jxqnfzujsgtzzjabvplm` |
| Auth | Supabase Auth + `@supabase/ssr` | Sessões em cookies (migrado de localStorage) |
| API layer | RPCs SECURITY DEFINER em `public.*` | Nunca acesso direto a tabelas |
| IA | Anthropic Claude claude-sonnet-4-6 | Via n8n AI Agent node |
| Voz | ElevenLabs API | Configurável por tenant |
| WhatsApp | Z-API | Instância por tenant |
| Automação | n8n (VPS próprio) | `https://n8n.atividadeweb.com.br` |
| Deploy | Vercel | `atendimentointeligentewa.vercel.app` |

---

## 3. Premissas Arquiteturais (NUNCA QUEBRAR)

1. **Multi-tenant desde a base** — todo dado tem `tenant_id`. RLS ativo em todas as tabelas sensíveis.
2. **RPCs para operações críticas** — nunca escrever diretamente em tabelas de negócio. Sempre via `public.*` RPC.
3. **Supabase como fonte de verdade** — integrações externas não substituem o estado interno.
4. **n8n como orquestrador** — automações vivem em workflows n8n, não em código do frontend.
5. **API layer via `src/lib/api.ts`** — frontend nunca chama Supabase diretamente, sempre via funções de `api.ts`.
6. **Sem acesso direto a tabelas** — todo dado passa por RPC ou view autorizada.
7. **Migrations sequenciais** — nunca alterar migration já aplicada. Próxima: `086_*.sql`.

---

## 4. Schemas do Banco

| Schema | Conteúdo principal |
|---|---|
| `core` | Tenants, usuários base |
| `crm` | Customers, tags, leads |
| `messaging` | Conversations, messages, campaigns, templates, tenant_channels |
| `scheduling` | Appointments, professionals, services, slots |
| `ai` | ai_agents, voice_profiles, agent_handoffs, memories |
| `config` | business_hours, channel_settings, tenant_settings, handoff_rules, sla_rules, feature_flags |
| `ops` | outbound_message_queue, job_queue |
| `billing` | tenant_subscriptions, plans |
| `iam` | roles, permissions, user_role_assignments |
| `audit` | audit_logs |
| `observability` | integration_logs, event_bus, prediction_scores |
| `public` | RPCs expostos (SECURITY DEFINER) |

---

## 5. IDs de Ambiente (Homologação)

```
SUPABASE_PROJECT_ID = jxqnfzujsgtzzjabvplm
SUPABASE_URL        = https://jxqnfzujsgtzzjabvplm.supabase.co
TENANT_ID           = 5518085b-42e9-4608-8c56-890cef45ba9b
CHANNEL_ID          = 58c4062a-9fe9-4ae2-abff-5a8b5236a79e
N8N_URL             = https://n8n.atividadeweb.com.br
VERCEL_URL          = https://atendimentointeligentewa.vercel.app
GIT_BRANCH          = claude/resume-session-2fEn8
```

---

## 6. Catálogo de RPCs (estado atual — migration 084)

### Configuração e IA
| RPC | Ação | Tabela |
|---|---|---|
| `rpc_get_ai_agent` | GET | `ai.ai_agents` |
| `rpc_update_ai_agent` | **UPSERT** (084) | `ai.ai_agents` |
| `rpc_get_ai_agent_profile` | GET | `config.ai_agent_profiles` |
| `rpc_update_ai_agent_profile` | UPSERT | `config.ai_agent_profiles` |
| `rpc_list_prompt_templates` | LIST | `config.prompt_templates` |
| `rpc_upsert_prompt_template` | UPSERT | `config.prompt_templates` |
| `rpc_get_business_hours` | GET | `config.business_hours` |
| `rpc_update_business_hours` | UPSERT array | `config.business_hours` |
| `rpc_get_channel_settings` | GET | `config.channel_settings` |
| `rpc_update_channel_settings` | UPSERT | `config.channel_settings` |
| `rpc_get_tenant_settings` | GET | `config.tenant_settings` |
| `rpc_update_tenant_settings` | UPSERT | `config.tenant_settings` |
| `rpc_list_handoff_rules` | LIST | `config.handoff_rules` |
| `rpc_upsert_handoff_rule` | UPSERT | `config.handoff_rules` |
| `rpc_list_sla_rules` | LIST | `config.sla_rules` |
| `rpc_upsert_sla_rule` | UPSERT | `config.sla_rules` |
| `rpc_list_feature_flags` | LIST | `config.feature_flags` |
| `rpc_update_feature_flag` | UPSERT | `config.feature_flags` |
| `rpc_list_voice_profiles` | LIST | `ai.voice_profiles` |
| `rpc_upsert_voice_profile` | UPSERT | `ai.voice_profiles` |

### Atendimento e Conversas
| RPC | Ação |
|---|---|
| `rpc_list_conversations` | Lista com filtros (status, customer_id) |
| `rpc_get_conversation_messages` | Mensagens de uma conversa |
| `rpc_assumir_conversa` | Agente humano assume (usa auth.uid()) |
| `rpc_encerrar_conversa` | Encerra conversa |
| `rpc_registrar_nota` | Nota interna |
| `rpc_list_handoff_queue` | Fila de handoff humano |
| `rpc_update_handoff_status` | Aceitar/resolver/rejeitar handoff |

### CRM e Agenda
| RPC | Ação |
|---|---|
| `rpc_list_appointments` | Lista com filtros (customer_id, status) |
| `rpc_list_customers` | Lista de clientes |

### Google Calendar (migration 085)
| RPC | Ação |
|---|---|
| `rpc_list_professional_calendars` | Lista calendários de profissionais (filtra por professional_id opcional) |
| `rpc_upsert_professional_calendar` | Conecta/atualiza Google Calendar com tokens OAuth |
| `rpc_delete_professional_calendar` | Desconecta calendário |
| `rpc_get_appointments_pending_google_sync` | Agendamentos confirmados sem external_event_id (por tenant) |
| `rpc_get_all_appointments_pending_google_sync` | Idem cross-tenant (service_role apenas — usado pelo worker n8n) |
| `rpc_update_appointment_external_id` | Grava Google event ID no agendamento após sync |
| `rpc_log_calendar_sync` | Loga tentativa de sync (direction, status, request/response) |

### n8n (chamadas automáticas)
| RPC | Quem chama | Notas |
|---|---|---|
| `rpc_take_conversation_batch` | n8n inbound | Debounce + intercepta transfer intent |
| `rpc_n8n_detect_transfer_intent` | rpc_take_conversation_batch | Detecta pedido de humano |
| `rpc_n8n_check_business_hours` | n8n / rpc_solicitar | Retorna {is_open: bool} |
| `rpc_n8n_solicitar_humano` | WA - AI Agent | Handoff com mensagem contextual |
| `rpc_n8n_post_interaction` | WA - AI Agent | Registra decisão pós-resposta |
| `rpc_n8n_get_scheduling_followup_targets` | Scheduling Follow-up | Params: `p_hours_first`, `p_hours_second` |
| `rpc_list_running_campaigns` | Campaigns - Dispatcher | **Sem parâmetros** (overload 081) |
| `rpc_complete_campaign` | Campaigns - Dispatcher | Finaliza campanha |
| `rpc_claim_jobs` | Workers | Reivindica jobs da fila |
| `rpc_complete_job` | Workers | Conclui job |
| `rpc_fail_job` | Workers | Falha job com erro |

### Dashboard e Analytics
| RPC | Retorno |
|---|---|
| `rpc_dashboard_summary` | KPIs consolidados |
| `rpc_conversations_trend` | Série temporal (param: days int) |
| `rpc_appointments_trend` | Série temporal (param: days int) |
| `rpc_get_roi_summary` | ROI por mês |
| `rpc_list_prediction_scores` | Scores da IA |

### Observabilidade
| RPC | Módulo |
|---|---|
| `rpc_list_audit_logs` | Auditoria |
| `rpc_list_integration_logs` | Integrações |
| `rpc_list_jobs` | Job queue |

### IAM e Multi-tenant
| RPC | Ação |
|---|---|
| `rpc_list_user_tenants` | Tenants do usuário logado |
| `rpc_get_user_tenant` | Tenant primário (fallback legacy) |
| `rpc_list_all_tenants` | Super-admin |
| `rpc_upsert_tenant` | Criar/editar tenant |
| `rpc_delete_tenant` | Excluir tenant |

### Campanhas
| RPC | Ação |
|---|---|
| `rpc_dispatch_campaign` | Marca running + retorna payload |
| `rpc_list_running_campaigns` | Lista running (sem params — 081) |
| `rpc_complete_campaign` | Finaliza campanha |

---

## 7. Workflows n8n (estado atual)

| ID | Nome | Status | Tipo |
|---|---|---|---|
| NNEoKlzImbPL3hRd | WA - Inbound Intake | ✅ Ativo | Webhook |
| f2DSLvZZ9L1K3JKt | WA - Decision and Buffered Reply | ❌ **INATIVO** | Webhook |
| 4zwbqu6Fx3aIdot7 | WA - AI Agent | ✅ Ativo | Webhook (substitui Decision) |
| Tnags6ta474JxRDJ | WA - Outbound Worker | ✅ Ativo | Cron 15s |
| 1Q9JZupMo7EkNRYK | Scheduling - Appointment Flow | ✅ Ativo | Webhook |
| qYW6Mb8bst1adWyc | Scheduling - Reminder Worker | ✅ Ativo | Cron |
| MriwCym6UkCLJuVD | Scheduling Follow-up — Sem Resposta | ✅ Ativo | Cron 2h |
| LQUXopWaXMhMaVdo | Campaigns - Dispatcher | ✅ Ativo | Cron 10min |
| U9BZl6uSy8RINGJ6 | Scheduling - Google Calendar Sync | ✅ Ativo | Cron 2min |

**Workflows faltantes:**
- `WA - Voice Reply Worker` — ElevenLabs → Z-API áudio
- `Observability - Event Consumer` — event bus → métricas
- `Ops - General Queue Worker` — consome `ops.job_queue`

**Configuração pendente:**
- `Scheduling - Google Calendar Sync` — editar nó "Parse Appointments" com CLIENT_ID/CLIENT_SECRET. Criar credencial "Supabase Service Role" (HTTP Header Auth, header: apikey).

**Observação:** `WA - Decision and Buffered Reply` foi substituído pelo `WA - AI Agent` (criado em 15/Abr). Pode ser arquivado.

---

## 8. Estrutura do Frontend

```
src/
├── app/
│   ├── page.tsx                    # Dashboard (Visão Geral)
│   ├── atendimento/page.tsx        # Chat + fila humana
│   ├── clientes/page.tsx           # CRM
│   ├── agenda/page.tsx             # Agendamentos
│   ├── servicos/page.tsx           # Serviços + profissionais
│   ├── agentes/page.tsx            # IA agents status
│   ├── campanhas/page.tsx          # Campanhas
│   ├── analytics/page.tsx          # ROI + métricas
│   ├── billing/page.tsx            # Planos e uso
│   ├── observabilidade/page.tsx    # Jobs, logs, integrações
│   ├── administracao/page.tsx      # Super-admin
│   ├── configuracoes/page.tsx      # 10 tabs de config
│   ├── login/page.tsx              # ✅ Auth
│   ├── forgot-password/page.tsx    # ✅ Auth
│   └── reset-password/page.tsx     # ✅ Auth
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx             # Nav + tenant switcher
│   │   ├── DashboardLayout.tsx     # Shell autenticado
│   │   └── HandoffBanner.tsx       # Alerta handoff
│   ├── modules/Configuracoes/      # 10 tabs
│   ├── modules/Atendimento/        # Chat UI
│   └── ui/                         # Card, Button, Input, Toggle, etc.
├── contexts/AuthContext.tsx        # ✅ Auth multi-tenant
├── lib/
│   ├── api.ts                      # TODAS as chamadas RPC
│   ├── supabase.ts                 # createBrowserClient (@supabase/ssr)
│   └── utils.ts
├── middleware.ts                   # ✅ Proteção de rotas (Edge)
└── types/index.ts                  # Tipos TypeScript completos
```

---

## 9. Regras de Operação da IA

### O que fazer SEMPRE
- Checar `PROJECT_STATE.md` antes de propor qualquer coisa
- Usar migration sequencial (próxima: `085_*.sql`)
- Testar SQL no Supabase MCP antes de criar arquivo de migration
- Usar `src/lib/api.ts` para novos acessos de dados no frontend
- Usar componentes de `src/components/ui/` — nunca instalar nova lib de UI
- Fazer `git add + commit + push` após cada entrega funcional

### O que NUNCA fazer
- Alterar migrations já aplicadas (001–084)
- Acessar tabelas Supabase diretamente no frontend
- Criar novo padrão de auth diferente do `@supabase/ssr`
- Instalar pacotes npm sem necessidade confirmada
- Redesenhar arquitetura sem motivo técnico claro
- Fazer push para branch diferente de `claude/resume-session-2fEn8`

### Ordem de implementação de features
1. Validar se RPC existe → se não, criar migration e aplicar via MCP
2. Criar/atualizar função em `api.ts`
3. Implementar UI
4. Commit + push

---

## 10. Webhooks n8n (URLs de produção)

| Workflow | URL |
|---|---|
| WA - Inbound Intake | `https://n8n.atividadeweb.com.br/webhook/wa-inbound` |
| WA - AI Agent | `https://n8n.atividadeweb.com.br/webhook/wa-decision` |
| Scheduling - Appointment Flow | `https://n8n.atividadeweb.com.br/webhook/scheduling-appointment-flow` |

---

## 11. Mapa de Documentação

| Necessidade | Onde buscar |
|---|---|
| Estado atual do projeto | `PROJECT_STATE.md` |
| RPCs disponíveis | Seção 6 deste manual |
| Workflows n8n | Seção 7 deste manual |
| Padrões de código frontend | Seção 9 deste manual |
| Schemas do banco | Seção 4 deste manual |
| Arquitetura funcional detalhada | `2-documento_mestre_do_projeto_*.md` |
| Especificação de workflows n8n | `5-documento_funcional_dos_workflows_*.md` |
| Integrações externas | `6-documento_de_integracoes_externas_*.md` |
| Regras de token | `REGRAS_DE_ECONOMIA_DE_CONTEXTO.md` |
