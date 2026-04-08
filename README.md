# AtendimentoIA — Dashboard

Dashboard operacional da Plataforma de Atendimento Inteligente via WhatsApp.

## Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Supabase** (PostgreSQL + RPCs)
- **Lucide React** (ícones)

---

## Setup local

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.local.example .env.local
```

Edite `.env.local` com suas credenciais:

```env
NEXT_PUBLIC_SUPABASE_URL=https://jxqnfzujsgtzzjabvplm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
NEXT_PUBLIC_TENANT_ID=seu_tenant_id
```

### 3. Rodar em desenvolvimento

```bash
npm run dev
```

Acesse: http://localhost:3000

---

## Estrutura do projeto

```
src/
├── app/                        # Páginas (App Router)
│   ├── page.tsx                # Visão Geral
│   ├── atendimento/page.tsx    # Módulo Atendimento
│   ├── clientes/page.tsx       # Módulo Clientes
│   ├── agenda/page.tsx         # Módulo Agenda
│   ├── servicos/page.tsx       # Módulo Serviços
│   ├── campanhas/page.tsx      # Módulo Campanhas
│   ├── observabilidade/page.tsx# Módulo Observabilidade
│   └── ...                     # Módulos em construção
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx         # Navegação lateral
│   │   ├── Topbar.tsx          # Barra de topo
│   │   └── DashboardShell.tsx  # Shell com refresh global
│   │
│   ├── ui/
│   │   ├── index.tsx           # Card, Button, Table, Avatar, Toast...
│   │   └── Badge.tsx           # Badge de status
│   │
│   └── modules/
│       ├── visao-geral/        # Visão Geral
│       ├── atendimento/        # Conversas + ações (assumir, nota, agendamento, encerrar)
│       ├── agenda/             # Agendamentos
│       ├── clientes/           # CRM
│       ├── servicos/           # Catálogo de serviços
│       ├── campanhas/          # Templates + Reminders
│       └── observabilidade/    # Job queue + alertas
│
├── lib/
│   ├── supabase.ts             # Cliente Supabase singleton
│   ├── api.ts                  # Todas as chamadas ao banco (RPCs + queries)
│   ├── utils.ts                # Formatação, helpers, variants de badge
│   └── auth.ts                 # Placeholder de autenticação
│
└── types/
    └── index.ts                # Tipos TypeScript completos do domínio
```

---

## RPCs disponíveis no Supabase

| RPC | Descrição |
|-----|-----------|
| `rpc_dashboard_summary` | Métricas consolidadas do tenant |
| `rpc_list_conversations` | Conversas com nome do cliente e última mensagem |
| `rpc_list_appointments` | Agendamentos com profissional e serviço resolvidos |
| `rpc_assumir_conversa` | Assume conversa, fecha handoff, audit log |
| `rpc_registrar_nota` | Insere nota interna na conversa |
| `rpc_encerrar_conversa` | Encerra conversa (resolved), audit log |
| `rpc_criar_agendamento_dashboard` | Cria agendamento com validação de conflito |

---

## Módulos implementados

| Módulo | Status | Funcionalidades |
|--------|--------|-----------------|
| Visão Geral | ✅ Completo | Métricas, conversas, agendamentos, jobs, distribuição de status |
| Atendimento | ✅ Completo | Lista, detalhe, histórico de mensagens, assumir, nota, agendamento, encerrar |
| Clientes | ✅ Completo | Lista com métricas por status |
| Agenda | ✅ Completo | Lista filtrada, métricas por status |
| Serviços | ✅ Completo | Catálogo com duração e preços |
| Campanhas | ✅ Completo | Templates, reminder rules, dispatches |
| Observabilidade | ✅ Completo | Job queue, alertas de falha, métricas |
| Analytics e ROI | 🔜 Próxima iteração | — |
| Billing e Uso | 🔜 Próxima iteração | — |
| Configurações | 🔜 Próxima iteração | — |
| Administração | 🔜 Próxima iteração | — |

---

## Autenticação

O arquivo `src/lib/auth.ts` contém um placeholder com usuário fixo.

Para produção, substituir por `supabase.auth.getUser()` e carregar
o `tenant_user` correspondente da tabela `core.tenant_users`.

---

## Deploy

### Vercel (recomendado)

```bash
npx vercel
```

Configure as variáveis de ambiente no painel da Vercel.

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Tenant de homologação

| Chave | Valor |
|-------|-------|
| tenant_id | 5518085b-42e9-4608-8c56-890cef45ba9b |
| channel_id | 58c4062a-9fe9-4ae2-abff-5a8b5236a79e |
| customer_id (Lindimar) | 79e43dbe-07eb-43f8-a103-e435605dc184 |
| professional_id | 76fa7503-d28f-4503-b6ec-10e7e0fc87e3 |
| service_id | 483c6f64-b598-4a31-a284-2de144e6cb52 |
