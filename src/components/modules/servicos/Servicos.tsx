'use client'

import { useEffect, useState } from 'react'
import { listServices } from '@/lib/api'
import type { Service } from '@/types'
import { Card, CardHeader, LoadingRow, EmptyState, Table, Th, Td, Tr } from '@/components/ui'
import { Badge } from '@/components/ui/Badge'
import { fmtBRL } from '@/lib/utils'

export function Servicos({ refreshKey }: { refreshKey: number }) {
  const [services, setServices] = useState<Service[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    setLoading(true)
    listServices().then(setServices).finally(() => setLoading(false))
  }, [refreshKey])

  return (
    <div className="space-y-4 animate-in">
      <Card padding={false}>
        <div className="p-4 pb-2">
          <CardHeader title="Catálogo de serviços" subtitle={`${services.length} serviços`} />
        </div>
        {loading ? <LoadingRow text="Buscando serviços..." /> : services.length === 0 ? (
          <EmptyState text="Nenhum serviço cadastrado" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Serviço</Th>
                <Th>Duração</Th>
                <Th>Preço mínimo</Th>
                <Th>Preço máximo</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {services.map(s => (
                <Tr key={s.id}>
                  <Td className="font-medium text-xs">{s.name}</Td>
                  <Td className="text-xs text-[var(--color-text-2)]">
                    {s.duration_minutes ? `${s.duration_minutes} min` : '—'}
                  </Td>
                  <Td className="text-xs">{fmtBRL(s.price_from)}</Td>
                  <Td className="text-xs">{fmtBRL(s.price_to)}</Td>
                  <Td>
                    <Badge label={s.is_active ? 'ativo' : 'inativo'} variant={s.is_active ? 'success' : 'muted'} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
