'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { listAppointments } from '@/lib/api'
import type { Appointment } from '@/types'
import { fmtDate, fmtDateTime } from '@/lib/utils'
import { CalendarCheck, AlertCircle, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const statusMap: Record<string, { label: string; variant: 'default' | 'info' | 'success' | 'error' | 'warning' }> = {
  scheduled:  { label: 'Agendado',   variant: 'info'    },
  confirmed:  { label: 'Confirmado', variant: 'success' },
  cancelled:  { label: 'Cancelado',  variant: 'error'   },
  completed:  { label: 'Realizado',  variant: 'default' },
}

export default function AgendaPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    listAppointments(selectedDate)
      .then(setAppointments)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [selectedDate])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Agenda</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(new Date(selectedDate + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 p-3 bg-red-50 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <Card padding={false}>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <CalendarCheck className="h-8 w-8 mb-2" />
            <p className="text-sm">Nenhum agendamento nesta data</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {appointments.map((a) => {
              const s = statusMap[a.status] ?? { label: a.status, variant: 'default' as const }
              return (
                <li key={a.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="flex items-center gap-1.5 text-sm text-gray-500 w-14 shrink-0">
                    <Clock className="h-3.5 w-3.5" />
                    {fmtDateTime(a.scheduled_at).split(' às ')[1] ?? '—'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{a.customer_name ?? 'Cliente'}</p>
                    <p className="text-xs text-gray-500">
                      {a.service_name} · {a.professional_name} · {a.duration_minutes}min
                    </p>
                  </div>
                  <Badge variant={s.variant}>{s.label}</Badge>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
