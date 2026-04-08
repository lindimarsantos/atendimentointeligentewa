'use client'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Atendimento } from '@/components/modules/atendimento/Atendimento'

export default function Page() {
  return (
    <DashboardShell title="Atendimento">
      {({ refreshKey }) => <Atendimento refreshKey={refreshKey} />}
    </DashboardShell>
  )
}
