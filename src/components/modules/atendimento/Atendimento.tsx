'use client'
import React from 'react'

import { useEffect, useState, useCallback } from 'react'
import {
  listConversations, getMessages,
  assumirConversa, registrarNota, encerrarConversa,
  criarAgendamentoDashboard, listAppointments,
  listProfessionals, listServices,
} from '@/lib/api'
import type { Conversation, Message, Appointment, Professional, Service } from '@/types'
import {
  Card, CardHeader, Button, Avatar, LoadingRow, EmptyState,
  Table, Th, Td, Tr, ActionPanel, Textarea, Input, Select,
  Toast, type ToastMsg,
} from '@/components/ui'
import { Badge } from '@/components/ui/Badge'
import { convStatusVariant, aptStatusVariant, fmtDateTime, timeAgo, toDatetimeLocal } from '@/lib/utils'
import { CURRENT_USER } from '@/lib/auth'
import { UserCheck, StickyNote, Calendar, XCircle, ArrowLeft } from 'lucide-react'

type Panel = 'assumir' | 'nota' | 'agendamento' | 'encerrar' | null

export function Atendimento({ refreshKey }: { refreshKey: number }) {
  const [convs,   setConvs]   = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('')
  const [current, setCurrent] = useState<Conversation | null>(null)
  const [toast,   setToast]   = useState<ToastMsg>(null)

  const showToast = useCallback((text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 3200)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listConversations(filter || undefined)
      setConvs(data)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load, refreshKey])

  const filtered = filter ? convs.filter(c => c.status === filter) : convs

  if (current) {
    return (
      <ConversationDetail
        conv={current}
        onBack={() => { setCurrent(null); load() }}
        showToast={showToast}
      />
    )
  }

  return (
    <div className="space-y-4 animate-in">
      <Toast msg={toast} />

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs border border-[var(--color-border-md)] rounded-lg bg-[var(--color-surface)] text-[var(--color-text)]"
        >
          <option value="">Todos os status</option>
          <option value="bot_active">bot_active</option>
          <option value="open">open</option>
          <option value="waiting_human">waiting_human</option>
          <option value="resolved">resolved</option>
          <option value="pending">pending</option>
        </select>
        <span className="text-xs text-[var(--color-text-2)]">
          {filtered.length} conversa{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <Card padding={false}>
        <div className="p-4 pb-2">
          <CardHeader title="Conversas" />
        </div>
        {loading ? <LoadingRow text="Buscando conversas..." /> : filtered.length === 0 ? (
          <EmptyState text="Nenhuma conversa encontrada" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th>Status</Th>
                <Th>Última mensagem</Th>
                <Th>Msgs</Th>
                <Th>Atualizado</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <Tr key={c.id} onClick={() => setCurrent(c)}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Avatar name={c.customer_name} />
                      <div>
                        <p className="font-medium text-xs">{c.customer_name}</p>
                        <p className="text-[10px] text-[var(--color-text-2)] font-mono">{c.customer_phone}</p>
                      </div>
                    </div>
                  </Td>
                  <Td><Badge label={c.status} variant={convStatusVariant(c.status)} /></Td>
                  <Td className="max-w-[200px]">
                    <p className="truncate text-[11px] text-[var(--color-text-2)]">
                      {c.last_message_text || '—'}
                    </p>
                  </Td>
                  <Td><span className="font-medium">{c.msg_count}</span></Td>
                  <Td className="text-[11px] text-[var(--color-text-2)]">{timeAgo(c.updated_at)}</Td>
                  <Td>
                    <Button size="sm" variant="ghost" onClick={() => setCurrent(c)}>
                      Abrir →
                    </Button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}

// ─── Detalhe da conversa ─────────────────────────────────────────────────────

function ConversationDetail({
  conv,
  onBack,
  showToast,
}: {
  conv: Conversation
  onBack: () => void
  showToast: (t: string, type?: 'ok' | 'err') => void
}) {
  const [msgs,    setMsgs]    = useState<Message[]>([])
  const [apts,    setApts]    = useState<Appointment[]>([])
  const [profs,   setProfs]   = useState<Professional[]>([])
  const [servs,   setServs]   = useState<Service[]>([])
  const [current, setCurrent] = useState(conv)
  const [panel,   setPanel]   = useState<Panel>(null)
  const [loading, setLoading] = useState(true)

  // Form state
  const [notaText,   setNotaText]   = useState('')
  const [motivo,     setMotivo]     = useState('')
  const [aptProf,    setAptProf]    = useState('')
  const [aptServ,    setAptServ]    = useState('')
  const [aptStart,   setAptStart]   = useState('')
  const [aptEnd,     setAptEnd]     = useState('')
  const [aptNotes,   setAptNotes]   = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadMsgs = useCallback(async () => {
    const m = await getMessages(current.id)
    setMsgs(m)
  }, [current.id])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getMessages(current.id),
      listAppointments(),
      listProfessionals(),
      listServices(),
    ]).then(([m, a, p, s]) => {
      setMsgs(m)
      setApts(a.filter(x => x.customer_id === current.customer_id))
      setProfs(p)
      setServs(s)
      // default start datetime
      const now = new Date(); now.setMinutes(0, 0, 0); now.setHours(now.getHours() + 1)
      setAptStart(toDatetimeLocal(now))
      const end = new Date(now); end.setMinutes(30)
      setAptEnd(toDatetimeLocal(end))
    }).finally(() => setLoading(false))
  }, [current.id, current.customer_id])

  // auto-fill end when service changes
  const handleServChange = (sid: string) => {
    setAptServ(sid)
    const s = servs.find(x => x.id === sid)
    if (s?.duration_minutes && aptStart) {
      const st = new Date(aptStart)
      if (!isNaN(st.getTime())) {
        const en = new Date(st.getTime() + s.duration_minutes * 60000)
        setAptEnd(toDatetimeLocal(en))
      }
    }
  }

  const togglePanel = (p: Panel) => setPanel(prev => prev === p ? null : p)

  // ─── Actions ───────────────────────────────────────────────────────────────

  const doAssumir = async () => {
    setSubmitting(true)
    try {
      const res = await assumirConversa(current.id, CURRENT_USER.id, CURRENT_USER.name)
      if (!res.ok) { showToast(res.error as string, 'err'); return }
      showToast('Conversa assumida!')
      setCurrent({ ...current, status: 'open' })
      setPanel(null)
      loadMsgs()
    } catch { showToast('Erro inesperado', 'err') }
    finally { setSubmitting(false) }
  }

  const doNota = async () => {
    if (!notaText.trim()) { showToast('Digite a nota', 'err'); return }
    setSubmitting(true)
    try {
      const res = await registrarNota(current.id, CURRENT_USER.id, CURRENT_USER.name, notaText)
      if (!res.ok) { showToast(res.error as string, 'err'); return }
      showToast('Nota registrada!')
      setNotaText('')
      setPanel(null)
      loadMsgs()
    } catch { showToast('Erro inesperado', 'err') }
    finally { setSubmitting(false) }
  }

  const doEncerrar = async () => {
    setSubmitting(true)
    try {
      const res = await encerrarConversa(current.id, CURRENT_USER.id, CURRENT_USER.name, motivo || undefined)
      if (!res.ok) { showToast(res.error as string, 'err'); return }
      showToast('Conversa encerrada.')
      setCurrent({ ...current, status: 'resolved' })
      setPanel(null)
      loadMsgs()
    } catch { showToast('Erro inesperado', 'err') }
    finally { setSubmitting(false) }
  }

  const doAgendamento = async () => {
    if (!aptProf || !aptServ || !aptStart || !aptEnd) {
      showToast('Preencha todos os campos', 'err'); return
    }
    if (new Date(aptStart) >= new Date(aptEnd)) {
      showToast('Horário de início deve ser antes do fim', 'err'); return
    }
    setSubmitting(true)
    try {
      const res = await criarAgendamentoDashboard({
        customerId:     current.customer_id,
        professionalId: aptProf,
        serviceId:      aptServ,
        startAt:        new Date(aptStart).toISOString(),
        endAt:          new Date(aptEnd).toISOString(),
        userId:         CURRENT_USER.id,
        userName:       CURRENT_USER.name,
        conversationId: current.id,
        notes:          aptNotes || undefined,
      })
      if (!res.ok) { showToast(res.error as string, 'err'); return }
      showToast('Agendamento criado!')
      setPanel(null)
      loadMsgs()
      const newApts = await listAppointments()
      setApts(newApts.filter(x => x.customer_id === current.customer_id))
    } catch (e: unknown) {
      showToast('Erro: ' + (e instanceof Error ? e.message : 'desconhecido'), 'err')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="space-y-4 animate-in">
      {/* Voltar */}
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft size={12} /> Voltar à lista
      </Button>

      {/* Header do cliente */}
      <Card>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Avatar name={current.customer_name} size="lg" />
          <div className="flex-1">
            <p className="text-sm font-medium">{current.customer_name}</p>
            <p className="text-xs text-[var(--color-text-2)] mt-0.5">
              {current.customer_phone} · Iniciada {fmtDateTime(current.started_at)} · {current.msg_count} msgs
            </p>
          </div>
          <Badge label={current.status} variant={convStatusVariant(current.status)} />
        </div>

        {/* Ações */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="primary" size="sm" onClick={() => togglePanel('assumir')} disabled={current.status === 'resolved'}>
            <UserCheck size={12} /> Assumir
          </Button>
          <Button variant="secondary" size="sm" onClick={() => togglePanel('nota')}>
            <StickyNote size={12} /> Registrar nota
          </Button>
          <Button variant="success" size="sm" onClick={() => togglePanel('agendamento')}>
            <Calendar size={12} /> Criar agendamento
          </Button>
          <Button variant="danger" size="sm" onClick={() => togglePanel('encerrar')} disabled={current.status === 'resolved'}>
            <XCircle size={12} /> Encerrar
          </Button>
        </div>

        {/* Painel — Assumir */}
        <ActionPanel open={panel === 'assumir'} title="Assumir atendimento">
          <p className="text-xs text-[var(--color-text-2)] mb-3">
            A conversa mudará para <strong>open</strong> e será atribuída a você. Handoffs pendentes serão fechados.
          </p>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setPanel(null)}>Cancelar</Button>
            <Button size="sm" variant="primary" loading={submitting} onClick={doAssumir}>Confirmar</Button>
          </div>
        </ActionPanel>

        {/* Painel — Nota */}
        <ActionPanel open={panel === 'nota'} title="Registrar nota interna">
          <Textarea
            placeholder="Conteúdo da nota interna..."
            value={notaText}
            onChange={e => setNotaText(e.target.value)}
            className="mb-2"
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setPanel(null)}>Cancelar</Button>
            <Button size="sm" variant="primary" loading={submitting} onClick={doNota}>Salvar nota</Button>
          </div>
        </ActionPanel>

        {/* Painel — Agendamento */}
        <ActionPanel open={panel === 'agendamento'} title="Criar agendamento para este cliente">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <p className="text-[10px] text-[var(--color-text-2)] mb-1 font-medium">Profissional</p>
              <Select value={aptProf} onChange={e => setAptProf(e.target.value)}>
                <option value="">Selecione...</option>
                {profs.map(p => (
                  <option key={p.id} value={p.id}>{p.name}{p.specialty ? ` · ${p.specialty}` : ''}</option>
                ))}
              </Select>
            </div>
            <div>
              <p className="text-[10px] text-[var(--color-text-2)] mb-1 font-medium">Serviço</p>
              <Select value={aptServ} onChange={e => handleServChange(e.target.value)}>
                <option value="">Selecione...</option>
                {servs.map(s => (
                  <option key={s.id} value={s.id}>{s.name}{s.duration_minutes ? ` (${s.duration_minutes}min)` : ''}</option>
                ))}
              </Select>
            </div>
            <div>
              <p className="text-[10px] text-[var(--color-text-2)] mb-1 font-medium">Início</p>
              <Input type="datetime-local" value={aptStart} onChange={e => setAptStart(e.target.value)} />
            </div>
            <div>
              <p className="text-[10px] text-[var(--color-text-2)] mb-1 font-medium">Fim</p>
              <Input type="datetime-local" value={aptEnd} onChange={e => setAptEnd(e.target.value)} />
            </div>
          </div>
          <p className="text-[10px] text-[var(--color-text-2)] mb-1 font-medium">Observações (opcional)</p>
          <Input placeholder="Ex: Trazer exames" value={aptNotes} onChange={e => setAptNotes(e.target.value)} className="mb-2" />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setPanel(null)}>Cancelar</Button>
            <Button size="sm" variant="success" loading={submitting} onClick={doAgendamento}>Criar agendamento</Button>
          </div>
        </ActionPanel>

        {/* Painel — Encerrar */}
        <ActionPanel open={panel === 'encerrar'} title="Encerrar conversa">
          <p className="text-xs text-[var(--color-text-2)] mb-2">A conversa mudará para <strong>resolved</strong>. Ação auditável.</p>
          <Input placeholder="Motivo (opcional)" value={motivo} onChange={e => setMotivo(e.target.value)} className="mb-2" />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setPanel(null)}>Cancelar</Button>
            <Button size="sm" variant="danger" loading={submitting} onClick={doEncerrar}>Confirmar encerramento</Button>
          </div>
        </ActionPanel>
      </Card>

      {/* Mensagens + info */}
      <div className="grid grid-cols-2 gap-4">
        {/* Histórico */}
        <Card>
          <CardHeader title="Histórico de mensagens" subtitle={`${msgs.length} mensagens`} />
          {loading ? <LoadingRow /> : (
            <div className="h-80 overflow-y-auto space-y-2 pr-1">
              {msgs.length === 0 ? <EmptyState text="Sem mensagens" /> : msgs.map(m => (
                <MessageBubble key={m.id} msg={m} />
              ))}
            </div>
          )}
        </Card>

        {/* Info lateral */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Dados do cliente" />
            <dl className="space-y-2 text-xs">
              <Row label="Nome"      value={current.customer_name} />
              <Row label="Telefone"  value={<span className="font-mono">{current.customer_phone || '—'}</span>} />
              <Row label="Status"    value={<Badge label={current.status} variant={convStatusVariant(current.status)} />} />
              <Row label="Iniciada"  value={fmtDateTime(current.started_at)} />
              <Row label="Atualizada" value={timeAgo(current.updated_at)} />
            </dl>
          </Card>

          <Card>
            <CardHeader title="Agendamentos do cliente" />
            {loading ? <LoadingRow /> : apts.length === 0 ? (
              <EmptyState text="Nenhum agendamento" />
            ) : (
              <div className="space-y-2">
                {apts.map(a => (
                  <div key={a.id} className="pb-2 border-b border-[var(--color-border)] last:border-0">
                    <p className="text-xs font-medium">{fmtDateTime(a.scheduled_start_at)}</p>
                    <p className="text-[10px] text-[var(--color-text-2)] mt-0.5">
                      {a.service_name} · {a.professional_name}
                    </p>
                    <div className="mt-1">
                      <Badge label={a.status} variant={aptStatusVariant(a.status)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ msg }: { msg: Message }) {
  const isOut = msg.direction === 'outbound'
  const isInt = msg.direction === 'internal'
  const senderLabel: Record<string, string> = {
    customer: 'cliente', bot: 'bot', agent: 'agente', system: 'sistema',
  }

  if (isInt) {
    return (
      <div className="flex justify-center">
        <div className="bg-[var(--color-purple-bg)] text-[var(--color-purple-fg)] text-[10px] px-3 py-1.5 rounded-full italic max-w-[85%] text-center">
          {msg.content_text || '—'}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col ${isOut ? 'items-end' : 'items-start'}`}>
      <p className="text-[10px] text-[var(--color-text-3)] mb-0.5">
        {senderLabel[msg.sender_type] ?? msg.sender_type} · {fmtDateTime(msg.created_at)}
      </p>
      <div className={`rounded-xl px-3 py-2 text-xs max-w-[80%] leading-relaxed ${
        isOut
          ? 'bg-[var(--color-info-bg)] text-[var(--color-info-fg)]'
          : 'bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-border)]'
      }`}>
        {msg.content_text || <em className="opacity-40">sem texto</em>}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-[var(--color-text-2)]">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}
