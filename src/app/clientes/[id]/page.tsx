'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  getCustomer, getCustomerMemories, listConversations, listAppointments,
  updateCustomerTags, listCustomerTags, autoTagCustomers,
} from '@/lib/api'
import type { Customer, CustomerMemory, Conversation, Appointment } from '@/types'
import { fmtDateTime, fmtDate, memoryTypeVariants, statusVariants, timeAgo } from '@/lib/utils'
import {
  ArrowLeft, User, Phone, Mail, Brain, AlertCircle,
  MessageSquare, CalendarCheck, Tag, X, Plus, Sparkles,
} from 'lucide-react'
import { toast } from '@/components/ui/Toast'

const memoryTypeLabel: Record<string, string> = {
  profile:             'Perfil',
  preference:          'Preferência',
  objection:           'Objeção',
  clinical_interest:   'Interesse clínico',
  schedule_preference: 'Preferência de horário',
  relationship:        'Relacionamento',
}

const statusLabel: Record<string, string> = {
  open: 'Aberta', pending: 'Pendente', resolved: 'Resolvida',
  bot_active: 'Bot', waiting_human: 'Aguarda humano',
}

const aptStatusStyle: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  pending:   'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-brand-100 text-brand-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show:   'bg-gray-100 text-gray-600',
}
const aptStatusLabel: Record<string, string> = {
  confirmed: 'Confirmado', completed: 'Realizado', pending: 'Pendente',
  scheduled: 'Agendado',  cancelled: 'Cancelado',  no_show: 'Não compareceu',
}

const TAG_COLORS = [
  'bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700',
  'bg-green-100 text-green-700', 'bg-yellow-100 text-yellow-700',
  'bg-pink-100 text-pink-700', 'bg-orange-100 text-orange-700',
]
function tagColor(tag: string) {
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) & 0xffff
  return TAG_COLORS[h % TAG_COLORS.length]
}

// ─── Tag Editor ───────────────────────────────────────────────────────────────

