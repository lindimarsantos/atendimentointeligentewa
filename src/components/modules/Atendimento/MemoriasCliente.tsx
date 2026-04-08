'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { getCustomerMemories } from '@/lib/api'
import type { CustomerMemory } from '@/types'
import { memoryTypeVariants } from '@/lib/utils'
import { Brain, ChevronDown, ChevronUp } from 'lucide-react'

const memoryTypeLabel: Record<string, string> = {
  profile:             'Perfil',
  preference:          'Preferência',
  objection:           'Objeção',
  clinical_interest:   'Interesse clínico',
  schedule_preference: 'Pref. horário',
  relationship:        'Relacionamento',
}

export function MemoriasCliente({ customerId }: { customerId: string }) {
  const [memories, setMemories] = useState<CustomerMemory[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    if (!customerId) return
    getCustomerMemories(customerId)
      .then((m) => setMemories(m.filter((x) => x.is_active)))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [customerId])

  return (
    <Card>
      <button
        className="w-full flex items-center justify-between mb-3"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Brain className="h-4 w-4 text-pink-500" />
          Memórias do cliente
          {memories.length > 0 && (
            <span className="ml-1 text-xs text-gray-400">({memories.length})</span>
          )}
        </span>
        {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>

      {expanded && (
        <>
          {loading ? (
            <div className="h-16 flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-pink-500" />
            </div>
          ) : memories.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Sem memórias ativas</p>
          ) : (
            <ul className="space-y-2">
              {[...memories]
                .sort((a, b) => b.importance_score - a.importance_score)
                .map((m) => (
                  <li key={m.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50">
                    <span
                      className={`inline-flex items-center shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${memoryTypeVariants[m.memory_type] ?? 'bg-gray-100 text-gray-700'}`}
                    >
                      {memoryTypeLabel[m.memory_type] ?? m.memory_type}
                    </span>
                    <p className="text-xs text-gray-700 flex-1">{m.content_text}</p>
                    <span
                      className="shrink-0 text-xs font-semibold"
                      style={{ color: `hsl(${m.importance_score * 120}, 55%, 45%)` }}
                    >
                      {Math.round(m.importance_score * 100)}%
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </>
      )}
    </Card>
  )
}
