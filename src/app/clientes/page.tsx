import { DashboardShell } from '@/components/layout/DashboardShell'
import { Clientes } from '@/components/modules/clientes/Clientes'

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <DashboardShell title="Clientes">
      {({ refreshKey }) => <Clientes refreshKey={refreshKey} />}
    </DashboardShell>
  )
}
