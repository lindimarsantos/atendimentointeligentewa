'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import {
  listProfessionals,
  listProfessionalCalendars,
  upsertProfessionalCalendar,
  deleteProfessionalCalendar,
} from '@/lib/api'
import type { Professional, ProfessionalCalendar } from '@/types'
import { toast } from '@/components/ui/Toast'
import {
  AlertCircle, Calendar, CheckCircle2, ExternalLink,
  Info, PlusCircle, RefreshCw, Unlink,
} from 'lucide-react'

function StatusBadge({ hasCredentials, lastSynced }: { hasCredentials: boolean; lastSynced?: string }) {
  if (!hasCredentials)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
        Sem credenciais
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      {lastSynced
        ? `Sync: ${new Date(lastSynced).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
        : 'Conectado'}
    </span>
  )
}

interface FormState {
  professional_id:      string
  calendar_id:          string
  calendar_name:        string
  sync_direction:       string
  oauth_refresh_token:  string
}

const EMPTY_FORM: FormState = {
  professional_id:     '',
  calendar_id:         'primary',
  calendar_name:       'Google Calendar',
  sync_direction:      'write',
  oauth_refresh_token: '',
}

export function GoogleCalendar() {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [calendars, setCalendars]         = useState<ProfessionalCalendar[]>([])
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState(false)
  const [deleting, setDeleting]           = useState<string | null>(null)
  const [error, setError]                 = useState<string | null>(null)
  const [showForm, setShowForm]           = useState(false)
  const [editId, setEditId]               = useState<string | null>(null)
  const [form, setForm]                   = useState<FormState>(EMPTY_FORM)

  const load = async () => {
    try {
      const [pros, cals] = await Promise.all([
        listProfessionals(),
        listProfessionalCalendars(),
      ])
      setProfessionals(pros)
      setCalendars(cals)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openNew = () => {
    setForm(EMPTY_FORM)
    setEditId(null)
    setShowForm(true)
  }

  const openEdit = (cal: ProfessionalCalendar) => {
    setForm({
      professional_id:     cal.professional_id,
      calendar_id:         cal.calendar_id,
      calendar_name:       cal.calendar_name ?? 'Google Calendar',
      sync_direction:      cal.sync_direction,
      oauth_refresh_token: '',
    })
    setEditId(cal.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.professional_id) { toast('Selecione um profissional', 'error'); return }
    if (!form.calendar_id.trim()) { toast('Informe o ID do calendário', 'error'); return }
    if (!editId && !form.oauth_refresh_token.trim()) {
      toast('Informe o Refresh Token do Google OAuth', 'error'); return
    }
    setSaving(true)
    try {
      await upsertProfessionalCalendar({
        id:                  editId ?? undefined,
        professional_id:     form.professional_id,
        calendar_id:         form.calendar_id.trim(),
        calendar_name:       form.calendar_name.trim() || 'Google Calendar',
        sync_direction:      form.sync_direction,
        is_primary:          true,
        oauth_refresh_token: form.oauth_refresh_token.trim() || undefined,
      })
      toast(editId ? 'Calendário atualizado' : 'Calendário conectado')
      setShowForm(false)
      setEditId(null)
      await load()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Desconectar este calendário? Os agendamentos existentes não serão afetados.')) return
    setDeleting(id)
    try {
      await deleteProfessionalCalendar(id)
      toast('Calendário desconectado')
      setCalendars((prev) => prev.filter((c) => c.id !== id))
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao desconectar', 'error')
    } finally {
      setDeleting(null)
    }
  }

  const profWithoutCalendar = professionals.filter(
    (p) => !calendars.some((c) => c.professional_id === p.id)
  )

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
    <div className="max-w-2xl space-y-6">

      {/* Info banner */}
      <Card>
        <div className="flex items-start gap-3">
          <Calendar className="h-5 w-5 text-brand-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Integração Google Calendar</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Agendamentos confirmados são sincronizados automaticamente para o Google Calendar
              do profissional a cada 2 minutos.
            </p>
            <a
              href="https://developers.google.com/oauthplayground"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline mt-1"
            >
              Obter Refresh Token no OAuth Playground
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </Card>

      {/* Calendar list */}
      {calendars.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Calendários conectados ({calendars.length})
          </h3>
          <div className="divide-y divide-gray-100">
            {calendars.map((cal) => (
              <div key={cal.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {cal.professional_name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {cal.calendar_name} &middot; ID: <code className="font-mono">{cal.calendar_id}</code>
                    {' '}&middot; {cal.sync_direction}
                  </p>
                  <div className="mt-1">
                    <StatusBadge
                      hasCredentials={cal.has_credentials}
                      lastSynced={cal.last_synced_at}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <button
                    onClick={() => openEdit(cal)}
                    className="text-gray-400 hover:text-brand-600 transition-colors"
                    title="Editar / atualizar token"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(cal.id)}
                    disabled={deleting === cal.id}
                    className="text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                    title="Desconectar"
                  >
                    {deleting === cal.id
                      ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500" />
                      : <Unlink className="h-4 w-4" />
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Empty state */}
      {calendars.length === 0 && !showForm && (
        <Card>
          <div className="text-center py-8">
            <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600">Nenhum calendário conectado</p>
            <p className="text-xs text-gray-400 mt-1">
              Conecte o Google Calendar de cada profissional para sincronizar agendamentos automaticamente.
            </p>
          </div>
        </Card>
      )}

      {/* Connect form */}
      {showForm && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            {editId ? <RefreshCw className="h-4 w-4 text-brand-600" /> : <PlusCircle className="h-4 w-4 text-brand-600" />}
            {editId ? 'Atualizar credenciais' : 'Conectar Google Calendar'}
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Profissional
              </label>
              <select
                value={form.professional_id}
                onChange={(e) => setForm((f) => ({ ...f, professional_id: e.target.value }))}
                disabled={!!editId}
                className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="">Selecione um profissional...</option>
                {(editId
                  ? professionals
                  : profWithoutCalendar
                ).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {!editId && profWithoutCalendar.length === 0 && professionals.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Todos os profissionais já possuem calendário conectado.
                </p>
              )}
            </div>

            <Input
              label="ID do Calendário Google"
              value={form.calendar_id}
              onChange={(e) => setForm((f) => ({ ...f, calendar_id: e.target.value }))}
              placeholder="primary"
              hint='Use "primary" para o calendário padrão ou cole o ID completo (ex: nome@group.calendar.google.com)'
            />

            <Input
              label="Nome do Calendário (exibição)"
              value={form.calendar_name}
              onChange={(e) => setForm((f) => ({ ...f, calendar_name: e.target.value }))}
              placeholder="Google Calendar"
            />

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Direção de sincronização
              </label>
              <select
                value={form.sync_direction}
                onChange={(e) => setForm((f) => ({ ...f, sync_direction: e.target.value }))}
                className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="write">Somente escrita (sistema → Google)</option>
                <option value="read">Somente leitura (Google → sistema)</option>
                <option value="bidirectional">Bidirecional</option>
              </select>
            </div>

            <div>
              <Input
                label={editId ? 'Novo Refresh Token (deixe em branco para manter o atual)' : 'Refresh Token OAuth 2.0'}
                type="password"
                value={form.oauth_refresh_token}
                onChange={(e) => setForm((f) => ({ ...f, oauth_refresh_token: e.target.value }))}
                placeholder="Cole aqui o refresh_token obtido no OAuth Playground"
                hint="Acesse developers.google.com/oauthplayground → scope: https://www.googleapis.com/auth/calendar"
              />
            </div>

            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-800">
                <strong>Como obter o Refresh Token:</strong> No OAuth Playground, selecione o escopo
                <code className="mx-1 font-mono bg-blue-100 px-1 rounded">https://www.googleapis.com/auth/calendar</code>,
                autorize com a conta Google do profissional e copie o <code className="font-mono">refresh_token</code>.
                O Client ID e Secret devem ser configurados no workflow n8n (nó &ldquo;Parse Appointments&rdquo;).
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-5">
            <Button
              variant="secondary"
              onClick={() => { setShowForm(false); setEditId(null) }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editId ? 'Atualizar' : 'Conectar'}
            </Button>
          </div>
        </Card>
      )}

      {/* Success state for connected + add more */}
      {!showForm && calendars.length > 0 && profWithoutCalendar.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {profWithoutCalendar.length === 1
            ? `${profWithoutCalendar[0].name} ainda não tem calendário conectado.`
            : `${profWithoutCalendar.length} profissional(is) sem calendário conectado.`}
        </div>
      )}

      {/* Add / actions */}
      {!showForm && (
        <div className="flex items-center gap-3">
          <Button
            onClick={openNew}
            disabled={professionals.length === 0}
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            {calendars.length === 0 ? 'Conectar Google Calendar' : 'Conectar outro profissional'}
          </Button>
          {calendars.length > 0 && (
            <button
              onClick={load}
              className="text-xs text-gray-500 hover:text-brand-600 flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar lista
            </button>
          )}
        </div>
      )}

      {professionals.length === 0 && (
        <div className="flex items-center gap-2 text-amber-700 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Nenhum profissional cadastrado. Acesse <strong>Serviços</strong> para adicionar profissionais primeiro.
        </div>
      )}
    </div>
  )
}
