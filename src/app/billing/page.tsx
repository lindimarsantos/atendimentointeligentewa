'use client'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Card, CardHeader } from '@/components/ui'


export default function Page() {
  return (
    <DashboardShell title="Billing e Uso">
      {() => (
        <Card>
          <CardHeader title="Billing e Uso" subtitle="Módulo em construção — próxima iteração." />
        </Card>
      )}
    </DashboardShell>
  )
}
