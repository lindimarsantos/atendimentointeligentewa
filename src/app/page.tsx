import { DashboardShell } from '@/components/layout/DashboardShell'
import { VisaoGeral } from '@/components/modules/visao-geral/VisaoGeral'

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <DashboardShell title="Visão Geral">
      {({ refreshKey }) => <VisaoGeral refreshKey={refreshKey} />}
    </DashboardShell>
  )
}
