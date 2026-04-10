'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Tabs } from '@/components/ui/Tabs'
import { listFeatureFlags, updateFeatureFlag, getTenantSettings, listAllTenants, upsertTenant, deleteTenant } from '@/lib/api'
import type { FeatureFlag, TenantSettings, Tenant } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/Toast'
import { ShieldCheck, ToggleLeft, ToggleRight, Settings2, Building2, Plus, Edit3, Trash2 } from 'lucide-react'
import { fmtDateTime } from '@/lib/utils'

// ─── Feature Flags tab ────────────────────────────────────────────────────────

function FeatureFlagsTab() {
  const [flags, setFlags]   = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    listFeatureFlags()
      .then(setFlags)
      .catch(() => setFlags([]))
      .finally(() => setLoading(false))
  }, [])

  const toggle = async (flag: FeatureFlag) => {
    setSaving(flag.code)
    try {
      await updateFeatureFlag(flag.code, !flag.is_enabled, flag.config_jsonb)
      setFlags(prev => prev.map(f => f.code === flag.code ? { ...f, is_enabled: !f.is_enabled } : f))
      toast(`${flag.code}: ${!flag.is_enabled ? 'ativado' : 'desativado'}`)
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao atualizar flag', 'error')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
      </div>
    )
  }

  if (flags.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <ToggleLeft className="h-10 w-10 mb-3" />
        <p className="text-sm">Nenhuma feature flag configurada</p>
      </div>
    )
  }

  return (
    <Card padding={false}>
      <ul className="divide-y divide-gray-100">
        {flags.map(flag => (
          <li key={flag.id} className="flex items-center gap-4 px-6 py-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 font-mono">{flag.code}</p>
              {flag.config_jsonb && Object.keys(flag.config_jsonb).length > 0 && (
                <p className="text-xs text-gray-400 truncate mt-0.5">
                  {JSON.stringify(flag.config_jsonb)}
                </p>
              )}
            </div>
            <Badge variant={flag.is_enabled ? 'success' : 'default'}>
              {flag.is_enabled ? 'Ativo' : 'Inativo'}
            </Badge>
            <button
              onClick={() => toggle(flag)}
              disabled={saving === flag.code}
              className="text-gray-400 hover:text-brand-600 transition-colors disabled:opacity-40"
              title={flag.is_enabled ? 'Desativar' : 'Ativar'}
            >
              {saving === flag.code ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
              ) : flag.is_enabled ? (
                <ToggleRight className="h-6 w-6 text-brand-600" />
              ) : (
                <ToggleLeft className="h-6 w-6" />
              )}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

// ─── Tenant Info tab ──────────────────────────────────────────────────────────

const intakeModeLabel: Record<string, string> = {
  bot_first:   'Bot primeiro',
  human_first: 'Humano primeiro',
  mixed:       'Misto',
}

function TenantInfoTab() {
  const [settings, setSettings] = useState<TenantSettings | null>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    getTenantSettings()
      .then(setSettings)
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Building2 className="h-10 w-10 mb-3" />
        <p className="text-sm">Dados do tenant não encontrados</p>
      </div>
    )
  }

  const rows: Array<{ label: string; value: string | React.ReactNode }> = [
    { label: 'Nome do negócio',    value: settings.business_name },
    { label: 'Timezone',           value: settings.timezone },
    { label: 'Idioma',             value: settings.language },
    { label: 'Modo de intake',     value: intakeModeLabel[settings.intake_mode] ?? settings.intake_mode },
    { label: 'Auto-criar cliente', value: settings.auto_create_customer ? <Badge variant="success">Sim</Badge> : <Badge variant="default">Não</Badge> },
    { label: 'Aprovação humana (alto risco)', value: settings.human_approval_high_risk ? <Badge variant="warning">Ativado</Badge> : <Badge variant="default">Desativado</Badge> },
    { label: 'Permitir áudio',     value: settings.allow_audio ? <Badge variant="success">Sim</Badge> : <Badge variant="default">Não</Badge> },
    { label: 'Permitir imagem',    value: settings.allow_image ? <Badge variant="success">Sim</Badge> : <Badge variant="default">Não</Badge> },
    { label: 'Permitir voz',       value: settings.allow_voice ? <Badge variant="success">Sim</Badge> : <Badge variant="default">Não</Badge> },
  ]

  return (
    <Card padding={false}>
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Configurações do tenant</p>
        <a
          href="/configuracoes"
          className="text-xs text-brand-600 hover:underline flex items-center gap-1"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Editar em Configurações
        </a>
      </div>
      <ul className="divide-y divide-gray-100">
        {rows.map(r => (
          <li key={String(r.label)} className="flex items-center justify-between px-6 py-3.5">
            <span className="text-sm text-gray-600">{r.label}</span>
            <span className="text-sm font-medium text-gray-900">{r.value}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

// ─── Tenants tab (owner only) ─────────────────────────────────────────────────

const TENANT_STATUS_OPTIONS = [
  { value: 'active',    label: 'Ativo'      },
  { value: 'trial',     label: 'Trial'      },
  { value: 'suspended', label: 'Suspenso'   },
  { value: 'cancelled', label: 'Cancelado'  },
]

const TENANT_STATUS_VARIANT: Record<string, 'success' | 'info' | 'error' | 'default' | 'warning'> = {
  active:    'success',
  trial:     'info',
  suspended: 'warning',
  cancelled: 'error',
}

const defaultTenantForm = { name: '', slug: '', status: 'active', plan: '', timezone: 'America/Sao_Paulo', locale: 'pt_BR' }

function TenantsTab() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [editId, setEditId]   = useState<string | undefined>()
  const [form, setForm]       = useState(defaultTenantForm)
  const [saving, setSaving]   = useState(false)

  const load = () => {
    setLoading(true)
    listAllTenants()
      .then(setTenants)
      .catch(() => setTenants([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setEditId(undefined); setForm(defaultTenantForm); setModal(true) }
  const openEdit = (t: Tenant) => {
    setEditId(t.id)
    setForm({ name: t.name, slug: t.slug, status: t.status, plan: t.plan ?? '', timezone: t.timezone, locale: t.locale })
    setModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast('Nome é obrigatório', 'error'); return }
    setSaving(true)
    try {
      await upsertTenant({ id: editId, ...form, plan: form.plan || undefined } as Partial<Tenant>)
      toast(editId ? 'Tenant atualizado' : 'Tenant criado')
      setModal(false)
      load()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (t: Tenant) => {
    if (!confirm(`Excluir tenant "${t.name}"? Esta ação é irreversível.`)) return
    try {
      await deleteTenant(t.id)
      toast('Tenant excluído')
      load()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao excluir', 'error')
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{tenants.length} tenant{tenants.length !== 1 ? 's' : ''} cadastrado{tenants.length !== 1 ? 's' : ''}</p>
        <Button size="sm" variant="secondary" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" /> Novo tenant
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
        </div>
      ) : tenants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Building2 className="h-10 w-10 mb-3" />
          <p className="text-sm">Nenhum tenant cadastrado</p>
        </div>
      ) : (
        <Card padding={false}>
          <ul className="divide-y divide-gray-100">
            {tenants.map((t) => (
              <li key={t.id} className="flex items-center gap-4 px-6 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                    <Badge variant={TENANT_STATUS_VARIANT[t.status] ?? 'default'}>{t.status}</Badge>
                    {t.plan && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">{t.plan}</span>}
                  </div>
                  <p className="text-xs text-gray-400">
                    {t.slug} · {t.member_count ?? 0} usuário{(t.member_count ?? 0) !== 1 ? 's' : ''} · Criado em {fmtDateTime(t.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(t)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar tenant' : 'Novo tenant'}>
        <div className="space-y-4">
          <Input label="Nome *" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ex: Clínica São Paulo" />
          <Input label="Slug" value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} placeholder="clinica-sao-paulo" hint="Gerado automaticamente se vazio" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Status" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} options={TENANT_STATUS_OPTIONS} />
            <Input label="Plano" value={form.plan} onChange={(e) => setForm((p) => ({ ...p, plan: e.target.value }))} placeholder="basic / pro / enterprise" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Timezone" value={form.timezone} onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))} placeholder="America/Sao_Paulo" />
            <Input label="Locale" value={form.locale} onChange={(e) => setForm((p) => ({ ...p, locale: e.target.value }))} placeholder="pt_BR" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>{editId ? 'Salvar' : 'Criar tenant'}</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdministracaoPage() {
  const { role } = useAuth()
  const isOwner  = role === 'owner'
  const [tab, setTab] = useState('flags')

  const pageTabs = [
    { id: 'flags',   label: 'Feature Flags', icon: ToggleRight },
    { id: 'tenant',  label: 'Tenant',        icon: Building2   },
    ...(isOwner ? [{ id: 'tenants', label: 'Todos os Tenants', icon: ShieldCheck }] : []),
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gray-100">
          <ShieldCheck className="h-5 w-5 text-gray-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Administração</h1>
          <p className="text-sm text-gray-500 mt-0.5">Feature flags e configurações do tenant{isOwner && ' · Painel super-admin'}</p>
        </div>
      </div>

      <Tabs tabs={pageTabs} active={tab} onChange={setTab} />

      <div>
        {tab === 'flags'   && <FeatureFlagsTab />}
        {tab === 'tenant'  && <TenantInfoTab  />}
        {tab === 'tenants' && isOwner && <TenantsTab />}
      </div>
    </div>
  )
}
