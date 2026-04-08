'use client'

import { useEffect, useState } from 'react'
import { listTemplates, listReminderRules, listReminderDispatches } from '@/lib/api'
import type { WhatsAppTemplate, ReminderRule, ReminderDispatch } from '@/types'
import { Card, CardHeader, LoadingRow, EmptyState, Table, Th, Td, Tr } from '@/components/ui'
import { Badge } from '@/components/ui/Badge'
import { fmtDateTime } from '@/lib/utils'

export function Campanhas({ refreshKey }: { refreshKey: number }) {
  const [templates,  setTemplates]  = useState<WhatsAppTemplate[]>([])
  const [rules,      setRules]      = useState<ReminderRule[]>([])
  const [dispatches, setDispatches] = useState<ReminderDispatch[]>([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([listTemplates(), listReminderRules(), listReminderDispatches()])
      .then(([t, r, d]) => { setTemplates(t); setRules(r); setDispatches(d) })
      .finally(() => setLoading(false))
  }, [refreshKey])

  return (
    <div className="space-y-4 animate-in">
      <div className="grid grid-cols-2 gap-4">
        {/* Templates */}
        <Card>
          <CardHeader title="Templates WhatsApp" subtitle={`${templates.length} templates`} />
          {loading ? <LoadingRow /> : templates.length === 0 ? <EmptyState text="Nenhum template" /> : (
            <div className="space-y-3">
              {templates.map(t => (
                <div key={t.id} className="pb-3 border-b border-[var(--color-border)] last:border-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-xs font-medium">{t.name}</p>
                    <Badge label={t.is_active ? 'ativo' : 'inativo'} variant={t.is_active ? 'success' : 'muted'} />
                  </div>
                  <p className="text-[10px] font-mono text-[var(--color-text-2)]">{t.code} · {t.category}</p>
                  {t.body_text && (
                    <p className="text-[10px] text-[var(--color-text-2)] mt-1.5 leading-relaxed line-clamp-3">
                      {t.body_text}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Reminder rules */}
        <Card>
          <CardHeader title="Reminder rules" subtitle={`${rules.length} regras`} />
          {loading ? <LoadingRow /> : rules.length === 0 ? <EmptyState text="Nenhuma regra" /> : (
            <div className="space-y-3">
              {rules.map(r => (
                <div key={r.id} className="flex items-center gap-3 pb-3 border-b border-[var(--color-border)] last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{r.name}</p>
                    <p className="text-[10px] text-[var(--color-text-2)] mt-0.5">
                      {r.trigger_type} · {r.hours_before}h antes
                    </p>
                  </div>
                  <Badge label={r.is_active ? 'ativa' : 'inativa'} variant={r.is_active ? 'success' : 'muted'} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Dispatches */}
      <Card padding={false}>
        <div className="p-4 pb-2">
          <CardHeader title="Reminder dispatches" subtitle={`${dispatches.length} registros`} />
        </div>
        {loading ? <LoadingRow /> : dispatches.length === 0 ? <EmptyState text="Nenhum dispatch" /> : (
          <Table>
            <thead>
              <tr>
                <Th>ID</Th><Th>Status</Th><Th>Enviado em</Th><Th>Erro</Th><Th>Criado em</Th>
              </tr>
            </thead>
            <tbody>
              {dispatches.map(d => (
                <Tr key={d.id}>
                  <Td className="font-mono text-[10px] text-[var(--color-text-2)]">{d.id.slice(0, 13)}…</Td>
                  <Td>
                    <Badge
                      label={d.status}
                      variant={d.status === 'sent' ? 'success' : d.status === 'failed' ? 'human' : 'muted'}
                    />
                  </Td>
                  <Td className="text-xs text-[var(--color-text-2)]">{fmtDateTime(d.dispatched_at)}</Td>
                  <Td className="text-[11px] text-[var(--color-danger-fg)] max-w-[200px] truncate">
                    {d.error_message || '—'}
                  </Td>
                  <Td className="text-xs text-[var(--color-text-2)]">{fmtDateTime(d.created_at)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
