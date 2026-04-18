'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, UserCheck, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { listHandoffQueue } from '@/lib/api'
import type { HandoffEntry } from '@/types'

const POLL_INTERVAL = 30_000 // 30 s

export function HandoffAlertBell() {
  const router     = useRouter()
  const [pending, setPending]         = useState<HandoffEntry[]>([])
  const [popupOpen, setPopupOpen]     = useState(false)
  const [newAlerts, setNewAlerts]     = useState<HandoffEntry[]>([])
  const seenIds                       = useRef<Set<string>>(new Set())
  const popupRef                      = useRef<HTMLDivElement>(null)

  const fetchQueue = useCallback(async () => {
    try {
      const items = await listHandoffQueue('pending')
      setPending(items)

      const fresh = items.filter((i) => !seenIds.current.has(i.id))
      if (fresh.length > 0) {
        fresh.forEach((i) => seenIds.current.add(i.id))
        setNewAlerts(fresh)
      }
    } catch {
      // silent — don't disrupt UI if polling fails
    }
  }, [])

  useEffect(() => {
    fetchQueue()
    const id = setInterval(fetchQueue, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [fetchQueue])

  // Close popup on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopupOpen(false)
      }
    }
    if (popupOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [popupOpen])

  const count     = pending.length
  const hasNew    = newAlerts.length > 0

  function handleBellClick() {
    setPopupOpen((o) => !o)
    setNewAlerts([])
  }

  function goToConversation(convId: string) {
    setPopupOpen(false)
    router.push(`/atendimento/${convId}`)
  }

  return (
    <div className="relative" ref={popupRef}>
      <button
        onClick={handleBellClick}
        className={cn(
          'relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
          count > 0
            ? 'text-amber-600 hover:bg-amber-50'
            : 'text-gray-400 hover:bg-gray-100',
        )}
        title="Fila de handoff"
      >
        <Bell className={cn('h-4 w-4', hasNew && 'animate-bounce')} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {popupOpen && (
        <div className="absolute left-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-amber-50">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-800">
                Aguardando Atendimento
              </span>
            </div>
            <button
              onClick={() => setPopupOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {pending.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">
              Nenhum cliente aguardando
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y divide-gray-50">
              {pending.map((entry) => (
                <li key={entry.id}>
                  <button
                    onClick={() => goToConversation(entry.conversation_id)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {entry.customer_name ?? 'Desconhecido'}
                        </p>
                        {entry.reason_text && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {entry.reason_text}
                          </p>
                        )}
                        {entry.last_message && (
                          <p className="text-xs text-gray-400 truncate mt-0.5 italic">
                            &quot;{entry.last_message}&quot;
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 shrink-0 mt-0.5">
                        {formatTime(entry.created_at)}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
            <button
              onClick={() => {
                setPopupOpen(false)
                router.push('/atendimento')
              }}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              Ver todos na aba &quot;Aguarda Humano&quot; →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin}m`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
