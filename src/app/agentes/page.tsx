'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { getAiAgent, getAiAgentProfile, listConversations, getDashboardSummary } from '@/lib/api'
import type { AiAgent, AiAgentProfile, Conversation, DashboardSummary } from '@/types'
import { fmtDateTime, timeAgo, statusVariants } from '@/lib/utils'
import {
  Bot, Cpu, MessageSquare, Zap, Settings, AlertCircle,
  Activity, CheckCircle2, Clock, TrendingUp,
} from 'lucide-react'

const MODEL_LABELS: Record<string, string> = {
  'claude-sonnet-4-20250514': 'Claude Sonnet 4',
  'claude-opus-4-20250514':   'Claude Opus 4',
  'claude-haiku-4-5-20251001': 'Claude Haiku 4.5',
  'claude-sonnet-4-6':        'Claude Sonnet 4.6',
  'claude-opus-4-6':          'Claude Opus 4.6',
}

const STATUS_CONV: Record<string, string> = {
  bot_active:    'Bot ativo',
  open:          'Aberta',
  waiting_human: 'Aguarda humano',
  resolved:      'Resolvida',
  pending:       'Pendente',
}

export default function AgentesPage() {
  const [agent,    setAgent]    = useState<AiAgent | null>(null)
  const [profile,  setProfile]  = useState<AiAgentProfile | null>(null)
  const [botConvs, setBotConvs] = useState<Conversation[]>([])
  const [summary,  setSummary]  = useState<DashboardSummary | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  // Safe accessors — guards against sub-objects being null at runtime
  const convStats = summary?.conversations  ?? null
  const perfStats = summary?.performance    ?? null

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.allSettled([
      getAiAgent(),
      getAiAgentProfile(),
      listConversations('bot_active'),
      getDashboardSummary(),
    ]).then(([a, p, cv, s]) => {
      if (a.status  === 'fulfilled') setAgent(a.value)
      if (p.status  === 'fulfilled') setProfile(p.value)
      if (cv.status === 'fulfilled') setBotConvs(cv.value)
      if (s.status  === 'fulfilled') setSummary(s.value)
      if (a.status  === 'rejected')  setError('Erro ao carregar configuração do agente')
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const modelLabel = agent?.model_name
    ? (MODEL_LABELS[agent.model_name] ?? agent.model_name)
    : '—'

  const isOnline = !!agent

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Agentes de IA</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {botConvs.length} sessão{botConvs.length !== 1 ? 'ões' : ''} ativa{botConvs.length !== 1 ? 's' : ''} agora
          </p>
        </div>
        <Link href="/configuracoes">
          <Button variant="secondary" size="sm">
            <Settings className="h-3.5 w-3.5" /> Configurar
          </Button>
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 p-3 bg-red-50 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Agent card + stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Agent identity */}
        <Card className="lg:col-span-1">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center">
              <Bot className="h-6 w-6 text-brand-600" />
            </div>
            <Badge variant={isOnline ? 'success' : 'default'}>
              {isOnline ? 'Configurado' : 'Sem config'}
            </Badge>
          </div>

          <h2 className="text-base font-semibold text-gray-900 mb-0.5">
            {profile?.profile_name ?? agent?.name ?? 'Agente IA'}
          </h2>
          {profile?.objective && (
            <p className="text-xs text-gray-500 mb-4 line-clamp-2">{profile.objective}</p>
          )}

          <dl className="space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <dt className="flex items-center gap-1.5 text-gray-500">
                <Cpu className="h-3.5 w-3.5" /> Modelo
              </dt>
              <dd className="font-medium text-gray-900">{modelLabel}</dd>
            </div>
            {agent?.temperature != null && (
              <div className="flex items-center justify-between text-sm">
                <dt className="flex items-center gap-1.5 text-gray-500">
                  <Zap className="h-3.5 w-3.5" /> Temperatura
                </dt>
                <dd className="font-medium text-gray-900">{(agent.temperature as number).toFixed(2)}</dd>
              </div>
            )}
            {profile?.tone && (
              <div className="flex items-center justify-between text-sm">
                <dt className="text-gray-500">Tom</dt>
                <dd className="font-medium text-gray-900 capitalize">{profile.tone}</dd>
              </div>
            )}
            {profile?.verbosity && (
              <div className="flex items-center justify-between text-sm">
                <dt className="text-gray-500">Verbosidade</dt>
                <dd className="font-medium text-gray-900 capitalize">{profile.verbosity}</dd>
              </div>
            )}
          </dl>

          {/* Capabilities */}
          {profile && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-1.5">
              {profile.use_memory && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">Memória</span>
              )}
              {profile.use_recommendations && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">Recomendações</span>
              )}
              {profile.use_scheduling && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Agendamento</span>
              )}
              {profile.allow_voice_response && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700">Voz</span>
              )}
            </div>
          )}
        </Card>

        {/* KPIs */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <Card>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-blue-600" />
              </div>
              <span className="text-xs text-gray-500">Sessões ativas</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{botConvs.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">bot_active agora</p>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
              <span className="text-xs text-gray-500">Resolvidas</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {convStats?.resolved ?? '—'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">total do período</p>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-brand-600" />
              </div>
              <span className="text-xs text-gray-500">Taxa IA</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {perfStats?.bot_resolution_rate != null
                ? `${(perfStats.bot_resolution_rate * 100).toFixed(0)}%`
                : '—'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">resolução sem humano</p>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <span className="text-xs text-gray-500">Aguardando</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {convStats?.waiting_human ?? '—'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">handoff pendente</p>
          </Card>
        </div>
      </div>

      {/* System prompt preview */}
      {agent?.system_prompt && (
        <Card>
          <CardHeader>
            <CardTitle>System Prompt</CardTitle>
            <Link href="/configuracoes" className="text-xs text-brand-600 hover:underline">
              Editar
            </Link>
          </CardHeader>
          <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap line-clamp-6 font-mono">
            {agent.system_prompt}
          </pre>
        </Card>
      )}

      {/* Active bot sessions */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-semibold text-gray-900">Sessões em andamento</h3>
          </div>
          <span className="text-xs text-gray-400">{botConvs.length} ativas</span>
        </div>
        {botConvs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Bot className="h-8 w-8 mb-2" />
            <p className="text-sm">Nenhuma sessão ativa no momento</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {botConvs.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/atendimento/${c.id}`}
                  className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-brand-700">
                        {(c.customer_name ?? '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {c.customer_name ?? c.customer_phone ?? 'Desconhecido'}
                      </p>
                      {c.last_message_text && (
                        <p className="text-xs text-gray-500 truncate max-w-xs">
                          {c.last_message_text}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400">
                      {c.last_message_at ? timeAgo(c.last_message_at) : fmtDateTime(c.updated_at)}
                    </span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${statusVariants[c.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_CONV[c.status] ?? c.status}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
