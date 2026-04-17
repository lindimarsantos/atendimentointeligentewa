'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Input'
import { ResumoIA } from '@/components/modules/Atendimento/ResumoIA'
import { TimelineDecisoes } from '@/components/modules/Atendimento/TimelineDecisoes'
import { MemoriasCliente } from '@/components/modules/Atendimento/MemoriasCliente'
import { MemoriaRecente } from '@/components/modules/Atendimento/MemoriaRecente'
import {
  listConversations,
  getConversationMessages,
  getMessageIntents,
  assumirConversa,
  registrarNota,
  encerrarConversa,
  agentSendMessage,
  devolverAoBot,
  reabrirConversa,
} from '@/lib/api'
import type { Conversation, Message, MessageIntent } from '@/types'
import { fmtDateTime, statusVariants } from '@/lib/utils'
import { toast } from '@/components/ui/Toast'
import {
  ArrowLeft, UserCheck, StickyNote,
  CheckCircle2, AlertCircle, Tag, XCircle, Send, Bot, RotateCcw,
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
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Individual loading states
  const [savingAssumir, setSavingAssumir] = useState(false)
  const [savingNota, setSavingNota] = useState(false)
  const [savingEncerrar, setSavingEncerrar] = useState(false)
  const [savingReply, setSavingReply] = useState(false)
  const [savingDevolver, setSavingDevolver] = useState(false)
  const [savingReabrir, setSavingReabrir] = useState(false)

  // Reply box
  const [reply, setReply] = useState('')

  // Modal states
  const [notaModal, setNotaModal] = useState(false)
  const [nota, setNota] = useState('')
  const [encerrarModal, setEncerrarModal] = useState(false)

  const loadMessages = () =>
    getConversationMessages(id)
      .then(setMessages)
      .catch(() => {})

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

  // Scroll to latest message whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [messages])

  const intentsByMessage = (messageId: string) =>
    intents.filter((i) => i.message_id === messageId)

  const handleAssumir = async () => {
    setSavingAssumir(true)
    try {
      await assumirConversa(id)
      setConversation((c) => c ? { ...c, status: 'open' } : c)
      toast('Conversa assumida — você é o responsável agora')
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao assumir', 'error')
    } finally {
      setSavingAssumir(false)
    }
  }

  const handleNota = async () => {
    if (!nota.trim()) return
    setSavingNota(true)
    try {
      await registrarNota(id, nota)
      setNotaModal(false)
      setNota('')
      await loadMessages()          // refresh to show the note in the chat
      toast('Nota registrada')
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar nota', 'error')
    } finally {
      setSavingNota(false)
    }
  }

  const handleEncerrar = async () => {
    setSavingEncerrar(true)
    try {
      await encerrarConversa(id)
      setConversation((c) => c ? { ...c, status: 'resolved' } : c)
      setEncerrarModal(false)
      toast('Conversa encerrada')
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao encerrar', 'error')
    } finally {
      setSavingEncerrar(false)
    }
  }

  const handleReply = async () => {
    if (!reply.trim()) return
    setSavingReply(true)
    try {
      const creds = await agentSendMessage(id, reply)
      setReply('')
      // Fire-and-forget Z-API call to actually send the WhatsApp message
      if (creds.zapi_instance_id && creds.zapi_token && creds.customer_phone) {
        const zapiUrl = `https://api.z-api.io/instances/${creds.zapi_instance_id}/token/${creds.zapi_token}/send-text`
        fetch(zapiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(creds.zapi_client_token ? { 'Client-Token': creds.zapi_client_token } : {}),
          },
          body: JSON.stringify({ phone: creds.customer_phone, message: reply }),
        }).catch(() => {})
      }
      await loadMessages()
      toast('Mensagem enviada')
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao enviar mensagem', 'error')
    } finally {
      setSavingReply(false)
    }
  }

  const handleDevolver = async () => {
    setSavingDevolver(true)
    try {
      await devolverAoBot(id)
      setConversation((c) => c ? { ...c, status: 'bot_active' } : c)
      toast('Conversa devolvida ao bot')
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao devolver', 'error')
    } finally {
      setSavingDevolver(false)
    }
  }

  const handleReabrir = async () => {
    setSavingReabrir(true)
    try {
      await reabrirConversa(id)
      setConversation((c) => c ? { ...c, status: 'bot_active' } : c)
      toast('Conversa reaberta — bot assumiu o controle')
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao reabrir', 'error')
    } finally {
      setSavingReabrir(false)
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

  const isResolved = conversation.status === 'resolved'

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
          {(conversation.status === 'bot_active' || conversation.status === 'waiting_human') && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAssumir}
              loading={savingAssumir}
            >
              <UserCheck className="h-3.5 w-3.5" /> Assumir
            </Button>
          )}
          {conversation.status === 'open' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDevolver}
              loading={savingDevolver}
            >
              <Bot className="h-3.5 w-3.5" /> Devolver ao bot
            </Button>
          )}
          {isResolved && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReabrir}
              loading={savingReabrir}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reabrir
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setNotaModal(true)}
          >
            <StickyNote className="h-3.5 w-3.5" /> Nota
          </Button>
          {!isResolved && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setEncerrarModal(true)}
              loading={savingEncerrar}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Encerrar
            </Button>
          )}
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
                  const isNota = msg.content_text?.startsWith('[Nota]')
                  const msgIntents = intentsByMessage(msg.id)
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}
                    >
                      <div className="max-w-[75%] space-y-1">
                        {msgIntents.length > 0 && isInbound && (
                          <div className="flex flex-wrap gap-1 px-1">
                            {msgIntents.map((intent) => (
                              <IntentBadge key={intent.id} intent={intent} />
                            ))}
                          </div>
                        )}
                        <div
                          className={`px-3.5 py-2.5 rounded-2xl text-sm ${
                            isNota
                              ? 'bg-amber-50 text-amber-800 border border-amber-200 rounded-tr-sm'
                              : isInbound
                                ? 'bg-gray-100 text-gray-800 rounded-tl-sm'
                                : 'bg-brand-600 text-white rounded-tr-sm'
                          }`}
                        >
                          {isNota ? (
                            <span className="flex items-start gap-1.5">
                              <StickyNote className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                              {msg.content_text?.replace('[Nota] ', '')}
                            </span>
                          ) : (
                            msg.content_text ?? `[${msg.content_type}]`
                          )}
                        </div>
                        <p
                          className={`text-xs text-gray-400 px-1 ${isInbound ? 'text-left' : 'text-right'}`}
                        >
                          {fmtDateTime(msg.sent_at)} · {isNota ? 'nota' : msg.sender_type}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>
            {conversation.status === 'open' && (
              <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                <div className="flex gap-2 items-end">
                  <textarea
                    className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[64px] max-h-[160px]"
                    placeholder="Escreva sua resposta..."
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleReply()
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={handleReply}
                    loading={savingReply}
                    disabled={!reply.trim()}
                  >
                    <Send className="h-3.5 w-3.5" /> Enviar
                  </Button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Ctrl+Enter para enviar</p>
              </div>
            )}
          </Card>
        </div>

        {/* AI Panels */}
        <div className="space-y-4">
          <ResumoIA conversationId={id} />
          <MemoriaRecente conversationId={id} />
          <MemoriasCliente customerId={conversation.customer_id} />
          <TimelineDecisoes conversationId={id} />
        </div>
      </div>

      {/* Nota modal */}
      <Modal open={notaModal} onClose={() => { setNotaModal(false); setNota('') }} title="Registrar nota">
        <div className="space-y-4">
          <Textarea
            label="Nota interna"
            rows={4}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Descreva observações sobre o atendimento..."
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setNotaModal(false); setNota('') }}>
              Cancelar
            </Button>
            <Button onClick={handleNota} loading={savingNota} disabled={!nota.trim()}>
              Salvar nota
            </Button>
          </div>
        </div>
      </Modal>

      {/* Encerrar confirmation modal */}
      <Modal open={encerrarModal} onClose={() => setEncerrarModal(false)} title="Encerrar conversa">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Tem certeza que deseja encerrar esta conversa com{' '}
            <strong>{conversation.customer_name ?? conversation.customer_phone}</strong>?
            O status será alterado para <strong>Resolvida</strong>.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEncerrarModal(false)}>
              <XCircle className="h-3.5 w-3.5" /> Cancelar
            </Button>
            <Button variant="danger" onClick={handleEncerrar} loading={savingEncerrar}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar encerramento
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
