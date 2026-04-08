'use client'

import { useEffect, useState } from 'react'
import { getDashboardSummary, listConversations, listAppointments } from '@/lib/api'
import type { DashboardSummary, Conversation, Appointment } from '@/types'
import {
  Card, CardHeader, MetricCard, LoadingRow, EmptyState,
  Table, Th, Td, Tr, Avatar,
} from '@/components/ui'
import { Badge as StatusBadge } from '@/components/ui/Badge'
import { convStatusVariant, aptStatusVariant, timeAgo, fmtDateTime } from '@/lib/utils'
import Link from 'next/link'

export function VisaoGeral({ refreshKey }: { refreshKey: number }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [convs,   setConvs]   = useState<Conversation[]>([])
  const [apts,    setApts]    = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([getDashboardSummary(), listConversations(), listAppointments()])
      .then(([s, c, a]) => { setSummary(s); setConvs(c); setApts(a) })
      .finally(() => setLoading(false))
  }, [refreshKey])

  if (loading || !summary) {
    return (
      <div className="grid grid-cols-4 gap-2.5 mb-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-[var(--color-surface-2)] rounded-lg p-3.5 h-20 animate-pulse" />
        ))}
      </div>
    )
  }

  const s = summary
  const wh = s.conversations.waiting_human

  return (
    <div className="space-y-4 animate-in">
      {/* Alert handoff */}
      {wh > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[var(--color-danger-bg)] rounded-xl">
          <p className="flex-1 text-xs font-medium text-[var(--color-danger-fg)]">
            {wh} conversa{wh > 1 ? 's' : ''} aguardando atendimento humano
          </p>
          <Link href="/atendimento" className="text-[10px] bg-[var(--color-danger-fg)] text-white px-3 py-1 rounded-lg">
            Ver fila
          </Link>
        </div>
      )}

      {/* Métricas principais */}
      <div className="grid grid-cols-4 gap-2.5">
        <MetricCard label="Clientes" value={s.customers.total} sub={`${s.customers.leads} leads`} />
        <MetricCard label="Conversas" value={s.conversations.total} sub={`${wh} aguardando humano`} subVariant={wh > 0 ? 'down' : 'neutral'} />
        <MetricCard label="Agendamentos hoje" value={s.appointments.today} sub={`${s.appointments.confirmed} confirmados`} />
        <MetricCard label="Mensagens" value={s.messages.total} sub={`${s.messages.inbound} in · ${s.messages.outbound} out`} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Conversas */}
        <Card>
          <CardHeader
            title="Conversas recentes"
            action={<Link href="/atendimento" className="text-[11px] text-[var(--color-info-fg)] hover:underline">Ver todas</Link>}
          />
          {convs.length === 0 ? <EmptyState text="Nenhuma conversa" /> : (
            <div className="space-y-0">
              {convs.slice(0, 5).map(c => (
                <div key={c.id} className="flex items-center gap-2.5 py-2.5 border-b border-[var(--color-border)] last:border-0">
                  <Avatar name={c.customer_name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{c.customer_name}</p>
                    <p className="text-[10px] text-[var(--color-text-2)] truncate">{c.last_message_text || '—'}</p>
                  </div>
                  <StatusBadge label={c.status} variant={convStatusVariant(c.status)} />
                  <span className="text-[10px] text-[var(--color-text-3)] flex-shrink-0">{timeAgo(c.updated_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Agendamentos */}
        <Card>
          <CardHeader
            title="Agendamentos recentes"
            action={<Link href="/agenda" className="text-[11px] text-[var(--color-info-fg)] hover:underline">Agenda completa</Link>}
          />
          {apts.length === 0 ? <EmptyState text="Nenhum agendamento" /> : (
            <div className="space-y-0">
              {apts.slice(0, 5).map(a => (
                <div key={a.id} className="flex items-center gap-2.5 py-2.5 border-b border-[var(--color-border)] last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{a.customer_name}</p>
                    <p className="text-[10px] text-[var(--color-text-2)]">
                      {a.service_name} · {a.professional_name} · {fmtDateTime(a.scheduled_start_at)}
                    </p>
                  </div>
                  <StatusBadge label={a.status} variant={aptStatusVariant(a.status)} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Distribuição de status */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Distribuição — conversas" />
          <BarStats rows={[
            { label: 'Bot ativo',         value: s.conversations.bot_active,    total: s.conversations.total, color: '#185FA5' },
            { label: 'Aberto',            value: s.conversations.open,          total: s.conversations.total, color: '#888780' },
            { label: 'Aguardando humano', value: s.conversations.waiting_human, total: s.conversations.total, color: '#A32D2D' },
            { label: 'Resolvido',         value: s.conversations.resolved,      total: s.conversations.total, color: '#27500A' },
          ]} />
        </Card>
        <Card>
          <CardHeader title="Distribuição — agendamentos" />
          <BarStats rows={[
            { label: 'Confirmados', value: s.appointments.confirmed,                            total: s.appointments.total, color: '#27500A' },
            { label: 'Pendentes',   value: s.appointments.pending,                              total: s.appointments.total, color: '#BA7517' },
            { label: 'Concluídos',  value: s.appointments.completed,                            total: s.appointments.total, color: '#185FA5' },
            { label: 'Cancelados',  value: s.appointments.cancelled + s.appointments.no_show,   total: s.appointments.total, color: '#A32D2D' },
          ]} />
        </Card>
      </div>

      {/* Jobs */}
      <Card>
        <CardHeader
          title="Job queue — status"
          action={<Link href="/observabilidade" className="text-[11px] text-[var(--color-info-fg)] hover:underline">Detalhes</Link>}
        />
        <div className="grid grid-cols-4 gap-2.5">
          <MetricCard label="Total de jobs" value={s.jobs.total} />
          <MetricCard label="Completados"   value={s.jobs.completed} subVariant="up" />
          <MetricCard label="Pendentes"     value={s.jobs.pending} />
          <MetricCard label="Falharam"      value={s.jobs.failed} subVariant={s.jobs.failed > 0 ? 'down' : 'up'} sub={s.jobs.failed > 0 ? 'requer atenção' : 'ok'} />
        </div>
      </Card>
    </div>
  )
}

function BarStats({ rows }: { rows: { label: string; value: number; total: number; color: string }[] }) {
  return (
    <div className="space-y-3">
      {rows.map(r => (
        <div key={r.label}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-[var(--color-text-2)]">{r.label}</span>
            <span className="font-medium">{r.value}</span>
          </div>
          <div className="h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${r.total > 0 ? Math.round(r.value / r.total * 100) : 0}%`, background: r.color }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
