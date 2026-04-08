'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
}

const icons = {
  success: CheckCircle2,
  error:   XCircle,
  info:    AlertCircle,
}

const styles = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error:   'bg-red-50 border-red-200 text-red-800',
  info:    'bg-blue-50 border-blue-200 text-blue-800',
}

function ToastItem({
  toast,
  onRemove,
}: {
  toast: ToastMessage
  onRemove: (id: string) => void
}) {
  const Icon = icons[toast.type]

  useEffect(() => {
    const t = setTimeout(() => onRemove(toast.id), 4000)
    return () => clearTimeout(t)
  }, [toast.id, onRemove])

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-lg border shadow-md',
        'animate-in slide-in-from-right-4 duration-300',
        styles[toast.type],
      )}
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <span className="text-sm font-medium flex-1">{toast.message}</span>
      <button onClick={() => onRemove(toast.id)} className="opacity-60 hover:opacity-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// Global toast state (simple singleton without context)
let toastListeners: ((t: ToastMessage) => void)[] = []

export function toast(message: string, type: ToastType = 'success') {
  const id = Math.random().toString(36).slice(2)
  toastListeners.forEach((fn) => fn({ id, type, message }))
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    const handler = (t: ToastMessage) => setToasts((prev) => [...prev, t])
    toastListeners.push(handler)
    return () => {
      toastListeners = toastListeners.filter((fn) => fn !== handler)
    }
  }, [])

  const remove = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))

  if (!toasts.length) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={remove} />
      ))}
    </div>
  )
}
