# Prompt Operacional Padrão — Atendimento Inteligente WA

> Use este template no início de cada nova sessão Claude Code.

---

## Template de Sessão

```
Contexto do projeto: Atendimento Inteligente WA — plataforma de atendimento
via WhatsApp com IA. Branch de produção: master.

Leia antes de começar (OBRIGATÓRIO):
1. AI_OPERATING_MANUAL.md  → stack, padrões, RPCs, IDs de ambiente
2. PROJECT_STATE.md         → o que foi feito, backlog, alertas

Tarefa desta sessão:
[DESCREVER A TAREFA AQUI]

Regras:
- Desenvolver na branch: master (ou nova branch se indicado)
- Todos os dados via funções de src/lib/api.ts (nunca acesso direto ao Supabase)
- UI: usar componentes de src/components/ui/ (nunca instalar nova lib)
- Não alterar migrations já aplicadas (001, 002, 003)
- Ao terminar: atualizar PROJECT_STATE.md com o que mudou
- Se criar RPCs novas: adicionar na seção 6 do AI_OPERATING_MANUAL.md
```

---

## Sessões por Módulo

### Dashboard (Visão Geral)
```
Carregar: AI_OPERATING_MANUAL.md + PROJECT_STATE.md
RPCs disponíveis: rpc_dashboard_summary, rpc_conversations_trend, rpc_appointments_trend
Componente alvo: src/app/page.tsx ou src/app/visao-geral/page.tsx
```

### Atendimento (Chat)
```
Carregar: AI_OPERATING_MANUAL.md + PROJECT_STATE.md
RPCs disponíveis: rpc_list_conversations, rpc_get_conversation_messages,
                   rpc_assumir_conversa, rpc_encerrar_conversa, rpc_registrar_nota
Componente alvo: src/components/modules/Atendimento/
```

### Configurações (já implementado)
```
Carregar: AI_OPERATING_MANUAL.md + PROJECT_STATE.md
Componente alvo: src/components/modules/Configuracoes/
Ver seção 5 e 6 do AI_OPERATING_MANUAL.md para RPCs e padrões
```

### Observabilidade
```
Carregar: AI_OPERATING_MANUAL.md + PROJECT_STATE.md
RPCs disponíveis: rpc_list_audit_logs, rpc_list_integration_logs, rpc_list_jobs
Componente alvo: src/components/modules/Observabilidade/
```

---

## Economia de Tokens

| Abordagem                           | Tokens estimados |
|-------------------------------------|------------------|
| Carregar todos os arquivos do repo  | ~15.000–25.000   |
| Modelo mínimo (2 docs + contexto)  | ~4.000–6.000    |
| **Economia estimada**               | **~60–70%**      |
