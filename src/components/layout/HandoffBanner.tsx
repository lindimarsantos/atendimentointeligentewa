'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X, ChevronRight } from 'lucide-react'
import { listHandoffQueue } from '@/lib/api'
import type { HandoffEntry } from '@/types'

const POLL_INTERVAL = 30_000

export function HandoffBanner() {
  const router = useRouter()
  const [pending, setPending]   = useState<HandoffEntry[]>([])
  const [visible, setVisible]   = useState(false)
  const seenIds                 = useRef<Set<string>>(new Set())

  const fetchQueue = useCallback(async () => {
    try {
      const items = await listHandoffQueue('pending')
      setPending(items)

      const fresh = items.filter((i) => !seenIds.current.has(i.id))
      if (fresh.length > 0) {
        fresh.forEach((i) => seenIds.current.add(i.id))
        setVisible(true)
      }

      // Hide banner automatically if queue is now empty
      if (items.length === 0) setVisible(false)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchQueue()
    const id = setInterval(fetchQueue, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [fetchQueue])

  if (!visible || pending.length === 0) return null

  const first = pending[0]
  const extra = pending.length - 1

  return (
    <div className="fixed top-0 left-60 right-0 z-40 flex items-center gap-3 px-5 py-2.5 bg-amber-50 border-b border-amber-200 shadow-sm animate-in slide-in-from-top-2 duration-300">
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 shrink-0">
        <Bell className="h-3.5 w-3.5 text-white" />
      </span>

      <p className="flex-1 text-sm text-amber-900">
        <span className="font-semibold">
          {pending.length === 1
            ? `${first.customer_name ?? 'Cliente'} aguarda atendimento humano`
            : `${first.customer_name ?? 'Cliente'} e mais ${extra} ${extra === 1 ? 'cliente aguardam' : 'clientes aguardam'} atendimento humano`}
        </span>
        {first.last_message && (
          <span className="ml-2 text-amber-700 font-normal truncate max-w-xs inline-block align-bottom">
            &ldquo;{first.last_message}&rdquo;
          </span>
        )}
      </p>

      <button
        onClick={() => {
          setVisible(false)
          router.push(
            pending.length === 1
              ? `/atendimento/${first.conversation_id}`
              : '/atendimento',
          )
        }}
        className="flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-200 hover:bg-amber-300 px-3 py-1.5 rounded-lg transition-colors shrink-0"
      >
        {pending.length === 1 ? 'Responder' : 'Ver todos'}
        <ChevronRight className="h-3.5 w-3.5" />
      </button>

      <button
        onClick={() => setVisible(false)}
        className="text-amber-500 hover:text-amber-700 transition-colors shrink-0"
        title="Dispensar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
