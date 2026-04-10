'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { Toggle } from '@/components/ui/Toggle'
import {
  listServices, upsertService, deleteService,
  listProfessionals, upsertProfessional, deleteProfessional,
  getProfessionalAvailability, upsertProfessionalAvailability,
} from '@/lib/api'
import type { Service, Professional, ProfessionalAvailability } from '@/types'
import { toast } from '@/components/ui/Toast'
import {
  Scissors, Clock, DollarSign, Search, Users,
  AlertTriangle, CheckCircle2, Plus, Edit3, Trash2, CalendarDays,
} from 'lucide-react'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function fmtPrice(min?: number, max?: number): string | null {
  if (min == null && max == null) return null
  const fmt = (n: number) => `R$ ${n.toFixed(0)}`
  if (min != null && max != null && min !== max) return `${fmt(min)} – ${fmt(max)}`
  return fmt((min ?? max)!)
}

function defaultSlots(): ProfessionalAvailability[] {
  return DAYS.map((_, i) => ({
    professional_id: '',
    day_of_week:     i,
    start_time:      '09:00',
    end_time:        '18:00',
    is_available:    i >= 1 && i <= 5, // Seg–Sex por padrão
  }))
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <Icon className="h-10 w-10 mb-3" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

// ─── Availability Modal ───────────────────────────────────────────────────────

function AvailabilityModal({
  professional,
  open,
  onClose,
}: {
  professional: Professional
  open: boolean
  onClose: () => void
}) {
  const [slots, setSlots]   = useState<ProfessionalAvailability[]>(defaultSlots())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getProfessionalAvailability(professional.id)
      .then((data) => {
        if (data.length === 0) {
          setSlots(defaultSlots())
        } else {
          // Merge fetched data into full 7-day array
          const base = defaultSlots()
          data.forEach((row) => {
            const idx = base.findIndex((s) => s.day_of_week === row.day_of_week)
            if (idx >= 0) base[idx] = { ...base[idx], ...row }
          })
          setSlots(base)
        }
      })
      .catch(() => setSlots(defaultSlots()))
      .finally(() => setLoading(false))
  }, [open, professional.id])

  function update(dow: number, patch: Partial<ProfessionalAvailability>) {
    setSlots((prev) => prev.map((s) => s.day_of_week === dow ? { ...s, ...patch } : s))
  }

  function applyPreset(preset: 'weekdays' | 'all' | 'none') {
    setSlots((prev) => prev.map((s) => ({
      ...s,
      is_available: preset === 'all' ? true : preset === 'none' ? false : s.day_of_week >= 1 && s.day_of_week <= 5,
    })))
  }

  async function save() {
    setSaving(true)
    try {
      await upsertProfessionalAvailability(
        professional.id,
        slots.map(({ day_of_week, start_time, end_time, is_available, break_start, break_end }) => ({
          day_of_week, start_time, end_time, is_available,
          break_start: break_start ?? '',
          break_end:   break_end   ?? '',
        })),
      )
      toast('Agenda salva com sucesso')
      onClose()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar agenda', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Agenda semanal — ${professional.name}`}
    >
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
        </div>
      ) : (
        <div className="space-y-4">

          {/* Preset buttons */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500 mr-1">Atalhos:</span>
            <button
              onClick={() => applyPreset('weekdays')}
              className="px-2.5 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            >
              Seg–Sex
            </button>
            <button
              onClick={() => applyPreset('all')}
              className="px-2.5 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            >
              Todos os dias
            </button>
            <button
              onClick={() => applyPreset('none')}
              className="px-2.5 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            >
              Nenhum
            </button>
          </div>

          {/* Week grid */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[90px_44px_80px_8px_80px] bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 px-3 py-2 gap-2">
              <span>Dia</span>
              <span>Ativo</span>
              <span>Entrada</span>
              <span />
              <span>Saída</span>
            </div>

            {slots.map((slot) => {
              const hasBreak = !!(slot.break_start && slot.break_end)
              return (
                <div
                  key={slot.day_of_week}
                  className={`px-3 py-2.5 border-b last:border-b-0 border-gray-100 transition-colors ${
                    slot.is_available ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  {/* Main row: day + toggle + work hours */}
                  <div className="grid grid-cols-[90px_44px_80px_8px_80px] items-center gap-2">
                    <span className={`text-sm font-medium ${slot.is_available ? 'text-gray-900' : 'text-gray-400'}`}>
                      {DAYS[slot.day_of_week]}
                    </span>

                    <Toggle
                      checked={slot.is_available}
                      onChange={(v) => update(slot.day_of_week, {
                        is_available: v,
                        // clear break when disabling day
                        ...(!v ? { break_start: undefined, break_end: undefined } : {}),
                      })}
                      label=""
                    />

                    <input
                      type="time"
                      value={slot.start_time}
                      disabled={!slot.is_available}
                      onChange={(e) => update(slot.day_of_week, { start_time: e.target.value })}
                      className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-40 disabled:bg-gray-50"
                    />

                    <span className="text-xs text-gray-400 text-center">–</span>

                    <input
                      type="time"
                      value={slot.end_time}
                      disabled={!slot.is_available}
                      onChange={(e) => update(slot.day_of_week, { end_time: e.target.value })}
                      className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-40 disabled:bg-gray-50"
                    />
                  </div>

                  {/* Break row — only when day is active */}
                  {slot.is_available && (
                    <div className="flex items-center gap-2 mt-2 pl-[134px]">
                      <button
                        onClick={() => update(slot.day_of_week, hasBreak
                          ? { break_start: undefined, break_end: undefined }
                          : { break_start: '12:00', break_end: '13:00' }
                        )}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors ${
                          hasBreak
                            ? 'border-amber-200 bg-amber-50 text-amber-700'
                            : 'border-gray-200 bg-gray-50 text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        ☕ {hasBreak ? 'Pausa' : '+ Pausa'}
                      </button>

                      {hasBreak && (
                        <>
                          <input
                            type="time"
                            value={slot.break_start ?? '12:00'}
                            onChange={(e) => update(slot.day_of_week, { break_start: e.target.value })}
                            className="w-[80px] text-sm border border-amber-200 bg-amber-50 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                          <span className="text-xs text-gray-400">–</span>
                          <input
                            type="time"
                            value={slot.break_end ?? '13:00'}
                            onChange={(e) => update(slot.day_of_week, { break_end: e.target.value })}
                            className="w-[80px] text-sm border border-amber-200 bg-amber-50 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <p className="text-xs text-gray-400">
            Os horários definem quando a IA pode oferecer agendamentos.
            Clique em <strong>☕ + Pausa</strong> para configurar intervalo de almoço/descanso em cada dia.
            Conflitos com consultas já marcadas são excluídos automaticamente.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button onClick={save} loading={saving}>Salvar agenda</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── Service card ─────────────────────────────────────────────────────────────

function ServiceCard({
  s, onEdit, onDelete,
}: { s: Service; onEdit: () => void; onDelete: () => void }) {
  const price = fmtPrice(s.price_min, s.price_max)
  return (
    <Card className={!s.is_active ? 'opacity-60' : ''}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${s.is_active ? 'bg-brand-50' : 'bg-gray-100'}`}>
          <Scissors className={`h-4 w-4 ${s.is_active ? 'text-brand-600' : 'text-gray-400'}`} />
        </div>
        <Badge variant={s.is_active ? 'success' : 'default'}>
          {s.is_active ? 'Ativo' : 'Inativo'}
        </Badge>
      </div>

      <h3 className="text-sm font-semibold text-gray-900 mb-1">{s.name}</h3>

      {s.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{s.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-500 mt-auto pt-2 border-t border-gray-100">
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          {s.duration_minutes} min
        </span>
        {price && (
          <span className="flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5 shrink-0" />
            {price}
          </span>
        )}
        {s.requires_evaluation && (
          <span className="flex items-center gap-1 text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Requer avaliação
          </span>
        )}
      </div>

      <div className="flex justify-end gap-1 mt-3 pt-2 border-t border-gray-100">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Edit3 className="h-3 w-3" /> Editar
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-500 hover:text-red-700 hover:bg-red-50">
          <Trash2 className="h-3 w-3" /> Excluir
        </Button>
      </div>
    </Card>
  )
}

// ─── Professional card ────────────────────────────────────────────────────────

function ProfessionalCard({
  p, onEdit, onDelete, onSchedule,
}: { p: Professional; onEdit: () => void; onDelete: () => void; onSchedule: () => void }) {
  return (
    <Card className={!p.is_active ? 'opacity-60' : ''}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-purple-700">
            {p.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
          {p.specialty && (
            <p className="text-xs text-gray-500 truncate">{p.specialty}</p>
          )}
        </div>
        <Badge variant={p.is_active ? 'success' : 'default'}>
          {p.is_active ? 'Ativo' : 'Inativo'}
        </Badge>
      </div>

      {p.bio ? (
        <p className="text-xs text-gray-500 line-clamp-3 pt-2 border-t border-gray-100">
          {p.bio}
        </p>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-gray-400 pt-2 border-t border-gray-100">
          <CheckCircle2 className={`h-3.5 w-3.5 ${p.is_active ? 'text-green-500' : 'text-gray-300'}`} />
          {p.is_active ? 'Disponível para agendamentos' : 'Indisponível'}
        </div>
      )}

      <div className="flex justify-end gap-1 mt-3 pt-2 border-t border-gray-100">
        <Button variant="ghost" size="sm" onClick={onSchedule} className="text-brand-600 hover:text-brand-700 hover:bg-brand-50">
          <CalendarDays className="h-3 w-3" /> Agenda
        </Button>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Edit3 className="h-3 w-3" /> Editar
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-500 hover:text-red-700 hover:bg-red-50">
          <Trash2 className="h-3 w-3" /> Excluir
        </Button>
      </div>
    </Card>
  )
}

// ─── Default form values ──────────────────────────────────────────────────────

const defaultService: Partial<Service> = {
  name: '', description: '', duration_minutes: 30,
  price_min: undefined, price_max: undefined,
  requires_evaluation: false, is_active: true,
}

const defaultProfessional: Partial<Professional> = {
  name: '', specialty: '', bio: '', is_active: true,
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const pageTabs = [
  { id: 'services',      label: 'Serviços',      icon: Scissors },
  { id: 'professionals', label: 'Profissionais', icon: Users    },
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ServicosPage() {
  const [tab, setTab]                     = useState('services')
  const [services, setServices]           = useState<Service[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [filterActive, setFilterActive]   = useState<'all' | 'active' | 'inactive'>('all')

  // Service modal
  const [svcModal, setSvcModal]   = useState(false)
  const [svcForm, setSvcForm]     = useState<Partial<Service>>(defaultService)
  const [svcSaving, setSvcSaving] = useState(false)

  // Professional modal
  const [profModal, setProfModal]   = useState(false)
  const [profForm, setProfForm]     = useState<Partial<Professional>>(defaultProfessional)
  const [profSaving, setProfSaving] = useState(false)

  // Availability modal
  const [schedProfessional, setSchedProfessional] = useState<Professional | null>(null)

  const load = () => {
    setLoading(true)
    Promise.allSettled([listServices(), listProfessionals()])
      .then(([s, p]) => {
        if (s.status === 'fulfilled') setServices(s.value)
        if (p.status === 'fulfilled') setProfessionals(p.value)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  // ── Service CRUD ────────────────────────────────────────────────────────────

  const openNewService = () => { setSvcForm(defaultService); setSvcModal(true) }
  const openEditService = (s: Service) => { setSvcForm({ ...s }); setSvcModal(true) }

  const handleSaveService = async () => {
    if (!svcForm.name?.trim()) { toast('Nome do serviço é obrigatório', 'error'); return }
    if (!svcForm.duration_minutes || svcForm.duration_minutes <= 0) { toast('Duração deve ser maior que zero', 'error'); return }
    setSvcSaving(true)
    try {
      await upsertService(svcForm)
      toast(svcForm.id ? 'Serviço atualizado' : 'Serviço criado')
      setSvcModal(false)
      load()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar serviço', 'error')
    } finally {
      setSvcSaving(false)
    }
  }

  const handleDeleteService = async (s: Service) => {
    if (!confirm(`Excluir serviço "${s.name}"?`)) return
    try {
      await deleteService(s.id)
      toast('Serviço excluído')
      load()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao excluir', 'error')
    }
  }

  // ── Professional CRUD ───────────────────────────────────────────────────────

  const openNewProfessional = () => { setProfForm(defaultProfessional); setProfModal(true) }
  const openEditProfessional = (p: Professional) => { setProfForm({ ...p }); setProfModal(true) }

  const handleSaveProfessional = async () => {
    if (!profForm.name?.trim()) { toast('Nome do profissional é obrigatório', 'error'); return }
    setProfSaving(true)
    try {
      await upsertProfessional(profForm)
      toast(profForm.id ? 'Profissional atualizado' : 'Profissional criado')
      setProfModal(false)
      load()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar profissional', 'error')
    } finally {
      setProfSaving(false)
    }
  }

  const handleDeleteProfessional = async (p: Professional) => {
    if (!confirm(`Excluir profissional "${p.name}"?`)) return
    try {
      await deleteProfessional(p.id)
      toast('Profissional excluído')
      load()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao excluir', 'error')
    }
  }

  // ── Filters ─────────────────────────────────────────────────────────────────

  const filteredServices = useMemo(() =>
    services
      .filter((s) => filterActive === 'all' || (filterActive === 'active' ? s.is_active : !s.is_active))
      .filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.description?.toLowerCase().includes(search.toLowerCase())),
  [services, search, filterActive])

  const filteredProfessionals = useMemo(() =>
    professionals
      .filter((p) => filterActive === 'all' || (filterActive === 'active' ? p.is_active : !p.is_active))
      .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.specialty?.toLowerCase().includes(search.toLowerCase())),
  [professionals, search, filterActive])

  const activeServices      = services.filter((s) => s.is_active).length
  const activeProfessionals = professionals.filter((p) => p.is_active).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Serviços</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeServices} serviço{activeServices !== 1 ? 's' : ''} ativo{activeServices !== 1 ? 's' : ''} ·{' '}
            {activeProfessionals} profissional{activeProfessionals !== 1 ? 'is' : ''} ativo{activeProfessionals !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={tab === 'services' ? openNewService : openNewProfessional}
        >
          <Plus className="h-3.5 w-3.5" />
          {tab === 'services' ? 'Novo serviço' : 'Novo profissional'}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs tabs={pageTabs} active={tab} onChange={(t) => { setTab(t); setSearch('') }} />

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'services' ? 'Buscar serviço...' : 'Buscar profissional...'}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterActive(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filterActive === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'active' ? 'Ativos' : 'Inativos'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
        </div>
      ) : tab === 'services' ? (
        filteredServices.length === 0 ? (
          <EmptyState icon={Scissors} label={search ? 'Nenhum serviço encontrado' : 'Nenhum serviço cadastrado'} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredServices.map((s) => (
              <ServiceCard
                key={s.id} s={s}
                onEdit={() => openEditService(s)}
                onDelete={() => handleDeleteService(s)}
              />
            ))}
          </div>
        )
      ) : (
        filteredProfessionals.length === 0 ? (
          <EmptyState icon={Users} label={search ? 'Nenhum profissional encontrado' : 'Nenhum profissional cadastrado'} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProfessionals.map((p) => (
              <ProfessionalCard
                key={p.id} p={p}
                onEdit={() => openEditProfessional(p)}
                onDelete={() => handleDeleteProfessional(p)}
                onSchedule={() => setSchedProfessional(p)}
              />
            ))}
          </div>
        )
      )}

      {/* ── Service Modal ──────────────────────────────────────────────────── */}
      <Modal
        open={svcModal}
        onClose={() => setSvcModal(false)}
        title={svcForm.id ? 'Editar serviço' : 'Novo serviço'}
      >
        <div className="space-y-4">
          <Input
            label="Nome do serviço *"
            value={svcForm.name ?? ''}
            onChange={(e) => setSvcForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Ex: Corte feminino"
          />
          <Textarea
            label="Descrição"
            rows={2}
            value={svcForm.description ?? ''}
            onChange={(e) => setSvcForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Breve descrição do serviço..."
          />
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Duração (min) *"
              type="number"
              min={1}
              value={svcForm.duration_minutes ?? ''}
              onChange={(e) => setSvcForm((p) => ({ ...p, duration_minutes: Number(e.target.value) }))}
              placeholder="30"
            />
            <Input
              label="Preço mín. (R$)"
              type="number"
              min={0}
              step={0.01}
              value={svcForm.price_min ?? ''}
              onChange={(e) => setSvcForm((p) => ({ ...p, price_min: e.target.value ? Number(e.target.value) : undefined }))}
              placeholder="50"
            />
            <Input
              label="Preço máx. (R$)"
              type="number"
              min={0}
              step={0.01}
              value={svcForm.price_max ?? ''}
              onChange={(e) => setSvcForm((p) => ({ ...p, price_max: e.target.value ? Number(e.target.value) : undefined }))}
              placeholder="100"
            />
          </div>
          <div className="flex flex-col gap-3">
            <Toggle
              checked={svcForm.requires_evaluation ?? false}
              onChange={(v) => setSvcForm((p) => ({ ...p, requires_evaluation: v }))}
              label="Requer avaliação prévia"
            />
            <Toggle
              checked={svcForm.is_active ?? true}
              onChange={(v) => setSvcForm((p) => ({ ...p, is_active: v }))}
              label="Serviço ativo"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setSvcModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveService} loading={svcSaving}>
              {svcForm.id ? 'Salvar alterações' : 'Criar serviço'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Professional Modal ─────────────────────────────────────────────── */}
      <Modal
        open={profModal}
        onClose={() => setProfModal(false)}
        title={profForm.id ? 'Editar profissional' : 'Novo profissional'}
      >
        <div className="space-y-4">
          <Input
            label="Nome *"
            value={profForm.name ?? ''}
            onChange={(e) => setProfForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Ex: Ana Lima"
          />
          <Input
            label="Especialidade"
            value={profForm.specialty ?? ''}
            onChange={(e) => setProfForm((p) => ({ ...p, specialty: e.target.value }))}
            placeholder="Ex: Colorimetria"
          />
          <Textarea
            label="Bio"
            rows={3}
            value={profForm.bio ?? ''}
            onChange={(e) => setProfForm((p) => ({ ...p, bio: e.target.value }))}
            placeholder="Apresentação do profissional..."
          />
          <Toggle
            checked={profForm.is_active ?? true}
            onChange={(v) => setProfForm((p) => ({ ...p, is_active: v }))}
            label="Profissional ativo"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setProfModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveProfessional} loading={profSaving}>
              {profForm.id ? 'Salvar alterações' : 'Criar profissional'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Availability Modal ─────────────────────────────────────────────── */}
      {schedProfessional && (
        <AvailabilityModal
          professional={schedProfessional}
          open={!!schedProfessional}
          onClose={() => setSchedProfessional(null)}
        />
      )}
    </div>
  )
}
