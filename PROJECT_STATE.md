# Project State — Atendimento Inteligente WA
> Atualizado: 2026-04-18 | Migration atual: 085 | Branch: claude/resume-session-2fEn8

---

## Objetivo
Plataforma SaaS multi-tenant de atendimento via WhatsApp com IA. Clínicas e empresas de serviço como foco inicial. IA atende, agenda, faz handoff, gera analytics. Operação configurável sem código.

---

## Arquitetura Principal
```
WhatsApp (Z-API) → n8n (inbound) → Supabase (RPCs) → n8n (AI Agent / workers)
                                                     → Dashboard (Next.js/Vercel)
```
- **Auth**: Supabase Auth com cookies (`@supabase/ssr`) + middleware Edge
- **Dados**: Supabase PostgreSQL multi-tenant, acesso exclusivo via RPCs
- **Automação**: n8n como orquestrador (8 workflows ativos)
- **IA**: Claude claude-sonnet-4-6 via n8n AI Agent node

---

## Fases de Implementação

### Fase 1 — Banco e consistência ✅ COMPLETA
- Migrations 001–084 aplicadas
- Todos os schemas criados: core, crm, messaging, scheduling, ai, config, ops, billing, iam, audit, observability
- RPCs completos para todos os módulos
- UNIQUE(tenant_id) em ai.ai_agents adicionado (084)

### Fase 2 — n8n inbound/outbound ✅ COMPLETA
- WA - Inbound Intake ✅
- WA - AI Agent ✅ (substituiu WA - Decision and Buffered Reply — inativo, pode ser arquivado)
- WA - Outbound Worker ✅
- Transfer intent interceptado em `rpc_take_conversation_batch` (079)
- Business hours enforcement ativo (078)

### Fase 3 — Agenda ✅ COMPLETA
- Scheduling - Appointment Flow ✅
- Scheduling - Reminder Worker ✅
- Scheduling Follow-up — Sem Resposta ✅ (corrigido 082)
- **Google Calendar integration** ✅ IMPLEMENTADA (migration 085 + workflow n8n + UI dashboard)
- **Geração de slots** ✅ `rpc_n8n_get_slots` + `rpc_get_available_slots` implementados

### Fase 4 — Dashboard ✅ MAJORITARIAMENTE COMPLETA
Todos os módulos com UI implementada:
- Visão Geral (KPIs, charts, período customizável)
- Atendimento (chat + handoff)
- Clientes (CRM + perfil)
- Agenda, Serviços, Agentes, Campanhas
- Analytics, Billing, Observabilidade, Administração
- Configurações (10 tabs funcionais)
- Auth completo (login, forgot, reset password)
- Middleware de proteção de rotas ✅

### Fase 5 — Operação avançada ⚠️ PARCIAL
- Campaigns - Dispatcher ✅ (corrigido 081/082)
- **Ops - General Queue Worker** ❌ workflow n8n não criado
- **WA - Voice Reply Worker** ❌ workflow n8n não criado
- **Observability - Event Consumer** ❌ workflow n8n não criado

---

## O que Está Funcionando em Produção

### n8n workflows ativos
1. WA - Inbound Intake — recebe mensagens WhatsApp
2. WA - AI Agent — processa e responde com IA
3. WA - Outbound Worker — envia mensagens da fila (cron 15s)
4. Scheduling - Appointment Flow — cria agendamentos
5. Scheduling - Reminder Worker — envia lembretes
6. Scheduling Follow-up — Sem Resposta — follow-up automático (cron 2h)
7. Campaigns - Dispatcher — dispara campanhas (cron 10min)
8. Scheduling - Google Calendar Sync — sincroniza agendamentos → Google Calendar (cron 2min) ⚠️ Requer configuração de credenciais

### Dashboard
- Todas as rotas acessíveis e funcionais
- Auth multi-tenant com seleção de tenant por usuário

---

## O que Falta Implementar

### Alta prioridade
| Item | Tipo | Fase |
|---|---|---|
| Google Calendar — configurar credenciais n8n | Configuração | 3 |
| WA - Voice Reply Worker | workflow n8n | 5 |
| Observability - Event Consumer | workflow n8n | 5 |
| Ops - General Queue Worker | workflow n8n | 5 |

### Média prioridade
| Item | Tipo |
|---|---|
| Arquivar WA - Decision and Buffered Reply | n8n cleanup |
| Verificar geração de slots de agenda | Scheduling |
| Verificar se Voice Reply está dentro do WA - AI Agent | Investigação |

---

## Princípios que Não Podem Ser Quebrados
1. `tenant_id` obrigatório em toda operação
2. Dados só via RPCs (`public.*`)
3. Migrations sequenciais (próxima: 085)
4. Auth via `@supabase/ssr` (cookies, não localStorage)
5. Frontend sem acesso direto ao Supabase
6. n8n como único orquestrador de automações

---

## Alertas Ativos
| Item | Nível | Status |
|---|---|---|
| WA - Decision and Buffered Reply | INFO | Inativo — substituído por WA - AI Agent. Arquivar. |
| Google Calendar — credenciais n8n | MÉDIA | Workflow criado (U9BZl6uSy8RINGJ6). Editar nó "Parse Appointments" com CLIENT_ID e CLIENT_SECRET. Configurar credencial "Supabase Service Role". |
| Scheduling Follow-up — Sem Resposta | ALTA | Novo workflow criado (72R1FIaOyMAhmFpZ) com parâmetros corretos. Atribuir credencial "Supabase Service Role" ao nó "Buscar Conversas Sem Resposta", desativar antigo (MriwCym6UkCLJuVD) e ativar novo. |
| WA - Voice Reply Worker | MÉDIA | Não existe como workflow separado |
| Observability - Event Consumer | BAIXA | Não implementado |
