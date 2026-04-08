'use client'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Campanhas } from '@/components/modules/campanhas/Campanhas'

export default function Page() {
  return (
    <DashboardShell title="Campanhas e Templates">
      {({ refreshKey }) => <Campanhas refreshKey={refreshKey} />}
    </DashboardShell>
  )
}
