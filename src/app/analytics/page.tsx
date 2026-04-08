'use client'

import { Card } from '@/components/ui/Card'
import { BarChart2, TrendingUp, DollarSign, Users } from 'lucide-react'

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Analytics e ROI</h1>
        <p className="text-sm text-gray-500 mt-0.5">Métricas de performance e retorno</p>
      </div>
      <Card>
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
          <BarChart2 className="h-12 w-12 text-gray-300" />
          <p className="text-base font-medium text-gray-500">Módulo em construção</p>
          <p className="text-sm">Analytics e ROI serão implementados na próxima iteração.</p>
        </div>
      </Card>
    </div>
  )
}
