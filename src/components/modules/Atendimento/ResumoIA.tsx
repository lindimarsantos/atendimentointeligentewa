'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { getConversationSummary } from '@/lib/api'
import type { ConversationSummary } from '@/types'
import { fmtDateTime } from '@/lib/utils'
import { Sparkles, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'

export function ResumoIA({ conversationId }: { conversationId: string }) {
  const [summary, setSummary] = useState<ConversationSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    getConversationSummary(conversationId)
      .then(setSummary)
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
          <Sparkles className="h-4 w-4 text-purple-500" />
          Resumo da IA
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <>
          {loading ? (
            <div className="h-20 flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500" />
            </div>
          ) : !summary ? (
            <p className="text-xs text-gray-400 text-center py-4">
              Sem resumo disponível
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-700 leading-relaxed">{summary.summary_text}</p>

              {summary.facts_jsonb && Object.keys(summary.facts_jsonb).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Fatos identificados
                  </p>
                  <ul className="space-y-1">
                    {Object.entries(summary.facts_jsonb).map(([k, v]) => (
                      <li key={k} className="flex items-start gap-2 text-xs">
                        <span className="text-gray-400 font-medium shrink-0">{k}:</span>
                        <span className="text-gray-700">{String(v)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {Array.isArray(summary.open_items_jsonb) && summary.open_items_jsonb.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Itens em aberto
                  </p>
                  <ul className="space-y-1">
                    {summary.open_items_jsonb.map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                        <span className="text-yellow-500 mt-0.5">•</span>
                        {String(item)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs text-gray-400">{fmtDateTime(summary.created_at)}</p>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
