'use client'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Observabilidade } from '@/components/modules/observabilidade/Observabilidade'

export default function Page() {
  return (
    <DashboardShell title="Observabilidade">
      {({ refreshKey }) => <Observabilidade refreshKey={refreshKey} />}
    </DashboardShell>
  )
}
