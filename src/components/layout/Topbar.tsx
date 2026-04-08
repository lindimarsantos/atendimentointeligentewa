'use client'

import { RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'

interface TopbarProps {
  title: string
  connected: boolean
  lastSync: string | null
  onRefresh: () => void
  refreshing?: boolean
}

export function Topbar({ title, connected, lastSync, onRefresh, refreshing }: TopbarProps) {
  return (
    <header
      style={{ height: 'var(--topbar-height)' }}
      className="flex-shrink-0 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center px-5 gap-3"
    >
      <h1 className="text-sm font-medium flex-1">{title}</h1>

      {/* Status de conexão */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 border border-[var(--color-border)] rounded-lg text-[11px] text-[var(--color-text-2)]">
        <span
          className={clsx(
            'w-1.5 h-1.5 rounded-full flex-shrink-0',
            connected ? 'bg-[var(--color-success-fg)]' : 'bg-[var(--color-danger-fg)]',
          )}
        />
        {connected
          ? lastSync ? `Sincronizado ${lastSync}` : 'Conectado'
          : 'Desconectado'}
      </div>

      {/* Refresh */}
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="flex items-center gap-1.5 px-2.5 py-1 border border-[var(--color-border)] rounded-lg text-[11px] text-[var(--color-text-2)] hover:bg-[var(--color-surface-2)] disabled:opacity-40 transition-all"
      >
        <RefreshCw size={11} className={refreshing ? 'spin' : ''} />
        Atualizar
      </button>
    </header>
  )
}
