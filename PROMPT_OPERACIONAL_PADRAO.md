# Prompt Operacional Padrão — Atendimento Inteligente WA
> Use este template no início de cada sessão Claude Code

---

## Template de Sessão (copie e cole)

```
Projeto: Atendimento Inteligente WA — plataforma SaaS de atendimento via WhatsApp com IA.
Branch ativa: claude/resume-session-2fEn8

Antes de responder, leia OBRIGATORIAMENTE:
1. AI_OPERATING_MANUAL.md  → stack, RPCs, workflows, regras de operação
2. PROJECT_STATE.md         → o que está feito, o que falta, alertas ativos

Contexto-base:
- Supabase project: jxqnfzujsgtzzjabvplm
- Migration atual: 085 (próxima será 086_*.sql)
- Auth: @supabase/ssr + cookies (NÃO usar createClient/localStorage)
- Todos os dados via src/lib/api.ts → RPCs public.*
- UI: componentes de src/components/ui/ (não instalar novas libs)
- n8n: https://n8n.atividadeweb.com.br (8 workflows — ver manual seção 7)

Tarefa desta sessão:
[DESCREVER A TAREFA AQUI]

Regras obrigatórias:
- Checar se RPC já existe antes de criar migration
- Testar SQL no Supabase MCP antes de criar arquivo .sql
- Nomear migration como 086_nome_descritivo.sql (sequencial)
- Nunca alterar migrations 001-084
- Fazer commit + push ao final de cada entrega funcional
- Atualizar PROJECT_STATE.md ao finalizar
```

---

## Regras de Continuidade (para a IA)

### Antes de propor qualquer coisa
1. Ler `PROJECT_STATE.md` — verificar se já foi feito
2. Consultar seção 6 de `AI_OPERATING_MANUAL.md` — verificar se RPC existe
3. Consultar seção 7 — verificar se workflow n8n existe
4. Propor apenas o que está faltando, sem redesenhar o que funciona

### Ao implementar banco (migration)
1. Executar SQL no Supabase MCP (`execute_sql`) para validar
2. Criar arquivo `supabase/migrations/085_*.sql`
3. Aplicar via MCP (`apply_migration`)
4. Documentar RPC novo na seção 6 de `AI_OPERATING_MANUAL.md`

### Ao implementar frontend
1. Criar função em `src/lib/api.ts` se necessário
2. Usar componentes de `src/components/ui/`
3. Seguir padrão: `useState` local + função de `api.ts` + toast de feedback
4. Nunca instalar nova biblioteca de UI

### Ao implementar n8n
1. Usar Supabase MCP para consultar estrutura de tabelas se necessário
2. Verificar parâmetros exatos dos RPCs (ver manual seção 6)
3. Nomear workflows seguindo padrão: `Área - Descrição`
4. Workers cron devem sempre chamar `rpc_complete_job` ou `rpc_fail_job`

### Ao finalizar
1. `git add + commit + push origin claude/resume-session-2fEn8`
2. Atualizar `PROJECT_STATE.md` com o que mudou
3. Se criou RPC: atualizar seção 6 de `AI_OPERATING_MANUAL.md`

---

## Sessões por Módulo (contexto mínimo)

### Banco / Migrations
```
Carregar: AI_OPERATING_MANUAL.md (seções 3, 4, 6)
Supabase MCP: execute_sql + apply_migration
Migration próxima: 086_*.sql
```

### n8n Workflows
```
Carregar: AI_OPERATING_MANUAL.md (seções 6, 7, 10)
Referência detalhada: 5-documento_funcional_dos_workflows_*.md (só se necessário)
```

### Frontend / Dashboard
```
Carregar: AI_OPERATING_MANUAL.md (seções 8, 9)
Padrão: useState + api.ts + ui/components
Sem novas libs
```

### Integrações Externas (Z-API, ElevenLabs, Google Calendar)
```
Carregar: AI_OPERATING_MANUAL.md + 6-documento_de_integracoes_externas_*.md
Credenciais: via config do tenant no Supabase, nunca hardcoded
```

### Configurações / Auth
```
Carregar: AI_OPERATING_MANUAL.md (seções 5, 9)
Auth usa: @supabase/ssr createBrowserClient + middleware.ts
```
