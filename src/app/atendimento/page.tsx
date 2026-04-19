'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { listConversations, listHandoffQueue, updateHandoffStatus } from '@/lib/api'
import type { Conversation, HandoffEntry } from '@/types'
import { timeAgo, statusVariants } from '@/lib/utils'
import { MessageSquare, ChevronRight, UserCheck, XCircle, CheckCircle2, HandMetal } from 'lucide-react'
import { Tabs } from '@/components/ui/Tabs'
import { toast } from '@/components/ui/Toast'

// ─── Constants ────────────────────────────────────────────────────────────────

const statusLabel: Record<string, string> = {
  open:          'Aberta',
  pending:       'Pendente',
  resolved:      'Resolvida',
  bot_active:    'Bot ativo',
  waiting_human: 'Aguarda humano',
}

const handoffStatusVariant: Record<string, 'warning' | 'info' | 'success' | 'error' | 'default'> = {
  pending:  'warning',
  accepted: 'info',
  resolved: 'success',
  rejected: 'error',
}

const handoffStatusLabel: Record<string, string> = {
  pending:  'Aguardando',
  accepted: 'Em atendimento',
  resolved: 'Resolvido',
  rejected: 'Devolvido ao bot',
}

const mainTabs = [
  { id: '',              label: 'Todas'          },
  { id: 'bot_active',    label: 'Bot ativo'      },
  { id: 'waiting_human', label: 'Aguarda humano' },
  { id: 'open',          label: 'Abertas'        },
  { id: 'resolved',      label: 'Resolvidas'     },
  { id: 'handoff',       label: 'Fila de Handoff'},
]

// ─── Handoff Queue ────────────────────────────────────────────────────────────

function HandoffQueue() {
  const [entries, setEntries] = useState<HandoffEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    listHandoffQueue()
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const act = async (entry: HandoffEntry, status: 'accepted' | 'resolved' | 'rejected') => {
    setBusy(entry.id)
    try {
      await updateHandoffStatus(entry.id, status)
      const labels: Record<string, string> = { accepted: 'Atendimento aceito', resolved: 'Atendimento resolvido', rejected: 'Devolvido ao bot' }
      toast(labels[status])
      load()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao atualizar', 'error')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
        </div>
      </Card>
    )
  }

  if (entries.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <HandMetal className="h-10 w-10 mb-3" />
          <p className="text-sm font-medium">Nenhum handoff aguardando aceite</p>
          <p className="text-xs mt-1">Nenhuma conversa aguarda transferência para humano no momento.</p>
        </div>
      </Card>
    )
  }

  const pending  = entries.filter((e) => e.status === 'pending')
  const accepted = entries.filter((e) => e.status === 'accepted')

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Aguardando atendimento ({pending.length})
          </h3>
          <Card padding={false}>
            <ul className="divide-y divide-gray-100">
              {pending.map((e) => (
                <HandoffCard key={e.id} entry={e} busy={busy === e.id} onAct={act} />
              ))}
            </ul>
          </Card>
        </div>
      )}
      {accepted.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Em atendimento humano ({accepted.length})
          </h3>
          <Card padding={false}>
            <ul className="divide-y divide-gray-100">
              {accepted.map((e) => (
                <HandoffCard key={e.id} entry={e} busy={busy === e.id} onAct={act} />
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  )
}

function HandoffCard({
  entry, busy, onAct,
}: {
  entry: HandoffEntry
  busy: boolean
  onAct: (entry: HandoffEntry, status: 'accepted' | 'resolved' | 'rejected') => void
}) {
  const waitMin = Math.floor((Date.now() - new Date(entry.created_at).getTime()) / 60000)

  return (
    <li className="px-5 py-4">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-sm font-bold text-amber-700">
            {(entry.customer_name ?? '?').charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {entry.customer_name ?? entry.customer_phone ?? 'Desconhecido'}
            </p>
            <Badge variant={handoffStatusVariant[entry.status] ?? 'default'}>
              {handoffStatusLabel[entry.status] ?? entry.status}
            </Badge>
            {entry.target_role && (
              <span className="text-xs text-gray-400 font-mono">{entry.target_role}</span>
            )}
          </div>

          {entry.reason_text && (
            <p className="text-xs text-gray-600 mb-1">
              <span className="font-medium">Motivo:</span> {entry.reason_text}
            </p>
          )}

          {entry.last_message && (
            <p className="text-xs text-gray-400 italic truncate mb-1.5">
              &ldquo;{entry.last_message}&rdquo;
            </p>
          )}

          <p className="text-xs text-gray-400">
            Aguardando há {waitMin < 1 ? 'menos de 1 min' : `${waitMin} min`}
            {entry.customer_phone && ` · ${entry.customer_phone}`}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-2.5">
            <Link
              href={`/atendimento/${entry.conversation_id}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors"
            >
              <MessageSquare className="h-3 w-3" /> Ver conversa
            </Link>
            {entry.status === 'pending' && (
              <Button
                size="sm"
                variant="secondary"
                loading={busy}
                onClick={() => onAct(entry, 'accepted')}
              >
                <UserCheck className="h-3 w-3" /> Aceitar
              </Button>
            )}
            {entry.status === 'accepted' && (
              <Button
                size="sm"
                variant="secondary"
                loading={busy}
                onClick={() => onAct(entry, 'resolved')}
              >
                <CheckCircle2 className="h-3 w-3" /> Resolver
              </Button>
            )}
            {(entry.status === 'pending' || entry.status === 'accepted') && (
              <button
                onClick={() => onAct(entry, 'rejected')}
                disabled={busy}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
              >
                <XCircle className="h-3 w-3" /> Devolver ao bot
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AtendimentoPage() {
  const [status, setStatus] = useState('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'handoff') return
    setLoading(true)
    listConversations(status || undefined)
      .then(setConversations)
      .catch(() => setConversations([]))
      .finally(() => setLoading(false))
  }, [status])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Atendimento</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {status === 'handoff' ? 'Handoffs aguardando ação humana' : `${conversations.length} conversas`}
          </p>
        </div>
      </div>

      <Tabs tabs={mainTabs} active={status} onChange={setStatus} />

      {status === 'handoff' ? (
        <HandoffQueue />
      ) : (
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
                          {c.customer_name ?? 'Desconhecido'}
                          {c.customer_phone && (
                            <span className="ml-1.5 text-xs font-normal text-gray-400">
                              {c.customer_phone}
                            </span>
                          )}
                        </p>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusVariants[c.status] ?? 'bg-gray-100 text-gray-700'}`}
                        >
                          {statusLabel[c.status] ?? c.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {c.last_message_text ?? c.last_message ?? 'Sem mensagens'}
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
      )}
    </div>
  )
}
