'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import {
  listAppointments, updateAppointmentStatus, criarAgendamento,
  listServices, listProfessionals, listCustomers,
} from '@/lib/api'
import type { Appointment, Service, Professional, Customer } from '@/types'
import { toast } from '@/components/ui/Toast'
import { format, addDays, startOfWeek, isSameDay, parseISO, addMinutes } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  CalendarCheck, Clock, ChevronLeft, ChevronRight, Plus,
  CheckCircle2, XCircle, UserCheck, User,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'info' | 'success' | 'error' | 'warning' }> = {
  scheduled:  { label: 'Agendado',   variant: 'info'    },
  confirmed:  { label: 'Confirmado', variant: 'success' },
  completed:  { label: 'Realizado',  variant: 'default' },
  cancelled:  { label: 'Cancelado',  variant: 'error'   },
  no_show:    { label: 'Não veio',   variant: 'warning' },
  pending:    { label: 'Pendente',   variant: 'warning' },
}

const STATUS_FILTERS = [
  { id: 'all',       label: 'Todos'      },
  { id: 'scheduled', label: 'Agendados'  },
  { id: 'confirmed', label: 'Confirmados'},
  { id: 'completed', label: 'Realizados' },
  { id: 'cancelled', label: 'Cancelados' },
]

const DAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTime(a: Appointment): string {
  const raw = a.scheduled_start_at ?? a.scheduled_at ?? ''
  if (!raw) return '—'
  try { return format(parseISO(raw), 'HH:mm') } catch { return '—' }
}

function getDateStr(a: Appointment): string {
  return (a.scheduled_start_at ?? a.scheduled_at ?? '').slice(0, 10)
}

// ─── Appointment Card ─────────────────────────────────────────────────────────

