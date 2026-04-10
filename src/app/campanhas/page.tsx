'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Tabs } from '@/components/ui/Tabs'
import {
  listCampaigns, upsertCampaign, updateCampaignStatus, deleteCampaign,
  listMessageTemplates, upsertMessageTemplate,
} from '@/lib/api'
import type { Campaign, MessageTemplate } from '@/types'
import { toast } from '@/components/ui/Toast'
import { fmtDateTime } from '@/lib/utils'
import {
  Megaphone, FileText, Plus, Edit3, Trash2,
  Play, Pause, CheckCircle2, Clock, Send, Users,
} from 'lucide-react'
import { VariablesReference } from '@/components/ui/VariablesReference'

// ─── Constants ────────────────────────────────────────────────────────────────

const CAMPAIGN_STATUS: Record<string, { label: string; variant: 'default' | 'info' | 'success' | 'warning' | 'error' }> = {
  draft:     { label: 'Rascunho',      variant: 'default' },
  scheduled: { label: 'Agendada',      variant: 'info'    },
  running:   { label: 'Em andamento',  variant: 'warning' },
  completed: { label: 'Concluída',     variant: 'success' },
  paused:    { label: 'Pausada',       variant: 'default' },
}

const TEMPLATE_STATUS: Record<string, { label: string; variant: 'default' | 'success' | 'error' | 'warning' }> = {
  approved: { label: 'Aprovado',  variant: 'success' },
  pending:  { label: 'Pendente',  variant: 'warning' },
  rejected: { label: 'Rejeitado', variant: 'error'   },
}

const CATEGORIES = [
  { value: 'utility',        label: 'Utilidade'       },
  { value: 'marketing',      label: 'Marketing'       },
  { value: 'authentication', label: 'Autenticação'    },
]

const LANGUAGES = [
  { value: 'pt_BR', label: 'Português (Brasil)' },
  { value: 'pt_PT', label: 'Português (Portugal)' },
  { value: 'en_US', label: 'English (US)'         },
  { value: 'es_ES', label: 'Español'              },
]

