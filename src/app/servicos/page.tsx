import { DashboardShell } from '@/components/layout/DashboardShell'
import { Servicos } from '@/components/modules/servicos/Servicos'

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <DashboardShell title="Serviços">
      {({ refreshKey }) => <Servicos refreshKey={refreshKey} />}
    </DashboardShell>
  )
}
