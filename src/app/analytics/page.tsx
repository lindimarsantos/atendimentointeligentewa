'use client'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Card, CardHeader } from '@/components/ui'


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
