'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { getConversationSummary } from '@/lib/api'
import { Clock, ChevronRight } from 'lucide-react'

interface RecentMsg { role: string; text: string }

export function MemoriaRecente({ conversationId }: { conversationId: string }) {
  const [msgs, setMsgs]     = useState<RecentMsg[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen]       = useState(false)

  useEffect(() => {
    getConversationSummary(conversationId)
      .then((s) => {
        const items = s?.open_items_jsonb
        if (Array.isArray(items)) setMsgs(items as RecentMsg[])
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [conversationId])

  return (
    <>
      <Card>
        <button
          className="w-full flex items-center justify-between"
          onClick={() => !loading && setOpen(true)}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Clock className="h-4 w-4 text-amber-500" />
            Memória Recente
            {!loading && msgs.length > 0 && (
              <span className="text-xs text-gray-400 font-normal">
                ({msgs.length} msgs)
              </span>
            )}
          </span>
          {loading
            ? <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-amber-400" />
            : <ChevronRight className="h-4 w-4 text-gray-400" />}
        </button>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Memória Recente" size="lg">
        {msgs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            Nenhuma mensagem recente registrada
          </p>
        ) : (
          <div className="space-y-3 py-1">
            {msgs.map((msg, i) => {
              const isCustomer = msg.role !== 'Sofia'
              return (
                <div key={i} className={`flex ${isCustomer ? 'justify-start' : 'justify-end'}`}>
                  <div className="max-w-[80%] space-y-0.5">
                    <p className={`text-[11px] font-semibold px-1 ${
                      isCustomer ? 'text-gray-500 text-left' : 'text-brand-500 text-right'
                    }`}>
                      {msg.role}
                    </p>
                    <div className={`px-3.5 py-2 rounded-2xl text-sm leading-snug ${
                      isCustomer
                        ? 'bg-gray-100 text-gray-800 rounded-tl-sm'
                        : 'bg-brand-600 text-white rounded-tr-sm'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Modal>
    </>
  )
}
