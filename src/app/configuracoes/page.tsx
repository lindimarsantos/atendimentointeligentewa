import { DashboardShell } from '@/components/layout/DashboardShell'
import { Card, CardHeader } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <DashboardShell title="Configurações">
      {() => (
        <Card>
          <CardHeader title="Configurações" subtitle="Módulo em construção — próxima iteração." />
        </Card>
      )}
    </DashboardShell>
  )
}
