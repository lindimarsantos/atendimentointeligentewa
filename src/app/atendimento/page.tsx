import { DashboardShell } from '@/components/layout/DashboardShell'
import { Atendimento } from '@/components/modules/atendimento/Atendimento'

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <DashboardShell title="Atendimento">
      {({ refreshKey }) => <Atendimento refreshKey={refreshKey} />}
    </DashboardShell>
  )
}
