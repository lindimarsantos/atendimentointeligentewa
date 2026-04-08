import { clsx, type ClassValue } from 'clsx'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function fmtDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  } catch {
    return dateStr
  }
}

export function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR })
  } catch {
    return dateStr
  }
}

export function fmtTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'HH:mm', { locale: ptBR })
  } catch {
    return dateStr
  }
}

export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true, locale: ptBR })
  } catch {
    return dateStr
  }
}

export function fmtSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}min`
}

export const statusVariants: Record<string, string> = {
  open:          'bg-blue-100 text-blue-800',
  pending:       'bg-yellow-100 text-yellow-800',
  resolved:      'bg-green-100 text-green-800',
  bot_active:    'bg-purple-100 text-purple-800',
  waiting_human: 'bg-orange-100 text-orange-800',
}

export const decisionVariants: Record<string, string> = {
  reply:               'bg-blue-100 text-blue-700',
  handoff:             'bg-red-100 text-red-700',
  schedule:            'bg-green-100 text-green-700',
  recommend_service:   'bg-purple-100 text-purple-700',
  request_more_data:   'bg-yellow-100 text-yellow-700',
  block:               'bg-gray-100 text-gray-700',
}

export const memoryTypeVariants: Record<string, string> = {
  profile:             'bg-blue-100 text-blue-700',
  preference:          'bg-green-100 text-green-700',
  objection:           'bg-red-100 text-red-700',
  clinical_interest:   'bg-purple-100 text-purple-700',
  schedule_preference: 'bg-yellow-100 text-yellow-700',
  relationship:        'bg-pink-100 text-pink-700',
}

export const auditActionVariants: Record<string, string> = {
  insert:   'bg-green-100 text-green-700',
  update:   'bg-blue-100 text-blue-700',
  delete:   'bg-red-100 text-red-700',
  sync:     'bg-purple-100 text-purple-700',
  decision: 'bg-yellow-100 text-yellow-700',
  handoff:  'bg-orange-100 text-orange-700',
  login:    'bg-gray-100 text-gray-700',
}
