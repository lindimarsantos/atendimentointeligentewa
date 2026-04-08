'use client'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Clientes } from '@/components/modules/clientes/Clientes'


export default function Page() {
  return (
    <DashboardShell title="Clientes">
      {({ refreshKey }) => <Clientes refreshKey={refreshKey} />}
    </DashboardShell>
  )
}
