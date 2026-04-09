'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Toggle } from '@/components/ui/Toggle'
import { Slider } from '@/components/ui/Slider'
import { Modal } from '@/components/ui/Modal'
import { getAiAgent, updateAiAgent, listPromptTemplates, upsertPromptTemplate } from '@/lib/api'
import type { AiAgent, PromptTemplate } from '@/types'
import { toast } from '@/components/ui/Toast'
import { AlertCircle, Plus, Edit3, Eye } from 'lucide-react'
import { fmtDateTime } from '@/lib/utils'

const DEFAULT_AGENT: AiAgent = {
  id: '',
  tenant_id: '',
  name: 'Agente Principal',
  status: 'active',
  model_name: 'claude-sonnet-4-20250514',
  system_prompt: '',
  temperature: 0.7,
  max_tokens: 2048,
  updated_at: '',
}

// Highlight {{variables}} in text
function PromptPreview({ text }: { text: string }) {
  const parts = text.split(/({{[^}]+}})/g)
  return (
    <div className="font-mono text-xs leading-relaxed text-gray-700 whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        part.startsWith('{{') ? (
          <span key={i} className="bg-yellow-100 text-yellow-800 px-0.5 rounded">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </div>
  )
}

export function PromptModelo() {
  const [agent, setAgent] = useState<AiAgent | null>(null)
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [templateModal, setTemplateModal] = useState<PromptTemplate | null>(null)
  const [newTemplate, setNewTemplate] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [tplForm, setTplForm] = useState<Partial<PromptTemplate>>({
    code: '', title: '', prompt_text: '', is_active: true,
  })

  useEffect(() => {
    Promise.all([getAiAgent(), listPromptTemplates()])
      .then(([a, t]) => { setAgent(a ?? DEFAULT_AGENT); setTemplates(t) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const set = <K extends keyof AiAgent>(key: K, value: AiAgent[K]) =>
    setAgent((prev) => prev ? { ...prev, [key]: value } : prev)

  const handleSaveAgent = async () => {
    if (!agent) return
    setSaving(true)
    try {
      await updateAiAgent(agent)
      toast('Configurações do modelo salvas')
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const openEditTemplate = (tpl: PromptTemplate) => {
    setTplForm({ ...tpl })
    setTemplateModal(tpl)
    setNewTemplate(false)
  }

  const openNewTemplate = () => {
    setTplForm({ code: '', title: '', prompt_text: '', is_active: true })
    setNewTemplate(true)
    setTemplateModal({} as PromptTemplate)
  }

  const handleSaveTemplate = async () => {
    if (!tplForm.code || !tplForm.title || !tplForm.prompt_text) {
      toast('Preencha todos os campos obrigatórios', 'error')
      return
    }
    setSaving(true)
    try {
      await upsertPromptTemplate({
        code: tplForm.code!,
        title: tplForm.title!,
        prompt_text: tplForm.prompt_text!,
        is_active: tplForm.is_active ?? true,
      })
      toast('Template salvo')
      setTemplateModal(null)
      const updated = await listPromptTemplates()
      setTemplates(updated)
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar template', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
      </div>
    )

  if (error)
    return (
      <div className="flex items-center gap-2 text-red-600 p-3 bg-red-50 rounded-lg text-sm">
        <AlertCircle className="h-4 w-4" /> {error}
      </div>
    )

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Agent config */}
      {agent && (
        <section className="space-y-5">
          <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">
            Configuração do modelo LLM
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nome técnico do agente"
              value={agent.name}
              onChange={(e) => set('name', e.target.value)}
            />
            <Select
              label="Modelo LLM"
              value={agent.model_name}
              onChange={(e) => set('model_name', e.target.value)}
              options={[
                { value: 'claude-sonnet-4-20250514',  label: 'Claude Sonnet 4 (recomendado)' },
                { value: 'claude-opus-4-20250514',    label: 'Claude Opus 4 (máxima qualidade)' },
                { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (mais rápido)'  },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Slider
              label="Temperature"
              value={agent.temperature}
              onChange={(v) => set('temperature', v)}
              min={0}
              max={1}
              step={0.05}
              formatValue={(v) => v.toFixed(2)}
              hint="0 = mais determinístico · 1 = mais criativo"
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Max tokens</label>
              <input
                type="number"
                min={256}
                max={8192}
                step={256}
                value={agent.max_tokens}
                onChange={(e) => set('max_tokens', parseInt(e.target.value))}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <p className="text-xs text-gray-500">Limite de tokens na resposta</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">System prompt</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewOpen(true)}
              >
                <Eye className="h-3.5 w-3.5" /> Preview
              </Button>
            </div>
            <textarea
              rows={14}
              value={agent.system_prompt}
              onChange={(e) => set('system_prompt', e.target.value)}
              className="prompt-editor block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-y"
              placeholder="Você é Sofia, uma assistente de atendimento da Clínica..."
              spellCheck={false}
            />
            <p className="text-xs text-gray-500 mt-1">
              Use <code className="bg-gray-100 px-1 rounded">{'{{'+'variavel'+'}}'}</code> para
              inserir dados dinâmicos (ex: <code className="bg-gray-100 px-1 rounded">{'{{'+'cliente_nome'+'}}'}</code>)
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveAgent} loading={saving}>
              Salvar configurações do modelo
            </Button>
          </div>
        </section>
      )}

      {/* Prompt templates */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <h3 className="text-sm font-semibold text-gray-900">Templates de prompt</h3>
          <Button variant="secondary" size="sm" onClick={openNewTemplate}>
            <Plus className="h-3.5 w-3.5" /> Novo template
          </Button>
        </div>

        {templates.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            Nenhum template cadastrado
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{tpl.title}</p>
                    <p className="text-xs text-gray-500 font-mono">{tpl.code}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        tpl.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {tpl.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                    <span className="text-xs text-gray-400">v{tpl.version}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-600 line-clamp-2">{tpl.prompt_text}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400">{fmtDateTime(tpl.updated_at)}</p>
                  <Button variant="ghost" size="sm" onClick={() => openEditTemplate(tpl)}>
                    <Edit3 className="h-3 w-3" /> Editar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Preview modal */}
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Preview do system prompt"
        size="xl"
      >
        <div className="bg-gray-50 rounded-lg p-4 max-h-[60vh] overflow-y-auto">
          {agent && <PromptPreview text={agent.system_prompt} />}
        </div>
      </Modal>

      {/* Template edit modal */}
      <Modal
        open={!!templateModal}
        onClose={() => setTemplateModal(null)}
        title={newTemplate ? 'Novo template' : 'Editar template'}
        size="xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Código (único)"
              value={tplForm.code ?? ''}
              onChange={(e) => setTplForm((p) => ({ ...p, code: e.target.value }))}
              placeholder="ex: saudacao_inicial"
              disabled={!newTemplate}
            />
            <Input
              label="Título"
              value={tplForm.title ?? ''}
              onChange={(e) => setTplForm((p) => ({ ...p, title: e.target.value }))}
            />
          </div>
          <Textarea
            label="Texto do prompt"
            rows={8}
            value={tplForm.prompt_text ?? ''}
            onChange={(e) => setTplForm((p) => ({ ...p, prompt_text: e.target.value }))}
            className="prompt-editor"
            placeholder="Olá {{cliente_nome}}! Bem-vindo à {{negocio_nome}}..."
          />
          <Toggle
            checked={tplForm.is_active ?? true}
            onChange={(v) => setTplForm((p) => ({ ...p, is_active: v }))}
            label="Template ativo"
            description="Somente templates ativos são usados pelo agente"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setTemplateModal(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveTemplate} loading={saving}>
              Salvar template
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
