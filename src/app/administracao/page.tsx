'use client'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Card, CardHeader } from '@/components/ui'

export default function Page() {
  return (
    <DashboardShell title="Administração">
      {() => (
        <Card>
          <CardHeader title="Administração" subtitle="Módulo em construção — próxima iteração." />
        </Card>
      )}
    </DashboardShell>
  )
}
