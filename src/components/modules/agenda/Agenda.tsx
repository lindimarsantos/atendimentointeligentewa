'use client'

import { useEffect, useState } from 'react'
import { listAppointments } from '@/lib/api'
import type { Appointment } from '@/types'
import { Card, CardHeader, LoadingRow, EmptyState, Table, Th, Td, Tr, Avatar, MetricCard } from '@/components/ui'
import { Badge } from '@/components/ui/Badge'
import { aptStatusVariant, fmtDateTime, timeAgo } from '@/lib/utils'

export function Agenda({ refreshKey }: { refreshKey: number }) {
  const [apts,   setApts]   = useState<Appointment[]>([])
  const [loading,setLoading]= useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    listAppointments(filter || undefined)
      .then(setApts)
      .finally(() => setLoading(false))
  }, [filter, refreshKey])

  const confirmed  = apts.filter(a => a.status === 'confirmed').length
  const pending    = apts.filter(a => a.status === 'pending').length
  const completed  = apts.filter(a => a.status === 'completed').length
  const cancelled  = apts.filter(a => ['cancelled','no_show'].includes(a.status)).length

  return (
    <div className="space-y-4 animate-in">
      {/* Métricas */}
      <div className="grid grid-cols-4 gap-2.5">
        <MetricCard label="Total"       value={apts.length} />
        <MetricCard label="Confirmados" value={confirmed}  subVariant="up" />
        <MetricCard label="Pendentes"   value={pending} />
        <MetricCard label="Concluídos"  value={completed}  subVariant="up" />
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs border border-[var(--color-border-md)] rounded-lg bg-[var(--color-surface)] text-[var(--color-text)]"
        >
          <option value="">Todos os status</option>
          <option value="confirmed">confirmed</option>
          <option value="pending">pending</option>
          <option value="completed">completed</option>
          <option value="cancelled">cancelled</option>
          <option value="no_show">no_show</option>
        </select>
        <span className="text-xs text-[var(--color-text-2)]">{apts.length} agendamento{apts.length !== 1 ? 's' : ''}</span>
      </div>

      <Card padding={false}>
        <div className="p-4 pb-2"><CardHeader title="Agendamentos" /></div>
        {loading ? <LoadingRow text="Buscando agendamentos..." /> : apts.length === 0 ? (
          <EmptyState text="Nenhum agendamento encontrado" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Data/Hora</Th>
                <Th>Cliente</Th>
                <Th>Profissional</Th>
                <Th>Serviço</Th>
                <Th>Duração</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {apts.map(a => (
                <Tr key={a.id}>
                  <Td className="whitespace-nowrap font-medium">{fmtDateTime(a.scheduled_start_at)}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Avatar name={a.customer_name} />
                      <div>
                        <p className="font-medium text-xs">{a.customer_name}</p>
                        <p className="text-[10px] text-[var(--color-text-2)] font-mono">{a.customer_phone}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <p className="text-xs font-medium">{a.professional_name}</p>
                    <p className="text-[10px] text-[var(--color-text-2)]">{a.professional_specialty}</p>
                  </Td>
                  <Td className="text-xs">{a.service_name}</Td>
                  <Td className="text-xs text-[var(--color-text-2)]">{a.service_duration} min</Td>
                  <Td><Badge label={a.status} variant={aptStatusVariant(a.status)} /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
