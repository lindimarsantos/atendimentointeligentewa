'use client'

import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Card } from '@/components/ui/Card'
import { getDashboardSummary, getConversationsTrend, getAppointmentsTrend } from '@/lib/api'
import type { DashboardSummary, DailyMetric, DailyAppointmentMetric } from '@/types'
import { fmtSeconds } from '@/lib/utils'
import {
  MessageSquare, Bot, UserCheck, Clock, CheckCircle2, CalendarCheck,
  TrendingUp, TrendingDown, Minus,
} from 'lucide-react'

// recharts (no SSR)
const AreaChart       = dynamic(() => import('recharts').then(m => m.AreaChart),       { ssr: false })
const Area            = dynamic(() => import('recharts').then(m => m.Area),            { ssr: false })
const BarChart        = dynamic(() => import('recharts').then(m => m.BarChart),        { ssr: false })
const Bar             = dynamic(() => import('recharts').then(m => m.Bar),             { ssr: false })
const XAxis           = dynamic(() => import('recharts').then(m => m.XAxis),           { ssr: false })
const YAxis           = dynamic(() => import('recharts').then(m => m.YAxis),           { ssr: false })
const CartesianGrid   = dynamic(() => import('recharts').then(m => m.CartesianGrid),   { ssr: false })
const Tooltip         = dynamic(() => import('recharts').then(m => m.Tooltip),         { ssr: false })
const Legend          = dynamic(() => import('recharts').then(m => m.Legend),          { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false })