const PAGE_TABS = [
  { id: 'campaigns', label: 'Campanhas', icon: Megaphone },
  { id: 'templates', label: 'Templates', icon: FileText  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getBodyText(components: unknown): string {
  if (!Array.isArray(components)) return ''
  const body = (components as Array<Record<string, unknown>>).find((c) => c.type === 'BODY')
  return typeof body?.text === 'string' ? body.text : ''
}

function buildComponents(header: string, body: string, footer: string): unknown[] {
  const parts: unknown[] = []
  if (header.trim()) parts.push({ type: 'HEADER', format: 'TEXT', text: header.trim() })
  if (body.trim())   parts.push({ type: 'BODY',   text: body.trim() })
  if (footer.trim()) parts.push({ type: 'FOOTER', text: footer.trim() })
  return parts
}

function extractComponent(components: unknown, type: string): string {
  if (!Array.isArray(components)) return ''
  const c = (components as Array<Record<string, unknown>>).find((x) => x.type === type)
  return typeof c?.text === 'string' ? c.text : ''
}

// ─── Campaign Card ────────────────────────────────────────────────────────────

function CampaignCard({
  c, templates, onEdit, onDelete, onStatus,
}: {
  c: Campaign
  templates: MessageTemplate[]
  onEdit: () => void
  onDelete: () => void
  onStatus: (status: string) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const s    = CAMPAIGN_STATUS[c.status] ?? { label: c.status, variant: 'default' as const }
  const pct  = c.target_count && c.target_count > 0 ? Math.min(100, ((c.sent_count ?? 0) / c.target_count) * 100) : 0
  const tmpl = templates.find((t) => t.id === c.template_id)

  const act = async (status: string) => {
    setBusy(true)
    await onStatus(status).finally(() => setBusy(false))
  }

  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg bg-brand-50`}>
          <Megaphone className="h-4 w-4 text-brand-600" />
        </div>
        <Badge variant={s.variant}>{s.label}</Badge>
      </div>

      <h3 className="text-sm font-semibold text-gray-900 mb-1">{c.name}</h3>

      {tmpl && (
        <p className="text-xs text-gray-500 mb-2 truncate">
          <FileText className="h-3 w-3 inline mr-1" />{tmpl.name}
        </p>
      )}

      {/* Progress */}
      {(c.target_count ?? 0) > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span className="flex items-center gap-1"><Send className="h-3 w-3" />{c.sent_count ?? 0} enviados</span>
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.target_count} alvo</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${c.status === 'completed' ? 'bg-green-500' : 'bg-brand-500'}`}
              style={{ width: `${pct.toFixed(1)}%` }}
            />
          </div>
        </div>
      )}

      {c.scheduled_at && (
        <p className="text-xs text-gray-400 flex items-center gap-1 mb-2">
          <Clock className="h-3 w-3" />{fmtDateTime(c.scheduled_at)}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-auto">
        <div className="flex gap-1">
          {(c.status === 'draft' || c.status === 'paused') && (
            <button
              onClick={() => act(c.scheduled_at ? 'scheduled' : 'running')}
              disabled={busy}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-40 transition-colors"
            >
              <Play className="h-3 w-3" /> Iniciar
            </button>
          )}
          {(c.status === 'running' || c.status === 'scheduled') && (
            <button
              onClick={() => act('paused')}
              disabled={busy}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-40 transition-colors"
            >
              <Pause className="h-3 w-3" /> Pausar
            </button>
          )}
          {c.status === 'running' && (
            <button
              onClick={() => act('completed')}
              disabled={busy}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 transition-colors"
            >
              <CheckCircle2 className="h-3 w-3" /> Concluir
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {c.status === 'draft' && (
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Edit3 className="h-3 w-3" /> Editar
            </Button>
          )}
          {c.status === 'draft' && (
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-500 hover:text-red-700 hover:bg-red-50">
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({
  t, onEdit,
}: { t: MessageTemplate; onEdit: () => void }) {
  const s    = TEMPLATE_STATUS[t.status] ?? { label: t.status, variant: 'default' as const }
  const body = getBodyText(t.components)
  const cat  = CATEGORIES.find((c) => c.value === t.category)?.label ?? t.category

  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg bg-indigo-50">
          <FileText className="h-4 w-4 text-indigo-600" />
        </div>
        <Badge variant={s.variant}>{s.label}</Badge>
      </div>

      <h3 className="text-sm font-semibold text-gray-900 mb-1">{t.name}</h3>
      <p className="text-xs text-gray-400 mb-2">
        {cat} · {t.language}
        {t.template_type === 'zapi' && <span className="ml-1 text-indigo-500 font-medium">· Z-API</span>}
      </p>

      {body && (
        <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2.5 line-clamp-3 mb-2 whitespace-pre-line">
          {body}
        </p>
      )}

      <div className="flex justify-end pt-2 border-t border-gray-100">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Edit3 className="h-3 w-3" /> Editar
        </Button>
      </div>
    </Card>
  )
}

// ─── Default forms ────────────────────────────────────────────────────────────

const defaultCampaign: Partial<Campaign> = { name: '', status: 'draft', template_id: undefined, scheduled_at: undefined }
const TEMPLATE_TYPES = [
  { value: 'zapi',     label: 'Z-API (sem aprovação)'      },
  { value: 'official', label: 'API Oficial (requer aprovação Meta)' },
]

const defaultTemplate = { name: '', category: 'utility', language: 'pt_BR', template_type: 'zapi', header: '', body: '', footer: '' }

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CampanhasPage() {
  const [tab, setTab]                   = useState('campaigns')
  const [campaigns, setCampaigns]       = useState<Campaign[]>([])
  const [templates, setTemplates]       = useState<MessageTemplate[]>([])
  const [loading, setLoading]           = useState(true)

  // Campaign modal
  const [cmpModal, setCmpModal]   = useState(false)
  const [cmpForm, setCmpForm]     = useState<Partial<Campaign>>(defaultCampaign)
  const [cmpSaving, setCmpSaving] = useState(false)

  // Template modal
  const [tmplModal, setTmplModal]   = useState(false)
  const [tmplForm, setTmplForm]     = useState(defaultTemplate)
  const [tmplId, setTmplId]         = useState<string | undefined>()
  const [tmplSaving, setTmplSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.allSettled([listCampaigns(), listMessageTemplates()])
      .then(([c, t]) => {
        if (c.status === 'fulfilled') setCampaigns(c.value)
        if (t.status === 'fulfilled') setTemplates(t.value)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // ── Campaign CRUD ───────────────────────────────────────────────────────────

  const openNewCampaign  = () => { setCmpForm(defaultCampaign); setCmpModal(true) }
  const openEditCampaign = (c: Campaign) => { setCmpForm({ ...c }); setCmpModal(true) }

  const handleSaveCampaign = async () => {
    if (!cmpForm.name?.trim()) { toast('Nome da campanha é obrigatório', 'error'); return }
    setCmpSaving(true)
    try {
      await upsertCampaign(cmpForm)
      toast(cmpForm.id ? 'Campanha atualizada' : 'Campanha criada')
      setCmpModal(false)
      load()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar', 'error')
    } finally {
      setCmpSaving(false)
    }
  }

  const handleCampaignStatus = async (id: string, status: string) => {
    try {
      await updateCampaignStatus(id, status)
      setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, status: status as Campaign['status'] } : c))
      toast(CAMPAIGN_STATUS[status]?.label ?? status)
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao atualizar', 'error')
    }
  }

  const handleDeleteCampaign = async (c: Campaign) => {
    if (!confirm(`Excluir campanha "${c.name}"?`)) return
    try {
      await deleteCampaign(c.id)
      toast('Campanha excluída')
      load()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao excluir', 'error')
    }
  }

  // ── Template CRUD ───────────────────────────────────────────────────────────

  const openNewTemplate = () => {
    setTmplId(undefined)
    setTmplForm(defaultTemplate)
    setTmplModal(true)
  }

  const openEditTemplate = (t: MessageTemplate) => {
    setTmplId(t.id)
    setTmplForm({
      name:          t.name,
      category:      t.category,
      language:      t.language,
      template_type: t.template_type ?? 'official',
      header:        extractComponent(t.components, 'HEADER'),
      body:          extractComponent(t.components, 'BODY'),
      footer:        extractComponent(t.components, 'FOOTER'),
    })
    setTmplModal(true)
  }

  const handleSaveTemplate = async () => {
    if (!tmplForm.name.trim()) { toast('Nome do template é obrigatório', 'error'); return }
    if (!tmplForm.body.trim()) { toast('Corpo do template é obrigatório', 'error'); return }
    setTmplSaving(true)
    try {
      await upsertMessageTemplate({
        id:            tmplId,
        name:          tmplForm.name,
        category:      tmplForm.category,
        language:      tmplForm.language,
        template_type: tmplForm.template_type as 'zapi' | 'official',
        components:    buildComponents(tmplForm.header, tmplForm.body, tmplForm.footer),
      })
      toast(tmplId ? 'Template atualizado' : 'Template criado')
      setTmplModal(false)
      load()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar', 'error')
    } finally {
      setTmplSaving(false)
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const approvedTemplates = useMemo(() => templates.filter((t) => t.status === 'approved'), [templates])

  const stats = useMemo(() => ({
    total:    campaigns.length,
    active:   campaigns.filter((c) => c.status === 'running').length,
    scheduled: campaigns.filter((c) => c.status === 'scheduled').length,
    sent:     campaigns.reduce((acc, c) => acc + (c.sent_count ?? 0), 0),
  }), [campaigns])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Campanhas e Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {stats.active} ativa{stats.active !== 1 ? 's' : ''} · {stats.scheduled} agendada{stats.scheduled !== 1 ? 's' : ''} · {stats.sent.toLocaleString('pt-BR')} mensagens enviadas
          </p>
        </div>
        <Button
          variant="secondary" size="sm"
          onClick={tab === 'campaigns' ? openNewCampaign : openNewTemplate}
        >
          <Plus className="h-3.5 w-3.5" />
          {tab === 'campaigns' ? 'Nova campanha' : 'Novo template'}
        </Button>
      </div>

      <Tabs tabs={PAGE_TABS} active={tab} onChange={setTab} />

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
        </div>
      ) : tab === 'campaigns' ? (
        campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Megaphone className="h-10 w-10 mb-3" />
            <p className="text-sm">Nenhuma campanha criada</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {campaigns.map((c) => (
              <CampaignCard
                key={c.id} c={c} templates={templates}
                onEdit={() => openEditCampaign(c)}
                onDelete={() => handleDeleteCampaign(c)}
                onStatus={(status) => handleCampaignStatus(c.id, status)}
              />
            ))}
          </div>
        )
      ) : (
        templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <FileText className="h-10 w-10 mb-3" />
            <p className="text-sm">Nenhum template cadastrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {templates.map((t) => (
              <TemplateCard key={t.id} t={t} onEdit={() => openEditTemplate(t)} />
            ))}
          </div>
        )
      )}

      {/* ── Campaign Modal ─────────────────────────────────────────────────── */}
      <Modal
        open={cmpModal}
        onClose={() => setCmpModal(false)}
        title={cmpForm.id ? 'Editar campanha' : 'Nova campanha'}
      >
        <div className="space-y-4">
          <Input
            label="Nome da campanha *"
            value={cmpForm.name ?? ''}
            onChange={(e) => setCmpForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Ex: Promoção de Páscoa"
          />
          <Select
            label="Template (aprovado)"
            value={cmpForm.template_id ?? ''}
            onChange={(e) => setCmpForm((p) => ({ ...p, template_id: e.target.value || undefined }))}
            options={[
              { value: '', label: 'Sem template' },
              ...approvedTemplates.map((t) => ({ value: t.id, label: t.name })),
            ]}
          />
          <Input
            label="Número de destinatários"
            type="number"
            min={0}
            value={cmpForm.target_count ?? ''}
            onChange={(e) => setCmpForm((p) => ({ ...p, target_count: e.target.value ? Number(e.target.value) : undefined }))}
            placeholder="Ex: 500"
            hint="Deixe vazio para definir depois"
          />
          <Input
            label="Agendar para"
            type="datetime-local"
            value={cmpForm.scheduled_at ? cmpForm.scheduled_at.slice(0, 16) : ''}
            onChange={(e) => setCmpForm((p) => ({ ...p, scheduled_at: e.target.value ? e.target.value + ':00' : undefined }))}
            hint="Deixe vazio para iniciar manualmente"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCmpModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveCampaign} loading={cmpSaving}>
              {cmpForm.id ? 'Salvar alterações' : 'Criar campanha'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Template Modal ─────────────────────────────────────────────────── */}
      <Modal
        open={tmplModal}
        onClose={() => setTmplModal(false)}
        title={tmplId ? 'Editar template' : 'Novo template'}
        size="2xl"
      >
        <div className="flex gap-6 items-start">

          {/* Formulário */}
          <div className="flex-1 min-w-0 space-y-4">
            <Input
              label="Nome do template *"
              value={tmplForm.name}
              onChange={(e) => setTmplForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Ex: confirmacao_agendamento"
              hint="Use apenas letras minúsculas, números e underscores"
            />
            <Select
              label="Tipo de template"
              value={tmplForm.template_type}
              onChange={(e) => setTmplForm((p) => ({ ...p, template_type: e.target.value }))}
              options={TEMPLATE_TYPES}
              hint={tmplForm.template_type === 'zapi' ? 'Ativado imediatamente, sem aprovação' : 'Requer aprovação da Meta (WhatsApp Business)'}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Categoria"
                value={tmplForm.category}
                onChange={(e) => setTmplForm((p) => ({ ...p, category: e.target.value }))}
                options={CATEGORIES}
              />
              <Select
                label="Idioma"
                value={tmplForm.language}
                onChange={(e) => setTmplForm((p) => ({ ...p, language: e.target.value }))}
                options={LANGUAGES}
              />
            </div>
            <Input
              label="Cabeçalho (opcional)"
              value={tmplForm.header}
              onChange={(e) => setTmplForm((p) => ({ ...p, header: e.target.value }))}
              placeholder="Texto do cabeçalho"
            />
            <Textarea
              label="Corpo da mensagem *"
              rows={5}
              value={tmplForm.body}
              onChange={(e) => setTmplForm((p) => ({ ...p, body: e.target.value }))}
              placeholder={"Olá {{cliente_primeiro_nome}}, seu agendamento foi confirmado para {{agendamento_data}}."}
              hint="Use {{variavel}} para inserir dados dinâmicos"
            />
            <Input
              label="Rodapé (opcional)"
              value={tmplForm.footer}
              onChange={(e) => setTmplForm((p) => ({ ...p, footer: e.target.value }))}
              placeholder="Ex: Responda SAIR para cancelar"
            />
            {tmplForm.template_type === 'official' && (
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                Templates <strong>Oficiais</strong> ficam com status <strong>Pendente</strong> até aprovação pela Meta (WhatsApp Business). Use o tipo <strong>Z-API</strong> para ativar imediatamente.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setTmplModal(false)}>Cancelar</Button>
              <Button onClick={handleSaveTemplate} loading={tmplSaving}>
                {tmplId ? 'Salvar alterações' : 'Criar template'}
              </Button>
            </div>
          </div>

          {/* Variáveis — lateral direita */}
          <div className="w-64 shrink-0 self-start sticky top-0">
            <VariablesReference defaultOpen />
          </div>

        </div>
      </Modal>
    </div>
  )
}
