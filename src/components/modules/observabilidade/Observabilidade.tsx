'use client'

import { useEffect, useState } from 'react'
import { listJobQueue, getDashboardSummary } from '@/lib/api'
import type { JobQueueItem, DashboardSummary } from '@/types'
import { Card, CardHeader, MetricCard, LoadingRow, EmptyState, Table, Th, Td, Tr } from '@/components/ui'
import { Badge } from '@/components/ui/Badge'
import { jobStatusVariant, timeAgo } from '@/lib/utils'

export function Observabilidade({ refreshKey }: { refreshKey: number }) {
  const [jobs,    setJobs]    = useState<JobQueueItem[]>([])
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([listJobQueue(), getDashboardSummary()])
      .then(([j, s]) => { setJobs(j); setSummary(s) })
      .finally(() => setLoading(false))
  }, [refreshKey])

  const failed = jobs.filter(j => j.status === 'failed')

  return (
    <div className="space-y-4 animate-in">
      {failed.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[var(--color-danger-bg)] rounded-xl">
          <p className="flex-1 text-xs font-medium text-[var(--color-danger-fg)]">
            {failed.length} job{failed.length > 1 ? 's' : ''} com falha: {failed[0]?.last_error || ''}
          </p>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2.5">
        <MetricCard label="Jobs total"    value={summary?.jobs.total    ?? '—'} />
        <MetricCard label="Completados"   value={summary?.jobs.completed ?? '—'} subVariant="up" />
        <MetricCard label="Falharam"      value={summary?.jobs.failed   ?? '—'} subVariant={summary && summary.jobs.failed > 0 ? 'down' : 'neutral'} />
        <MetricCard label="Mensagens"     value={summary?.messages.total ?? '—'} sub={summary ? `${summary.messages.inbound} in · ${summary.messages.outbound} out` : undefined} />
      </div>

      <Card padding={false}>
        <div className="p-4 pb-2">
          <CardHeader title="Job queue" subtitle={`${jobs.length} jobs`} />
        </div>
        {loading ? <LoadingRow text="Buscando jobs..." /> : jobs.length === 0 ? (
          <EmptyState text="Nenhum job encontrado" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Fila</Th><Th>Tipo</Th><Th>Status</Th><Th>Tentativas</Th><Th>Último erro</Th><Th>Atualizado</Th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(j => (
                <Tr key={j.id}>
                  <Td className="font-mono text-[11px]">{j.queue_name}</Td>
                  <Td className="font-mono text-[11px]">{j.job_type}</Td>
                  <Td><Badge label={j.status} variant={jobStatusVariant(j.status)} /></Td>
                  <Td className="text-xs">{j.attempts}/{j.max_attempts}</Td>
                  <Td className="text-[11px] text-[var(--color-danger-fg)] max-w-[220px] truncate">
                    {j.last_error || '—'}
                  </Td>
                  <Td className="text-[11px] text-[var(--color-text-2)]">{timeAgo(j.updated_at)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
