import { DashboardShell } from '@/components/layout/DashboardShell'
import { Agenda } from '@/components/modules/agenda/Agenda'

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <DashboardShell title="Agenda">
      {({ refreshKey }) => <Agenda refreshKey={refreshKey} />}
    </DashboardShell>
  )
}
