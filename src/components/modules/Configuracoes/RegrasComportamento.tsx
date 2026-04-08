'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Toggle } from '@/components/ui/Toggle'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import {
  listHandoffRules, upsertHandoffRule,
  listSlaRules, upsertSlaRule,
  listFeatureFlags, updateFeatureFlag,
} from '@/lib/api'
import type { HandoffRule, SlaRule, FeatureFlag } from '@/types'
import { toast } from '@/components/ui/Toast'
import { AlertCircle, Plus, Edit3, Shield, Clock, Flag } from 'lucide-react'
import { fmtSeconds } from '@/lib/utils'
import { Tabs } from '@/components/ui/Tabs'

// ─── Handoff Rules ────────────────────────────────────────────────────────────

const triggerLabel: Record<string, string> = {
  keyword:  'Palavra-chave',
  sentiment: 'Sentimento',
  schedule: 'Horário',
  attempts: 'Tentativas',
}

function HandoffRulesSection() {
  const [rules, setRules] = useState<HandoffRule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<Partial<HandoffRule>>({
    rule_name: '', trigger_type: 'keyword', target_role: 'agent', is_active: true,
    trigger_config_jsonb: {},
  })

  const load = () => {
    listHandoffRules().then(setRules).catch(() => null).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const openNew = () => {
    setForm({ rule_name: '', trigger_type: 'keyword', target_role: 'agent', is_active: true, trigger_config_jsonb: {} })
    setModal(true)
  }

  const openEdit = (r: HandoffRule) => {
    setForm({ ...r })
    setModal(true)
  }

  const handleSave = async () => {
    if (!form.rule_name || !form.trigger_type || !form.target_role) {
      toast('Preencha os campos obrigatórios', 'error')
      return
    }
    setSaving(true)
    try {
      await upsertHandoffRule(form)
      toast('Regra salva')
      setModal(false)
      load()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{rules.length} regras</p>
        <Button variant="secondary" size="sm" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" /> Nova regra
        </Button>
      </div>

      {loading ? (
        <div className="h-20 flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-600" />
        </div>
      ) : rules.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Nenhuma regra de handoff</p>
      ) : (
        <ul className="space-y-2">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{r.rule_name}</p>
                <p className="text-xs text-gray-500">
                  {triggerLabel[r.trigger_type] ?? r.trigger_type} → {r.target_role}
                </p>
              </div>
              <Badge variant={r.is_active ? 'success' : 'default'}>
                {r.is_active ? 'Ativa' : 'Inativa'}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                <Edit3 className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Regra de handoff">
        <div className="space-y-4">
          <Input
            label="Nome da regra"
            value={form.rule_name ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, rule_name: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Tipo de gatilho"
              value={form.trigger_type ?? 'keyword'}
              onChange={(e) => setForm((p) => ({ ...p, trigger_type: e.target.value as HandoffRule['trigger_type'] }))}
              options={[
                { value: 'keyword',   label: 'Palavra-chave' },
                { value: 'sentiment', label: 'Sentimento'    },
                { value: 'schedule',  label: 'Horário'       },
                { value: 'attempts',  label: 'Tentativas'    },
              ]}
            />
            <Input
              label="Perfil alvo"
              value={form.target_role ?? 'agent'}
              onChange={(e) => setForm((p) => ({ ...p, target_role: e.target.value }))}
              placeholder="agent"
            />
          </div>
          {form.trigger_type === 'keyword' && (
            <Input
              label="Palavras-chave (separadas por vírgula)"
              value={String((form.trigger_config_jsonb as Record<string, unknown>)?.keywords ?? '')}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  trigger_config_jsonb: { keywords: e.target.value.split(',').map((k) => k.trim()) },
                }))
              }
              placeholder="urgente, reclamação, cancelar"
            />
          )}
          {form.trigger_type === 'attempts' && (
            <Input
              type="number"
              label="Máximo de tentativas"
              value={String((form.trigger_config_jsonb as Record<string, unknown>)?.max_attempts ?? 3)}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  trigger_config_jsonb: { max_attempts: parseInt(e.target.value) },
                }))
              }
            />
          )}
          <Toggle
            checked={form.is_active ?? true}
            onChange={(v) => setForm((p) => ({ ...p, is_active: v }))}
            label="Regra ativa"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>Salvar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── SLA Rules ────────────────────────────────────────────────────────────────

