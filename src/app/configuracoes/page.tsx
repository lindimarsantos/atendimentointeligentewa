'use client'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Card, CardHeader } from '@/components/ui'


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