function AppointmentCard({
  a, onStatusChange,
}: { a: Appointment; onStatusChange: (id: string, status: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const s = STATUS_MAP[a.status] ?? { label: a.status, variant: 'default' as const }

  const act = async (status: string) => {
    setBusy(true)
    await onStatusChange(a.id, status).finally(() => setBusy(false))
  }

  const canConfirm  = a.status === 'scheduled' || a.status === 'pending'
  const canComplete = a.status === 'confirmed'
  const canCancel   = a.status === 'scheduled' || a.status === 'confirmed' || a.status === 'pending'

  return (
    <div className="flex gap-4 py-3 border-b border-gray-100 last:border-0">
      {/* Time */}
      <div className="w-12 shrink-0 text-center pt-1">
        <span className="text-xs font-mono font-medium text-gray-600">{getTime(a)}</span>
      </div>

      {/* Card body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {a.customer_name ?? 'Cliente'}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {a.service_name ?? '—'} · {a.professional_name ?? '—'} · {a.service_duration ?? a.duration_minutes ?? '?'}min
            </p>
            {a.notes && (
              <p className="text-xs text-gray-400 italic truncate mt-0.5">{a.notes}</p>
            )}
          </div>
          <Badge variant={s.variant}>{s.label}</Badge>
        </div>

        {/* Actions */}
        {(canConfirm || canComplete || canCancel) && (
          <div className="flex items-center gap-1.5 mt-2">
            {canConfirm && (
              <button
                onClick={() => act('confirmed')}
                disabled={busy}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-40 transition-colors"
              >
                <UserCheck className="h-3 w-3" /> Confirmar
              </button>
            )}
            {canComplete && (
              <button
                onClick={() => act('completed')}
                disabled={busy}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 transition-colors"
              >
                <CheckCircle2 className="h-3 w-3" /> Concluir
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => act('cancelled')}
                disabled={busy}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40 transition-colors"
              >
                <XCircle className="h-3 w-3" /> Cancelar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── New Appointment Modal ────────────────────────────────────────────────────

interface ApptForm {
  customer_id: string
  customer_label: string
  service_id: string
  professional_id: string
  date: string
  time: string
  duration: number
  notes: string
}

function NovoAgendamentoModal({
  open,
  initialDate,
  onClose,
  onSaved,
}: {
  open: boolean
  initialDate: string
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<ApptForm>({
    customer_id: '', customer_label: '',
    service_id: '', professional_id: '',
    date: initialDate, time: '09:00', duration: 30, notes: '',
  })
  const [saving, setSaving]       = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [services, setServices]   = useState<Service[]>([])
  const [profs, setProfs]         = useState<Professional[]>([])
  const [custSearch, setCustSearch] = useState('')
  const [custOpen, setCustOpen]     = useState(false)

  // Load reference data when modal opens
  useEffect(() => {
    if (!open) return
    setForm((f) => ({ ...f, date: initialDate }))
    Promise.allSettled([listServices(), listProfessionals(), listCustomers()])
      .then(([sv, pv, cv]) => {
        if (sv.status === 'fulfilled') setServices(sv.value.filter((s) => s.is_active))
        if (pv.status === 'fulfilled') setProfs(pv.value.filter((p) => p.is_active))
        if (cv.status === 'fulfilled') setCustomers(cv.value)
      })
  }, [open, initialDate])

  // Auto-fill duration from service
  useEffect(() => {
    const svc = services.find((s) => s.id === form.service_id)
    if (svc) setForm((f) => ({ ...f, duration: svc.duration_minutes }))
  }, [form.service_id, services])

  const filteredCustomers = useMemo(() =>
    custSearch.length < 1
      ? customers.slice(0, 8)
      : customers.filter((c) =>
          c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
          c.phone.includes(custSearch)
        ).slice(0, 8),
  [customers, custSearch])

  const selectCustomer = (c: Customer) => {
    setForm((f) => ({ ...f, customer_id: c.id, customer_label: `${c.name} · ${c.phone}` }))
    setCustSearch('')
    setCustOpen(false)
  }

  const handleSave = async () => {
    if (!form.customer_id) { toast('Selecione um cliente', 'error'); return }
    if (!form.service_id)  { toast('Selecione um serviço', 'error'); return }
    if (!form.professional_id) { toast('Selecione um profissional', 'error'); return }
    if (!form.date || !form.time) { toast('Informe data e horário', 'error'); return }

    const startAt = `${form.date}T${form.time}:00`
    const endAt   = format(addMinutes(parseISO(startAt), form.duration), "yyyy-MM-dd'T'HH:mm:ss")

    setSaving(true)
    try {
      await criarAgendamento({
        customer_id: form.customer_id,
        service_id: form.service_id,
        professional_id: form.professional_id,
        start_at: startAt,
        end_at: endAt,
        notes: form.notes || undefined,
      })
      toast('Agendamento criado')
      onClose()
      onSaved()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao criar agendamento', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo agendamento">
      <div className="space-y-4">
        {/* Customer */}
        <div className="relative">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Cliente *
          </label>
          {form.customer_id ? (
            <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
              <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-900 flex-1 truncate">{form.customer_label}</span>
              <button
                onClick={() => setForm((f) => ({ ...f, customer_id: '', customer_label: '' }))}
                className="text-xs text-gray-400 hover:text-red-500 shrink-0"
              >
                Trocar
              </button>
            </div>
          ) : (
            <>
              <input
                value={custSearch}
                onChange={(e) => { setCustSearch(e.target.value); setCustOpen(true) }}
                onFocus={() => setCustOpen(true)}
                placeholder="Buscar por nome ou telefone..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              {custOpen && filteredCustomers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => selectCustomer(c)}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                    >
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.phone}</p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Service + Professional */}
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Serviço *"
            value={form.service_id}
            onChange={(e) => setForm((f) => ({ ...f, service_id: e.target.value }))}
            options={[
              { value: '', label: 'Selecionar...' },
              ...services.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <Select
            label="Profissional *"
            value={form.professional_id}
            onChange={(e) => setForm((f) => ({ ...f, professional_id: e.target.value }))}
            options={[
              { value: '', label: 'Selecionar...' },
              ...profs.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        </div>

        {/* Date + Time + Duration */}
        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Data *"
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />
          <Input
            label="Horário *"
            type="time"
            value={form.time}
            onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
          />
          <Input
            label="Duração (min)"
            type="number"
            min={5}
            value={form.duration}
            onChange={(e) => setForm((f) => ({ ...f, duration: Number(e.target.value) }))}
          />
        </div>

        {/* Notes */}
        <Textarea
          label="Observações"
          rows={2}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Informações adicionais..."
        />

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} loading={saving}>Criar agendamento</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgendaPage() {
  const today      = useMemo(() => new Date(), [])
  const [weekStart, setWeekStart]       = useState(() => startOfWeek(today, { weekStartsOn: 1 }))
  const [selectedDay, setSelectedDay]   = useState(today)
  const [weekAppts, setWeekAppts]       = useState<Appointment[]>([])
  const [loading, setLoading]           = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [newModal, setNewModal]         = useState(false)

  const loadWeek = useCallback(() => {
    const from = format(weekStart, 'yyyy-MM-dd')
    const to   = format(addDays(weekStart, 6), 'yyyy-MM-dd')
    setLoading(true)
    listAppointments(from, to)
      .then(setWeekAppts)
      .catch(() => setWeekAppts([]))
      .finally(() => setLoading(false))
  }, [weekStart])

  useEffect(() => { loadWeek() }, [loadWeek])

  // Navigate weeks — keep selected day inside the new week
  const prevWeek = () => {
    const newStart = addDays(weekStart, -7)
    setWeekStart(newStart)
    setSelectedDay(addDays(selectedDay, -7))
  }
  const nextWeek = () => {
    const newStart = addDays(weekStart, 7)
    setWeekStart(newStart)
    setSelectedDay(addDays(selectedDay, 7))
  }
  const goToday = () => {
    setWeekStart(startOfWeek(today, { weekStartsOn: 1 }))
    setSelectedDay(today)
  }

  // Week day strip
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  // Count per day
  const countByDay = useMemo(() => {
    const counts: Record<string, number> = {}
    weekAppts.forEach((a) => {
      const d = getDateStr(a)
      if (d) counts[d] = (counts[d] ?? 0) + 1
    })
    return counts
  }, [weekAppts])

  // Appointments for selected day, filtered by status
  const dayAppts = useMemo(() => {
    const dayStr = format(selectedDay, 'yyyy-MM-dd')
    return weekAppts
      .filter((a) => getDateStr(a) === dayStr)
      .filter((a) => statusFilter === 'all' || a.status === statusFilter)
      .sort((a, b) => getTime(a).localeCompare(getTime(b)))
  }, [weekAppts, selectedDay, statusFilter])

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateAppointmentStatus(id, status)
      const s = STATUS_MAP[status]
      toast(s ? s.label : status)
      // Optimistic update
      setWeekAppts((prev) => prev.map((a) => a.id === id ? { ...a, status: status as Appointment['status'] } : a))
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao atualizar', 'error')
    }
  }

  const totalDay   = weekAppts.filter((a) => getDateStr(a) === format(selectedDay, 'yyyy-MM-dd')).length
  const weekLabel  = `${format(weekStart, "dd/MM")} – ${format(addDays(weekStart, 6), "dd/MM/yyyy")}`

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Agenda</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(selectedDay, "EEEE, dd 'de' MMMM", { locale: ptBR })} · {totalDay} agendamento{totalDay !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setNewModal(true)}>
          <Plus className="h-3.5 w-3.5" /> Novo agendamento
        </Button>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={prevWeek}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-gray-700 min-w-[140px] text-center">{weekLabel}</span>
        <button
          onClick={nextWeek}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={goToday}
          className="ml-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Hoje
        </button>
      </div>

      {/* Day strip */}
      <div className="grid grid-cols-7 gap-1.5">
        {weekDays.map((day, i) => {
          const dayStr    = format(day, 'yyyy-MM-dd')
          const count     = countByDay[dayStr] ?? 0
          const isToday   = isSameDay(day, today)
          const isSelected = isSameDay(day, selectedDay)
          return (
            <button
              key={dayStr}
              onClick={() => setSelectedDay(day)}
              className={`flex flex-col items-center py-2.5 px-1 rounded-xl text-center transition-colors ${
                isSelected
                  ? 'bg-brand-600 text-white'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <span className={`text-xs font-medium mb-1 ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                {DAY_NAMES[i]}
              </span>
              <span className={`text-sm font-bold ${isToday && !isSelected ? 'text-brand-600' : ''}`}>
                {format(day, 'd')}
              </span>
              {count > 0 && (
                <span className={`mt-1 text-xs font-medium px-1.5 py-0.5 rounded-full ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-brand-50 text-brand-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 w-fit">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              statusFilter === f.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Appointment list */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
          </div>
        ) : dayAppts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-gray-400">
            <CalendarCheck className="h-9 w-9 mb-3" />
            <p className="text-sm">
              {statusFilter === 'all'
                ? 'Nenhum agendamento neste dia'
                : `Nenhum agendamento com status "${STATUS_MAP[statusFilter]?.label ?? statusFilter}"`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {dayAppts.map((a) => (
              <AppointmentCard key={a.id} a={a} onStatusChange={handleStatusChange} />
            ))}
          </div>
        )}
      </Card>

      {/* New appointment modal */}
      <NovoAgendamentoModal
        open={newModal}
        initialDate={format(selectedDay, 'yyyy-MM-dd')}
        onClose={() => setNewModal(false)}
        onSaved={loadWeek}
      />
    </div>
  )
}
