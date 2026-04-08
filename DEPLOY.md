# Guia de Deploy — AtendimentoIA Dashboard

## Visão geral do fluxo

```
Você pede mudança aqui no Chat
        ↓
Eu gero arquivos atualizados + novo zip
        ↓
Você arrasta os arquivos para o GitHub
        ↓
Vercel detecta e publica automaticamente (≈ 1 min)
        ↓
Dashboard atualizado no ar
```

---

## Parte 1 — Subir pela primeira vez

### Passo 1 — Criar conta no GitHub (se não tiver)
- Acesse github.com → Sign up → crie com email e senha

### Passo 2 — Criar repositório no GitHub
1. Clique no "+" (canto superior direito) → "New repository"
2. Nome: `atendimento-ia-dashboard`
3. Visibilidade: **Private** (recomendado)
4. Deixe as outras opções em branco
5. Clique em **Create repository**

### Passo 3 — Subir os arquivos do zip
1. Baixe e descompacte o zip `dashboard-atendimento-ia.zip`
2. Na página do repositório recém-criado, clique em **"uploading an existing file"**
3. Arraste a pasta `dashboard` inteira (ou todos os arquivos dentro dela)
4. Na caixa "Commit changes", escreva: `chore: versão inicial do dashboard`
5. Clique em **Commit changes**

### Passo 4 — Criar conta no Vercel
- Acesse vercel.com → "Sign Up" → escolha **"Continue with GitHub"**
- Autorize o Vercel a acessar seu GitHub

### Passo 5 — Importar o projeto no Vercel
1. No painel da Vercel, clique em **"Add New Project"**
2. Selecione o repositório `atendimento-ia-dashboard`
3. Clique em **Import**

### Passo 6 — Configurar variáveis de ambiente
Na tela de configuração, clique em **"Environment Variables"** e adicione:

| Nome | Valor |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://jxqnfzujsgtzzjabvplm.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (chave completa do .env.local.example) |
| `NEXT_PUBLIC_TENANT_ID` | `5518085b-42e9-4608-8c56-890cef45ba9b` |

### Passo 7 — Deploy
- Clique em **Deploy**
- Aguarde ~2 minutos
- A Vercel entrega uma URL pública: `https://atendimento-ia-dashboard.vercel.app`

---

## Parte 2 — Atualizar o dashboard (fluxo recorrente)

Quando eu gerar arquivos novos ou corrigidos:

### Opção A — Via GitHub (mais simples, sem instalar nada)

1. Acesse o repositório no GitHub
2. Navegue até o arquivo que mudou (ex: `src/components/modules/atendimento/Atendimento.tsx`)
3. Clique no ícone de lápis ✏️ (editar)
4. Cole o conteúdo novo
5. Clique em **Commit changes**
6. A Vercel detecta automaticamente e republica em ~1 min

### Opção B — Reenvio de zip (para muitas mudanças)

1. Baixe o novo zip gerado no chat
2. No repositório GitHub, clique em **"Add file" → "Upload files"**
3. Arraste os arquivos novos/atualizados
4. Commit → Vercel republica automaticamente

### Opção C — GitHub Desktop (mais confortável a longo prazo)

Se quiser instalar o [GitHub Desktop](https://desktop.github.com/):
1. Clona o repositório no seu computador
2. Você substitui os arquivos localmente
3. Clica em "Commit to main" → "Push origin"
4. Vercel republica

---

## Parte 3 — Ver o status do deploy

- Acesse vercel.com → seu projeto → aba **Deployments**
- Cada commit vira um deployment listado com status (Building → Ready)
- Se der erro, clique no deployment → **Build Logs** para ver o que falhou

---

## Variáveis de ambiente — valores completos

```
NEXT_PUBLIC_SUPABASE_URL=https://jxqnfzujsgtzzjabvplm.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4cW5menVqc2d0enpqYWJ2cGxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDIzNzYsImV4cCI6MjA5MTAxODM3Nn0.LSeDBTdAcPDQmabe50EJtEWdFExUjINL5pc5MbmN4I8

NEXT_PUBLIC_TENANT_ID=5518085b-42e9-4608-8c56-890cef45ba9b
```

---

## Dúvidas frequentes

**"O Vercel pediu o 'Root Directory'"**
→ Se você subiu a pasta `dashboard`, coloque `dashboard` como Root Directory. Se subiu o conteúdo diretamente, deixe em branco.

**"O build falhou com erro de TypeScript"**
→ Me manda o erro aqui no chat, corrijo e gero novo zip.

**"Quero um domínio próprio (ex: dashboard.minhaclínica.com.br)"**
→ Na Vercel, vá em Settings → Domains → adicione o domínio. Eu te oriento na configuração do DNS.
