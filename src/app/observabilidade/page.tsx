import { DashboardShell } from '@/components/layout/DashboardShell'
import { Observabilidade } from '@/components/modules/observabilidade/Observabilidade'

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <DashboardShell title="Observabilidade">
      {({ refreshKey }) => <Observabilidade refreshKey={refreshKey} />}
    </DashboardShell>
  )
}
