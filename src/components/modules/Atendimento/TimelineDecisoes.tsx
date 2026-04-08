'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { getAiDecisions } from '@/lib/api'
import type { AiDecision } from '@/types'
import { fmtDateTime, decisionVariants } from '@/lib/utils'
import { GitBranch, ChevronDown, ChevronUp } from 'lucide-react'

const decisionLabel: Record<string, string> = {
  reply:               'Resposta',
  handoff:             'Handoff',
  schedule:            'Agendamento',
  recommend_service:   'Recomendação',
  request_more_data:   'Solicitar dados',
  block:               'Bloqueio',
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  )
}

export function TimelineDecisoes({ conversationId }: { conversationId: string }) {
  const [decisions, setDecisions] = useState<AiDecision[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    getAiDecisions(conversationId)
      .then(setDecisions)
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [conversationId])

  return (
    <Card>
      <button
        className="w-full flex items-center justify-between mb-3"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <GitBranch className="h-4 w-4 text-blue-500" />
          Decisões da IA
          {decisions.length > 0 && (
            <span className="ml-1 text-xs text-gray-400">({decisions.length})</span>
          )}
        </span>
        {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>

      {expanded && (
        <>
          {loading ? (
            <div className="h-16 flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
            </div>
          ) : decisions.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Sem decisões registradas</p>
          ) : (
            <ol className="relative border-l border-gray-100 ml-2 space-y-3">
              {decisions.map((d) => {
                const isOpen = openId === d.id
                return (
                  <li key={d.id} className="ml-4">
                    <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-gray-200 border-2 border-white" />
                    <div
                      className="cursor-pointer"
                      onClick={() => setOpenId(isOpen ? null : d.id)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${decisionVariants[d.decision_type] ?? 'bg-gray-100 text-gray-700'}`}
                        >
                          {decisionLabel[d.decision_type] ?? d.decision_type}
                        </span>
                        <span className="text-xs text-gray-400">{fmtDateTime(d.created_at)}</span>
                      </div>
                      <ConfidenceBar value={d.confidence_score} />
                      {d.decision_reason && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{d.decision_reason}</p>
                      )}
                    </div>

                    {isOpen && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs space-y-2">
                        {d.decision_reason && (
                          <div>
                            <p className="font-semibold text-gray-500 mb-1">Razão</p>
                            <p className="text-gray-700">{d.decision_reason}</p>
                          </div>
                        )}
                        {d.approved_by_rule && (
                          <div>
                            <p className="font-semibold text-gray-500 mb-1">Regra aplicada</p>
                            <p className="text-gray-700 font-mono">{d.approved_by_rule}</p>
                          </div>
                        )}
                        {d.output_payload_jsonb && (
                          <div>
                            <p className="font-semibold text-gray-500 mb-1">Output</p>
                            <pre className="text-gray-600 overflow-auto max-h-32 font-mono whitespace-pre-wrap">
                              {JSON.stringify(d.output_payload_jsonb, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </>
      )}
    </Card>
  )
}
