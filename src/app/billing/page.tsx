'use client'

import { Card } from '@/components/ui/Card'
import { CreditCard } from 'lucide-react'

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Billing e Uso</h1>
        <p className="text-sm text-gray-500 mt-0.5">Consumo, limites e faturamento</p>
      </div>
      <Card>
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
          <CreditCard className="h-12 w-12 text-gray-300" />
          <p className="text-base font-medium text-gray-500">Módulo em construção</p>
          <p className="text-sm">Billing e Uso serão implementados na próxima iteração.</p>
        </div>
      </Card>
    </div>
  )
}
