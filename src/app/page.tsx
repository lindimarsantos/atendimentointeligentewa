'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { getDashboardSummary } from '@/lib/api'
import type { DashboardSummary } from '@/types'
import { fmtSeconds } from '@/lib/utils'
import {
  MessageSquare,
  Clock,
  CheckCircle2,
  Users,
  CalendarCheck,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  color: string
  sub?: string
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </Card>
  )
}

export default function VisaoGeralPage() {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDashboardSummary()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    )

  if (error)
    return (
      <div className="flex items-center gap-2 text-red-600 p-4 bg-red-50 rounded-lg">
        <AlertCircle className="h-5 w-5" />
        <span className="text-sm">{error}</span>
      </div>
    )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Visão Geral</h1>
        <p className="text-sm text-gray-500 mt-0.5">Resumo do atendimento em tempo real</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard
          label="Conversas abertas"
          value={data?.open_conversations ?? 0}
          icon={MessageSquare}
          color="bg-blue-500"
          sub={`${data?.total_conversations ?? 0} total`}
        />
        <StatCard
          label="Aguardando humano"
          value={data?.pending_conversations ?? 0}
          icon={Clock}
          color="bg-yellow-500"
        />
        <StatCard
          label="Resolvidas hoje"
          value={data?.resolved_today ?? 0}
          icon={CheckCircle2}
          color="bg-green-500"
        />
        <StatCard
          label="Tempo médio resposta"
          value={fmtSeconds(data?.avg_response_seconds ?? 0)}
          icon={TrendingUp}
          color="bg-purple-500"
        />
        <StatCard
          label="Agendamentos hoje"
          value={data?.appointments_today ?? 0}
          icon={CalendarCheck}
          color="bg-brand-600"
        />
        <StatCard
          label="Novos clientes (semana)"
          value={data?.new_customers_week ?? 0}
          icon={Users}
          color="bg-pink-500"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status das conversas</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Bot ativo',        value: 'bot_active',    color: 'bg-purple-100 text-purple-700' },
            { label: 'Abertas',          value: 'open',          color: 'bg-blue-100 text-blue-700'   },
            { label: 'Aguardando humano',value: 'waiting_human', color: 'bg-orange-100 text-orange-700' },
            { label: 'Pendentes',        value: 'pending',       color: 'bg-yellow-100 text-yellow-700' },
            { label: 'Resolvidas',       value: 'resolved',      color: 'bg-green-100 text-green-700' },
          ].map((s) => (
            <span
              key={s.value}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${s.color}`}
            >
              <span className="h-2 w-2 rounded-full bg-current opacity-60" />
              {s.label}
            </span>
          ))}
        </div>
      </Card>
    </div>
  )
}