function fmtDay(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function pct(n: number) { return `${(n * 100).toFixed(1)}%` }

function TrendIcon({ v }: { v: number }) {
  if (v > 0) return <TrendingUp className="h-3.5 w-3.5 text-green-500" />
  if (v < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-500" />
  return <Minus className="h-3.5 w-3.5 text-gray-400" />
}

function KpiCard({
  label, value, sub, icon: Icon, iconBg, trend,
}: {
  label: string; value: string | number; sub?: string
  icon: React.ComponentType<{ className?: string }>; iconBg: string; trend?: number
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 mb-1 truncate">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {sub && (
            <div className="flex items-center gap-1 mt-1">
              {trend !== undefined && <TrendIcon v={trend} />}
              <p className="text-xs text-gray-400">{sub}</p>
            </div>
          )}
        </div>
        <div className={`p-2.5 rounded-xl ${iconBg} shrink-0`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </Card>
  )
}

const PERIODS = [
  { label: '7 dias',  value: 7  },
  { label: '14 dias', value: 14 },
  { label: '30 dias', value: 30 },
]

export default function AnalyticsPage() {
  const [period, setPeriod]         = useState(30)
  const [summary, setSummary]       = useState<DashboardSummary | null>(null)
  const [convTrend, setConvTrend]   = useState<DailyMetric[]>([])
  const [apptTrend, setApptTrend]   = useState<DailyAppointmentMetric[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.allSettled([
      getDashboardSummary(),
      getConversationsTrend(period),
      getAppointmentsTrend(period),
    ]).then(([s, c, a]) => {
      if (s.status === 'fulfilled') setSummary(s.value)
      if (c.status === 'fulfilled') setConvTrend(c.value)
      if (a.status === 'fulfilled') setApptTrend(a.value)
    }).finally(() => setLoading(false))
  }, [period])

  const convData = useMemo(() =>
    convTrend.map(d => ({ ...d, day: fmtDay(d.date) })),
  [convTrend])

  const apptData = useMemo(() =>
    apptTrend.map(d => ({ ...d, day: fmtDay(d.date) })),
  [apptTrend])

  const perf = summary?.performance

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Analytics e ROI</h1>
          <p className="text-sm text-gray-500 mt-0.5">Métricas de performance e retorno do atendimento inteligente</p>
        </div>
        {/* Period selector */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                period === p.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
        </div>
      ) : (
        <>
          {/* AI Performance KPIs */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Performance da IA</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                label="Taxa de resolução IA"
                value={perf ? pct(perf.bot_resolution_rate) : '—'}
                sub="conversas resolvidas pelo bot"
                icon={Bot}
                iconBg="bg-purple-500"
              />
              <KpiCard
                label="Taxa de handoff"
                value={perf ? pct(perf.handoff_rate) : '—'}
                sub="transferências para humano"
                icon={UserCheck}
                iconBg="bg-amber-500"
              />
              <KpiCard
                label="1ª resposta (média)"
                value={perf ? fmtSeconds(perf.avg_first_response_seconds) : '—'}
                sub="tempo até 1ª resposta"
                icon={Clock}
                iconBg="bg-blue-500"
              />
              <KpiCard
                label="Resolução (média)"
                value={perf ? fmtSeconds(perf.avg_resolution_seconds) : '—'}
                sub="tempo total de resolução"
                icon={CheckCircle2}
                iconBg="bg-green-500"
              />
            </div>
          </div>

          {/* Operational KPIs */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Volume operacional</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                label="Mensagens (total)"
                value={summary?.messages.total ?? '—'}
                sub={`${summary?.messages.today ?? 0} hoje`}
                icon={MessageSquare}
                iconBg="bg-brand-500"
              />
              <KpiCard
                label="Conversas resolvidas"
                value={summary?.conversations.resolved ?? '—'}
                sub={`${summary?.conversations.resolved_today ?? 0} hoje`}
                icon={CheckCircle2}
                iconBg="bg-green-500"
              />
              <KpiCard
                label="Agendamentos"
                value={summary?.appointments.total ?? '—'}
                sub={`${summary?.appointments.today ?? 0} hoje`}
                icon={CalendarCheck}
                iconBg="bg-indigo-500"
              />
              <KpiCard
                label="Clientes ativos"
                value={summary?.customers.active ?? '—'}
                sub={`${summary?.customers.new_week ?? 0} novos esta semana`}
                icon={TrendingUp}
                iconBg="bg-teal-500"
              />
            </div>
          </div>

          {/* Conversation trend */}
          <Card>
            <p className="text-sm font-semibold text-gray-900 mb-4">
              Tendência de conversas — últimos {period} dias
            </p>
            {convData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">Sem dados de tendência</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={convData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gConv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}    />
                    </linearGradient>
                    <linearGradient id="gResolved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}    />
                    </linearGradient>
                    <linearGradient id="gHandoff" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="conversations" name="Conversas"    stroke="#6366f1" fill="url(#gConv)"     strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="resolved"      name="Resolvidas"   stroke="#22c55e" fill="url(#gResolved)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="handoffs"      name="Handoffs"     stroke="#f59e0b" fill="url(#gHandoff)"  strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Appointments trend */}
          <Card>
            <p className="text-sm font-semibold text-gray-900 mb-4">
              Agendamentos — últimos {period} dias
            </p>
            {apptData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">Sem dados de agendamentos</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={apptData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="total"     name="Total"      fill="#6366f1" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="completed" name="Realizados" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="cancelled" name="Cancelados" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Bot vs Human breakdown */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <p className="text-sm font-semibold text-gray-900 mb-4">Eficiência da IA</p>
                <div className="space-y-3">
                  {[
                    { label: 'Resolvidas pelo bot', value: perf?.bot_resolution_rate ?? 0, color: 'bg-purple-500' },
                    { label: 'Transferidas para humano', value: perf?.handoff_rate ?? 0, color: 'bg-amber-400' },
                    { label: 'Pendentes / outras', value: Math.max(0, 1 - (perf?.bot_resolution_rate ?? 0) - (perf?.handoff_rate ?? 0)), color: 'bg-gray-200' },
                  ].map(r => (
                    <div key={r.label}>
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>{r.label}</span>
                        <span className="font-medium">{pct(r.value)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className={`${r.color} h-2 rounded-full`} style={{ width: pct(r.value) }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <p className="text-sm font-semibold text-gray-900 mb-4">Status de conversas</p>
                <div className="space-y-3">
                  {[
                    { label: 'Bot ativo',       value: summary.conversations.bot_active,    color: 'bg-purple-400', total: summary.conversations.total },
                    { label: 'Aguarda humano',  value: summary.conversations.waiting_human, color: 'bg-red-400',    total: summary.conversations.total },
                    { label: 'Abertas',          value: summary.conversations.open,          color: 'bg-blue-400',   total: summary.conversations.total },
                    { label: 'Resolvidas',       value: summary.conversations.resolved,      color: 'bg-green-400',  total: summary.conversations.total },
                  ].map(r => (
                    <div key={r.label}>
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>{r.label}</span>
                        <span className="font-medium">{r.value}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={`${r.color} h-2 rounded-full`}
                          style={{ width: r.total > 0 ? `${Math.min(100, (r.value / r.total) * 100).toFixed(1)}%` : '0%' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}
