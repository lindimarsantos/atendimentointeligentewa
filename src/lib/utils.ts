import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { ConversationStatus, AppointmentStatus, JobStatus, CustomerStatus } from '@/types'

// ─── Data/hora ────────────────────────────────────────────────────────────────

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—'
  return format(new Date(d), 'dd/MM/yyyy HH:mm', { locale: ptBR })
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return format(new Date(d), 'dd/MM/yyyy', { locale: ptBR })
}

export function timeAgo(d: string | null | undefined): string {
  if (!d) return '—'
  return formatDistanceToNow(new Date(d), { locale: ptBR, addSuffix: true })
}

export function toDatetimeLocal(d: Date): string {
  return d.toISOString().slice(0, 16)
}

// ─── Iniciais ─────────────────────────────────────────────────────────────────

export function initials(name: string | null | undefined): string {
  if (!name || name === 'Desconhecido') return '??'
  return name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// ─── Badges / labels ──────────────────────────────────────────────────────────

type BadgeVariant = 'bot' | 'open' | 'human' | 'success' | 'muted' | 'purple'

export function convStatusVariant(s: ConversationStatus): BadgeVariant {
  const map: Record<ConversationStatus, BadgeVariant> = {
    bot_active:    'bot',
    open:          'open',
    waiting_human: 'human',
    resolved:      'success',
    pending:       'muted',
  }
  return map[s] ?? 'muted'
}

export function aptStatusVariant(s: AppointmentStatus): BadgeVariant {
  const map: Record<AppointmentStatus, BadgeVariant> = {
    confirmed:   'success',
    completed:   'success',
    pending:     'bot',
    cancelled:   'muted',
    no_show:     'human',
    rescheduled: 'purple',
  }
  return map[s] ?? 'muted'
}

export function jobStatusVariant(s: JobStatus): BadgeVariant {
  const map: Record<JobStatus, BadgeVariant> = {
    completed:  'success',
    pending:    'bot',
    processing: 'open',
    failed:     'human',
    cancelled:  'muted',
  }
  return map[s] ?? 'muted'
}

export function custStatusVariant(s: CustomerStatus): BadgeVariant {
  const map: Record<CustomerStatus, BadgeVariant> = {
    active:   'success',
    prospect: 'open',
    lead:     'muted',
    inactive: 'muted',
  }
  return map[s] ?? 'muted'
}

// ─── Moeda ────────────────────────────────────────────────────────────────────

export function fmtBRL(v: number | null | undefined): string {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
