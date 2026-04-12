'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { getConversationSummary } from '@/lib/api'
import type { ConversationSummary } from '@/types'
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react'

const PREVIEW_LENGTH = 180

const factsLabel: Record<string, string> = {
  cliente:      'Cliente',
  mensagens:    'Mensagens',
  agendamento:  'Agendamento',
  profissional: 'Profissional',
  horário:      'Horário',
}

export function ResumoIA({ conversationId }: { conversationId: string }) {
  const [summary, setSummary]     = useState<ConversationSummary | null>(null)
  const [loading, setLoading]     = useState(true)
  const [expanded, setExpanded]   = useState(true)
  const [fullText, setFullText]   = useState(false)

  useEffect(() => {
    getConversationSummary(conversationId)
      .then(setSummary)
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [conversationId])

  const text     = summary?.summary_text ?? ''
  const isLong   = text.length > PREVIEW_LENGTH
  const displayed = fullText || !isLong ? text : text.slice(0, PREVIEW_LENGTH) + '…'

  return (
    <Card>
      <button
        className="w-full flex items-center justify-between mb-3"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Sparkles className="h-4 w-4 text-purple-500" />
          Resumo da IA
        </span>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-gray-400" />
          : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>

      {expanded && (
        <>
          {loading ? (
            <div className="h-20 flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500" />
            </div>
          ) : !summary ? (
            <p className="text-xs text-gray-400 text-center py-4">Sem resumo disponível</p>
          ) : (
            <div className="space-y-3">
              {/* Facts strip */}
              {summary.facts_jsonb && Object.keys(summary.facts_jsonb).length > 0 && (
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 p-2.5 bg-purple-50 rounded-lg">
                  {Object.entries(summary.facts_jsonb).map(([k, v]) => (
                    <div key={k} className="col-span-1 min-w-0">
                      <dt className="text-[10px] font-semibold text-purple-400 uppercase tracking-wide truncate">
                        {factsLabel[k] ?? k}
                      </dt>
                      <dd className="text-xs text-gray-800 truncate">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {/* Narrative text (truncated) */}
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {displayed}
              </p>

              {isLong && (
                <button
                  className="text-xs text-purple-600 hover:underline"
                  onClick={(e) => { e.stopPropagation(); setFullText((v) => !v) }}
                >
                  {fullText ? 'Ver menos' : 'Ver mais'}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  )
}
