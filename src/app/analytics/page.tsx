import { DashboardShell } from '@/components/layout/DashboardShell'
import { Card, CardHeader } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <DashboardShell title="Analytics e ROI">
      {() => (
        <Card>
          <CardHeader title="Analytics e ROI" subtitle="Módulo em construção — próxima iteração." />
        </Card>
      )}
    </DashboardShell>
  )
}
