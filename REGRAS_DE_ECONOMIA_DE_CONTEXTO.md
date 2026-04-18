# Regras de Economia de Contexto — Atendimento Inteligente WA
> Guia para reduzir consumo de tokens sem perder continuidade

---

## Princípio Central

**Carregar apenas o contexto necessário para a tarefa atual.**
Documentos grandes só devem ser lidos quando a tarefa exige especificidade que não está no contexto-base.

---

## Camadas de Contexto

### Camada 0 — Sempre presentes (mínimo absoluto)
Estes dois documentos devem estar no início de TODA sessão:
- `AI_OPERATING_MANUAL.md` — stack, RPCs, workflows, regras
- `PROJECT_STATE.md` — estado atual, o que falta

**Custo estimado: ~3.000–4.000 tokens**

### Camada 1 — Carregar por demanda
Carregar apenas quando a tarefa exige:

| Documento | Carregar quando |
|---|---|
| `5-documento_funcional_dos_workflows_*.md` | Criar ou depurar workflow n8n |
| `6-documento_de_integracoes_externas_*.md` | Implementar Z-API, ElevenLabs, Google Calendar |
| `2-documento_mestre_do_projeto_*.md` | Dúvida sobre escopo ou decisão arquitetural |
| Código-fonte específico | Modificar um arquivo existente |

**Custo adicional estimado: +2.000–5.000 tokens por documento**

### Camada 2 — Nunca carregar desnecessariamente
- Todos os arquivos `.tsx` do projeto de uma vez
- Todos os arquivos de migration de uma vez
- Documentos que não sejam relevantes para a tarefa atual

---

## Regras Práticas

### Regra 1 — Use referências, não transcrições
❌ Errado: colar o conteúdo inteiro de uma migration no chat  
✅ Correto: "a migration 079 intercepta transfer intent — veja o arquivo se precisar"

### Regra 2 — Tarefas pequenas, contexto pequeno
❌ Errado: abrir toda a documentação para resolver um bug pontual  
✅ Correto: identificar qual arquivo/RPC está envolvido e ler apenas ele

### Regra 3 — Não repetir o que já foi dito
❌ Errado: reenviar o Prompt Mestre completo em toda sessão  
✅ Correto: usar o `PROMPT_OPERACIONAL_PADRAO.md` (versão compacta)

### Regra 4 — Estado antes de código
❌ Errado: pedir implementação sem verificar se já existe  
✅ Correto: sempre checar `PROJECT_STATE.md` → seção 6 do manual → depois implementar

### Regra 5 — Uma tarefa por sessão
❌ Errado: "implementa banco + workflow + frontend tudo junto"  
✅ Correto: banco primeiro → testar → workflow → testar → frontend → commit

### Regra 6 — Contexto de código mínimo
Ao modificar um arquivo:
- Ler apenas o arquivo que será modificado
- Não ler arquivos relacionados "por precaução"
- Se surgir dependência, ler pontualmente naquele momento

### Regra 7 — Commits frequentes limpam o contexto
Fazer commit ao final de cada subtarefa completa:
- Mantém o histórico claro
- Permite resumir o estado em texto curto
- Reduz risco de retrabalho por contexto perdido

---

## Custo por Tipo de Operação

| Operação | Documentos necessários | Tokens estimados |
|---|---|---|
| Corrigir bug em RPC | Manual (seção 6) + arquivo SQL | ~2.000 |
| Criar nova migration | Manual (seção 4, 6) | ~2.500 |
| Criar workflow n8n | Manual (seções 6, 7) + doc workflows | ~4.000 |
| Criar página frontend | Manual (seção 8, 9) + arquivo .tsx alvo | ~3.000 |
| Integrar API externa | Manual + doc integrações | ~4.500 |
| Debug n8n | Manual (seção 7) + logs Supabase | ~2.500 |
| Sessão completa nova feature | Manual + PROJECT_STATE | ~3.500 base |

---

## Checklist de Início de Sessão

```
[ ] Carregar AI_OPERATING_MANUAL.md
[ ] Carregar PROJECT_STATE.md
[ ] Identificar a tarefa específica
[ ] Verificar se já existe no PROJECT_STATE.md
[ ] Verificar se RPC/workflow já existe no manual
[ ] Carregar apenas documentos adicionais necessários
[ ] Iniciar implementação
```

---

## O que NÃO Fazer

- Reenviar o Prompt Mestre completo (>5.000 tokens) a cada sessão
- Ler todos os arquivos do projeto "para entender o contexto"
- Carregar documentação de integrações quando a tarefa é só frontend
- Repetir conteúdo de migrations anteriores no contexto
- Pedir ao modelo para "resumir tudo que foi feito" — isso gasta tokens sem produzir valor

---

## Atualização dos Documentos-Base

Após cada sessão produtiva, atualizar:
1. `PROJECT_STATE.md` — o que foi implementado/concluído
2. `AI_OPERATING_MANUAL.md` seção 6 — se criou novos RPCs
3. `AI_OPERATING_MANUAL.md` seção 7 — se criou novos workflows

Custo de manutenção: ~500 tokens por atualização.  
Economia gerada: evita reprocessar documentação antiga em sessões futuras.
