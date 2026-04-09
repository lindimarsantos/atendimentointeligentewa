# Project State — Atendimento Inteligente WA

> Última atualização: 2026-04-09

---

## ✅ Concluído

### Core da plataforma
- [x] Next.js 14 App Router + TypeScript + Tailwind
- [x] Layout com sidebar (11 rotas)
- [x] Supabase client com TENANT_ID e CHANNEL_ID
- [x] `src/lib/api.ts` — todas as funções de acesso a dados implementadas
- [x] `src/types/index.ts` — tipos completos para todos os módulos
- [x] UI library compartilhada (`src/components/ui/`)

### Módulo 10: Configurações de IA e Atendimento
- [x] Página `/configuracoes` com 7 tabs
- [x] `PerfilAgente` — nome, tom, verbosidade, objetivo, capacidades
- [x] `PromptModelo` — modelo LLM, system prompt, temperatura, templates
- [x] `DadosNegocio` — visão de serviços, profissionais, horários (read-only)
- [x] `MensagensCanal` — boas-vindas, fora-horário, handoff, buffer, typing
- [x] `RegrasComportamento` — handoff rules, SLA, feature flags
- [x] `Voz` — perfis ElevenLabs (CRUD)
- [x] `GeralTenant` — identidade, modo intake, mídia, automação
- [x] Fix null-state: todos os tabs inicializam com defaults quando sem dados
- [x] Migrations 001–003 aplicadas (RPCs de configuração, auditoria, trends)

### Outros módulos (estrutura existe)
- [x] Rotas criadas para: atendimento, clientes, agenda, serviços, campanhas, analytics, billing, administração, observabilidade

---

## 📋 Backlog (próximas sessões)

### Dashboard (Visão Geral)
- [x] 6 KPIs (clientes, conversas, handoff, resolvidas, agendamentos, taxa IA)
- [x] Gráfico de área — tendência de conversas (7/14/30 dias)
- [x] Gráfico de barras — agendamentos por dia
- [x] Donuts — distribuição de status + eficiência da IA
- [x] Métricas operacionais (mensagens, jobs, lembretes)
- [x] Listas recentes: conversas + agendamentos
- [x] Alerta banner para conversas aguardando humano

### Atendimento
- [x] Lista com filtro por status (5 tabs)
- [x] Interface de chat (bolhas inbound/outbound + badges de intenção)
- [x] Ações: assumir, encerrar, registrar nota
- [x] Painel lateral: Resumo IA, Memórias do cliente, Timeline de decisões

### Clientes
- [x] Lista com busca e tags coloridas
- [x] Perfil com dados, memórias da IA, histórico de conversas e agendamentos

### Observabilidade
- [x] Job Queue — fila com status, tipo, erro, data
- [x] Auditoria — logs de auditoria
- [x] Integrações — integration logs

### Configurações — melhorias futuras
- [ ] Tab `DadosNegócio`: permitir edição de horários via `rpc_update_business_hours`
- [ ] Autenticação multi-tenant (Supabase Auth)

---

## ⚠️ Alertas

| Item | Nível | Descrição |
|------|-------|-----------|
| `rpc_update_ai_agent` | MÉDIO | Apenas UPDATE, sem INSERT. Se `ai.ai_agents` não tiver linha para o tenant, save silencia. |
| TENANT_ID hardcoded | MÉDIO | Substitua por auth dinâmica antes de multi-tenant. |
| Sem autenticação | MÉDIO | Rotas não têm proteção de sessão ainda. |
