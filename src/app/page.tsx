'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { getDashboardSummary, listConversations, listAppointments, getConversationsTrend, getAppointmentsTrend } from '@/lib/api'
import type { DashboardSummary, Conversation, Appointment, DailyMetric, DailyAppointmentMetric } from '@/types'
import { fmtSeconds, fmtDateTime, statusVariants, timeAgo } from '@/lib/utils'
import {
  MessageSquare, Clock, CheckCircle2, Users, CalendarCheck,
  TrendingUp, TrendingDown, Minus, AlertTriangle, Bot,
  Activity, Zap, Target, BarChart2,
} from 'lucide-react'

// recharts must be dynamically imported (no SSR)
const AreaChart      = dynamic(() => import('recharts').then(m => m.AreaChart),      { ssr: false })
const Area           = dynamic(() => import('recharts').then(m => m.Area),           { ssr: false })
const BarChart       = dynamic(() => import('recharts').then(m => m.BarChart),       { ssr: false })
const Bar            = dynamic(() => import('recharts').then(m => m.Bar),            { ssr: false })
const PieChart       = dynamic(() => import('recharts').then(m => m.PieChart),       { ssr: false })
const Pie            = dynamic(() => import('recharts').then(m => m.Pie),            { ssr: false })
const Cell           = dynamic(() => import('recharts').then(m => m.Cell),           { ssr: false })
const XAxis          = dynamic(() => import('recharts').then(m => m.XAxis),          { ssr: false })
const YAxis          = dynamic(() => import('recharts').then(m => m.YAxis),          { ssr: false })
const CartesianGrid  = dynamic(() => import('recharts').then(m => m.CartesianGrid),  { ssr: false })
const Tooltip        = dynamic(() => import('recharts').then(m => m.Tooltip),        { ssr: false })
const Legend         = dynamic(() => import('recharts').then(m => m.Legend),         { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false })

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDay(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function TrendIcon({ value }: { value: number }) {
  if (value > 0) return <TrendingUp className="h-3.5 w-3.5 text-green-500" />
  if (value < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-500" />
  return <Minus className="h-3.5 w-3.5 text-gray-400" />
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, color, trend, alert,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  trend?: number
  alert?: boolean
}) {
  return (
    <Card className={alert ? 'border-red-200 bg-red-50/40' : ''}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 mb-1 truncate">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {sub && (
            <div className="flex items-center gap-1 mt-1">
              {trend !== undefined && <TrendIcon value={trend} />}
              <p className={`text-xs ${alert ? 'text-red-600 font-medium' : 'text-gray-400'}`}>{sub}</p>
            </div>
          )}
        </div>
        <div className={`p-2.5 rounded-xl ${color} shrink-0`}>
          <Icon className="h-4.5 w-4.5 text-white h-5 w-5" />
        </div>
      </div>
    </Card>
  )
}

// ─── Conversation row ────────────────────────────────────────────────────────

const statusLabel: Record<string, string> = {
  open: 'Aberta', pending: 'Pendente', resolved: 'Resolvida',
  bot_active: 'Bot', waiting_human: 'Aguarda humano',
}

function ConvRow({ c }: { c: Conversation }) {
  const msg = c.last_message_text ?? c.last_message ?? '—'
  return (
    <Link href={`/atendimento/${c.id}`} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 -mx-6 px-6 transition-colors">
      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
        <span className="text-xs font-semibold text-brand-700">
          {(c.customer_name ?? '?').charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{c.customer_name ?? c.customer_phone}</p>
        <p className="text-xs text-gray-400 truncate">{msg}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${statusVariants[c.status] ?? 'bg-gray-100 text-gray-700'}`}>
          {statusLabel[c.status] ?? c.status}
        </span>
        <span className="text-xs text-gray-400">{timeAgo(c.updated_at)}</span>
      </div>
    </Link>
  )
}

// ─── Appointment row ─────────────────────────────────────────────────────────

const aptStatusStyle: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  pending:   'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-brand-100 text-brand-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show:   'bg-gray-100 text-gray-600',
}
const aptStatusLabel: Record<string, string> = {
  confirmed: 'Confirmado', completed: 'Realizado', pending: 'Pendente',
  scheduled: 'Agendado', cancelled: 'Cancelado', no_show: 'Não compareceu',
}

function AptRow({ a }: { a: Appointment }) {
  const dateStr = a.scheduled_start_at ?? a.scheduled_at
  return (
    <Link href="/agenda" className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 -mx-6 px-6 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{a.customer_name}</p>
        <p className="text-xs text-gray-400 truncate">
          {a.service_name} · {a.professional_name}
          {dateStr ? ` · ${fmtDateTime(dateStr)}` : ''}
        </p>
      </div>
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${aptStatusStyle[a.status] ?? 'bg-gray-100 text-gray-600'}`}>
        {aptStatusLabel[a.status] ?? a.status}
      </span>
    </Link>
  )
}