function SlaSection() {
  const [rules, setRules] = useState<SlaRule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<Partial<SlaRule>>({
    priority: '', first_response_seconds: 300, resolution_seconds: 3600,
    business_hours_only: true, is_active: true,
  })

  const load = () => {
    listSlaRules().then(setRules).catch(() => null).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const openNew = () => {
    setForm({ priority: '', first_response_seconds: 300, resolution_seconds: 3600, business_hours_only: true, is_active: true })
    setModal(true)
  }

  const openEdit = (r: SlaRule) => { setForm({ ...r }); setModal(true) }

  const handleSave = async () => {
    if (!form.priority) { toast('Informe a prioridade', 'error'); return }
    setSaving(true)
    try {
      await upsertSlaRule(form)
      toast('SLA salvo')
      setModal(false)
      load()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{rules.length} regras SLA</p>
        <Button variant="secondary" size="sm" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" /> Novo SLA
        </Button>
      </div>

      {loading ? (
        <div className="h-20 flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-600" />
        </div>
      ) : rules.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Nenhum SLA configurado</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100">
                <th className="text-left pb-2 pr-4">Prioridade</th>
                <th className="text-left pb-2 pr-4">1ª resposta</th>
                <th className="text-left pb-2 pr-4">Resolução</th>
                <th className="text-left pb-2 pr-4">Só horário comercial</th>
                <th className="text-left pb-2 pr-4">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="py-2 pr-4 font-medium">{r.priority}</td>
                  <td className="py-2 pr-4 text-gray-600">{fmtSeconds(r.first_response_seconds)}</td>
                  <td className="py-2 pr-4 text-gray-600">{fmtSeconds(r.resolution_seconds)}</td>
                  <td className="py-2 pr-4">{r.business_hours_only ? 'Sim' : 'Não'}</td>
                  <td className="py-2 pr-4">
                    <Badge variant={r.is_active ? 'success' : 'default'}>
                      {r.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  <td className="py-2">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                      <Edit3 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Regra de SLA">
        <div className="space-y-4">
          <Input
            label="Prioridade"
            value={form.priority ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
            placeholder="alta, media, baixa"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              label="Tempo 1ª resposta (segundos)"
              value={String(form.first_response_seconds ?? 300)}
              onChange={(e) => setForm((p) => ({ ...p, first_response_seconds: parseInt(e.target.value) }))}
            />
            <Input
              type="number"
              label="Tempo de resolução (segundos)"
              value={String(form.resolution_seconds ?? 3600)}
              onChange={(e) => setForm((p) => ({ ...p, resolution_seconds: parseInt(e.target.value) }))}
            />
          </div>
          <div className="space-y-3">
            <Toggle
              checked={form.business_hours_only ?? true}
              onChange={(v) => setForm((p) => ({ ...p, business_hours_only: v }))}
              label="Somente horário comercial"
            />
            <Toggle
              checked={form.is_active ?? true}
              onChange={(v) => setForm((p) => ({ ...p, is_active: v }))}
              label="SLA ativo"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>Salvar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Feature Flags ────────────────────────────────────────────────────────────

function FeatureFlagsSection() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [savingCode, setSavingCode] = useState<string | null>(null)

  useEffect(() => {
    listFeatureFlags().then(setFlags).catch(() => null).finally(() => setLoading(false))
  }, [])

  const handleToggle = async (flag: FeatureFlag, value: boolean) => {
    setSavingCode(flag.code)
    try {
      await updateFeatureFlag(flag.code, value)
      setFlags((prev) => prev.map((f) => f.code === flag.code ? { ...f, is_enabled: value } : f))
      toast(`${flag.code}: ${value ? 'habilitado' : 'desabilitado'}`)
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro', 'error')
    } finally {
      setSavingCode(null)
    }
  }

  if (loading)
    return (
      <div className="h-20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-600" />
      </div>
    )

  if (flags.length === 0)
    return <p className="text-sm text-gray-400 text-center py-6">Nenhuma feature flag</p>

  return (
    <ul className="space-y-3">
      {flags.map((flag) => (
        <li key={flag.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 font-mono">{flag.code}</p>
            {flag.config_jsonb && (
              <p className="text-xs text-gray-400 mt-0.5">
                {JSON.stringify(flag.config_jsonb)}
              </p>
            )}
          </div>
          <Toggle
            checked={flag.is_enabled}
            onChange={(v) => handleToggle(flag, v)}
            disabled={savingCode === flag.code}
          />
        </li>
      ))}
    </ul>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const tabs = [
  { id: 'handoff', label: 'Regras de handoff', icon: Shield },
  { id: 'sla',     label: 'SLA',               icon: Clock  },
  { id: 'flags',   label: 'Feature flags',     icon: Flag   },
]

export function RegrasComportamento() {
  const [tab, setTab] = useState('handoff')

  return (
    <div className="space-y-5 max-w-3xl">
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      <div>
        {tab === 'handoff' && <HandoffRulesSection />}
        {tab === 'sla'     && <SlaSection />}
        {tab === 'flags'   && <FeatureFlagsSection />}
      </div>
    </div>
  )
}
