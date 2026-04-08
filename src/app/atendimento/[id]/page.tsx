'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Input'
import { ResumoIA } from '@/components/modules/Atendimento/ResumoIA'
import { TimelineDecisoes } from '@/components/modules/Atendimento/TimelineDecisoes'
import { MemoriasCliente } from '@/components/modules/Atendimento/MemoriasCliente'
import {
  listConversations,
  getConversationMessages,
  getMessageIntents,
  assumirConversa,
  registrarNota,
  encerrarConversa,
} from '@/lib/api'
import type { Conversation, Message, MessageIntent } from '@/types'
import { fmtDateTime, statusVariants } from '@/lib/utils'
import { toast } from '@/components/ui/Toast'
import {
  ArrowLeft, UserCheck, StickyNote, CalendarPlus,
  CheckCircle2, Loader2, AlertCircle, Tag,
} from 'lucide-react'

const statusLabel: Record<string, string> = {
  open:          'Aberta',
  pending:       'Pendente',
  resolved:      'Resolvida',
  bot_active:    'Bot ativo',
  waiting_human: 'Aguarda humano',
}

function IntentBadge({ intent }: { intent: MessageIntent }) {
  const pct = Math.round(intent.confidence_score * 100)
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs">
      <Tag className="h-2.5 w-2.5" />
      {intent.intent_code} {pct}%
    </span>
  )
}

export default function ConversaDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [intents, setIntents] = useState<MessageIntent[]>([])
  const [loading, setLoading] = useState(true)

  // Modal states
  const [notaModal, setNotaModal] = useState(false)
  const [nota, setNota] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      listConversations().then((list) => list.find((c) => c.id === id) ?? null),
      getConversationMessages(id).catch(() => [] as Message[]),
      getMessageIntents(id).catch(() => [] as MessageIntent[]),
    ])
      .then(([conv, msgs, ints]) => {
        setConversation(conv)
        setMessages(msgs)
        setIntents(ints)
      })
      .finally(() => setLoading(false))
  }, [id])

  const intentsByMessage = (messageId: string) =>
    intents.filter((i) => i.message_id === messageId)

  const handleAssumir = async () => {
    setSaving(true)
    try {
      await assumirConversa(id, 'dashboard-agent')
      toast('Conversa assumida com sucesso')
      setConversation((c) => c ? { ...c, status: 'open' } : c)
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao assumir', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleNota = async () => {
    if (!nota.trim()) return
    setSaving(true)
    try {
      await registrarNota(id, nota)
      toast('Nota registrada')
      setNotaModal(false)
      setNota('')
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar nota', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleEncerrar = async () => {
    if (!confirm('Encerrar esta conversa?')) return
    setSaving(true)
    try {
      await encerrarConversa(id)
      toast('Conversa encerrada')
      setConversation((c) => c ? { ...c, status: 'resolved' } : c)
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao encerrar', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    )

  if (!conversation)
    return (
      <div className="flex items-center gap-2 text-red-600 p-4 bg-red-50 rounded-lg">
        <AlertCircle className="h-5 w-5" /> Conversa não encontrada
      </div>
    )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/atendimento" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {conversation.customer_name ?? conversation.customer_phone ?? 'Conversa'}
            </h1>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusVariants[conversation.status] ?? 'bg-gray-100 text-gray-700'}`}
            >
              {statusLabel[conversation.status] ?? conversation.status}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleAssumir} loading={saving}>
            <UserCheck className="h-3.5 w-3.5" /> Assumir
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setNotaModal(true)}>
            <StickyNote className="h-3.5 w-3.5" /> Nota
          </Button>
          <Button variant="danger" size="sm" onClick={handleEncerrar} loading={saving}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Encerrar
          </Button>
        </div>
      </div>

      {/* Content: messages + AI panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages */}
        <div className="lg:col-span-2">
          <Card padding={false}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">
                Mensagens ({messages.length})
              </h2>
            </div>
            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Sem mensagens</p>
              ) : (
                messages.map((msg) => {
                  const isInbound = msg.direction === 'inbound'
                  const msgIntents = intentsByMessage(msg.id)
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}
                    >
                      <div className={`max-w-[75%] space-y-1`}>
                        {msgIntents.length > 0 && isInbound && (
                          <div className="flex flex-wrap gap-1 px-1">
                            {msgIntents.map((intent) => (
                              <IntentBadge key={intent.id} intent={intent} />
                            ))}
                          </div>
                        )}
                        <div
                          className={`px-3.5 py-2.5 rounded-2xl text-sm ${
                            isInbound
                              ? 'bg-gray-100 text-gray-800 rounded-tl-sm'
                              : 'bg-brand-600 text-white rounded-tr-sm'
                          }`}
                        >
                          {msg.content_text ?? `[${msg.content_type}]`}
                        </div>
                        <p
                          className={`text-xs text-gray-400 px-1 ${isInbound ? 'text-left' : 'text-right'}`}
                        >
                          {fmtDateTime(msg.sent_at)} · {msg.sender_type}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </Card>
        </div>

        {/* AI Panels */}
        <div className="space-y-4">
          <ResumoIA conversationId={id} />
          <MemoriasCliente customerId={conversation.customer_id} />
          <TimelineDecisoes conversationId={id} />
        </div>
      </div>

      {/* Nota modal */}
      <Modal open={notaModal} onClose={() => setNotaModal(false)} title="Registrar nota">
        <div className="space-y-4">
          <Textarea
            label="Nota interna"
            rows={4}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Descreva observações sobre o atendimento..."
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setNotaModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleNota} loading={saving}>
              Salvar nota
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
