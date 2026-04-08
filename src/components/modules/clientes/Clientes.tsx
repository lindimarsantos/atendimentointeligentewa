'use client'

import { useEffect, useState } from 'react'
import { listCustomers } from '@/lib/api'
import type { Customer } from '@/types'
import { Card, CardHeader, LoadingRow, EmptyState, Table, Th, Td, Tr, Avatar, MetricCard } from '@/components/ui'
import { Badge } from '@/components/ui/Badge'
import { custStatusVariant, fmtDateTime, timeAgo } from '@/lib/utils'

export function Clientes({ refreshKey }: { refreshKey: number }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    listCustomers().then(setCustomers).finally(() => setLoading(false))
  }, [refreshKey])

  const leads    = customers.filter(c => c.status === 'lead').length
  const prospects= customers.filter(c => c.status === 'prospect').length
  const active   = customers.filter(c => c.status === 'active').length

  return (
    <div className="space-y-4 animate-in">
      <div className="grid grid-cols-4 gap-2.5">
        <MetricCard label="Total" value={customers.length} />
        <MetricCard label="Leads" value={leads} />
        <MetricCard label="Prospects" value={prospects} />
        <MetricCard label="Ativos" value={active} subVariant="up" />
      </div>

      <Card padding={false}>
        <div className="p-4 pb-2">
          <CardHeader title="Base de clientes" subtitle={`${customers.length} cadastros`} />
        </div>
        {loading ? <LoadingRow text="Buscando clientes..." /> : customers.length === 0 ? (
          <EmptyState text="Nenhum cliente encontrado" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Nome</Th>
                <Th>Telefone</Th>
                <Th>Status</Th>
                <Th>Primeiro contato</Th>
                <Th>Última interação</Th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <Tr key={c.id}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Avatar name={c.full_name} />
                      <div>
                        <p className="font-medium text-xs">{c.full_name || '—'}</p>
                        <p className="text-[10px] text-[var(--color-text-2)]">{c.email || ''}</p>
                      </div>
                    </div>
                  </Td>
                  <Td className="font-mono text-[11px]">{c.phone_e164 || '—'}</Td>
                  <Td><Badge label={c.status} variant={custStatusVariant(c.status)} /></Td>
                  <Td className="text-xs text-[var(--color-text-2)]">{fmtDateTime(c.first_contact_at)}</Td>
                  <Td className="text-xs text-[var(--color-text-2)]">{timeAgo(c.last_interaction_at)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
