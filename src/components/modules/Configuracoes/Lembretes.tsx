'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { listReminderRules, upsertReminderRule, deleteReminderRule, listMessageTemplates } from '@/lib/api'
import type { ReminderRule, MessageTemplate } from '@/types'
import { toast } from '@/components/ui/Toast'
import { Bell, Plus, Edit3, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const TRIGGER_TYPE_OPTIONS = [
  { value: 'appointment_before', label: 'Antes do agendamento'     },
  { value: 'appointment_day',    label: 'No dia do agendamento'    },
  { value: 'post_appointment',   label: 'Após o agendamento'       },
  { value: 'no_show',            label: 'Após não comparecimento'  },
]

const TRIGGER_LABEL: Record<string, string> = Object.fromEntries(
  TRIGGER_TYPE_OPTIONS.map((o) => [o.value, o.label])
)

const defaultForm = {
  name: '',
  trigger_type: 'appointment_before',
  hours_before: 24,
  template_id: '',
  is_active: true,
  prep_notes: '',
  include_recommendations: false,
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Lembretes() {
  const [rules, setRules]       = useState<ReminderRule[]>([])
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [editId, setEditId]     = useState<string | undefined>()
  const [form, setForm]         = useState(defaultForm)
  const [saving, setSaving]     = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.allSettled([listReminderRules(), listMessageTemplates()])
      .then(([r, t]) => {
        if (r.status === 'fulfilled') setRules(r.value)
        if (t.status === 'fulfilled') setTemplates(t.value.filter((t) => t.status === 'approved'))
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const openNew = () => {
    setEditId(undefined)
    setForm(defaultForm)
    setModal(true)
  }

  const openEdit = (r: ReminderRule) => {
    setEditId(r.id)
    setForm({
      name:                    r.name,
      trigger_type:            r.trigger_type,
      hours_before:            r.hours_before ?? 24,
      template_id:             r.template_id ?? '',
      is_active:               r.is_active,
      prep_notes:              r.config_jsonb?.prep_notes ?? '',
      include_recommendations: r.config_jsonb?.include_recommendations ?? false,
    })
    setModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast('Nome é obrigatório', 'error'); return }
    setSaving(true)
    try {
      await upsertReminderRule({
        id:                       editId,
        name:                     form.name,
        trigger_type:             form.trigger_type,
        hours_before:             Number(form.hours_before),
        template_id:              form.template_id || undefined,
        is_active:                form.is_active,
        prep_notes:               form.prep_notes,
        include_recommendations:  form.include_recommendations,
      })
      toast(editId ? 'Regra atualizada' : 'Regra criada')
      setModal(false)
      load()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (r: ReminderRule) => {
    if (!confirm(`Excluir regra "${r.name}"?`)) return
    try {
      await deleteReminderRule(r.id)
      toast('Regra excluída')
      load()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao excluir', 'error')
    }
  }

  const handleToggle = async (r: ReminderRule) => {
    try {
      await upsertReminderRule({
        id:                      r.id,
        name:                    r.name,
        trigger_type:            r.trigger_type,
        hours_before:            r.hours_before ?? 24,
        template_id:             r.template_id,
        is_active:               !r.is_active,
        prep_notes:              r.config_jsonb?.prep_notes,
        include_recommendations: r.config_jsonb?.include_recommendations,
      })
      setRules((prev) => prev.map((x) => x.id === r.id ? { ...x, is_active: !r.is_active } : x))
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao atualizar', 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Regras de lembrete</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure quando e como o agente envia lembretes automáticos de agendamento.
            Inclua notas de preparo para o cliente receber orientações antes do atendimento.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" /> Nova regra
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Bell className="h-10 w-10 mb-3" />
          <p className="text-sm">Nenhuma regra de lembrete configurada</p>
        </div>
      ) : (
        <Card padding={false}>
          <ul className="divide-y divide-gray-100">
            {rules.map((r) => {
              const hasPrepNotes = !!r.config_jsonb?.prep_notes
              const tmpl = templates.find((t) => t.id === r.template_id)
              return (
                <li key={r.id} className="flex items-start gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-gray-900">{r.name}</p>
                      <Badge variant={r.is_active ? 'success' : 'default'}>
                        {r.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                      {hasPrepNotes && (
                        <Badge variant="info">Com notas de preparo</Badge>
                      )}
                      {r.config_jsonb?.include_recommendations && (
                        <Badge variant="warning">+ Recomendações</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {TRIGGER_LABEL[r.trigger_type] ?? r.trigger_type}
                      {r.hours_before != null && ` · ${r.hours_before}h de antecedência`}
                      {tmpl && ` · Template: ${tmpl.name}`}
                    </p>
                    {hasPrepNotes && (
                      <p className="text-xs text-gray-400 italic mt-1 line-clamp-2">
                        {r.config_jsonb.prep_notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                    <button
                      onClick={() => handleToggle(r)}
                      title={r.is_active ? 'Desativar' : 'Ativar'}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                    >
                      {r.is_active
                        ? <ToggleRight className="h-5 w-5 text-brand-600" />
                        : <ToggleLeft className="h-5 w-5" />}
                    </button>
                    <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? 'Editar regra de lembrete' : 'Nova regra de lembrete'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Nome da regra *"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Ex: Lembrete 24h antes"
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Tipo de gatilho"
              value={form.trigger_type}
              onChange={(e) => setForm((p) => ({ ...p, trigger_type: e.target.value }))}
              options={TRIGGER_TYPE_OPTIONS}
            />
            <Input
              label="Horas de antecedência"
              type="number"
              min={0}
              max={720}
              value={form.hours_before}
              onChange={(e) => setForm((p) => ({ ...p, hours_before: Number(e.target.value) }))}
              hint="0 = no momento do evento"
            />
          </div>

          <Select
            label="Template de mensagem"
            value={form.template_id}
            onChange={(e) => setForm((p) => ({ ...p, template_id: e.target.value }))}
            options={[
              { value: '', label: 'Sem template (mensagem gerada pela IA)' },
              ...templates.map((t) => ({ value: t.id, label: t.name })),
            ]}
          />

          <Textarea
            label="Notas de preparo para o cliente"
            rows={4}
            value={form.prep_notes}
            onChange={(e) => setForm((p) => ({ ...p, prep_notes: e.target.value }))}
            placeholder={"Ex: Por favor, chegue com 15 minutos de antecedência.\nEvite aplicar cremes ou maquiagem no rosto no dia do procedimento.\nTraga documento de identidade."}
            hint="Estas notas são incluídas na mensagem de lembrete enviada ao cliente."
          />

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              checked={form.include_recommendations}
              onChange={(e) => setForm((p) => ({ ...p, include_recommendations: e.target.checked }))}
            />
            <div>
              <p className="text-sm font-medium text-gray-700">Incluir recomendações de serviços</p>
              <p className="text-xs text-gray-500 mt-0.5">
                A IA adicionará sugestões de serviços complementares com base no histórico do cliente.
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer pt-1">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              checked={form.is_active}
              onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
            />
            <span className="text-sm font-medium text-gray-700">Regra ativa</span>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>
              {editId ? 'Salvar alterações' : 'Criar regra'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