// ─── Donut stat ──────────────────────────────────────────────────────────────

function DonutStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-xs text-gray-600 flex-1">{label}</span>
      <span className="text-xs font-semibold text-gray-900">{value}</span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [7, 14, 30] as const

export default function VisaoGeralPage() {
  const [summary, setSummary]   = useState<DashboardSummary | null>(null)
  const [convs, setConvs]       = useState<Conversation[]>([])
  const [apts, setApts]         = useState<Appointment[]>([])
  const [trend, setTrend]       = useState<DailyMetric[]>([])
  const [aptTrend, setAptTrend] = useState<DailyAppointmentMetric[]>([])
  const [period, setPeriod]     = useState<7 | 14 | 30>(30)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getDashboardSummary().catch(() => null),
      listConversations().catch(() => [] as Conversation[]),
      listAppointments().catch(() => [] as Appointment[]),
      getConversationsTrend(period).catch(() => [] as DailyMetric[]),
      getAppointmentsTrend(period).catch(() => [] as DailyAppointmentMetric[]),
    ])
      .then(([s, c, a, t, at]) => {
        if (s) setSummary(s)
        setConvs(c); setApts(a); setTrend(t); setAptTrend(at)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [period])

  if (loading)
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )

  const s = summary
  const wh = s?.conversations?.waiting_human ?? 0
  const botRate = s?.performance?.bot_resolution_rate ?? 0
  const handoffRate = s?.performance?.handoff_rate ?? 0

  // Pie data for conversation distribution
  const convPie = [
    { name: 'Bot ativo',         value: s?.conversations?.bot_active    ?? 0, color: '#7c3aed' },
    { name: 'Abertas',           value: s?.conversations?.open          ?? 0, color: '#0284c7' },
    { name: 'Aguardando humano', value: s?.conversations?.waiting_human ?? 0, color: '#ea580c' },
    { name: 'Pendentes',         value: s?.conversations?.pending       ?? 0, color: '#d97706' },
    { name: 'Resolvidas',        value: s?.conversations?.resolved      ?? 0, color: '#16a34a' },
  ].filter(d => d.value > 0)

  // Pie for bot efficiency
  const effPie = [
    { name: 'Bot resolveu', value: Math.round(botRate * 100),    color: '#16a34a' },
    { name: 'Handoff',      value: Math.round(handoffRate * 100), color: '#ea580c' },
    { name: 'Em andamento', value: Math.max(0, 100 - Math.round(botRate * 100) - Math.round(handoffRate * 100)), color: '#e5e7eb' },
  ].filter(d => d.value > 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Visão Geral</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Atualizado agora · {s?.generated_at ? fmtDateTime(s.generated_at) : '—'}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {PERIOD_OPTIONS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                period === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {/* Alert */}
      {wh > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl">
          <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0" />
          <p className="flex-1 text-sm font-medium text-orange-800">
            {wh} conversa{wh > 1 ? 's' : ''} aguardando atendimento humano
          </p>
          <Link href="/atendimento?status=waiting_human"
            className="text-xs bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 transition-colors">
            Ver fila
          </Link>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard
          label="Clientes ativos"
          value={s?.customers?.total ?? 0}
          sub={`+${s?.customers?.new_week ?? 0} esta semana`}
          icon={Users}
          color="bg-brand-600"
          trend={s?.customers?.new_week ?? 0}
        />
        <KpiCard
          label="Conversas abertas"
          value={s?.conversations?.open ?? 0}
          sub={`${s?.conversations?.total ?? 0} total`}
          icon={MessageSquare}
          color="bg-blue-500"
        />
        <KpiCard
          label="Aguardando humano"
          value={wh}
          sub={wh > 0 ? 'requer atenção' : 'nenhuma'}
          icon={Clock}
          color={wh > 0 ? 'bg-orange-500' : 'bg-green-500'}
          alert={wh > 0}
        />
        <KpiCard
          label="Resolvidas hoje"
          value={s?.conversations?.resolved_today ?? 0}
          sub={`tempo médio: ${fmtSeconds(s?.performance?.avg_resolution_seconds ?? 0)}`}
          icon={CheckCircle2}
          color="bg-green-500"
        />
        <KpiCard
          label="Agendamentos hoje"
          value={s?.appointments?.today ?? 0}
          sub={`${s?.appointments?.confirmed ?? 0} confirmados`}
          icon={CalendarCheck}
          color="bg-purple-500"
        />
        <KpiCard
          label="Taxa de resolução IA"
          value={`${Math.round(botRate * 100)}%`}
          sub={`handoff: ${Math.round(handoffRate * 100)}%`}
          icon={Bot}
          color="bg-indigo-500"
          trend={botRate > 0.6 ? 1 : botRate < 0.4 ? -1 : 0}
        />
      </div>

      {/* Charts row 1: Trend + Appointment bars */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Conversation trend — 3/5 */}
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Conversas — últimos {period} dias</CardTitle>
            <span className="text-xs text-gray-400">{trend.length} dias</span>
          </CardHeader>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gConvs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#0284c7" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="gResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="gHandoff" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ea580c" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#ea580c" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(v: number, name: string) => [v, name]}
                  labelFormatter={(l: string) => fmtDay(l)}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Area type="monotone" dataKey="conversations" name="Conversas"   stroke="#0284c7" fill="url(#gConvs)"    strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="resolved"      name="Resolvidas"  stroke="#16a34a" fill="url(#gResolved)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="handoffs"      name="Handoffs"    stroke="#ea580c" fill="url(#gHandoff)"  strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Appointment bars — 2/5 */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Agendamentos por dia</CardTitle>
          </CardHeader>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aptTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  labelFormatter={(l: string) => fmtDay(l)}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="confirmed"  name="Confirmados" stackId="a" fill="#16a34a" radius={[0,0,0,0]} />
                <Bar dataKey="completed"  name="Realizados"  stackId="a" fill="#0284c7" />
                <Bar dataKey="cancelled"  name="Cancelados"  stackId="a" fill="#fca5a5" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Charts row 2: Distribution pies + performance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Conv status donut */}
        <Card>
          <CardHeader><CardTitle>Status das conversas</CardTitle></CardHeader>
          <div className="flex items-center gap-4">
            <div className="h-36 w-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={convPie} dataKey="value" cx="50%" cy="50%" innerRadius={36} outerRadius={58} paddingAngle={2} strokeWidth={0}>
                    {convPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {convPie.map(d => <DonutStat key={d.name} label={d.name} value={d.value} color={d.color} />)}
            </div>
          </div>
        </Card>

        {/* Bot efficiency donut */}
        <Card>
          <CardHeader><CardTitle>Eficiência da IA</CardTitle></CardHeader>
          <div className="flex items-center gap-4">
            <div className="h-36 w-36 shrink-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={effPie} dataKey="value" cx="50%" cy="50%" innerRadius={36} outerRadius={58} paddingAngle={2} strokeWidth={0}>
                    {effPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-gray-900">{Math.round(botRate * 100)}%</span>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-xs text-gray-500">Bot resolveu</p>
                <p className="text-lg font-bold text-green-600">{Math.round(botRate * 100)}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Precisou de humano</p>
                <p className="text-lg font-bold text-orange-600">{Math.round(handoffRate * 100)}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Resp. média</p>
                <p className="text-sm font-semibold text-gray-700">
                  {fmtSeconds(s?.performance?.avg_first_response_seconds ?? 0)}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Performance stats */}
        <Card>
          <CardHeader><CardTitle>Métricas operacionais</CardTitle></CardHeader>
          <div className="space-y-3">
            {[
              { label: 'Mensagens hoje',     value: String(s?.messages?.today ?? 0),         icon: MessageSquare, color: 'text-blue-500' },
              { label: 'Inbound / Outbound', value: `${s?.messages?.inbound ?? 0} / ${s?.messages?.outbound ?? 0}`, icon: Activity,       color: 'text-purple-500' },
              { label: 'Jobs na fila',       value: String(s?.jobs?.pending ?? 0),            icon: Zap,           color: s?.jobs?.pending ? 'text-yellow-500' : 'text-green-500' },
              { label: 'Jobs falharam',      value: String(s?.jobs?.failed ?? 0),             icon: Target,        color: s?.jobs?.failed ? 'text-red-500' : 'text-green-500' },
              { label: 'Lembretes enviados', value: String(s?.reminders?.dispatches_sent ?? 0), icon: CheckCircle2, color: 'text-green-500' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex items-center gap-3">
                <Icon className={`h-4 w-4 ${color} shrink-0`} />
                <span className="text-xs text-gray-600 flex-1">{label}</span>
                <span className="text-sm font-semibold text-gray-900">{value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Conversas recentes</CardTitle>
            <Link href="/atendimento" className="text-xs text-brand-600 hover:underline">Ver todas</Link>
          </CardHeader>
          {convs.length === 0
            ? <p className="text-sm text-gray-400 text-center py-6">Nenhuma conversa</p>
            : convs.slice(0, 6).map(c => <ConvRow key={c.id} c={c} />)
          }
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agendamentos recentes</CardTitle>
            <Link href="/agenda" className="text-xs text-brand-600 hover:underline">Agenda completa</Link>
          </CardHeader>
          {apts.length === 0
            ? <p className="text-sm text-gray-400 text-center py-6">Nenhum agendamento</p>
            : apts.slice(0, 6).map(a => <AptRow key={a.id} a={a} />)
          }
        </Card>
      </div>
    </div>
  )
}
