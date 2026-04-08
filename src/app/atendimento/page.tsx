'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { listConversations } from '@/lib/api'
import type { Conversation } from '@/types'
import { timeAgo, statusVariants } from '@/lib/utils'
import { MessageSquare, ChevronRight, AlertCircle } from 'lucide-react'
import { Tabs } from '@/components/ui/Tabs'

const statusLabel: Record<string, string> = {
  open:          'Aberta',
  pending:       'Pendente',
  resolved:      'Resolvida',
  bot_active:    'Bot ativo',
  waiting_human: 'Aguarda humano',
}

const tabs = [
  { id: '',             label: 'Todas'          },
  { id: 'bot_active',   label: 'Bot ativo'      },
  { id: 'waiting_human',label: 'Aguarda humano' },
  { id: 'open',         label: 'Abertas'        },
  { id: 'resolved',     label: 'Resolvidas'     },
]

export default function AtendimentoPage() {
  const [status, setStatus] = useState('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    listConversations(status || undefined)
      .then(setConversations)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [status])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Atendimento</h1>
          <p className="text-sm text-gray-500 mt-0.5">{conversations.length} conversas</p>
        </div>
      </div>

      <Tabs tabs={tabs} active={status} onChange={setStatus} />

      {error && (
        <div className="flex items-center gap-2 text-red-600 p-3 bg-red-50 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <Card padding={false}>
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <MessageSquare className="h-8 w-8 mb-2" />
            <p className="text-sm">Nenhuma conversa</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/atendimento/${c.id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-brand-700">
                      {(c.customer_name ?? '?').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {c.customer_name ?? c.customer_phone ?? 'Desconhecido'}
                      </p>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusVariants[c.status] ?? 'bg-gray-100 text-gray-700'}`}
                      >
                        {statusLabel[c.status] ?? c.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {c.last_message ?? 'Sem mensagens'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400">{timeAgo(c.updated_at)}</span>
                    <ChevronRight className="h-4 w-4 text-gray-300" />
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