function TagEditor({
  customerId,
  initialTags,
  onSaved,
}: {
  customerId: string
  initialTags: string[]
  onSaved: (tags: string[]) => void
}) {
  const [tags, setTags]             = useState<string[]>(initialTags)
  const [input, setInput]           = useState('')
  const [suggestions, setSugg]      = useState<string[]>([])
  const [allTags, setAllTags]       = useState<string[]>([])
  const [saving, setSaving]         = useState(false)
  const [autoTagging, setAutoTag]   = useState(false)
  const [dirty, setDirty]           = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listCustomerTags().then(setAllTags).catch(() => {})
  }, [])

  const filtered = allTags.filter(
    (t) => t.toLowerCase().includes(input.toLowerCase()) && !tags.includes(t)
  )

  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase().replace(/\s+/g, '-')
    if (!t || tags.includes(t)) return
    const next = [...tags, t]
    setTags(next)
    setInput('')
    setSugg([])
    setDirty(true)
  }

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag))
    setDirty(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      await updateCustomerTags(customerId, tags)
      setDirty(false)
      onSaved(tags)
      toast('Tags salvas')
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar tags', 'error')
    } finally {
      setSaving(false)
    }
  }

  const runAutoTag = async () => {
    setAutoTag(true)
    try {
      await autoTagCustomers()
      const updated = await import('@/lib/api').then((m) => m.getCustomer(customerId))
      if (updated?.tags) {
        setTags(updated.tags)
        onSaved(updated.tags)
        setDirty(false)
      }
      toast('Tags automáticas aplicadas')
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao aplicar auto-tags', 'error')
    } finally {
      setAutoTag(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Current tags */}
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {tags.length === 0 && (
          <span className="text-xs text-gray-400 italic">Nenhuma tag</span>
        )}
        {tags.map((tag) => (
          <span
            key={tag}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tagColor(tag)}`}
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>

      {/* Input */}
      <div className="relative">
        <div className="flex gap-1.5">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setSugg(filtered.slice(0, 6))
            }}
            onFocus={() => setSugg(filtered.slice(0, 6))}
            onBlur={() => setTimeout(() => setSugg([]), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); addTag(input) }
              if (e.key === 'Escape') setSugg([])
            }}
            placeholder="Nova tag..."
            className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={() => addTag(input)}
            disabled={!input.trim()}
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors"
          >
            <Plus className="h-3.5 w-3.5 text-gray-600" />
          </button>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="absolute left-0 right-8 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
            {suggestions.map((s) => (
              <button
                key={s}
                onMouseDown={() => addTag(s)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors"
              >
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${tagColor(s)}`}>
                  {s}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} loading={saving} disabled={!dirty}>
          Salvar tags
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={runAutoTag}
          loading={autoTagging}
        >
          <Sparkles className="h-3 w-3" /> Auto-tag
        </Button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClienteDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [memories, setMemories] = useState<CustomerMemory[]>([])
  const [convs, setConvs]       = useState<Conversation[]>([])
  const [apts, setApts]         = useState<Appointment[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.allSettled([
      getCustomer(id),
      getCustomerMemories(id),
      listConversations(undefined, id),
      listAppointments(undefined, undefined, id),
    ]).then(([c, m, cv, a]) => {
      if (c.status  === 'fulfilled') setCustomer(c.value)
      if (m.status  === 'fulfilled') setMemories(m.value)
      if (cv.status === 'fulfilled') setConvs(cv.value)
      if (a.status  === 'fulfilled') setApts(a.value)
    }).finally(() => setLoading(false))
  }, [id])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    )

  if (!customer)
    return (
      <div className="flex items-center gap-2 text-red-600 p-4 bg-red-50 rounded-lg">
        <AlertCircle className="h-5 w-5" />
        Cliente não encontrado
      </div>
    )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/clientes" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">{customer.name}</h1>
      </div>

      {/* Profile + Memories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Dados do cliente</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="text-gray-700">{customer.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="text-gray-700">{customer.phone}</span>
            </div>
            {customer.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="text-gray-700">{customer.email}</span>
              </div>
            )}

            {/* Tag editor */}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center gap-1.5 mb-2">
                <Tag className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-xs font-medium text-gray-600">Tags</span>
              </div>
              <TagEditor
                customerId={id}
                initialTags={customer.tags ?? []}
                onSaved={(tags) => setCustomer((c) => c ? { ...c, tags } : c)}
              />
            </div>

            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-400">Cliente desde {fmtDateTime(customer.created_at)}</p>
            </div>
          </div>
        </Card>

        {/* Memories */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-500" />
                Memórias da IA
              </span>
            </CardTitle>
            <span className="text-xs text-gray-400">{memories.length} registros</span>
          </CardHeader>
          {memories.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Nenhuma memória registrada para este cliente
            </p>
          ) : (
            <ul className="space-y-3">
              {memories.map((m) => (
                <li key={m.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${memoryTypeVariants[m.memory_type] ?? 'bg-gray-100 text-gray-700'}`}>
                        {memoryTypeLabel[m.memory_type] ?? m.memory_type}
                      </span>
                      <span className="text-xs text-gray-400">
                        relevância {Math.round(m.importance_score * 100)}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{m.content_text}</p>
                    {m.last_used_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        Último uso: {fmtDateTime(m.last_used_at)}
                      </p>
                    )}
                  </div>
                  <div
                    className="w-1.5 min-h-[24px] rounded-full mt-1 shrink-0"
                    style={{ background: `hsl(${m.importance_score * 120}, 60%, 55%)`, opacity: 0.7 }}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Conversations + Appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversations */}
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-500" />
                Conversas
              </span>
            </CardTitle>
            <span className="text-xs text-gray-400">{convs.length} registros</span>
          </CardHeader>
          {convs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Nenhuma conversa encontrada
            </p>
          ) : (
            <ul className="space-y-2">
              {convs.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/atendimento/${c.id}`}
                    className="flex items-start justify-between gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 truncate">
                        {c.last_message_text ?? c.last_message ?? '—'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{timeAgo(c.updated_at)}</p>
                    </div>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusVariants[c.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {statusLabel[c.status] ?? c.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Appointments */}
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-green-500" />
                Agendamentos
              </span>
            </CardTitle>
            <span className="text-xs text-gray-400">{apts.length} registros</span>
          </CardHeader>
          {apts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Nenhum agendamento encontrado
            </p>
          ) : (
            <ul className="space-y-2">
              {apts.map((a) => {
                const dateStr = a.scheduled_start_at ?? a.scheduled_at
                return (
                  <li key={a.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-gray-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {a.service_name ?? '—'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {a.professional_name}{dateStr ? ` · ${fmtDate(dateStr)}` : ''}
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${aptStatusStyle[a.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {aptStatusLabel[a.status] ?? a.status}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
