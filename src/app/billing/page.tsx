'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { getDashboardSummary } from '@/lib/api'
import type { DashboardSummary } from '@/types'
import { CreditCard, MessageSquare, CalendarCheck, Zap, Users, Activity } from 'lucide-react'

// Simulated plan limits (replace with real billing API when available)
const PLAN = {
  name: 'Plano Business',
  limits: {
    messages:      50_000,
    conversations: 2_000,
    appointments:  500,
    jobs:          10_000,
    customers:     5_000,
  },
}

function UsageBar({
  label, used, limit, icon: Icon, color,
}: {
  label: string; used: number; limit: number
  icon: React.ComponentType<{ className?: string }>; color: string
}) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const isHigh = pct >= 80
  return (
    <div className="flex items-start gap-3">
      <div className={`p-2 rounded-lg ${color} shrink-0 mt-0.5`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className={`text-xs font-medium ${isHigh ? 'text-red-600' : 'text-gray-500'}`}>
            {used.toLocaleString('pt-BR')} / {limit.toLocaleString('pt-BR')}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${isHigh ? 'bg-red-500' : 'bg-brand-500'}`}
            style={{ width: `${pct.toFixed(1)}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{pct.toFixed(1)}% utilizado</p>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, icon: Icon, iconBg }: {
  label: string; value: string | number; sub?: string
  icon: React.ComponentType<{ className?: string }>; iconBg: string
}) {
  return (
    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
      <div className={`p-2.5 rounded-xl ${iconBg} shrink-0`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

export default function BillingPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboardSummary()
      .then(setSummary)
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  const jobs = summary?.jobs ?? { total: 0, pending: 0, completed: 0, failed: 0 }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Billing e Uso</h1>
        <p className="text-sm text-gray-500 mt-0.5">Consumo do plano e métricas de utilização</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
        </div>
      ) : (
        <>
          {/* Plan summary */}
          <Card>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-600 shrink-0">
                  <CreditCard className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{PLAN.name}</p>
                  <p className="text-xs text-gray-500">Ciclo mensal atual</p>
                </div>
              </div>
              <Badge variant="success">Ativo</Badge>
            </div>
            <p className="text-xs text-gray-400">
              Os limites abaixo são referências do plano atual. Entre em contato para upgrade ou ajuste de limites.
            </p>
          </Card>

          {/* Usage */}
          <Card>
            <p className="text-sm font-semibold text-gray-900 mb-5">Consumo do período</p>
            <div className="space-y-5">
              <UsageBar
                label="Mensagens"
                used={summary?.messages.total ?? 0}
                limit={PLAN.limits.messages}
                icon={MessageSquare}
                color="bg-brand-500"
              />
              <UsageBar
                label="Conversas"
                used={summary?.conversations.total ?? 0}
                limit={PLAN.limits.conversations}
                icon={Activity}
                color="bg-indigo-500"
              />
              <UsageBar
                label="Agendamentos"
                used={summary?.appointments.total ?? 0}
                limit={PLAN.limits.appointments}
                icon={CalendarCheck}
                color="bg-green-500"
              />
              <UsageBar
                label="Jobs processados"
                used={jobs.total}
                limit={PLAN.limits.jobs}
                icon={Zap}
                color="bg-amber-500"
              />
              <UsageBar
                label="Clientes na base"
                used={summary?.customers.total ?? 0}
                limit={PLAN.limits.customers}
                icon={Users}
                color="bg-purple-500"
              />
            </div>
          </Card>

          {/* Operational stats */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Estatísticas operacionais</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard
                label="Mensagens hoje"
                value={(summary?.messages.today ?? 0).toLocaleString('pt-BR')}
                sub={`${summary?.messages.inbound ?? 0} recebidas · ${summary?.messages.outbound ?? 0} enviadas`}
                icon={MessageSquare}
                iconBg="bg-brand-500"
              />
              <StatCard
                label="Jobs concluídos"
                value={(jobs.completed).toLocaleString('pt-BR')}
                sub={`${jobs.failed} falharam · ${jobs.pending} pendentes`}
                icon={Zap}
                iconBg="bg-amber-500"
              />
              <StatCard
                label="Lembretes enviados"
                value={(summary?.reminders.dispatches_sent ?? 0).toLocaleString('pt-BR')}
                sub={`${summary?.reminders.dispatches_failed ?? 0} falharam`}
                icon={Activity}
                iconBg="bg-teal-500"
              />
              <StatCard
                label="Novos clientes (semana)"
                value={(summary?.customers.new_week ?? 0).toLocaleString('pt-BR')}
                sub={`${summary?.customers.new_today ?? 0} hoje`}
                icon={Users}
                iconBg="bg-purple-500"
              />
              <StatCard
                label="Regras de lembrete"
                value={summary?.reminders.rules_active ?? 0}
                sub="regras ativas"
                icon={CalendarCheck}
                iconBg="bg-green-500"
              />
              <StatCard
                label="Conversas abertas"
                value={summary?.conversations.open ?? 0}
                sub={`${summary?.conversations.waiting_human ?? 0} aguardando humano`}
                icon={Activity}
                iconBg="bg-blue-500"
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
