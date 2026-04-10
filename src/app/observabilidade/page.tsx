'use client'

import { useEffect, useState } from 'react'
import { Tabs } from '@/components/ui/Tabs'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { listJobs, listPredictionScores, getRoiSummary } from '@/lib/api'
import type { JobEntry, PredictionScore, RoiSummary } from '@/types'
import { fmtDateTime } from '@/lib/utils'
import { Auditoria } from '@/components/modules/Observabilidade/Auditoria'
import { IntegrationLogs } from '@/components/modules/Observabilidade/IntegrationLogs'
import { Activity, Shield, Plug, Brain, TrendingUp } from 'lucide-react'

const jobStatusVariant: Record<string, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  pending: 'warning',
  running: 'info',
  done:    'success',
  failed:  'error',
}

function JobQueue() {
  const [jobs, setJobs] = useState<JobEntry[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    listJobs()
      .then(setJobs)
      .catch(() => setJobs([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <Card padding={false}>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
          </div>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">Fila vazia</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {jobs.map((job) => (
              <li key={job.id} className="flex items-center gap-4 px-6 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{job.job_type}</p>
                  {job.error && (
                    <p className="text-xs text-red-600 truncate">{job.error}</p>
                  )}
                  <p className="text-xs text-gray-400">{fmtDateTime(job.created_at)}</p>
                </div>
                <Badge variant={jobStatusVariant[job.status] ?? 'default'}>
                  {job.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

// ─── Prediction Scores tab ────────────────────────────────────────────────────

const SCORE_TYPE_LABEL: Record<string, string> = {
  churn_risk:         'Risco de churn',
  conversion:         'Conversão',
  no_show:            'No-show',
  upsell_probability: 'Potencial upsell',
  satisfaction:       'Satisfação',
}

function ScoresIA() {
  const [scores, setScores]   = useState<PredictionScore[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listPredictionScores({ limit: 100 })
      .then(setScores)
      .catch(() => setScores([]))
      .finally(() => setLoading(false))
  }, [])

  function scoreColor(v: number) {
    if (v >= 0.75) return 'text-red-600 bg-red-50'
    if (v >= 0.5)  return 'text-amber-600 bg-amber-50'
    return 'text-green-600 bg-green-50'
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">
        Scores gerados automaticamente pelos modelos de IA para cada cliente ou conversa.
      </p>
      <Card padding={false}>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
          </div>
        ) : scores.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Brain className="h-10 w-10 mb-3" />
            <p className="text-sm font-medium">Nenhum score gerado ainda</p>
            <p className="text-xs mt-1 text-center max-w-xs">
              Os scores serão gerados automaticamente conforme o agente IA processa conversas e interações.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {scores.map((s) => (
              <li key={s.id} className="flex items-center gap-4 px-6 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {s.entity_name ?? s.entity_id.slice(0, 8)}
                    <span className="ml-1.5 text-xs text-gray-400">{s.entity_type}</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    {SCORE_TYPE_LABEL[s.score_type] ?? s.score_type}
                    {s.model_name && <span className="ml-1.5 font-mono">{s.model_name}</span>}
                    {' · '}{fmtDateTime(s.created_at)}
                  </p>
                </div>
                <span className={`shrink-0 text-sm font-bold px-2.5 py-1 rounded-lg ${scoreColor(Number(s.score_value))}`}>
                  {(Number(s.score_value) * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

// ─── ROI tab ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
function fmtBRL(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtPct(n: number | null | undefined) {
  if (n == null) return '—'
  return `${(Number(n) * 100).toFixed(1)}%`
}

function RoiPanel() {
  const [roi, setRoi]         = useState<RoiSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getRoiSummary(6)
      .then(setRoi)
      .catch(() => setRoi(null))
      .finally(() => setLoading(false))
  }, [])

  const kpis = roi ? [
    { label: 'Receita total',        value: fmtBRL(roi.total_revenue)     },
    { label: 'Investimento (mídia)', value: fmtBRL(roi.total_media_spend) },
    { label: 'ROI',                  value: roi.roi_ratio > 0 ? `${fmt(roi.roi_ratio)}x` : '—' },
    { label: 'Leads',                value: fmt(roi.total_leads)           },
    { label: 'Agendamentos',         value: fmt(roi.total_appointments)    },
    { label: 'Taxa de comparecimento', value: fmtPct(roi.avg_show_rate)   },
    { label: 'Taxa de conversão',    value: fmtPct(roi.avg_conversion_rate)},
  ] : []

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">Resumo dos últimos 6 meses com base nos snapshots de ROI registrados.</p>
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
        </div>
      ) : !roi || (roi.total_leads === 0 && roi.total_revenue === 0) ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <TrendingUp className="h-10 w-10 mb-3" />
          <p className="text-sm font-medium">Sem dados de ROI ainda</p>
          <p className="text-xs mt-1 text-center max-w-xs">
            Os snapshots de ROI são gerados periodicamente com base em leads, agendamentos e receita registrados.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {kpis.map((k) => (
              <Card key={k.label}>
                <p className="text-xs text-gray-500 mb-1">{k.label}</p>
                <p className="text-lg font-bold text-gray-900">{k.value}</p>
              </Card>
            ))}
          </div>
          {roi.snapshots && roi.snapshots.length > 0 && (
            <Card padding={false}>
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-600">Histórico por período</p>
              </div>
              <ul className="divide-y divide-gray-100">
                {roi.snapshots.map((s) => (
                  <li key={s.period_start} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span className="text-gray-600">{s.period_start} → {s.period_end}</span>
                    <div className="flex items-center gap-4 text-right">
                      <span className="text-xs text-gray-400">{fmt(s.leads_count)} leads</span>
                      <span className="text-xs text-gray-400">{fmtPct(s.conversion_rate)} conv.</span>
                      <span className="font-medium text-gray-900">{fmtBRL(s.revenue_total)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const tabs = [
  { id: 'jobs',         label: 'Job Queue',   icon: Activity   },
  { id: 'scores',       label: 'Scores IA',   icon: Brain      },
  { id: 'roi',          label: 'ROI',         icon: TrendingUp },
  { id: 'auditoria',    label: 'Auditoria',   icon: Shield     },
  { id: 'integrations', label: 'Integrações', icon: Plug       },
]

export default function ObservabilidadePage() {
  const [tab, setTab] = useState('jobs')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Observabilidade</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Monitoramento de jobs, scores IA, ROI, auditoria e integrações
        </p>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <div className="mt-2">
        {tab === 'jobs'         && <JobQueue />}
        {tab === 'scores'       && <ScoresIA />}
        {tab === 'roi'          && <RoiPanel />}
        {tab === 'auditoria'    && <Auditoria />}
        {tab === 'integrations' && <IntegrationLogs />}
      </div>
    </div>
  )
}
